from __future__ import annotations

import csv
import io
import subprocess
import sys
import traceback
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.shared.incidents import IncidentValidationError, transform_csv_row


CSV_PATH = REPO_ROOT / "scripts" / "incidents-nexova.csv"
HISTORICAL_CSV_OBJECT = "origin/Analizador-de-Incidencias:scripts/incidents-nexova.csv"
REQUIRED_COLUMNS = {"ticket_id", "date", "category", "description", "status"}


def _check_csv_file(csv_path: Path) -> None:
    """Verifica que el archivo CSV exista, sea un archivo y no esté vacío."""
    if not csv_path.exists():
        raise FileNotFoundError(
            f"CSV no encontrado: {csv_path}"
        )
    if not csv_path.is_file():
        raise IsADirectoryError(
            f"La ruta del CSV corresponde a un directorio: {csv_path}"
        )
    file_size = csv_path.stat().st_size
    if file_size == 0:
        raise ValueError(
            f"El archivo CSV está vacío: {csv_path} (0 bytes)"
        )


def open_historical_csv(csv_path: Path) -> io.TextIOBase:
    if csv_path.exists():
        _check_csv_file(csv_path)
        try:
            return csv_path.open(newline="", encoding="utf-8")
        except OSError as error:
            raise OSError(
                f"No se pudo abrir el archivo CSV {csv_path}: {error}"
            ) from error

    try:
        content = subprocess.check_output(
            ["git", "show", HISTORICAL_CSV_OBJECT],
            cwd=REPO_ROOT,
            text=True,
        )
    except OSError as error:
        raise FileNotFoundError(
            f"No se encontró el CSV en {csv_path} ni se pudo ejecutar git: {error}"
        ) from error
    except subprocess.CalledProcessError as error:
        raise FileNotFoundError(
            f"No se encontró el CSV en {csv_path} ni en el objeto git "
            f"{HISTORICAL_CSV_OBJECT}"
        ) from error

    if not content.strip():
        raise ValueError(
            f"El objeto git {HISTORICAL_CSV_OBJECT} está vacío"
        )

    return io.StringIO(content)


def seed_incidents(csv_path: Path = CSV_PATH) -> dict[str, int]:
    from services.api.database import incidents_table

    stats = {"processed": 0, "inserted": 0, "duplicates": 0, "invalid": 0}

    try:
        csv_file = open_historical_csv(csv_path)
    except (FileNotFoundError, IsADirectoryError, OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)

    with csv_file:
        reader = csv.DictReader(csv_file)
        fieldnames = reader.fieldnames or []
        missing = REQUIRED_COLUMNS - set(fieldnames)
        if missing:
            print(
                f"ERROR: Faltan columnas obligatorias en el CSV: "
                f"{', '.join(sorted(missing))}. "
                f"Columnas encontradas: {', '.join(fieldnames)}",
                file=sys.stderr,
            )
            sys.exit(1)

        try:
            existing_ids = {record["id"] for record in incidents_table.all()}
        except Exception as error:
            print(
                f"ERROR: No se pudieron leer las incidencias existentes: {error}",
                file=sys.stderr,
            )
            sys.exit(1)

        row_count = 0
        for row_number, row in enumerate(reader, start=2):
            row_count += 1
            stats["processed"] += 1
            try:
                incident_id, incident = transform_csv_row(row)
            except (IncidentValidationError, KeyError, ValueError) as error:
                stats["invalid"] += 1
                print(
                    f"Fila {row_number} descartada: {error}",
                    file=sys.stderr,
                )
                continue

            if incident_id in existing_ids:
                stats["duplicates"] += 1
                continue

            try:
                incidents_table.insert(incident.to_record())
            except Exception as error:
                print(
                    f"ERROR: No se pudo insertar fila {row_number} "
                    f"(ticket {incident_id}): {error}",
                    file=sys.stderr,
                )
                stats["invalid"] += 1
                continue

            existing_ids.add(incident_id)
            stats["inserted"] += 1

    if row_count == 0:
        print("ADVERTENCIA: El archivo CSV no contiene filas de datos.", file=sys.stderr)

    print(
        "Seed de incidencias: "
        f"procesadas={stats['processed']} "
        f"insertadas={stats['inserted']} "
        f"duplicadas={stats['duplicates']} "
        f"inválidas={stats['invalid']}"
    )
    return stats


def main() -> None:
    try:
        seed_incidents()
    except Exception as exc:
        print(
            f"Error al ejecutar seed_incidents: {exc}",
            file=sys.stderr,
        )
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()