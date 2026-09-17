from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import StrEnum
import re
from typing import Any


class IncidentCategory(StrEnum):
    TECHNICAL_FAILURE = "technical_failure"
    PROCESS_ERROR = "process_error"
    CLIENT_COMPLAINT = "client_complaint"
    CANDIDATE_ISSUE = "candidate_issue"
    STAFF_ISSUE = "staff_issue"
    SLA_BREACH = "sla_breach"
    DATA_QUALITY = "data_quality"
    OTHER = "other"


class IncidentStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISCARDED = "discarded"


class IncidentOrigin(StrEnum):
    CUSTOMER = "customer"
    BRANCH = "branch"
    INTERNAL = "internal"


class IncidentBranch(StrEnum):
    CENTRAL = "central"
    VALENCIA_OPERATIONS = "valencia_operations"
    MIAMI_OFFICE = "miami_office"
    REMOTE = "remote"


VALID_STATUS_TRANSITIONS: dict[IncidentStatus, frozenset[IncidentStatus]] = {
    IncidentStatus.OPEN: frozenset({IncidentStatus.IN_PROGRESS, IncidentStatus.DISCARDED}),
    IncidentStatus.IN_PROGRESS: frozenset({IncidentStatus.RESOLVED, IncidentStatus.DISCARDED}),
    IncidentStatus.RESOLVED: frozenset(),
    IncidentStatus.DISCARDED: frozenset(),
}

CSV_STATUS_MAP = {
    "OPEN": IncidentStatus.OPEN,
    "CLOSED": IncidentStatus.RESOLVED,
    "DISCARDED": IncidentStatus.DISCARDED,
}

CSV_CATEGORY_MAP = {
    "TECHNICAL": IncidentCategory.TECHNICAL_FAILURE,
    "BILLING": IncidentCategory.PROCESS_ERROR,
    "ACCESS": IncidentCategory.TECHNICAL_FAILURE,
    "HR_QUERY": IncidentCategory.PROCESS_ERROR,
    "COMPLAINT": IncidentCategory.CLIENT_COMPLAINT,
}


class IncidentValidationError(ValueError):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


@dataclass(frozen=True)
class Incident:
    id: str
    title: str
    description: str
    category: IncidentCategory
    status: IncidentStatus
    origin: IncidentOrigin
    branch: IncidentBranch
    created_at: str
    updated_at: str

    def to_record(self) -> dict[str, str]:
        return {key: value.value if isinstance(value, StrEnum) else value for key, value in asdict(self).items()}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_incident_values(values: dict[str, Any]) -> None:
    errors: list[str] = []
    required_fields = (
        "id", "title", "description", "category", "status", "origin",
        "branch", "created_at", "updated_at",
    )

    for field in required_fields:
        if values.get(field) is None or (isinstance(values.get(field), str) and not values[field].strip()):
            errors.append(f"{field} is required")

    for field, enum_type in (
        ("category", IncidentCategory),
        ("status", IncidentStatus),
        ("origin", IncidentOrigin),
        ("branch", IncidentBranch),
    ):
        value = values.get(field)
        if value is not None:
            try:
                enum_type(value)
            except ValueError:
                errors.append(f"{field} has an invalid value: {value}")

    for field in ("created_at", "updated_at"):
        value = values.get(field)
        if value:
            try:
                datetime.fromisoformat(value)
            except ValueError:
                errors.append(f"{field} must be an ISO timestamp")

    if values.get("title") and len(values["title"]) > 120:
        errors.append("title must be 120 characters or fewer")

    if values.get("created_at") and values.get("updated_at"):
        try:
            if datetime.fromisoformat(values["updated_at"]) < datetime.fromisoformat(values["created_at"]):
                errors.append("updated_at cannot be earlier than created_at")
        except ValueError:
            errors.append("updated_at or created_at has an invalid ISO timestamp format")

    if errors:
        raise IncidentValidationError(errors)


def build_incident(
    *,
    incident_id: str,
    title: str,
    description: str,
    category: str | IncidentCategory,
    status: str | IncidentStatus = IncidentStatus.OPEN,
    origin: str | IncidentOrigin,
    branch: str | IncidentBranch,
    created_at: str | None = None,
    updated_at: str | None = None,
) -> Incident:
    created = created_at or utc_now_iso()
    updated = updated_at or created
    values = {
        "id": incident_id,
        "title": title,
        "description": description,
        "category": IncidentCategory(category),
        "status": IncidentStatus(status),
        "origin": IncidentOrigin(origin),
        "branch": IncidentBranch(branch),
        "created_at": created,
        "updated_at": updated,
    }
    validate_incident_values(values)
    return Incident(**values)


def transition_is_valid(current: str | IncidentStatus, target: str | IncidentStatus) -> bool:
    return IncidentStatus(target) in VALID_STATUS_TRANSITIONS[IncidentStatus(current)]


def csv_source_key(row: dict[str, str], title: str, created_at: str) -> str:
    ticket_id = row.get("ticket_id", "").strip()
    return f"csv:ticket:{ticket_id}" if ticket_id else f"csv:fallback:{title}|{created_at}"


def validate_csv_row(row: dict[str, str]) -> None:
    errors: list[str] = []
    ticket_id = row.get("ticket_id", "").strip()
    if not re.fullmatch(r"NXV-\d{6}", ticket_id):
        errors.append("ticket_id is missing or invalid")

    date_value = row.get("date", "").strip()
    try:
        datetime.strptime(date_value, "%Y-%m-%d")
    except ValueError:
        errors.append("date is missing or invalid")

    if not row.get("client_company", "").strip():
        errors.append("client_company is required")
    if row.get("category", "").strip() not in CSV_CATEGORY_MAP:
        errors.append("category is missing or unmappable")
    if len(row.get("description", "")) < 5:
        errors.append("description must contain at least 5 characters")
    if not re.fullmatch(r"AGT-\d{2}", row.get("agent_id", "").strip()):
        errors.append("agent_id is missing or invalid")
    if row.get("status", "").strip() not in CSV_STATUS_MAP:
        errors.append("status is missing or unmappable")

    email = row.get("customer_email", "").strip()
    if not email or "@" not in email:
        errors.append("customer_email is missing or invalid")

    status = row.get("status", "").strip()
    satisfaction = row.get("satisfaction_score", "").strip()
    if status == "CLOSED" and not satisfaction:
        errors.append("CLOSED records require satisfaction_score")
    if satisfaction:
        try:
            score = float(satisfaction.replace(",", "."))
            if not score.is_integer() or not 1 <= score <= 5:
                errors.append("satisfaction_score must be an integer from 1 to 5")
        except ValueError:
            errors.append("satisfaction_score is invalid")

    if errors:
        raise IncidentValidationError(errors)


def transform_csv_row(row: dict[str, str]) -> tuple[str, Incident]:
    validate_csv_row(row)
    description = row.get("description", "")
    title = description[:120].strip()
    if not title:
        raise IncidentValidationError(["description cannot produce an empty title"])

    try:
        created_at = datetime.strptime(row["date"].strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc).isoformat()
        status = CSV_STATUS_MAP[row["status"].strip()]
        category = CSV_CATEGORY_MAP[row["category"].strip()]
    except (KeyError, ValueError) as error:
        raise IncidentValidationError([f"CSV value cannot be mapped: {error}"]) from error

    incident = build_incident(
        incident_id=csv_source_key(row, title, created_at),
        title=title,
        description=description,
        category=category,
        status=status,
        origin=IncidentOrigin.CUSTOMER,
        branch=IncidentBranch.CENTRAL,
        created_at=created_at,
        updated_at=created_at,
    )
    return incident.id, incident