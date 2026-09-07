from fastapi.testclient import TestClient

import database
from main import app


client = TestClient(app, raise_server_exceptions=False)


def incident_payload(**overrides):
    payload = {
        "title": "No funciona el ATS",
        "description": "El equipo no puede iniciar sesión en el ATS.",
        "category": "technical_failure",
        "status": "open",
        "origin": "internal",
        "branch": "valencia_operations",
    }
    payload.update(overrides)
    return payload


def create_incident(**overrides):
    response = client.post("/incidents", json=incident_payload(**overrides))
    assert response.status_code == 201
    return response.json()


def test_create_incident_returns_generated_fields():
    response = client.post("/incidents", json=incident_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["created_at"] == body["updated_at"]
    assert body["status"] == "open"


def test_create_incident_rejects_invalid_fields_with_field_details():
    response = client.post("/incidents", json=incident_payload(category="invalid"))

    assert response.status_code == 400
    assert "category" in response.json()["error"]["fields"]


def test_list_incidents_and_filters():
    create_incident(category="technical_failure", origin="internal", branch="remote")
    create_incident(category="client_complaint", origin="customer", branch="central")

    response = client.get("/incidents", params={"category": "client_complaint"})

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["origin"] == "customer"


def test_invalid_filter_returns_400():
    response = client.get("/incidents", params={"status": "invalid"})
    assert response.status_code == 400


def test_get_incident_by_id_and_missing_id():
    incident = create_incident()

    assert client.get(f"/incidents/{incident['id']}").status_code == 200
    missing = client.get("/incidents/not-found")
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "INCIDENT_NOT_FOUND"


def test_patch_status_allows_valid_transitions_and_updates_timestamp():
    incident = create_incident()
    response = client.patch(
        f"/incidents/{incident['id']}/status",
        json={"status": "in_progress"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"
    assert response.json()["updated_at"] >= incident["updated_at"]


def test_patch_status_rejects_invalid_transition_and_final_states():
    incident = create_incident()
    invalid = client.patch(
        f"/incidents/{incident['id']}/status",
        json={"status": "resolved"},
    )
    assert invalid.status_code == 400

    client.patch(f"/incidents/{incident['id']}/status", json={"status": "in_progress"})
    client.patch(f"/incidents/{incident['id']}/status", json={"status": "resolved"})
    final = client.patch(f"/incidents/{incident['id']}/status", json={"status": "open"})
    assert final.status_code == 400


def test_summary_works_with_zero_and_nonzero_records():
    empty = client.get("/incidents/summary").json()
    assert empty["total"] == 0
    assert empty["by_status"]["open"] == 0

    create_incident()
    populated = client.get("/incidents/summary").json()
    assert populated["total"] == 1
    assert populated["by_status"]["open"] == 1
    assert populated["by_category"]["technical_failure"] == 1
    assert populated["by_origin"]["internal"] == 1
    assert populated["by_branch"]["valencia_operations"] == 1


def test_unexpected_service_errors_return_json_500(monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("internal test failure")

    monkeypatch.setattr("incidents.get_incidents", fail)
    response = client.get("/incidents")

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "internal test failure" not in response.text