from __future__ import annotations

import csv
import io
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.shared.incidents import IncidentValidationError, transform_csv_row


CSV_PATH = REPO_ROOT / "scripts" / "incidents-nexova.csv"
HISTORICAL_CSV_OBJECT = "origin/Analizador-de-Incidencias:scripts/incidents-nexova.csv"


def open_historical_csv(csv_path: Path) -> io.TextIOBase:
    if csv_path.exists():
        return csv_path.open(newline="", encoding="utf-8")

    try:
        content = subprocess.check_output(
            ["git", "show", HISTORICAL_CSV_OBJECT],
            cwd=REPO_ROOT,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise FileNotFoundError(
            f"No se encontró el CSV en {csv_path} ni en {HISTORICAL_CSV_OBJECT}"
        ) from error
    return io.StringIO(content)


def seed_incidents(csv_path: Path = CSV_PATH) -> dict[str, int]:
    from services.api.database import incidents_table

    stats = {"processed": 0, "inserted": 0, "duplicates": 0, "invalid": 0}
    with open_historical_csv(csv_path) as csv_file:
        reader = csv.DictReader(csv_file)
        required_columns = {"ticket_id", "date", "category", "description", "status"}
        missing = required_columns - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Faltan columnas obligatorias: {', '.join(sorted(missing))}")

        existing_ids = {record["id"] for record in incidents_table.all()}
        for row_number, row in enumerate(reader, start=2):
            stats["processed"] += 1
            try:
                incident_id, incident = transform_csv_row(row)
            except (IncidentValidationError, KeyError, ValueError) as error:
                stats["invalid"] += 1
                print(f"Fila {row_number} descartada: {error}", file=sys.stderr)
                continue

            if incident_id in existing_ids:
                stats["duplicates"] += 1
                continue

            incidents_table.insert(incident.to_record())
            existing_ids.add(incident_id)
            stats["inserted"] += 1

    print(
        "Seed de incidencias: "
        f"procesadas={stats['processed']} "
        f"insertadas={stats['inserted']} "
        f"duplicadas={stats['duplicates']} "
        f"inválidas={stats['invalid']}"
    )
    return stats


if __name__ == "__main__":
    seed_incidents()