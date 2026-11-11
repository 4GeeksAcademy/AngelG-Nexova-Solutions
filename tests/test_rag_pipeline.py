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