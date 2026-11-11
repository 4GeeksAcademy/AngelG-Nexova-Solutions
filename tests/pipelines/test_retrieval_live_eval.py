"""Opt-in Recall@3 check against the configured Nexova retrieval backend.

Run only when the user has configured the RAG services and explicitly opts in:
RUN_LIVE_RAG_EVAL=1 DATABASE_URL='' PYTHONPATH="$PWD:$PWD/services/api" \
  uv run --directory services/api pytest -q ../../tests/pipelines/test_retrieval_live_eval.py

This test queries the configured retrieval service; it does not seed or mutate Qdrant.
"""

import os

import pytest

from data.pipelines.rag import retrieve

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_LIVE_RAG_EVAL") != "1",
    reason="opt-in: requiere servicios reales de embeddings y Qdrant configurados",
)

# Targets are source-document labels represented in the corpus and the test set.
# There are at least two objection cases, as required by the RAG briefing.
CASES = [
    ("¿Cuál es la tarifa estándar de headhunting?", {"pricing-model"}),
    ("¿Cómo se pagan los honorarios de headhunting?", {"pricing-model"}),
    ("¿Puedo pagar todo al final cuando empiece el candidato?", {"objection-handling", "pricing-model"}),
    ("¿Qué ocurre si no estoy conforme con la terna?", {"objection-handling"}),
    ("¿Puedo negociar la tarifa del 22% al 15%?", {"objection-handling", "pricing-model"}),
    ("¿Cuánto tarda una búsqueda ejecutiva y es garantía?", {"hiring-process-sla"}),
    ("¿Qué incluye outsourcing de equipos de soporte?", {"service-lines"}),
    ("¿Qué comunica Nexova si trabaja con competidores?", {"objection-handling"}),
]


def test_live_recall_at_three_meets_briefing_target():
    """At least 80% of queries must retrieve an expected document in top three."""
    hits = 0
    details = []
    for question, expected_documents in CASES:
        results = retrieve(question, k=3)
        retrieved_documents = {
            str(result.get("source_document", "")) for result in results[:3]
        }
        hit = bool(retrieved_documents & expected_documents)
        hits += int(hit)
        details.append(
            f"{question!r}: expected={sorted(expected_documents)}, "
            f"retrieved={sorted(retrieved_documents)}, hit={hit}"
        )

    recall_at_3 = hits / len(CASES)
    assert recall_at_3 >= 0.80, (
        f"Recall@3={recall_at_3:.0%} ({hits}/{len(CASES)}), objetivo >=80%.\n"
        + "\n".join(details)
    )
