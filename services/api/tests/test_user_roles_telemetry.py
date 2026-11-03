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


def test_supervisor_has_technical_telemetry_access_but_user_does_not(monkeypatch):
    from telemetry.router import get_db

    monkeypatch.setattr(
        "telemetry.router.technical_report",
        lambda session, start, end: {"events": [], "summary": {}},
    )
    app.dependency_overrides[get_db] = lambda: object()
    try:
        supervisor = register_and_login("telemetry-supervisor@example.com", "supervisor")
        ordinary_user = register_and_login("telemetry-user@example.com", "user")

        assert client.get("/telemetry/report", headers=supervisor).status_code == 200
        assert client.get("/telemetry/report", headers=ordinary_user).status_code == 403
    finally:
        app.dependency_overrides.pop(get_db, None)