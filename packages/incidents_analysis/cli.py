from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .analyzer import analyze_records
from .config import load_config
from .exporter import build_metric_rows, export_results_csv
from .models import AnalysisInputError, AnalysisResult
from .parser import parse_csv_file, parse_csv_text
from .validator import validate_required_columns


INVALID_LABELS = {
    "MISSING_CLIENT_COMPANY": "Missing client_company",
    "INVALID_OR_MISSING_CATEGORY": "Invalid or missing category",
    "INVALID_OR_MISSING_EMAIL": "Invalid or missing email",
    "CLOSED_WITHOUT_SATISFACTION": "Closed ticket, no score",
    "EMPTY_OR_SHORT_DESCRIPTION": "Empty or short description",
    "INVALID_OR_MISSING_AGENT_ID": "Invalid or missing agent_id",
    "INVALID_STATUS": "Invalid or missing status",
    "INVALID_TICKET_ID": "Invalid ticket_id format",
    "INVALID_DATE": "Invalid date format",
    "INVALID_SATISFACTION": "Invalid satisfaction_score",
}

SCORE_LABELS = {
    "1": "Very dissatisfied",
    "2": "Dissatisfied",
    "3": "Neutral",
    "4": "Satisfied",
    "5": "Very satisfied",
}


def _default_config_path() -> str:
    repo_root = Path(__file__).resolve().parents[2]
    return str(repo_root / "scripts" / "incidents_config.json")


def _pct(part: int, total: int) -> str:
    if total == 0:
        return "0.0%"
    return f"{(part / total) * 100:.1f}%"


def _detect_source_name(csv_path: str | None) -> str:
    if not csv_path:
        return "<stdin>"
    return Path(csv_path).name


def _print_summary(result: AnalysisResult, source_file: str) -> None:
    print("=" * 60)
    print("  NEXOVA - SUPPORT TICKET ANALYSIS")
    print(f"  Source file: {source_file}")
    print("=" * 60)
    print()

    print(f"TOTAL RECORDS IN FILE .......... {result.processed_records}")
    print(f"  |- Valid records ............. {result.valid_records}")
    print(f"  '- Invalid / incomplete ...... {result.invalid_records}")
    print()

    print("INVALID RECORDS BREAKDOWN")
    if not result.invalid_by_type:
        print("  (none)")
    else:
        invalid_items = list(result.invalid_by_type.items())
        for idx, (error_type, value) in enumerate(invalid_items):
            branch = "|-" if idx < len(invalid_items) - 1 else "'-"
            label = INVALID_LABELS.get(error_type, error_type)
            print(f"  {branch} {label:<30} {value}")
    print()

    print("BREAKDOWN BY CATEGORY (valid records)")
    category_items = list(result.by_category.items())
    for idx, (category, value) in enumerate(category_items):
        branch = "|-" if idx < len(category_items) - 1 else "'-"
        print(f"  {branch} {category:<28} {value:>3}  ({_pct(value, result.valid_records)})")
    print()

    print("BREAKDOWN BY STATUS (valid records)")
    status_items = list(result.by_status.items())
    for idx, (status, value) in enumerate(status_items):
        branch = "|-" if idx < len(status_items) - 1 else "'-"
        print(f"  {branch} {status:<28} {value:>3}  ({_pct(value, result.valid_records)})")
    print()

    print("SATISFACTION INDEX (closed tickets)")
    print(
        "  Scored tickets: "
        f"{result.closed_with_satisfaction} of {result.closed_valid_records}"
    )
    average = (
        "N/A"
        if result.average_satisfaction_closed is None
        else f"{result.average_satisfaction_closed:.2f}"
    )
    print(f"  Average score: {average} / 5.00")
    score_items = list(result.satisfaction_distribution.items())
    for idx, (score, value) in enumerate(score_items):
        branch = "|-" if idx < len(score_items) - 1 else "'-"
        label = SCORE_LABELS.get(score, "Unknown")
        print(f"  {branch} Score {score} ({label}) ... {value}")
    print()

    print("=" * 60)


def _analyze(csv_text: str, config_path: str) -> AnalysisResult:
    config = load_config(config_path)
    headers, records = parse_csv_text(csv_text)
    validate_required_columns(headers, config)
    return analyze_records(records, config)


def analyze_file(csv_path: str, config_path: str) -> AnalysisResult:
    config = load_config(config_path)
    headers, records = parse_csv_file(csv_path)
    validate_required_columns(headers, config)
    return analyze_records(records, config)


def _success_payload(result: AnalysisResult) -> dict[str, Any]:
    payload = result.to_dict()
    payload["export_rows"] = build_metric_rows(result)
    return payload


def _error_payload(error: AnalysisInputError) -> dict[str, Any]:
    return {
        "error": {
            "code": error.code,
            "message": error.message,
        }
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Analizador de incidencias CSV")
    parser.add_argument("csv_path", nargs="?", help="Ruta al CSV a analizar")
    parser.add_argument(
        "--config",
        default=_default_config_path(),
        help="Ruta al JSON de configuracion",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Imprime la salida en JSON",
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Lee el CSV desde stdin",
    )
    parser.add_argument(
        "--no-prompt-export",
        action="store_true",
        help="No pregunta por exportacion al terminar",
    )
    parser.add_argument(
        "--export-path",
        default="results.csv",
        help="Ruta de salida para exportacion CSV",
    )

    args = parser.parse_args()

    if not args.stdin and not args.csv_path:
        parser.error("Debes indicar una ruta CSV o usar --stdin.")

    try:
        if args.stdin:
            csv_text = sys.stdin.read()
            result = _analyze(csv_text=csv_text, config_path=args.config)
        else:
            result = analyze_file(csv_path=args.csv_path, config_path=args.config)
    except AnalysisInputError as error:
        if args.json:
            print(json.dumps(_error_payload(error), ensure_ascii=False))
        else:
            print(f"Error ({error.code}): {error.message}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(_success_payload(result), ensure_ascii=False))
        return 0

    _print_summary(result, source_file=_detect_source_name(args.csv_path))

    if args.no_prompt_export:
        return 0

    answer = input("¿Deseas exportar los resultados a CSV? [s / n] ").strip().lower()
    if answer in {"s", "y"}:
        output_file = export_results_csv(result, args.export_path)
        print(f"Resultados exportados en: {output_file}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
