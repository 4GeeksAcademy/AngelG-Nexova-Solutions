from fastapi.testclient import TestClient

from main import app


client = TestClient(app, raise_server_exceptions=False)


def auth_headers():
    registered = client.post(
        "/users",
        json={"email": "records@example.com", "password": "Password123!"},
    )
    assert registered.status_code == 200
    login = client.post(
        "/auth/login",
        data={"username": "records@example.com", "password": "Password123!"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def record_payload(**overrides):
    payload = {
        "full_name": "Ada Lovelace",
        "email": "ada@example.com",
        "phone": "+34 600 000 000",
        "position": "Senior Engineer",
        "experience_years": 8,
        "linkedin_url": None,
        "cv_url": None,
    }
    payload.update(overrides)
    return payload


def create_record(headers):
    response = client.post(
        "/records", headers=headers, json=record_payload()
    )
    assert response.status_code == 200
    return response.json()


def test_records_group_lists_and_creates_candidates():
    headers = auth_headers()

    created = create_record(headers)
    listed = client.get("/records", headers=headers)

    assert created["status"] == "received"
    assert created["stage"] == "pending"
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["data"][0]["id"] == created["id"]


def test_records_group_supports_pagination_boundary():
    headers = auth_headers()
    create_record(headers)

    response = client.get(
        "/records", headers=headers, params={"page": 2, "limit": 1}
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["data"] == []


def test_records_group_rejects_missing_record_and_invalid_patch():
    headers = auth_headers()

    missing = client.get("/records/not-found", headers=headers)
    invalid_patch = client.patch(
        "/records/not-found",
        headers=headers,
        json={"status": "not-a-status"},
    )

    assert missing.status_code == 404
    assert invalid_patch.status_code == 400


def test_records_group_reads_and_manages_notes():
    headers = auth_headers()
    record = create_record(headers)

    empty = client.get(f"/records/{record['id']}/notes", headers=headers)
    created = client.post(
        f"/records/{record['id']}/notes",
        headers=headers,
        json={"content": "Llamar para coordinar la entrevista."},
    )
    listed = client.get(f"/records/{record['id']}/notes", headers=headers)
    deleted = client.delete(
        f"/records/{record['id']}/notes/{created.json()['id']}",
        headers=headers,
    )
    after_delete = client.get(f"/records/{record['id']}/notes", headers=headers)

    assert empty.status_code == 200
    assert empty.json() == {"data": [], "meta": {"total": 0}}
    assert created.status_code == 200
    assert created.json()["record_id"] == record["id"]
    assert listed.json()["meta"]["total"] == 1
    assert listed.json()["data"][0]["content"] == "Llamar para coordinar la entrevista."
    assert deleted.status_code == 204
    assert after_delete.json() == {"data": [], "meta": {"total": 0}}


def test_records_group_reports_note_creation_failure(monkeypatch):
    headers = auth_headers()
    record = create_record(headers)

    def fail(*args, **kwargs):
        raise RuntimeError("note creation failed")

    monkeypatch.setattr("records.create_note", fail)
    response = client.post(
        f"/records/{record['id']}/notes",
        headers=headers,
        json={"content": "No se pudo guardar."},
    )

    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "NOTE_CREATE_FAILED"


def test_records_group_updates_candidate_and_handles_service_error(monkeypatch):
    headers = auth_headers()
    record = create_record(headers)

    updated = client.patch(
        f"/records/{record['id']}",
        headers=headers,
        json={"status": "in_progress", "stage": "review"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"
    assert updated.json()["stage"] == "review"

    def fail(*args, **kwargs):
        raise RuntimeError("record update failed")

    monkeypatch.setattr("records.update_record", fail)
    failed = client.patch(
        f"/records/{record['id']}",
        headers=headers,
        json={"status": "selected"},
    )

    assert failed.status_code == 500
    assert failed.json()["detail"]["code"] == "RECORD_UPDATE_FAILED"
