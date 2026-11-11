"""Chunk and index Nexova knowledge documents in Qdrant.

Phase 2 only: this module prepares the corpus and writes vectors. Retrieval,
answer generation, and API concerns belong to later phases.
"""

from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openai import OpenAI
from qdrant_client import QdrantClient, models

COLLECTION_NAME = "nexova_knowledge"
CORPUS_DIR = Path(__file__).resolve().parents[2] / "docs" / "company-knowledge-base"

# Avoid splitting sections into tiny fragments while keeping embeddings focused.
MAX_CHUNK_CHARS = 900
MIN_CHUNK_CHARS = 180

SOURCE_SLUGS = {
    "nexova-service-lines.es.md": "service-lines",
    "nexova-pricing-model.es.md": "pricing-model",
    "nexova-hiring-process-sla.es.md": "hiring-process-sla",
    "nexova-objection-handling.es.md": "objection-handling",
}

@dataclass(frozen=True)
class Chunk:
    """A semantically coherent source section and its required metadata."""

    source_document: str
    section: str
    language: str
    chunk_index: int
    text: str

    def payload(self) -> dict[str, str | int]:
        return {
            "company": "nexova",
            "source_document": self.source_document,
            "section": self.section,
            "language": self.language,
            "chunk_index": self.chunk_index,
            "text": self.text,
        }


def _flush_chunk(chunks: list[str], heading: str, body: list[str]) -> None:
    text = "\n\n".join(part.strip() for part in body if part.strip()).strip()
    if not text:
        return
    # Coalesce short adjacent paragraphs within a section before emitting.
    if chunks and len(chunks[-1]) + len(text) + 2 <= MIN_CHUNK_CHARS:
        chunks[-1] += "\n\n" + text
    else:
        chunks.append(text)


def _section_chunks(markdown: str) -> list[tuple[str, str]]:
    """Split markdown at headings and blank-line paragraph boundaries."""
    sections: list[tuple[str, str]] = []
    heading = "Introducción"
    lines: list[str] = []

    def flush_paragraph() -> None:
        text = "\n".join(line.strip() for line in lines if line.strip()).strip()
        lines.clear()
        if not text:
            return
        # When an unusually large list/table occurs, split on line boundaries.
        pieces: list[str] = []
        current: list[str] = []
        for line in text.splitlines():
            if current and len("\n".join([*current, line])) > MAX_CHUNK_CHARS:
                pieces.append("\n".join(current))
                current = [line]
            else:
                current.append(line)
        if current:
            pieces.append("\n".join(current))
        sections.extend((heading, piece) for piece in pieces if piece.strip())

    for line in markdown.splitlines():
        match = re.match(r"^(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if match:
            flush_paragraph()
            heading = match.group(2).strip()
        elif line.strip():
            lines.append(line)
        elif lines:
            flush_paragraph()
    flush_paragraph()
    return sections


def chunk_document(path: Path) -> list[Chunk]:
    """Produce semantic chunks with the metadata required by the RAG brief."""
    try:
        slug = SOURCE_SLUGS[path.name]
    except KeyError as exc:
        raise ValueError(f"Unsupported knowledge source: {path.name}") from exc

    content = path.read_text(encoding="utf-8")
    section_chunks = _section_chunks(content)
    if len(section_chunks) < 3:
        raise ValueError(f"{path.name} yielded fewer than 3 semantic chunks")
    return [
        Chunk(
            source_document=slug,
            section=section,
            language="es",
            chunk_index=index,
            text=text,
        )
        for index, (section, text) in enumerate(section_chunks)
    ]


def embed(text: str) -> list[float]:
    """Embed text with the separately configured embedding model.

    Configure OPENAI_BASE_URL for an OpenAI-compatible gateway and set
    EMBEDDING_MODEL_ID and OPENAI_API_KEY in the environment. Generation model
    configuration is intentionally separate and is consumed in a later phase.
    """
    model_id = os.getenv("EMBEDDING_MODEL_ID")
    if not model_id:
        raise RuntimeError("EMBEDDING_MODEL_ID must be configured for indexing")

    client_options: dict[str, Any] = {}
    base_url = os.getenv("OPENAI_BASE_URL")
    if base_url:
        client_options["base_url"] = base_url
    client = OpenAI(**client_options)
    response = client.embeddings.create(model=model_id, input=text)
    return response.data[0].embedding


def _point_id(chunk: Chunk) -> str:
    """Return a stable UUID-shaped point ID for repeatable upserts."""
    key = f"nexova:{chunk.source_document}:{chunk.chunk_index}:{chunk.text}"
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]
    return f"{digest[:8]}-{digest[8:12]}-5{digest[13:16]}-a{digest[17:20]}-{digest[20:32]}"


def _qdrant_client() -> QdrantClient:
    url = os.getenv("QDRANT_URL", "http://localhost:6333")
    api_key = os.getenv("QDRANT_API_KEY")
    return QdrantClient(url=url, api_key=api_key)


def setup(client: QdrantClient | None = None) -> int:
    """Create the collection if needed and idempotently upsert all corpus chunks.

    Returns the number of indexed points. Re-running setup replaces points with
    the same stable IDs instead of duplicating them.
    """
    qdrant = client or _qdrant_client()
    documents = [CORPUS_DIR / filename for filename in SOURCE_SLUGS]
    missing = [str(path) for path in documents if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing knowledge source(s): " + ", ".join(missing))

    chunks = [chunk for path in documents for chunk in chunk_document(path)]
    first_vector = embed(chunks[0].text)
    vector_size = len(first_vector)
    if vector_size == 0:
        raise ValueError("Embedding provider returned an empty vector")

    if not qdrant.collection_exists(COLLECTION_NAME):
        qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=vector_size,
                distance=models.Distance.COSINE,
            ),
        )

    points: list[models.PointStruct] = []
    for index, chunk in enumerate(chunks):
        vector = first_vector if index == 0 else embed(chunk.text)
        if len(vector) != vector_size:
            raise ValueError("Embedding vectors have inconsistent dimensions")
        points.append(
            models.PointStruct(
                id=_point_id(chunk),
                vector=vector,
                payload=chunk.payload(),
            )
        )

    qdrant.upsert(collection_name=COLLECTION_NAME, points=points, wait=True)
    return len(points)


if __name__ == "__main__":
    print(f"Indexed {setup()} chunks into {COLLECTION_NAME}.")
