"""Manual/scheduler entrypoint: python -m reporting.cli [--week-start YYYY-MM-DD]."""

import argparse
import logging
import time
from datetime import date, datetime, timedelta, timezone

import database
from reporting.pipeline import PipelineBusy, PipelineFailure, previous_week, run_pipeline
from telemetry.capture import require_hito6_schema


def next_monday(now: datetime) -> datetime:
    monday = (now - timedelta(days=now.weekday())).replace(hour=6, minute=0, second=0, microsecond=0)
    return monday if monday > now else monday + timedelta(days=7)


def main() -> None:
    parser = argparse.ArgumentParser(description="Reporte semanal de inventario")
    parser.add_argument("--week-start", type=date.fromisoformat)
    parser.add_argument("--schedule", action="store_true", help="Ejecutar cada lunes a las 06:00 UTC.")
    args = parser.parse_args()
    if database.engine is None:
        parser.error("DATABASE_URL debe apuntar a PostgreSQL.")
    require_hito6_schema(database.engine)
    if args.schedule:
        if args.week_start is not None:
            parser.error("--schedule no se combina con --week-start.")
        logging.basicConfig(level=logging.INFO)
        while True:
            # Catch up the last completed week on startup as well as every Monday.
            week = previous_week()
            for attempt in range(3):
                try:
                    run = run_pipeline(database.engine, week)
                    logging.info("Weekly reporting succeeded: week=%s rows=%s", week, run.rows_written)
                    break
                except (PipelineBusy, PipelineFailure):
                    logging.error("Weekly reporting did not complete: attempt=%s/3", attempt + 1)
                    if attempt < 2:
                        time.sleep(60)
            now = datetime.now(timezone.utc)
            due = next_monday(now)
            time.sleep((due - now).total_seconds())
    run = run_pipeline(database.engine, args.week_start or previous_week())
    print(f"Corrida {run.id}: {run.status}, semana={run.week_start}, filas={run.rows_written}.")


if __name__ == "__main__":
    main()
