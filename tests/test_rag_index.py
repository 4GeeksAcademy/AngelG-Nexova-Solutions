from pathlib import Path

import pytest

from data.process.rag_index import CORPUS_DIR, COLLECTION_NAME, SOURCE_SLUGS, chunk_document


def test_all_sources_have_three_or_more_semantic_chunks() -> None:
    for filename in SOURCE_SLUGS:
        chunks = chunk_document(CORPUS_DIR / filename)
        assert len(chunks) >= 3
        assert all(chunk.text.strip() for chunk in chunks)
        assert all(chunk.language == "es" for chunk in chunks)
        assert [chunk.chunk_index for chunk in chunks] == list(range(len(chunks)))


def test_payload_contains_required_metadata() -> None:
    chunk = chunk_document(CORPUS_DIR / next(iter(SOURCE_SLUGS)))[0]
    assert chunk.payload() == {
        "company": "nexova",
        "source_document": "service-lines",
        "section": "Líneas de Servicio",
        "language": "es",
        "chunk_index": 0,
        "text": chunk.text,
    }


def test_unknown_source_is_rejected(tmp_path: Path) -> None:
    unknown = tmp_path / "other.md"
    unknown.write_text("# Otro\n\nTexto", encoding="utf-8")
    with pytest.raises(ValueError, match="Unsupported knowledge source"):
        chunk_document(unknown)


def test_collection_name_matches_brief() -> None:
    assert COLLECTION_NAME == "nexova_knowledge"
