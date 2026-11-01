from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


IncidentChannel = Literal["email", "slack", "helpdesk_ticket", "client_call", "dashboard"]
IncidentType = Literal[
    "sla_breach",
    "client_escalation",
    "system_outage",
    "data_issue",
    "staffing_gap",
    "compliance_flag",
]
IncidentSeverity = Literal["critical", "high", "medium", "low"]
ResponsibleArea = Literal[
    "marketing",
    "sales",
    "hr_internal",
    "talent_selection",
    "corporate_training",
    "customer_support",
    "technology",
]
IncidentStatus = Literal["open", "assigned", "in_progress", "resolved", "closed", "reopened"]


class IncidentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_name: str | None = None
    channel: IncidentChannel
    type: IncidentType
    severity: IncidentSeverity
    responsible_area: ResponsibleArea
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    assigned_to: str | None = None
    sla_deadline: datetime | None = None

    @field_validator("client_name", "assigned_to")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("value cannot be blank")
        return value

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title cannot be blank")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("description cannot be blank")
        return value

    @model_validator(mode="after")
    def validate_sla_deadline(self) -> "IncidentCreate":
        if self.type == "sla_breach" and self.sla_deadline is None:
            raise ValueError("sla_deadline is required for sla_breach incidents")
        if self.type != "sla_breach" and self.sla_deadline is not None:
            raise ValueError("sla_deadline must be null unless type is sla_breach")
        return self


class IncidentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_name: str | None = None
    channel: IncidentChannel | None = None
    type: IncidentType | None = None
    severity: IncidentSeverity | None = None
    responsible_area: ResponsibleArea | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    assigned_to: str | None = None
    sla_deadline: datetime | None = None

    @field_validator("client_name", "assigned_to")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("value cannot be blank")
        return value

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("title cannot be blank")
        return value

    @field_validator("description")
    @classmethod
    def validate_patch_description(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("description cannot be blank")
        return value

    @model_validator(mode="after")
    def validate_non_nullable_fields(self) -> "IncidentUpdate":
        for field in (
            "channel",
            "type",
            "severity",
            "responsible_area",
            "title",
            "description",
        ):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class IncidentStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: IncidentStatus


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_name: str | None
    channel: IncidentChannel
    type: IncidentType
    severity: IncidentSeverity
    responsible_area: ResponsibleArea
    title: str
    description: str
    status: IncidentStatus
    assigned_to: str | None
    sla_deadline: datetime | None
    resolved_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    is_archived: bool


class IncidentAuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_id: str
    change_type: str
    old_value: str | None
    new_value: str | None
    occurred_at: datetime
    actor_id: str
    actor_email: str | None


class IncidentListResponse(BaseModel):
    items: list[IncidentResponse]
    total: int
    limit: int
    offset: int


class IncidentSummaryResponse(BaseModel):
    total: int
    by_status: dict[str, int]
    by_severity: dict[str, int]
    overdue_sla: int
