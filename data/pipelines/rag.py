"""Retrieval and answer generation for the Nexova sales knowledge base."""

from __future__ import annotations

import os
from typing import Any

from openai import OpenAI
from qdrant_client import QdrantClient

from data.process.rag_index import COLLECTION_NAME, _qdrant_client, embed

DEFAULT_TOP_K = 5
DEFAULT_MIN_SCORE = 0.35
NO_CONTEXT_ANSWER = (
    "No encuentro información suficiente en la base de conocimiento para "
    "responder con seguridad. Consulta con un account manager antes de "
    "confirmar esa condición al prospecto."
)


def _generation_client() -> OpenAI:
    options: dict[str, Any] = {}
    base_url = os.getenv("OPENAI_BASE_URL")
    if base_url:
        options["base_url"] = base_url
    return OpenAI(**options)


def retrieve(
    query: str,
    k: int = DEFAULT_TOP_K,
    min_score: float = DEFAULT_MIN_SCORE,
    *,
    client: QdrantClient | None = None,
) -> list[dict[str, Any]]:
    """Return only payloads whose cosine score meets the minimum threshold."""
    if not query.strip():
        raise ValueError("query must not be empty")
    if k < 1:
        raise ValueError("k must be at least 1")
    if not 0 <= min_score <= 1:
        raise ValueError("min_score must be between 0 and 1 for cosine scores")

    vector = embed(query)
    qdrant = client or _qdrant_client()
    response = qdrant.query_points(
        collection_name=COLLECTION_NAME,
        query=vector,
        limit=k,
        with_payload=True,
    )

    results: list[dict[str, Any]] = []
    for point in response.points:
        if point.score is None or point.score < min_score or point.payload is None:
            continue
        results.append(dict(point.payload))
    return results


def generate_answer(question: str, context: list[dict[str, Any]]) -> str:
    """Generate a sales-ready answer using only retrieved Nexova evidence."""
    model_id = os.getenv("GENERATION_MODEL_ID")
    if not model_id:
        raise RuntimeError("GENERATION_MODEL_ID must be configured")

    embedding_model_id = os.getenv("EMBEDDING_MODEL_ID")
    if embedding_model_id and model_id == embedding_model_id:
        raise RuntimeError(
            "GENERATION_MODEL_ID must differ from EMBEDDING_MODEL_ID"
        )

    evidence = "\n\n".join(
        "[Documento: {source}; sección: {section}]\n{text}".format(
            source=item.get("source_document", "desconocido"),
            section=item.get("section", "sin sección"),
            text=item.get("text", ""),
        )
        for item in context
        if item.get("text")
    )
    if not evidence:
        evidence = "No se recuperó ningún fragmento relevante."

    system_prompt = """Eres un vendedor experimentado de Nexova que ayuda a SDRs a
preparar conversaciones con prospectos. Responde en español con seguridad,
claridad y orientación comercial, sin presión ni promesas no respaldadas.
Usa exclusivamente los hechos del contexto proporcionado. No completes vacíos
con conocimiento general ni inventes porcentajes, importes, plazos, garantías,
descuentos o condiciones comerciales. Presenta los plazos de entrega como
promedios, no como garantías, salvo la garantía de reemplazo contractual de
seis meses. Nunca ofrezcas un descuento sobre la tarifa estándar del 22%; indica
que cualquier excepción requiere aprobación de Marcos Ibáñez. Para cambios al
esquema de pago, indica los límites y aprobaciones que figuren en el contexto.
Al hablar de empresas competidoras, comunica con transparencia las condiciones
descritas en el contexto. Si este no contiene información suficiente, dilo
explícitamente y recomienda confirmarlo con un account manager; no adivines.
No afirmes haber consultado fuentes distintas de los fragmentos entregados."""

    response = _generation_client().chat.completions.create(
        model=model_id,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Pregunta del SDR: {question}\n\n"
                    f"Contexto recuperado:\n{evidence}"
                ),
            },
        ],
    )
    answer = response.choices[0].message.content
    if not answer or not answer.strip():
        raise RuntimeError("The generation model returned an empty answer")
    return answer.strip()


def query_with_sources(question: str) -> dict[str, Any]:
    """Answer from retrieved evidence and return safe document/section citations."""
    context = retrieve(question)
    evidence = [
        item
        for item in context
        if isinstance(item.get("text"), str) and item["text"].strip()
    ]

    if not evidence:
        answer = NO_CONTEXT_ANSWER
    else:
        answer = generate_answer(question, evidence)

    sources: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for item in evidence:
        document = item.get("source_document")
        section = item.get("section")

        if not isinstance(document, str) or not document.strip():
            continue
        if not isinstance(section, str) or not section.strip():
            continue

        citation = (document.strip(), section.strip())
        if citation not in seen:
            seen.add(citation)
            sources.append({"document": citation[0], "section": citation[1]})

    return {"answer": answer, "sources": sources}


def query(question: str) -> str:
    """Compose retrieval and generation; preserve the answer-only helper."""
    return query_with_sources(question)["answer"]