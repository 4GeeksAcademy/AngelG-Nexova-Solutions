import logging
import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from reporting.models import PipelineRun, WeeklyPerformance
from telemetry.capture import CURRENCIES
from telemetry.models import TelemetryEvent

logger = logging.getLogger(__name__)
EVENT_METRICS = {
    "inbound_order_created": "total_material_cost",
    "outbound_order_created": "kits_delivered_count",
    "stock_threshold_triggered": "shortage_events_count",
    "kit_cost_variance_detected": "cost_variance_events_count",
}


class PipelineBusy(Exception):
    pass


class PipelineFailure(Exception):
    pass


def previous_week() -> date:
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=today.weekday() + 7)


def validate_week(week: date) -> None:
    if week.weekday() != 0:
        raise ValueError("week_start debe ser un lunes UTC.")
    # Prevent overflow when computing the exclusive end.
    if week > date.max - timedelta(days=7):
        raise ValueError("week_start fuera de rango.")


def aggregate(events: list[TelemetryEvent]) -> list[dict]:
    groups: dict[tuple[str, str], dict] = {}
    for event in events:
        p = event.properties
        office = p.get("office")
        programme = p.get("programme_id")
        if event.event_version != 1 or office not in CURRENCIES or p.get("currency") != CURRENCIES[office]:
            raise ValueError("Invalid event version or office/currency")
        if not isinstance(programme, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", programme):
            raise ValueError("Invalid programme")
        if p.get("product_category") not in {"training_kit", "certification", "onboarding_equipment"} or type(p.get("product_id")) is not int or p["product_id"] <= 0:
            raise ValueError("Invalid event product")
        quantity = Decimal(str(p.get("quantity")))
        if not quantity.is_finite() or quantity <= 0:
            raise ValueError("Invalid event quantity")
        key = (office, programme)
        group = groups.setdefault(key, {
            "office": office, "programme_id": programme, "currency": CURRENCIES[office],
            "total_material_cost": Decimal("0"), "kits_delivered_count": 0,
            "shortage_events_count": 0, "cost_variance_events_count": 0,
        })
        metric = EVENT_METRICS[event.event_type]
        if event.event_type == "inbound_order_created":
            amount = Decimal(str(p.get("total_cost")))
            if not amount.is_finite() or amount < 0 or amount != amount.quantize(Decimal("0.01")):
                raise ValueError("Invalid inbound cost")
            group[metric] += amount
        else:
            group[metric] += 1
    return [groups[key] for key in sorted(groups)]


def run_pipeline(engine: Engine, week: date) -> PipelineRun:
    validate_week(week)
    start = datetime.combine(week, time.min, timezone.utc)
    end = start + timedelta(days=7)
    run_id = uuid4()
    with engine.connect() as connection:
        session = Session(connection, expire_on_commit=False)
        locked = session.scalar(
            text("SELECT pg_try_advisory_lock(6006, :period)"), {"period": week.toordinal()}
        )
        if not locked:
            session.close()
            raise PipelineBusy("Ya hay una corrida para esta semana.")
        try:
            run = PipelineRun(
                id=run_id, week_start=week, status="running",
                started_at=datetime.now(timezone.utc), events_read=0, rows_written=0,
            )
            session.add(run)
            session.commit()
            try:
                cutoff = datetime.now(timezone.utc)
                events = list(session.scalars(select(TelemetryEvent).where(
                    TelemetryEvent.event_type.in_(EVENT_METRICS),
                    TelemetryEvent.occurred_at >= start,
                    TelemetryEvent.occurred_at < end,
                    TelemetryEvent.recorded_at <= cutoff,
                )).all())
                entries = aggregate(events)
                now = datetime.now(timezone.utc)
                for entry in entries:
                    values = {**entry, "week_start": week, "computed_at": now, "id": uuid4()}
                    statement = insert(WeeklyPerformance).values(**values)
                    statement = statement.on_conflict_do_update(
                        index_elements=["office", "programme_id", "week_start"],
                        set_={key: value for key, value in values.items() if key not in {"id", "office", "programme_id", "week_start"}},
                    )
                    session.execute(statement)
                run.status = "succeeded"
                run.finished_at = now
                run.source_cutoff = cutoff
                run.events_read = len(events)
                run.rows_written = len(entries)
                session.commit()
                return run
            except (SQLAlchemyError, ValueError, InvalidOperation) as error:
                session.rollback()
                run = session.get(PipelineRun, run_id)
                if run is None:
                    logger.error("Weekly reporting failed and its run metadata is unavailable")
                    raise PipelineFailure("No se pudo recuperar la corrida fallida.") from None
                run.status = "failed"
                run.finished_at = datetime.now(timezone.utc)
                run.error_code = "DATABASE_ERROR" if isinstance(error, SQLAlchemyError) else "EVENT_VALIDATION_ERROR"
                logger.error("Weekly reporting failed: %s", run.error_code)
                session.commit()
                raise PipelineFailure("Falló el reporte semanal; consulte la última corrida.") from None
        finally:
            session.rollback()
            session.execute(text("SELECT pg_advisory_unlock(6006, :period)"), {"period": week.toordinal()})
            session.commit()
            session.close()
