"""Offline acceptance evaluations for the LangGraph RAG orchestration."""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
EVALS_PATH = Path(__file__).parents[2] / "data" / "eval" / "langgraph-agent-traces.json"


def _load_agent_graph_module():
    api_root = Path(__file__).parents[2] / "services" / "api"
    if str(api_root) not in sys.path:
        sys.path.insert(0, str(api_root))

    from agent import graph as module

    return module


agent_graph = _load_agent_graph_module()
InMemorySaver = agent_graph.InMemorySaver


def test_search_term_normalization_and_compound_matching():
    from sqlalchemy.dialects import postgresql

    from services.api.agent.tools import _matches_search_terms, _search_terms

    assert _search_terms("¿Qué incidencias abiertas hay en Valencia?") == ["valencia"]
    assert _search_terms("¿Cuánto stock del portátil de soporte?") == ["portatil", "soporte"]
    predicate = _matches_search_terms((MagicMock(),), ["portatil", "soporte"])
    sql = str(predicate.compile(dialect=postgresql.dialect()))
    assert " AND " in sql
    assert "replace(" in sql


@pytest.fixture
def offline_graph(monkeypatch):
    evidence_by_case = {
        "pricing": [
            {
                "source_document": "pricing-model",
                "section": "Tarifas",
                "text": "La tarifa estándar de headhunting es 22% del salario anual.",
            }
        ],
        "services": [
            {
                "source_document": "service-lines",
                "section": "Outsourcing",
                "text": "El outsourcing de soporte incluye atención de solicitudes y escalamiento.",
            }
        ],
    }

    def fake_retrieve(question):
        if "tarifa" in question.lower() or "headhunting" in question.lower():
            return evidence_by_case["pricing"]
        if "outsourcing" in question.lower():
            return evidence_by_case["services"]
        return []

    def fake_generate(question, evidence):
        assert evidence, "La generación no debe ejecutarse sin evidencia"
        return evidence[0]["text"]

    monkeypatch.setattr(agent_graph, "retrieve", fake_retrieve)
    monkeypatch.setattr(agent_graph, "generate_answer", fake_generate)
    return agent_graph.build_graph()


def test_eval_pricing_answer_is_grounded_in_expected_source(offline_graph):
    case = _load_eval("pricing_standard_rate")
    result = _invoke(offline_graph, case["question"], case["id"])
    assert case["expected_answer_fragment"] in result["answer"]
    assert case["expected_source"] in {source["document"] for source in result["sources"]}
    assert result["trace"] == case["expected_trace"]
    saved = offline_graph.get_state(
        {"configurable": {"thread_id": case["id"]}}
    ).values
    assert saved["question"] == case["question"]
    assert saved["evidence"]
    assert saved["answer"] == result["answer"]
    assert saved["owner_id"] == "offline-eval"


def test_eval_service_answer_is_grounded_in_expected_source(offline_graph):
    case = _load_eval("support_outsourcing_scope")
    result = _invoke(offline_graph, case["question"], case["id"])
    assert case["expected_answer_fragment"] in result["answer"]
    assert case["expected_source"] in {source["document"] for source in result["sources"]}
    assert result["trace"] == case["expected_trace"]


def test_eval_unknown_query_uses_fallback_and_no_generation(offline_graph):
    case = _load_eval("unsupported_policy_fallback")
    result = _invoke(offline_graph, case["question"], case["id"])
    assert result["status"] == case["expected_status"]
    assert result["sources"] == []
    assert result["trace"] == case["expected_trace"]
    assert "información suficiente" in result["answer"]


def test_blank_question_routes_directly_to_fallback(monkeypatch):
    monkeypatch.setattr(
        agent_graph,
        "retrieve",
        lambda _: pytest.fail("No debe recuperar ante una pregunta vacía"),
    )
    result = _invoke(agent_graph.build_graph(), "   ", "blank-question")
    assert result["trace"] == ["receive", "fallback"]
    assert result["status"] == "fallback"


@pytest.mark.parametrize(
    ("question", "expected_route"),
    [
        ("¿Qué artículos hay en la oficina de Valencia?", "inventory"),
        ("¿Qué articulos hay disponibles?", "inventory"),
        ("¿Qué incidencias están en progreso?", "incidents"),
        ("¿Cuál es el proceso de selección?", "rag"),
    ],
)
def test_question_classifier_routes_operational_and_rag_queries(
    question, expected_route
):
    assert agent_graph._classify_question(question) == expected_route


def test_incident_query_uses_operational_tool_and_safe_trace(monkeypatch):
    from services.api.agent.tools import IncidentToolItem, IncidentToolResult

    monkeypatch.setattr(
        agent_graph,
        "search_incidents_tool",
        lambda query, *, status=None: IncidentToolResult(
            status="ok",
            message="Se encontró una incidencia.",
            items=[
                IncidentToolItem(
                    id="INC-123",
                    client_name="Cliente interno",
                    title="Fallo de acceso",
                    description="Descripción privada",
                    status=status or "open",
                    severity="high",
                    responsible_area="IT",
                    assigned_to="Agente interno",
                    sla_deadline=None,
                )
            ],
        ),
    )
    graph = agent_graph.build_graph()
    result = _invoke(graph, "¿Qué incidencias abiertas hay?", "incident-tool-route")

    assert "INC-123" in result["answer"]
    assert result["status"] == "answered"
    assert result["trace"] == ["receive", "incidents_tool"]
    assert result["sources"] == [
        {"document": "incidents-tool", "section": "Búsqueda de incidencias"}
    ]
    checkpoint = graph.get_state(
        {"configurable": {"thread_id": "incident-tool-route"}}
    ).values
    assert checkpoint["route"] == "incidents"


def test_incident_status_phrase_filters_without_keyword(monkeypatch):
    from services.api.agent.tools import IncidentToolResult

    calls = []

    def fake_search(query, *, status=None):
        calls.append((query, status))
        return IncidentToolResult(status="ok", message="Sin incidencias.")

    monkeypatch.setattr(agent_graph, "search_incidents_tool", fake_search)
    result = _invoke(
        agent_graph.build_graph(), "¿Qué incidencias abiertas hay?", "incident-status"
    )

    assert calls == [("¿Qué incidencias abiertas hay?", "open")]
    assert result["status"] == "answered"


@pytest.mark.parametrize(
    ("question", "expected_status"),
    [
        ("incidencias abiertas", "open"),
        ("incidencias asignadas", "assigned"),
        ("incidencias en progreso", "in_progress"),
        ("incidencias resueltas", "resolved"),
        ("incidencias cerradas", "closed"),
        ("incidencias reabiertas", "reopened"),
    ],
)
def test_incident_status_aliases_are_normalized(question, expected_status):
    assert agent_graph._incident_status(question) == expected_status


def test_inventory_query_uses_operational_tool(monkeypatch):
    from decimal import Decimal

    from services.api.agent.tools import InventoryToolItem, InventoryToolResult

    monkeypatch.setattr(
        agent_graph,
        "search_inventory_tool",
        lambda query, *, office=None: InventoryToolResult(
            status="ok",
            message="Se encontró un artículo.",
            items=[
                InventoryToolItem(
                    id=7,
                    name="Portátil de soporte",
                    sku="LAP-7",
                    category="IT",
                    office=office or "valencia",
                    unit_of_measure="unidades",
                    current_stock=Decimal("2"),
                    reorder_point=Decimal("3"),
                    reorder_alert=True,
                )
            ],
        ),
    )
    graph = agent_graph.build_graph()
    result = _invoke(graph, "¿Cuánto stock hay de portátil?", "inventory-tool-route")

    assert "stock actual: 2" in result["answer"]
    assert "bajo el punto de reposición" in result["answer"]
    assert result["trace"] == ["receive", "inventory_tool"]
    assert result["sources"] == [
        {"document": "inventory-tool", "section": "Consulta de inventario"}
    ]


def test_combined_operational_query_calls_both_tools_without_rag(monkeypatch):
    from services.api.agent.tools import IncidentToolResult, InventoryToolResult

    calls = []

    def fake_incidents(query, *, status=None):
        calls.append(("incidents", query, status))
        return IncidentToolResult(status="ok", message="Incidencias consultadas.")

    def fake_inventory(query, *, office=None):
        calls.append(("inventory", query, office))
        return InventoryToolResult(status="ok", message="Inventario consultado.")

    monkeypatch.setattr(agent_graph, "search_incidents_tool", fake_incidents)
    monkeypatch.setattr(agent_graph, "search_inventory_tool", fake_inventory)
    monkeypatch.setattr(
        agent_graph,
        "retrieve",
        lambda _: pytest.fail("La ruta operativa combinada no debe consultar RAG"),
    )

    result = _invoke(
        agent_graph.build_graph(),
        "Revisa incidencias abiertas y stock de portátiles",
        "combined-operational-route",
    )

    assert calls == [
        (
            "incidents",
            "Revisa incidencias abiertas y stock de portátiles",
            "open",
        ),
        (
            "inventory",
            "Revisa incidencias abiertas y stock de portátiles",
            None,
        ),
    ]
    assert result["status"] == "answered"
    assert result["trace"] == ["receive", "incidents_tool", "inventory_tool"]
    assert [source["document"] for source in result["sources"]] == [
        "incidents-tool",
        "inventory-tool",
    ]


def test_operational_tool_error_does_not_fall_through_to_rag(monkeypatch):
    from services.api.agent.tools import IncidentToolResult

    monkeypatch.setattr(
        agent_graph,
        "search_incidents_tool",
        lambda *_args, **_kwargs: IncidentToolResult(
            status="unavailable", message="Consulta temporalmente no disponible."
        ),
    )
    monkeypatch.setattr(
        agent_graph,
        "retrieve",
        lambda _: pytest.fail("Una falla de tools no debe recurrir al RAG"),
    )
    result = _invoke(agent_graph.build_graph(), "Buscar incidencia de red", "tool-error")

    assert result["status"] == "fallback"
    assert result["answer"] == "Consulta temporalmente no disponible."
    assert result["trace"] == ["receive", "incidents_tool"]


def test_graph_compilation_failure_has_clear_domain_error(monkeypatch):
    class BrokenBuilder:
        def __init__(self, _state_type):
            pass

        def add_node(self, *_args, **_kwargs):
            pass

        def add_edge(self, *_args, **_kwargs):
            pass

        def add_conditional_edges(self, *_args, **_kwargs):
            pass

        def compile(self, **_kwargs):
            raise ValueError("internal structural detail")

    monkeypatch.setattr(agent_graph, "StateGraph", BrokenBuilder)
    with pytest.raises(agent_graph.GraphCompilationError, match="compilar el grafo") as error:
        agent_graph.build_graph()
    assert isinstance(error.value.__cause__, ValueError)
    assert "internal structural detail" in str(error.value.__cause__)


@pytest.mark.parametrize(
    ("document", "question", "required_fact"),
    [
        (
            "nexova-objection-handling.es.md",
            "¿Pueden bajar la tarifa estándar de headhunting del 22% al 15%?",
            "No se debe ofrecer un descuento sobre el 22% sin aprobación de Marcos Ibáñez.",
        ),
        (
            "nexova-objection-handling.es.md",
            "¿Puedo pagar todo al final cuando empiece el candidato?",
            "no es negociable para nuevos clientes",
        ),
        (
            "nexova-objection-handling.es.md",
            "¿Qué ocurre si ningún candidato de la terna me convence?",
            "feedback específico",
        ),
        (
            "nexova-objection-handling.es.md",
            "¿Ocultan que trabajan con mi competencia?",
            "nunca ocultarlo",
        ),
        (
            "nexova-hiring-process-sla.es.md",
            "¿Garantizan una terna ejecutiva en ocho semanas?",
            "8 semanas promedio",
        ),
        (
            "nexova-service-lines.es.md",
            "¿Qué incluye el servicio de outsourcing de soporte?",
            "supervisión de calidad y reporting mensual de SLAs",
        ),
    ],
)
def test_business_eval_expectations_are_supported_by_source(
    document, question, required_fact
):
    """Keep commercial acceptance facts anchored to the checked-in source corpus."""
    corpus_path = (
        Path(__file__).parents[2]
        / "docs"
        / "company-knowledge-base"
        / document
    )
    source_text = " ".join(corpus_path.read_text(encoding="utf-8").casefold().split())
    normalized_fact = " ".join(required_fact.casefold().split())
    assert question
    assert normalized_fact in source_text


def test_run_agent_returns_inspectable_checkpoint_without_raw_evidence(monkeypatch):
    saver = InMemorySaver()
    monkeypatch.setattr(agent_graph, "_connection_pool", None)
    monkeypatch.setattr(agent_graph, "_checkpointer", saver)
    monkeypatch.setattr(agent_graph, "_graph", agent_graph.build_graph(saver))
    monkeypatch.setattr(agent_graph, "retrieve", lambda _: [])
    result = agent_graph.run_agent(
        "Pregunta sin evidencia",
        owner_id="user-1",
        thread_id="test-checkpoint",
    )
    checkpoint = agent_graph.get_checkpoint(result["thread_id"], owner_id="user-1")
    assert checkpoint is not None
    assert checkpoint["status"] == "fallback"
    assert checkpoint["trace"] == ["receive", "retrieve", "fallback"]
    assert "question" not in checkpoint
    assert "evidence" not in checkpoint
    assert agent_graph.get_checkpoint(result["thread_id"], owner_id="user-2") is None


def _load_eval(case_id: str) -> dict[str, object]:
    cases = json.loads(EVALS_PATH.read_text(encoding="utf-8"))
    return next(case for case in cases if case["id"] == case_id)


def _invoke(graph, question: str, thread_id: str):
    return graph.invoke(
        {"question": question, "owner_id": "offline-eval"},
        config={"configurable": {"thread_id": thread_id}},
    )