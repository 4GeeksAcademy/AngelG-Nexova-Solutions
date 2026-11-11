from fastapi.testclient import TestClient

from database import users_table
from main import app
from tinydb import Query


client = TestClient(app, raise_server_exceptions=False)


def register_and_login(email: str, role: str) -> dict[str, str]:
    created = client.post("/users", json={"email": email, "password": "Password123!"})
    assert created.status_code == 200
    user = users_table.get(Query().email == email)
    users_table.update({"role": role}, Query().id == user["id"])
    login = client.post(
        "/auth/login", data={"username": email, "password": "Password123!"}
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_manager_has_technical_telemetry_access_but_other_roles_do_not(monkeypatch):
    from telemetry.analysis import TechnicalReport
    from telemetry.router import get_db

    monkeypatch.setattr(
        "telemetry.router.technical_report",
        lambda session, start, end: TechnicalReport(
            generated_at="2026-01-01T00:00:00Z",
            start=start,
            end=end,
            total_events=0,
            event_counts=[],
            unknown_event_count=0,
            first_event_at=None,
            last_event_at=None,
        ),
    )
    app.dependency_overrides[get_db] = lambda: object()
    try:
        manager = register_and_login("telemetry-manager@example.com", "manager")
        ordinary_user = register_and_login("telemetry-user@example.com", "user")
        legacy_supervisor = register_and_login("telemetry-supervisor@example.com", "supervisor")

        assert client.get("/telemetry/report", headers=manager).status_code == 200
        assert client.get("/telemetry/report", headers=ordinary_user).status_code == 403
        assert client.get("/telemetry/report", headers=legacy_supervisor).status_code == 403
    finally:
        app.dependency_overrides.pop(get_db, None)