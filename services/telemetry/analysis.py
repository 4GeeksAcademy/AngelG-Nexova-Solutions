"""Technical telemetry report; never exposes event payloads or actors."""

from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, select

from telemetry.models import TelemetryEvent

EVENT_TYPES = (
    "inbound_order_created", "outbound_order_created",
    "stock_threshold_triggered", "direct_stock_edit_rejected",
    "kit_cost_variance_detected",
)


class EventCount(BaseModel):
    event_type: str
    count: int


class TechnicalReport(BaseModel):
    generated_at: datetime
    start: datetime | None
    end: datetime | None
    total_events: int
    event_counts: list[EventCount]
    unknown_event_count: int
    first_event_at: datetime | None
    last_event_at: datetime | None


def technical_report(
    session: Session, start: datetime | None = None, end: datetime | None = None,
) -> TechnicalReport:
    for value in (start, end):
        if value is not None and value.tzinfo is None:
            raise ValueError("Las fechas requieren zona horaria.")
    if start is not None and end is not None and start >= end:
        raise ValueError("start debe ser anterior a end.")
    conditions = []
    if start is not None:
        conditions.append(TelemetryEvent.occurred_at >= start)
    if end is not None:
        conditions.append(TelemetryEvent.occurred_at < end)
    counts = dict(session.exec(
        select(TelemetryEvent.event_type, func.count())
        .where(*conditions).group_by(TelemetryEvent.event_type)
    ).all())
    first, last = session.exec(
        select(func.min(TelemetryEvent.occurred_at), func.max(TelemetryEvent.occurred_at))
        .where(*conditions)
    ).one()
    # SQLite test fixtures return naive datetimes; PostgreSQL returns aware values.
    def utc(value: datetime | None) -> datetime | None:
        return value.replace(tzinfo=timezone.utc) if value is not None and value.tzinfo is None else value

    return TechnicalReport(
        generated_at=datetime.now(timezone.utc), start=start, end=end,
        total_events=sum(counts.values()),
        event_counts=[EventCount(event_type=kind, count=counts.get(kind, 0)) for kind in EVENT_TYPES],
        unknown_event_count=sum(count for kind, count in counts.items() if kind not in EVENT_TYPES),
        first_event_at=utc(first), last_event_at=utc(last),
    )
