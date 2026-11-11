"""Evaluate exact relevant-chunk retrieval for the Nexova knowledge base."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from data.pipelines.rag import DEFAULT_MIN_SCORE, retrieve

QUERY_FILE = Path(__file__).with_name("test-queries.json")
TOP_K = 3
TARGET = 0.8


def evaluate() -> dict[str, Any]:
    queries = json.loads(QUERY_FILE.read_text(encoding="utf-8"))
    if not queries:
        raise ValueError("The retrieval evaluation dataset must not be empty")

    hits = 0
    results: list[dict[str, Any]] = []

    for item in queries:
        relevant_chunks = set(item["relevant_chunks"])
        if not relevant_chunks:
            raise ValueError(f"No relevant chunks labelled for: {item['question']}")

        chunks = retrieve(
            item["question"],
            k=TOP_K,
            min_score=DEFAULT_MIN_SCORE,
        )
        top_chunks = [
            f"{chunk.get('source_document')}:{chunk.get('chunk_index')}"
            for chunk in chunks[:TOP_K]
        ]
        matched_chunks = sorted(relevant_chunks.intersection(top_chunks))
        hit = bool(matched_chunks)
        hits += int(hit)

        results.append({
            "question": item["question"],
            "hit": hit,
            "relevant_chunks": sorted(relevant_chunks),
            "matched_chunks": matched_chunks,
            "top_chunks": top_chunks,
        })

    recall_at_3 = hits / len(queries)
    report = {
        "metric": "proportion of questions with a relevant chunk in the top 3",
        "threshold": DEFAULT_MIN_SCORE,
        "k": TOP_K,
        "recall_at_3": recall_at_3,
        "hits": hits,
        "total": len(queries),
        "target": TARGET,
        "target_met": recall_at_3 >= TARGET,
        "results": results,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return report


if __name__ == "__main__":
    evaluate()