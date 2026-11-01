from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


class ManagedIncident(SQLModel, table=True):
    """SQL-backed incident contract introduced alongside the legacy API."""

    __tablename__ = "managed_incident"

    id: str = Field(primary_key=True, index=True)
    client_name: str | None = None
    channel: str
    type: str
    severity: str
    responsible_area: str
    title: str
    description: str
    status: str = Field(default="open", index=True)
    assigned_to: str | None = None
    sla_deadline: datetime | None = Field(
        default=None, index=True, sa_type=DateTime(timezone=True)
    )
    resolved_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    closed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
    )
    is_archived: bool = Field(default=False, index=True)


class IncidentAuditEvent(SQLModel, table=True):
    """Append-only audit record for incident creation and material changes."""

    __tablename__ = "incident_audit_event"

    id: str = Field(primary_key=True, index=True)
    incident_id: str = Field(foreign_key="managed_incident.id", index=True)
    change_type: str
    old_value: str | None = None
    new_value: str | None = None
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    actor_id: str
    actor_email: str | None = None
