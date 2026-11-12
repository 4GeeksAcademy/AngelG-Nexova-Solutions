from types import SimpleNamespace

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from agent import graph
from agent.memory_contract import MemoryCategory, MemoryScope, ProposalStatus
from agent.memory_models import AgentMemoryEntry, AgentMemoryProposal


def test_rag_route_retrieves_only_response_preferences_and_passes_untrusted_context(monkeypatch):
    calls = {}
    evidence = [{"text": "Fuente comercial", "source_document": "kb", "section": "General"}]
    memory_context = '<agent_memory_context trust="untrusted_data">preferencia</agent_memory_context>'

    monkeypatch.setattr(graph, "retrieve", lambda question: evidence)

    def retrieve_memories(**kwargs):
        calls.update(kwargs)
        return [SimpleNamespace(content="Prefiero respuestas breves.")]

    monkeypatch.setattr(graph, "retrieve_memory_if_configured", retrieve_memories)
    monkeypatch.setattr(graph, "render_memory_context", lambda entries: memory_context)

    retrieved = graph.retrieve_evidence(
        {"question": "Pregunta SDR", "owner_id": "user-1", "trace": []}
    )

    assert retrieved["evidence"] == evidence
    assert retrieved["memory_context"] == memory_context
    assert calls["owner_id"] == "user-1"
    assert calls["categories"] == [graph.MemoryCategory.RESPONSE_PREFERENCE]
    assert calls["engine"] is graph.memory_engine

    generated = {}

    def generate_answer(question, context, *, memory_context=""):
        generated.update(question=question, context=context, memory_context=memory_context)
        return "Respuesta SDR"

    monkeypatch.setattr(
        graph,
        "generate_structured_answer",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AttributeError("legacy test client")),
    )
    monkeypatch.setattr(graph, "generate_answer", generate_answer)
    result = graph.generate({**retrieved, "question": "Pregunta SDR"})

    assert result["answer"] == "Respuesta SDR"
    assert generated["context"] == evidence
    assert generated["memory_context"] == memory_context


def test_operational_route_does_not_retrieve_or_apply_memory(monkeypatch):
    def unexpected(**_kwargs):
        raise AssertionError("memory should not be read for operational tools")

    monkeypatch.setattr(graph, "retrieve_memory_if_configured", unexpected)
    monkeypatch.setattr(graph, "search_incidents_tool", lambda *_args, **_kwargs: SimpleNamespace(
        status="ok", items=[], message="Sin resultados"
    ))

    result = graph.operational_tools(
        {"question": "incidencias", "route": "incidents", "owner_id": "user-1"}
    )
    assert result["answer"] == "Sin resultados"
    assert "memory_context" not in result


def test_explicit_consent_proposal_and_followup_approval_are_thread_and_owner_bound(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(graph, "memory_engine", engine)
    monkeypatch.setattr(graph, "_ensure_pool_open", lambda: None)
    monkeypatch.setattr(graph, "_graph", graph.build_graph())
    monkeypatch.setattr(graph, "retrieve_memory_if_configured", lambda **_kwargs: [])
    monkeypatch.setattr(graph, "render_memory_context", lambda _entries: "")
    monkeypatch.setattr(graph, "retrieve", lambda _question: [{"text": "RAG evidence"}])
    monkeypatch.setattr(
        graph,
        "generate_structured_answer",
        lambda *_args, **_kwargs: SimpleNamespace(
            answer="Respuesta basada en RAG.",
            memory_proposal=SimpleNamespace(
                content="Prefiero respuestas breves.",
                category=MemoryCategory.RESPONSE_PREFERENCE,
                scope=MemoryScope.USER,
                justification="Preferencia general de presentación.",
                model_dump=lambda: {
                    "content": "Prefiero respuestas breves.",
                    "category": MemoryCategory.RESPONSE_PREFERENCE,
                    "scope": MemoryScope.USER,
                    "justification": "Preferencia general de presentación.",
                },
            ),
        ),
    )

    first = graph._graph.invoke(
        {"question": "Siempre prefiero respuestas breves", "owner_id": "user-a", "thread_id": "thread-a"},
        config={"configurable": {"thread_id": "thread-a"}},
    )
    assert "¿Quieres que recuerde" in first["answer"]
    with Session(engine) as session:
        proposal = session.exec(select(AgentMemoryProposal)).one()
        assert proposal.status is ProposalStatus.PENDING
        assert proposal.owner_id == "user-a"
        assert proposal.thread_id == "thread-a"
        assert not session.exec(select(AgentMemoryEntry)).all()

    monkeypatch.setattr(
        graph,
        "classify_memory_decision",
        lambda *_args: SimpleNamespace(
            label="approve", edited_content=None, confidence=0.99, model_dump=lambda: {
                "label": "approve", "edited_content": None, "confidence": 0.99
            }
        ),
    )
    approved = graph.run_agent("Sí, apruébalo", owner_id="user-a", thread_id="thread-a")
    assert "Guardé" in approved["answer"]
    with Session(engine) as session:
        proposal = session.get(AgentMemoryProposal, proposal.id)
        entries = session.exec(select(AgentMemoryEntry)).all()
        assert proposal.status is ProposalStatus.APPROVED
        assert len(entries) == 1
        assert entries[0].owner_id == "user-a"
    engine.dispose()


def test_ambiguous_consent_defaults_to_no_memory(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(graph, "memory_engine", engine)
    monkeypatch.setattr(graph, "_ensure_pool_open", lambda: None)
    monkeypatch.setattr(graph, "_graph", graph.build_graph())
    graph.create_proposal_if_configured(
        owner_id="user-a",
        thread_id="thread-unclear",
        proposal=graph.MemoryProposal(
            content="Prefiero respuestas breves.",
            category=MemoryCategory.RESPONSE_PREFERENCE,
            scope=MemoryScope.USER,
            justification="Preferencia general de presentación.",
        ),
        engine=engine,
    )
    monkeypatch.setattr(
        graph,
        "classify_memory_decision",
        lambda *_args: SimpleNamespace(
            label="unclear", edited_content=None, confidence=0.3, model_dump=lambda: {
                "label": "unclear", "edited_content": None, "confidence": 0.3
            }
        ),
    )
    result = graph.run_agent("quizás", owner_id="user-a", thread_id="thread-unclear")
    assert "no se guardó" in result["answer"]
    with Session(engine) as session:
        assert not session.exec(select(AgentMemoryEntry)).all()
        proposal = session.exec(select(AgentMemoryProposal)).one()
        assert proposal.status is ProposalStatus.REJECTED_DEFAULT
    engine.dispose()


def test_clear_consent_and_separate_question_processes_both_parts(monkeypatch):
    monkeypatch.setattr(graph, "_ensure_pool_open", lambda: None)
    monkeypatch.setattr(
        graph,
        "get_pending_proposal_if_configured",
        lambda **_kwargs: SimpleNamespace(id="proposal-1", content="Prefiero respuestas breves."),
    )
    monkeypatch.setattr(
        graph,
        "classify_memory_decision",
        lambda *_args: SimpleNamespace(
            label="approve",
            edited_content=None,
            confidence=0.99,
            followup_question="¿Qué servicios ofrece Nexova?",
            model_dump=lambda: {
                "label": "approve",
                "edited_content": None,
                "confidence": 0.99,
                "followup_question": "¿Qué servicios ofrece Nexova?",
            },
        ),
    )
    monkeypatch.setattr(
        graph,
        "resolve_proposal_if_configured",
        lambda **_kwargs: SimpleNamespace(status=ProposalStatus.APPROVED),
    )
    invoked = {}

    def invoke(state, *, config):
        invoked.update(state=state, config=config)
        return {
            "answer": "Nexova ofrece los servicios descritos en la base de conocimiento.",
            "sources": [{"document": "services", "section": "Overview"}],
            "status": "answered",
            "trace": ["receive", "retrieve", "generate"],
        }

    monkeypatch.setattr(graph, "_graph", SimpleNamespace(invoke=invoke))

    response = graph.run_agent(
        "Sí, y ¿qué servicios ofrece Nexova?", owner_id="user-1", thread_id="thread-1"
    )

    assert "Guardé esa preferencia" in response["answer"]
    assert "Nexova ofrece" in response["answer"]
    assert response["sources"] == [{"document": "services", "section": "Overview"}]
    assert invoked["state"]["question"] == "¿Qué servicios ofrece Nexova?"
    assert invoked["state"]["owner_id"] == "user-1"
