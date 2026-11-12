"""Explicit, checkpointed LangGraph flow around the existing RAG functions."""

from __future__ import annotations

from typing import Literal, TypedDict
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from data.pipelines.rag import (
    NO_CONTEXT_ANSWER,
    classify_memory_decision,
    generate_answer,
    generate_structured_answer,
    retrieve,
)
from database import engine as memory_engine
from .memory_contract import (
    DecisionLabel,
    MemoryCategory,
    MemoryDecision,
    MemoryDecisionClassification,
    MemoryProposal,
    MemoryScope,
    MIN_DECISION_CONFIDENCE,
)
from .memory_repository import (
    MemoryStoreUnavailable,
    create_proposal_if_configured,
    get_pending_proposal_if_configured,
    render_memory_context,
    resolve_proposal_if_configured,
    retrieve_memory_if_configured,
)
from .guardrails import (
    InputDecision,
    OUTPUT_BLOCK_MESSAGE,
    assess_input,
    redirect_for_input,
    is_small_talk,
    redirect_for_small_talk,
    emit_guardrail_event,
    is_supported_general_question,
    respond_to_general_question,
    sanitize_evidence,
    sanitize_untrusted_text,
    validate_answer,
)
from .tools import (
    IncidentToolResult,
    InventoryToolResult,
    search_incidents_tool,
    search_inventory_tool,
)


class GraphCompilationError(RuntimeError):
    """Raised when the agent graph cannot be structurally compiled."""


class AgentState(TypedDict, total=False):
    """Small state passed between the agent's explicit steps."""

    question: str
    evidence: list[dict[str, object]]
    answer: str
    sources: list[dict[str, str]]
    status: Literal["answered", "fallback"]
    trace: list[str]
    owner_id: str
    thread_id: str
    memory_context: str
    route: Literal["rag", "incidents", "inventory", "operational", "blocked"]
    guardrail_reason: str


def receive(state: AgentState) -> AgentState:
    question = state.get("question", "").strip()
    decision = assess_input(question)
    intent = "blocked" if decision.blocked else _classify_question(question)
    return {
        "question": question,
        "owner_id": state.get("owner_id", ""),
        "thread_id": state.get("thread_id", ""),
        "route": intent,
        "guardrail_reason": decision.reason or "",
        "trace": [*state.get("trace", []), "receive"],
    }


_INCIDENT_TERMS = (
    "incidencia", "incidente", "ticket", "escalamiento", "escalada",
    "sla vencido", "sla incumplido", "sla breach", "problema reportado",
)
_INVENTORY_TERMS = (
    "inventario", "stock", "existencias", "articulo", "articulos",
    "producto", "productos", "material", "unidades disponibles",
)
_INCIDENT_STATUS_ALIASES: dict[str, tuple[str, ...]] = {
    "open": ("abierta", "abiertas", "abierto", "abiertos", "open", "pendiente", "pendientes"),
    "assigned": ("asignada", "asignadas", "asignado", "asignados", "assigned"),
    "in_progress": ("en curso", "en progreso", "in progress", "in_progress"),
    "resolved": ("resuelta", "resueltas", "resuelto", "resueltos", "resolved"),
    "closed": ("cerrada", "cerradas", "cerrado", "cerrados", "closed"),
    "reopened": ("reabierta", "reabiertas", "reabierto", "reabiertos", "reopened"),
}


def _contains_term(question: str, terms: tuple[str, ...]) -> bool:
    normalized = question.casefold().translate(str.maketrans("áéíóúüñ", "aeiouun"))
    normalized = " ".join(normalized.split())
    return any(term in normalized for term in terms)


def _classify_question(question: str) -> Literal[
    "rag", "incidents", "inventory", "operational"
]:
    has_incidents = _contains_term(question, _INCIDENT_TERMS)
    has_inventory = _contains_term(question, _INVENTORY_TERMS)
    if has_incidents and has_inventory:
        return "operational"
    if has_incidents:
        return "incidents"
    if has_inventory:
        return "inventory"
    return "rag"


def _incident_status(question: str) -> Literal[
    "open", "assigned", "in_progress", "resolved", "closed", "reopened"
] | None:
    normalized = question.casefold().translate(str.maketrans("áéíóúüñ", "aeiouun"))
    normalized = f" { ' '.join(normalized.split()) } "
    for status, aliases in _INCIDENT_STATUS_ALIASES.items():
        if any(f" {alias} " in normalized for alias in aliases):
            return status
    return None


def route_question(
    state: AgentState,
) -> Literal["retrieve", "operational_tools", "fallback", "input_guardrail"]:
    if state.get("route") == "blocked":
        return "input_guardrail"
    if not state.get("question"):
        return "fallback"
    if state.get("route") in {"incidents", "inventory", "operational"}:
        return "operational_tools"
    return "retrieve"


def retrieve_evidence(state: AgentState) -> AgentState:
    evidence = sanitize_evidence(retrieve(state["question"]))
    memory_context = ""
    try:
        memories = retrieve_memory_if_configured(
            owner_id=state.get("owner_id", ""),
            engine=memory_engine,
            categories=[MemoryCategory.RESPONSE_PREFERENCE],
        )
        memory_context = render_memory_context(memories)
    except MemoryStoreUnavailable:
        # Approved memories are optional; preserve the normal SDR path if the
        # dedicated memory store is unavailable.
        pass
    return {
        "evidence": evidence,
        "memory_context": memory_context,
        "trace": [*state.get("trace", []), "retrieve"],
    }


def route_evidence(state: AgentState) -> Literal["generate", "fallback"]:
    return "generate" if state.get("evidence") else "fallback"


def generate(state: AgentState) -> AgentState:
    evidence = state["evidence"]
    answer: str
    try:
        structured = generate_structured_answer(
            state["question"], evidence, memory_context=state.get("memory_context", "")
        )
    except (AttributeError, NotImplementedError):
        # Preserve compatibility with older generation clients and test doubles.
        structured = None
    if structured is None:
        answer = generate_answer(
            state["question"], evidence, memory_context=state.get("memory_context", "")
        )
    else:
        answer = structured.answer.strip()
        candidate = structured.memory_proposal
        if candidate is not None:
            try:
                proposal = MemoryProposal.model_validate(candidate.model_dump())
                if proposal.category is not MemoryCategory.RESPONSE_PREFERENCE:
                    raise ValueError("unsupported memory category")
                if proposal.scope is not MemoryScope.USER:
                    raise ValueError("unsupported memory scope")
                record = create_proposal_if_configured(
                    owner_id=state.get("owner_id", ""),
                    thread_id=state.get("thread_id", ""),
                    proposal=proposal,
                    engine=memory_engine,
                )
            except (ValueError, MemoryStoreUnavailable):
                # Never claim that consent is pending unless a safe proposal was
                # actually stored in the isolated durable memory repository.
                record = None
            if record is not None:
                answer += (
                    "\n\n¿Quieres que recuerde esta preferencia general para tus "
                    "respuestas futuras? Responde sí para aprobar, no para rechazar, "
                    "o indica cómo cambiarla."
                )
    if not validate_answer(answer):
        answer = OUTPUT_BLOCK_MESSAGE
    # Proposal generation is optional; approval is handled on a later message
    # against the exact owner/thread/proposal triple, never in this same turn.
    unique_sources: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in evidence:
        document = str(item.get("source_document", "unknown"))
        section = str(item.get("section", "General"))
        if (document, section) not in seen:
            seen.add((document, section))
            unique_sources.append({"document": document, "section": section})
    return {
        "answer": answer,
        "sources": unique_sources,
        "status": "answered",
        "trace": [*state.get("trace", []), "generate"],
    }


def _render_incidents(result: IncidentToolResult) -> str:
    if result.status != "ok" or not result.items:
        return result.message
    lines = [result.message]
    for incident in result.items:
        client = f"; cliente: {incident.client_name}" if incident.client_name else ""
        assignee = f"; asignada a: {incident.assigned_to}" if incident.assigned_to else ""
        deadline = (
            f"; vencimiento SLA: {incident.sla_deadline.isoformat()}"
            if incident.sla_deadline
            else ""
        )
        lines.append(
            f"- {incident.id}: {incident.title[:200]} (estado: {incident.status}; "
            f"severidad: {incident.severity}; área: {incident.responsible_area}"
            f"{client}{assignee}{deadline})."
        )
    return sanitize_untrusted_text("\n".join(lines))


def _render_inventory(result: InventoryToolResult) -> str:
    if result.status != "ok" or not result.items:
        return result.message
    lines = [result.message]
    for item in result.items:
        sku = f"; SKU: {item.sku}" if item.sku else ""
        alert = "; bajo el punto de reposición" if item.reorder_alert else ""
        lines.append(
            f"- {item.name[:200]}{sku} (oficina: {item.office}; categoría: "
            f"{item.category}; stock actual: {item.current_stock} {item.unit_of_measure}; "
            f"punto de reposición: {item.reorder_point}{alert})."
        )
    return sanitize_untrusted_text("\n".join(lines))


def operational_tools(state: AgentState) -> AgentState:
    """Run only the read-only operational tools selected for the internal agent."""
    route = state.get("route", "rag")
    outputs: list[str] = []
    sources: list[dict[str, str]] = []
    statuses: list[str] = []
    trace = [*state.get("trace", [])]

    if route in {"incidents", "operational"}:
        incident_result = search_incidents_tool(
            state["question"], status=_incident_status(state["question"])
        )
        outputs.append(_render_incidents(incident_result))
        statuses.append(incident_result.status)
        sources.append({"document": "incidents-tool", "section": "Búsqueda de incidencias"})
        trace.append("incidents_tool")
    if route in {"inventory", "operational"}:
        inventory_result = search_inventory_tool(state["question"])
        outputs.append(_render_inventory(inventory_result))
        statuses.append(inventory_result.status)
        sources.append({"document": "inventory-tool", "section": "Consulta de inventario"})
        trace.append("inventory_tool")

    rendered = sanitize_untrusted_text("\n\n".join(outputs))
    if not validate_answer(rendered):
        rendered = OUTPUT_BLOCK_MESSAGE
    has_failure = any(status != "ok" for status in statuses)
    return {
        "answer": rendered,
        "sources": sources,
        "status": "fallback" if has_failure else "answered",
        "trace": trace,
    }


def fallback(state: AgentState) -> AgentState:
    return {
        "answer": NO_CONTEXT_ANSWER,
        "sources": [],
        "status": "fallback",
        "trace": [*state.get("trace", []), "fallback"],
    }


def input_guardrail(state: AgentState) -> AgentState:
    """Return a fixed, non-echoing refusal for blocked requests."""
    reason = state.get("guardrail_reason") or "instruction_override"
    if reason == "unscoped_data_access":
        return {
            "answer": OUTPUT_BLOCK_MESSAGE,
            "sources": [],
            "status": "answered",
            "trace": [*state.get("trace", []), "input_guardrail"],
        }
    decision = InputDecision(
        blocked=True,
        reason=reason,
    )
    return {
        "answer": redirect_for_input(decision),
        "sources": [],
        "status": "answered",
        "trace": [*state.get("trace", []), "input_guardrail"],
    }


def build_graph(checkpointer=None):
    """Compile the graph with the supplied saver or an in-memory test saver."""
    builder = StateGraph(AgentState)
    builder.add_node("receive", receive)
    builder.add_node("retrieve", retrieve_evidence)
    builder.add_node("generate", generate)
    builder.add_node("operational_tools", operational_tools)
    builder.add_node("fallback", fallback)
    builder.add_node("input_guardrail", input_guardrail)
    builder.add_edge(START, "receive")
    builder.add_conditional_edges(
        "receive",
        route_question,
        {
            "retrieve": "retrieve",
            "operational_tools": "operational_tools",
            "fallback": "fallback",
            "input_guardrail": "input_guardrail",
        },
    )
    builder.add_conditional_edges(
        "retrieve", route_evidence, {"generate": "generate", "fallback": "fallback"}
    )
    builder.add_edge("generate", END)
    builder.add_edge("operational_tools", END)
    builder.add_edge("fallback", END)
    builder.add_edge("input_guardrail", END)
    try:
        return builder.compile(
            checkpointer=checkpointer if checkpointer is not None else InMemorySaver()
        )
    except Exception as exc:
        raise GraphCompilationError(
            "No se pudo compilar el grafo del agente; revise la estructura de nodos y transiciones."
        ) from exc


def _create_default_checkpointer():
    """Use PostgreSQL in configured API deployments, memory only without DB."""
    from database import engine

    # Keep module import and offline development usable when the optional
    # PostgreSQL checkpoint backend is absent from the current environment.
    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        from psycopg_pool import ConnectionPool
    except ImportError:
        return InMemorySaver(), None

    if engine is None:
        return InMemorySaver(), None

    conninfo = engine.url.set(drivername="postgresql").render_as_string(
        hide_password=False
    )
    pool = ConnectionPool(
        conninfo,
        kwargs={"autocommit": True, "prepare_threshold": 0},
        open=False,
    )
    return PostgresSaver(pool), pool


_checkpointer, _connection_pool = _create_default_checkpointer()
_graph = build_graph(_checkpointer)


def _ensure_pool_open() -> None:
    if _connection_pool is not None and _connection_pool.closed:
        _connection_pool.open(wait=True)


def run_agent(
    question: str,
    *,
    owner_id: str,
    thread_id: str | None = None,
) -> dict[str, object]:
    """Run the compiled graph and return the safe response plus trace metadata."""
    resolved_thread_id = thread_id or str(uuid4())
    input_decision = assess_input(question.strip())
    access_blocked = not is_small_talk(question) and _classify_question(question.strip()) in {
        "rag", "incidents", "operational"
    }
    if input_decision.blocked:
        return {
            "answer": redirect_for_input(input_decision),
            "sources": [],
            "status": "answered",
            "trace": ["input_guardrail"],
            "thread_id": resolved_thread_id,
        }
    if is_supported_general_question(question):
        emit_guardrail_event("redirect", "general_question_redirect")
        return {
            "answer": respond_to_general_question(question),
            "sources": [],
            "status": "answered",
            "trace": ["general_question_redirect"],
            "thread_id": resolved_thread_id,
        }
    if is_small_talk(question):
        emit_guardrail_event("redirect", "small_talk_redirect")
        return {
            "answer": redirect_for_small_talk(question),
            "sources": [],
            "status": "answered",
            "trace": ["small_talk_redirect"],
            "thread_id": resolved_thread_id,
        }
    _ensure_pool_open()
    try:
        pending = get_pending_proposal_if_configured(
            owner_id=owner_id, thread_id=resolved_thread_id, engine=memory_engine
        )
    except MemoryStoreUnavailable:
        pending = None
    if pending is not None:
        try:
            classified = classify_memory_decision(question, pending.content)
            classification = MemoryDecisionClassification.model_validate(
                classified.model_dump()
                if hasattr(classified, "model_dump")
                else classified
            )
        except Exception:
            classification = MemoryDecisionClassification(
                label=DecisionLabel.UNCLEAR, confidence=0
            )
        try:
            resolved = resolve_proposal_if_configured(
                owner_id=owner_id,
                thread_id=resolved_thread_id,
                decision=MemoryDecision(
                    proposal_id=pending.id,
                    label=classification.label,
                    edited_content=classification.edited_content,
                    confidence=classification.confidence,
                ),
                engine=memory_engine,
            )
        except (ValueError, MemoryStoreUnavailable):
            # A race, unavailable store, or ownership inconsistency cannot be
            # treated as consent; return a neutral response without RAG actions.
            response_text = "No pude confirmar el consentimiento; no se guardó ninguna preferencia."
        else:
            if resolved.status.value == "approved":
                response_text = "Entendido. Guardé esa preferencia general para tus respuestas futuras."
            elif resolved.status.value == "pending":
                response_text = (
                    f"Actualicé la propuesta a: «{resolved.content}». "
                    "¿Confirmas que recuerde esta preferencia? Responde sí o no."
                )
            elif resolved.status.value == "rejected":
                response_text = "Entendido. No guardaré esa preferencia."
            else:
                response_text = "No pude interpretar un consentimiento claro; no se guardó la preferencia."
        response: dict[str, object] = {
            "answer": response_text,
            "sources": [],
            "status": "answered",
            "trace": ["memory_consent", "memory_decision"],
            "thread_id": resolved_thread_id,
        }
        followup_question = classification.followup_question
        # Run only a separately classified request, never the consent phrase.
        if (
            isinstance(followup_question, str)
            and followup_question.strip()
            and classification.label in {DecisionLabel.APPROVE, DecisionLabel.REJECT}
            and classification.confidence >= MIN_DECISION_CONFIDENCE
            and "No pude confirmar" not in response_text
        ):
            followup = followup_question.strip()
            if _classify_question(followup) in {"rag", "incidents", "operational"}:
                emit_guardrail_event("security", "unscoped_data_access")
                response["answer"] = f"{response_text}\n\n{OUTPUT_BLOCK_MESSAGE}"
            else:
                result = _graph.invoke(
                    {
                        "question": followup,
                        "owner_id": owner_id,
                        "thread_id": resolved_thread_id,
                    },
                    config={"configurable": {"thread_id": resolved_thread_id}},
                )
                response["answer"] = f"{response_text}\n\n{result['answer']}"
                response["sources"] = result.get("sources", [])
                response["status"] = result["status"]
                response["trace"] = [*response["trace"], *result.get("trace", [])]
        return response
    if question.strip() and access_blocked:
        emit_guardrail_event("security", "unscoped_data_access")
        return {
            "answer": OUTPUT_BLOCK_MESSAGE,
            "sources": [],
            "status": "answered",
            "trace": ["input_guardrail"],
            "thread_id": resolved_thread_id,
        }
    result = _graph.invoke(
        {"question": question, "owner_id": owner_id, "thread_id": resolved_thread_id},
        config={"configurable": {"thread_id": resolved_thread_id}},
    )
    return {
        "answer": result["answer"],
        "sources": result.get("sources", []),
        "status": result["status"],
        "trace": result.get("trace", []),
        "thread_id": resolved_thread_id,
    }


def get_checkpoint(
    thread_id: str, *, owner_id: str
) -> dict[str, object] | None:
    """Return a safe trace only when the checkpoint belongs to this user."""
    _ensure_pool_open()
    checkpoint = _checkpointer.get_tuple(
        {"configurable": {"thread_id": thread_id}}
    )
    if checkpoint is None:
        return None
    values = checkpoint.checkpoint.get("channel_values", {})
    if values.get("owner_id") != owner_id:
        return None
    return {
        "thread_id": thread_id,
        "status": values.get("status"),
        "trace": values.get("trace", []),
    }