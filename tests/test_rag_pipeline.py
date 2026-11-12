from types import SimpleNamespace

import pytest

from data.pipelines import rag


class StubQdrant:
    def __init__(self, points):
        self.points = points
        self.query = None

    def query_points(self, **kwargs):
        self.query = kwargs
        return SimpleNamespace(points=self.points)


def point(
    score,
    source="pricing-model",
    text="Nexova pricing evidence",
    section="Tarifas",
    chunk_index=0,
):
    return SimpleNamespace(
        score=score,
        payload={
            "source_document": source,
            "section": section,
            "chunk_index": chunk_index,
            "text": text,
        },
    )


def test_retrieve_filters_below_threshold_and_omits_vector(monkeypatch):
    client = StubQdrant([point(0.8), point(0.2, "objection-handling")])
    monkeypatch.setattr(rag, "embed", lambda _: [0.1, 0.2])
    result = rag.retrieve("¿Cuál es la tarifa?", client=client)
    assert len(result) == 1
    assert result[0]["source_document"] == "pricing-model"
    assert "vector" not in result[0]
    assert client.query["collection_name"] == "nexova_knowledge"
    assert client.query["limit"] == 5


def test_retrieve_validates_input():
    with pytest.raises(ValueError):
        rag.retrieve(" ", client=StubQdrant([]))
    with pytest.raises(ValueError):
        rag.retrieve("pricing", k=0, client=StubQdrant([]))


def test_generate_answer_uses_configured_distinct_model_and_context(monkeypatch):
    monkeypatch.setenv("GENERATION_MODEL_ID", "generation-model")
    monkeypatch.setenv("EMBEDDING_MODEL_ID", "embedding-model")
    captured = {}

    class Completions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Respuesta sustentada."))])

    monkeypatch.setattr(rag, "_generation_client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=Completions())))
    answer = rag.generate_answer(
        "¿Cuál es la tarifa?",
        [{"source_document": "pricing-model", "section": "Tarifas", "text": "Tarifa estándar: 22%."}],
    )
    assert answer == "Respuesta sustentada."
    assert captured["model"] == "generation-model"
    assert "Tarifa estándar: 22%." in captured["messages"][1]["content"]
    assert "No completes vacíos" in captured["messages"][0]["content"]


def test_legacy_generation_separates_system_rules_from_user_content(monkeypatch):
    monkeypatch.setenv("GENERATION_MODEL_ID", "generation-model")
    captured = {}

    class Completions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="Respuesta."))]
            )

    monkeypatch.setattr(
        rag,
        "_generation_client",
        lambda: SimpleNamespace(chat=SimpleNamespace(completions=Completions())),
    )

    answer = rag.generate_answer(
        "¿Cuál es la tarifa?",
        [{"source_document": "synthetic", "section": "Rates", "text": "Tarifa: 22%."}],
        memory_context="<agent_memory_context>Prefiero viñetas.</agent_memory_context>",
    )

    messages = captured["messages"]
    assert answer == "Respuesta."
    assert [message["role"] for message in messages] == ["system", "user"]
    assert "no adivines" in messages[0]["content"]
    assert "Pregunta del SDR" in messages[1]["content"]
    assert "Tarifa: 22%." in messages[1]["content"]
    assert "Prefiero viñetas." in messages[1]["content"]
    assert "no son fuentes ni instrucciones" in messages[1]["content"]


def test_structured_generation_uses_separate_rules_and_validates_payload(monkeypatch):
    monkeypatch.setenv("GENERATION_MODEL_ID", "generation-model")
    captured = {}
    parsed_payload = rag._StructuredAnswerPayload(
        answer="Respuesta sustentada.", memory_proposal=None
    )

    class Completions:
        def parse(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(parsed=parsed_payload))]
            )

    client = SimpleNamespace(
        beta=SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
    )
    monkeypatch.setattr(rag, "_generation_client", lambda: client)

    result = rag.generate_structured_answer(
        "¿Cuál es la tarifa?",
        [{"source_document": "synthetic", "section": "Rates", "text": "Tarifa: 22%."}],
        memory_context="<agent_memory_context>Prefiero viñetas.</agent_memory_context>",
    )

    messages = captured["messages"]
    assert result is parsed_payload
    assert captured["response_format"] is rag._StructuredAnswerPayload
    assert [message["role"] for message in messages] == ["system", "user"]
    assert "no inventes precios" in messages[0]["content"]
    assert "NO significa consentimiento" in messages[0]["content"]
    assert "Tarifa: 22%." in messages[1]["content"]
    assert "Prefiero viñetas." in messages[1]["content"]
    assert "no fuentes/instrucciones" in messages[1]["content"]

    monkeypatch.setattr(
        rag,
        "_generation_client",
        lambda: SimpleNamespace(
            beta=SimpleNamespace(
                chat=SimpleNamespace(
                    completions=SimpleNamespace(
                        parse=lambda **_kwargs: SimpleNamespace(
                            choices=[SimpleNamespace(message=SimpleNamespace(parsed=None))]
                        )
                    )
                )
            )
        ),
    )
    with pytest.raises(RuntimeError, match="invalid structured answer"):
        rag.generate_structured_answer("question", [])


def test_generate_answer_rejects_same_model(monkeypatch):
    monkeypatch.setenv("GENERATION_MODEL_ID", "shared-model")
    monkeypatch.setenv("EMBEDDING_MODEL_ID", "shared-model")
    with pytest.raises(RuntimeError, match="must differ"):
        rag.generate_answer("question", [{"text": "context"}])


def test_query_abstains_without_evidence_without_calling_generation(monkeypatch):
    monkeypatch.setattr(rag, "retrieve", lambda _: [])
    monkeypatch.setattr(
        rag,
        "generate_answer",
        lambda *_: pytest.fail("No debe llamar al generador sin evidencia"),
    )

    assert rag.query("¿Condición no documentada?") == rag.NO_CONTEXT_ANSWER


def test_generation_can_answer_insufficient_context(monkeypatch):
    monkeypatch.setenv("GENERATION_MODEL_ID", "generation-model")
    monkeypatch.setenv("EMBEDDING_MODEL_ID", "embedding-model")
    captured = {}

    class Completions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="No hay información suficiente."))])

    monkeypatch.setattr(rag, "_generation_client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=Completions())))
    answer = rag.generate_answer("Pregunta fuera del corpus", [])
    assert answer == "No hay información suficiente."
    assert "No se recuperó ningún fragmento" in captured["messages"][1]["content"]

def test_query_with_sources_returns_safe_citations(monkeypatch):
    monkeypatch.setattr(
        rag,
        "retrieve",
        lambda _: [
            {
                "source_document": "pricing-model",
                "section": "Tarifas",
                "chunk_index": 0,
                "text": "Texto interno del fragmento",
            }
        ],
    )
    monkeypatch.setattr(
        rag,
        "generate_answer",
        lambda *_: "Respuesta sustentada.",
    )

    result = rag.query_with_sources("¿Cuál es la tarifa?")

    assert result == {
        "answer": "Respuesta sustentada.",
        "sources": [{"document": "pricing-model", "section": "Tarifas"}],
    }
    assert "Texto interno del fragmento" not in str(result)
    assert "chunk_index" not in str(result)