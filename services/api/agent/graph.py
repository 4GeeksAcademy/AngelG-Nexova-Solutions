"""Explicit, checkpointed LangGraph flow around the existing RAG functions."""

from __future__ import annotations

from typing import Literal, TypedDict
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from data.pipelines.rag import NO_CONTEXT_ANSWER, generate_answer, retrieve
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
    route: Literal["rag", "incidents", "inventory", "operational"]


def receive(state: AgentState) -> AgentState:
    question = state.get("question", "").strip()
    intent = _classify_question(question)
    return {
        "question": question,
        "owner_id": state.get("owner_id", ""),
        "route": intent,
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
) -> Literal["retrieve", "operational_tools", "fallback"]:
    if not state.get("question"):
        return "fallback"
    if state.get("route") in {"incidents", "inventory", "operational"}:
        return "operational_tools"
    return "retrieve"


def retrieve_evidence(state: AgentState) -> AgentState:
    evidence = retrieve(state["question"])
    return {
        "evidence": evidence,
        "trace": [*state.get("trace", []), "retrieve"],
    }


def route_evidence(state: AgentState) -> Literal["generate", "fallback"]:
    return "generate" if state.get("evidence") else "fallback"


def generate(state: AgentState) -> AgentState:
    evidence = state["evidence"]
    answer = generate_answer(state["question"], evidence)
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
    return "\n".join(lines)


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
    return "\n".join(lines)


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

    has_failure = any(status != "ok" for status in statuses)
    return {
        "answer": "\n\n".join(outputs),
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


def build_graph(checkpointer=None):
    """Compile the graph with the supplied saver or an in-memory test saver."""
    builder = StateGraph(AgentState)
    builder.add_node("receive", receive)
    builder.add_node("retrieve", retrieve_evidence)
    builder.add_node("generate", generate)
    builder.add_node("operational_tools", operational_tools)
    builder.add_node("fallback", fallback)
    builder.add_edge(START, "receive")
    builder.add_conditional_edges(
        "receive",
        route_question,
        {
            "retrieve": "retrieve",
            "operational_tools": "operational_tools",
            "fallback": "fallback",
        },
    )
    builder.add_conditional_edges(
        "retrieve", route_evidence, {"generate": "generate", "fallback": "fallback"}
    )
    builder.add_edge("generate", END)
    builder.add_edge("operational_tools", END)
    builder.add_edge("fallback", END)
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
    _ensure_pool_open()
    result = _graph.invoke(
        {"question": question, "owner_id": owner_id},
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