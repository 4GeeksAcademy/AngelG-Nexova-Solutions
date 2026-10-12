from __future__ import annotations

import csv
from pathlib import Path

from .models import AnalysisResult


def build_metric_rows(result: AnalysisResult) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    rows.extend(
        [
            {"section": "records", "metric": "total_processed", "value": str(result.processed_records)},
            {"section": "records", "metric": "total_valid", "value": str(result.valid_records)},
            {"section": "records", "metric": "total_invalid", "value": str(result.invalid_records)},
        ]
    )

    for category, value in result.by_category.items():
        rows.append(
            {
                "section": "by_category",
                "metric": category,
                "value": str(value),
            }
        )

    for status, value in result.by_status.items():
        rows.append(
            {
                "section": "by_status",
                "metric": status,
                "value": str(value),
            }
        )

    average = (
        "N/A"
        if result.average_satisfaction_closed is None
        else f"{result.average_satisfaction_closed:.2f}"
    )
    rows.append(
        {
            "section": "satisfaction",
            "metric": "average_closed",
            "value": average,
        }
    )
    rows.append(
        {
            "section": "satisfaction",
            "metric": "closed_with_score",
            "value": str(result.closed_with_satisfaction),
        }
    )
    rows.append(
        {
            "section": "satisfaction",
            "metric": "closed_valid_records",
            "value": str(result.closed_valid_records),
        }
    )

    for score, value in result.satisfaction_distribution.items():
        rows.append(
            {
                "section": "satisfaction_distribution",
                "metric": f"score_{score}",
                "value": str(value),
            }
        )

    for error_type, value in result.invalid_by_type.items():
        rows.append(
            {
                "section": "invalid_records",
                "metric": error_type,
                "value": str(value),
            }
        )

    return rows


def export_results_csv(result: AnalysisResult, output_path: str) -> str:
    path = Path(output_path)
    rows = build_metric_rows(result)

    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=["section", "metric", "value"])
        writer.writeheader()
        writer.writerows(rows)

    return str(path)
