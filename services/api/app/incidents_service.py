from __future__ import annotations

import csv
import io
import sys
import threading
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.incidents_analysis.analyzer import analyze_records
from packages.incidents_analysis.config import load_config
from packages.incidents_analysis.exporter import build_metric_rows
from packages.incidents_analysis.models import AnalysisInputError, AnalysisResult
from packages.incidents_analysis.parser import parse_csv_text
from packages.incidents_analysis.validator import validate_required_columns


CONFIG_PATH = str(REPO_ROOT / "scripts" / "incidents_config.json")

_last_result_lock = threading.Lock()
_last_result: AnalysisResult | None = None


def analyze_csv_content(csv_text: str) -> dict[str, Any]:
    config = load_config(CONFIG_PATH)
    headers, records = parse_csv_text(csv_text)
    validate_required_columns(headers, config)
    result = analyze_records(records, config)
    save_last_result(result)

    payload = result.to_dict()
    payload["export_rows"] = build_metric_rows(result)
    return payload


def save_last_result(result: AnalysisResult) -> None:
    global _last_result
    with _last_result_lock:
        _last_result = result


def get_last_result() -> AnalysisResult | None:
    with _last_result_lock:
        return _last_result


def clear_last_result() -> None:
    global _last_result
    with _last_result_lock:
        _last_result = None


def analysis_result_to_csv(result: AnalysisResult) -> str:
    rows = build_metric_rows(result)
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=["section", "metric", "value"])
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()
