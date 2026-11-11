from collections.abc import Generator
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import incident_models  # noqa: F401 — register incident tables
from auth import get_current_user
import database
from database import get_db
from main import app


@pytest.fixture
def managed_incidents_client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enforce_foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")

    SQLModel.metadata.create_all(engine)

    def override_get_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "phase1-test-user",
        "email": "phase1@example.test",
    }
    configured_engine = database.engine
    database.engine = None
    try:
        with TestClient(app) as client:
            yield client
    finally:
        database.engine = configured_engine
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        engine.dispose()


def payload(**overrides):
    value = {
        "client_name": "Cliente de prueba",
        "channel": "helpdesk_ticket",
        "type": "client_escalation",
        "severity": "high",
        "responsible_area": "customer_support",
        "title": "Escalación de cliente",
        "description": "Descripción de prueba suficiente.",
        "assigned_to": None,
        "sla_deadline": None,
    }
    value.update(overrides)
    return value


def test_managed_routes_require_authentication(managed_incidents_client):
    app.dependency_overrides.pop(get_current_user, None)
    response = managed_incidents_client.get("/v2/incidents")
    assert response.status_code == 401
    assert managed_incidents_client.delete("/v2/incidents/missing/permanent").status_code == 401


def test_create_incident_creates_audit_and_enforces_catalog_and_sla(managed_incidents_client):
    invalid = managed_incidents_client.post(
        "/v2/incidents", json=payload(type="sla_breach")
    )
    assert invalid.status_code == 400

    invalid_catalog = managed_incidents_client.post(
        "/v2/incidents", json=payload(severity="urgent")
    )
    assert invalid_catalog.status_code == 400

    created = managed_incidents_client.post(
        "/v2/incidents",
        json=payload(type="sla_breach", sla_deadline=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()),
    )
    assert created.status_code == 201
    incident = created.json()
    assert incident["status"] == "open"
    history = managed_incidents_client.get(f"/v2/incidents/{incident['id']}/history")
    assert history.status_code == 200
    assert len(history.json()) == 1
    assert history.json()[0]["change_type"] == "created"
    assert history.json()[0]["actor_id"] == "phase1-test-user"


def test_patch_preserves_sla_invariant_for_combined_changes(managed_incidents_client):
    created = managed_incidents_client.post(
        "/v2/incidents",
        json=payload(type="sla_breach", sla_deadline=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()),
    )
    assert created.status_code == 201
    incident_id = created.json()["id"]

    remove_deadline = managed_incidents_client.patch(
        f"/v2/incidents/{incident_id}", json={"sla_deadline": None}
    )
    assert remove_deadline.status_code == 422

    change_type_only = managed_incidents_client.patch(
        f"/v2/incidents/{incident_id}", json={"type": "client_escalation"}
    )
    assert change_type_only.status_code == 422

    change_both = managed_incidents_client.patch(
        f"/v2/incidents/{incident_id}",
        json={"type": "client_escalation", "sla_deadline": None},
    )
    assert change_both.status_code == 200
    assert change_both.json()["type"] == "client_escalation"
    assert change_both.json()["sla_deadline"] is None


def test_legacy_routes_remain_compatible(managed_incidents_client):
    response = managed_incidents_client.post(
        "/incidents",
        json={
            "title": "Incidencia legacy",
            "description": "Contrato antiguo aún disponible.",
            "category": "technical_failure",
            "origin": "internal",
            "branch": "central",
        },
    )
    assert response.status_code == 201
    assert "category" in response.json()
    assert managed_incidents_client.get("/incidents/summary").status_code == 200


def test_transitions_assignment_audit_filters_and_archive(managed_incidents_client):
    created = managed_incidents_client.post("/v2/incidents", json=payload())
    assert created.status_code == 201
    incident = created.json()
    incident_id = incident["id"]

    invalid = managed_incidents_client.patch(
        f"/v2/incidents/{incident_id}/status", json={"status": "resolved"}
    )
    assert invalid.status_code == 409

    for target in ("assigned", "in_progress", "resolved", "reopened", "assigned", "in_progress", "resolved", "closed"):
        result = managed_incidents_client.patch(
            f"/v2/incidents/{incident_id}/status", json={"status": target}
        )
        assert result.status_code == 200
        if target == "resolved":
            resolved_snapshot = result.json()["resolved_at"]
    assert result.json()["closed_at"] is not None
    assert result.json()["resolved_at"] == resolved_snapshot

    update = managed_incidents_client.patch(
        f"/v2/incidents/{incident_id}",
        json={"responsible_area": "technology", "assigned_to": "Agente"},
    )
    assert update.status_code == 200

    history = managed_incidents_client.get(f"/v2/incidents/{incident_id}/history").json()
    assert [item["change_type"] for item in history].count("status") == 8
    assert "responsible_area" in [item["change_type"] for item in history]
    assert "assigned_to" in [item["change_type"] for item in history]

    filtered = managed_incidents_client.get(
        "/v2/incidents", params={"severity": "high", "responsible_area": "technology"}
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["id"] == incident_id

    archived = managed_incidents_client.delete(f"/v2/incidents/{incident_id}")
    assert archived.status_code == 204
    assert managed_incidents_client.get("/v2/incidents").json()["total"] == 0
    assert len(managed_incidents_client.get(f"/v2/incidents/{incident_id}/history").json()) == 12
    other = managed_incidents_client.post("/v2/incidents", json=payload(title="Conservar")).json()
    assert managed_incidents_client.delete(f"/v2/incidents/{incident_id}/permanent").status_code == 204
    assert managed_incidents_client.get(f"/v2/incidents/{incident_id}/history").status_code == 404
    assert managed_incidents_client.get(f"/v2/incidents/{other['id']}").status_code == 200
    assert managed_incidents_client.delete(f"/v2/incidents/{incident_id}/permanent").status_code == 404


def test_sla_filter_and_summary(managed_incidents_client):
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    created = managed_incidents_client.post(
        "/v2/incidents", json=payload(type="sla_breach", sla_deadline=past)
    )
    assert created.status_code == 201

    overdue = managed_incidents_client.get("/v2/incidents", params={"overdue_sla": "true"})
    assert overdue.json()["total"] == 1
    summary = managed_incidents_client.get("/v2/incidents/summary").json()
    assert summary["overdue_sla"] == 1
    assert summary["by_severity"]["high"] == 1
    invalid_filter = managed_incidents_client.get("/v2/incidents", params={"severity": "urgent"})
    assert invalid_filter.status_code == 400
    assert summary["by_status"] == {
        "open": 1,
        "assigned": 0,
        "in_progress": 0,
        "resolved": 0,
        "closed": 0,
        "reopened": 0,
    }
    for index in range(12):
        assert managed_incidents_client.post(
            "/v2/incidents", json=payload(title=f"Busqueda {index}", client_name="Cliente % literal")
        ).status_code == 201
    result = managed_incidents_client.get(
        "/v2/incidents", params={"search": "BUSQUEDA", "limit": 10, "offset": 10}
    ).json()
    assert result["total"] == 12
    assert len(result["items"]) == 2
    assert managed_incidents_client.get("/v2/incidents", params={"search": "%"}).json()["total"] == 12
    assert managed_incidents_client.get("/v2/incidents", params={"search": "No existe"}).json()["total"] == 0
    assert managed_incidents_client.get("/v2/incidents", params={"search": "Cliente %", "severity": "low"}).json()["total"] == 0
