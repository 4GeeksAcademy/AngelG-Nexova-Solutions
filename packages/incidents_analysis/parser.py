from __future__ import annotations

import csv
from io import StringIO
from pathlib import Path

from .models import AnalysisInputError


def parse_csv_text(csv_text: str) -> tuple[list[str], list[dict[str, str]]]:
    if not csv_text.strip():
        raise AnalysisInputError(
            code="EMPTY_CSV",
            message="El archivo CSV esta vacio.",
        )

    stream = StringIO(csv_text)

    try:
        reader = csv.DictReader(stream, strict=True)
        headers = list(reader.fieldnames or [])
    except csv.Error as error:
        raise AnalysisInputError(
            code="MALFORMED_CSV",
            message=f"No se pudo leer el CSV: {error}",
        ) from error

    if not headers:
        raise AnalysisInputError(
            code="MISSING_HEADERS",
            message="El CSV no contiene encabezados.",
        )

    normalized_headers = [header.strip() for header in headers if header]
    if not normalized_headers:
        raise AnalysisInputError(
            code="MISSING_HEADERS",
            message="El CSV no contiene encabezados validos.",
        )

    records: list[dict[str, str]] = []
    try:
        for raw_row in reader:
            row: dict[str, str] = {}
            for key in normalized_headers:
                value = raw_row.get(key)
                row[key] = "" if value is None else str(value).strip()
            records.append(row)
    except csv.Error as error:
        raise AnalysisInputError(
            code="MALFORMED_CSV",
            message=f"CSV corrupto: {error}",
        ) from error

    return normalized_headers, records


def parse_csv_file(csv_path: str) -> tuple[list[str], list[dict[str, str]]]:
    path = Path(csv_path)
    if not path.exists() and not path.is_absolute() and path.parent == Path("."):
        repo_root = Path(__file__).resolve().parents[2]
        fallback_scripts = repo_root / "scripts" / path
        fallback_root = repo_root / path
        if fallback_scripts.exists():
            path = fallback_scripts
        elif fallback_root.exists():
            path = fallback_root

    if not path.exists():
        raise AnalysisInputError(
            code="FILE_NOT_FOUND",
            message=f"No existe el fichero CSV: {csv_path}",
        )
    if not path.is_file():
        raise AnalysisInputError(
            code="INVALID_FILE",
            message=f"La ruta no apunta a un fichero: {csv_path}",
        )

    try:
        csv_text = path.read_text(encoding="utf-8")
    except OSError as error:
        raise AnalysisInputError(
            code="UNREADABLE_FILE",
            message=f"No se pudo leer el fichero CSV: {error}",
        ) from error

    return parse_csv_text(csv_text)
