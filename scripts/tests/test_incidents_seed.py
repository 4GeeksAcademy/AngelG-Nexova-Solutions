import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from packages.shared.incidents import (  # noqa: E402
    IncidentValidationError,
    IncidentCategory,
    IncidentStatus,
    build_incident,
    transform_csv_row,
    transition_is_valid,
)


def test_transform_csv_row_applies_context_mappings():
    source = {
        "ticket_id": "NXV-000001",
        "date": "2024-01-18",
        "client_company": "FinServ Group",
        "category": "ACCESS",
        "description": "Role permissions not updated after department change",
        "agent_id": "AGT-08",
        "status": "CLOSED",
        "customer_email": "customer@example.com",
        "satisfaction_score": "5",
    }

    source_key, incident = transform_csv_row(source)

    assert source_key == "csv:ticket:NXV-000001"
    assert incident.category is IncidentCategory.TECHNICAL_FAILURE
    assert incident.status is IncidentStatus.RESOLVED
    assert incident.origin.value == "customer"
    assert incident.branch.value == "central"
    assert incident.created_at == "2024-01-18T00:00:00+00:00"
    assert incident.updated_at == incident.created_at


def test_transform_csv_row_rejects_unmappable_values():
    with pytest.raises(IncidentValidationError):
        transform_csv_row({
            "ticket_id": "NXV-000001",
            "date": "2024-01-18",
            "category": "UNKNOWN",
            "description": "An incident",
            "status": "OPEN",
            "client_company": "Nexova",
            "agent_id": "AGT-01",
            "customer_email": "customer@example.com",
        })


def test_incident_validation_and_transitions():
    incident = build_incident(
        incident_id="csv:ticket:NXV-000001",
        title="Incident",
        description="Description",
        category="other",
        origin="internal",
        branch="remote",
    )

    assert incident.status is IncidentStatus.OPEN
    assert transition_is_valid("open", "in_progress")
    assert transition_is_valid("in_progress", "resolved")
    assert not transition_is_valid("resolved", "open")