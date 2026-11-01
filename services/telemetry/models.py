from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel


class TelemetryEvent(SQLModel, table=True):
    __tablename__ = "telemetry_events"
    __table_args__ = (
        UniqueConstraint("source_id", "event_type", name="uq_telemetry_origin_type"),
    )

    event_id: UUID = Field(default_factory=uuid4, primary_key=True)
    event_type: str = Field(index=True)
    event_version: int = 1
    occurred_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True)
    )
    source: str = "inventory"
    source_id: str
    actor_id: str | None = None
    properties: dict = Field(sa_type=JSON)
