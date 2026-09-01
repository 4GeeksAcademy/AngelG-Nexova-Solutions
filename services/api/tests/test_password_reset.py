from fastapi.testclient import TestClient

import auth
from main import app


client = TestClient(app)


def register_user(email="user@example.com", password="OldPassword123!"):
    response = client.post(
        "/users",
        json={"email": email, "password": password}
    )
    assert response.status_code == 200
    return response.json()["user"]


def login(email, password):
    return client.post(
        "/auth/login",
        data={"username": email, "password": password}
    )


def get_reset_token_for(email):
    from services import get_user_by_email

    user = get_user_by_email(email)

    from database import password_reset_tokens_table
    from tinydb import Query

    Token = Query()
    record = password_reset_tokens_table.get(Token.user_id == user["id"])

    return record


def test_forgot_password_existing_email_sends_email(monkeypatch):
    sent = {}

    def fake_send(to_email, reset_url):
        sent["to_email"] = to_email
        sent["reset_url"] = reset_url

    monkeypatch.setattr(auth, "send_password_reset_email", fake_send)

    register_user(email="found@example.com")

    response = client.post(
        "/auth/forgot-password",
        json={"email": "found@example.com"}
    )

    assert response.status_code == 200
    assert sent["to_email"] == "found@example.com"
    assert "token=" in sent["reset_url"]


def test_forgot_password_unknown_email_does_not_send_email(monkeypatch):
    called = []

    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda *args, **kwargs: called.append(1)
    )

    response = client.post(
        "/auth/forgot-password",
        json={"email": "unknown@example.com"}
    )

    assert response.status_code == 200
    assert called == []


def test_forgot_password_response_does_not_reveal_user_existence(monkeypatch):
    monkeypatch.setattr(
        auth, "send_password_reset_email", lambda *a, **k: None
    )

    register_user(email="exists@example.com")

    existing_response = client.post(
        "/auth/forgot-password",
        json={"email": "exists@example.com"}
    )
    missing_response = client.post(
        "/auth/forgot-password",
        json={"email": "missing@example.com"}
    )

    assert existing_response.status_code == 200
    assert missing_response.status_code == 200
    assert existing_response.json() == missing_response.json()


def test_reset_password_with_valid_token_changes_password(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda to_email, reset_url: captured.setdefault("url", reset_url)
    )

    register_user(email="reset@example.com", password="OldPassword123!")
    client.post("/auth/forgot-password", json={"email": "reset@example.com"})

    token = captured["url"].split("token=")[1]

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"}
    )

    assert response.status_code == 200

    assert login("reset@example.com", "NewPassword123!").status_code == 200
    assert login("reset@example.com", "OldPassword123!").status_code == 401


def test_reset_password_new_password_is_hashed():
    from services import get_user_by_email

    captured = {}

    def fake_send(to_email, reset_url):
        captured["url"] = reset_url

    auth.send_password_reset_email = fake_send

    register_user(email="hash@example.com", password="OldPassword123!")
    client.post("/auth/forgot-password", json={"email": "hash@example.com"})

    token = captured["url"].split("token=")[1]

    client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"}
    )

    user = get_user_by_email("hash@example.com")

    assert user["hashed_password"] != "NewPassword123!"
    assert user["hashed_password"].startswith("$2b$")


def test_reset_password_token_cannot_be_reused(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda to_email, reset_url: captured.setdefault("url", reset_url)
    )

    register_user(email="reuse@example.com", password="OldPassword123!")
    client.post("/auth/forgot-password", json={"email": "reuse@example.com"})

    token = captured["url"].split("token=")[1]

    first = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"}
    )
    second = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "AnotherPassword123!"}
    )

    assert first.status_code == 200
    assert second.status_code == 400


def test_reset_password_expired_token(monkeypatch):
    from datetime import datetime, timedelta, timezone

    from database import password_reset_tokens_table
    from tinydb import Query

    captured = {}
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda to_email, reset_url: captured.setdefault("url", reset_url)
    )

    register_user(email="expired@example.com", password="OldPassword123!")
    client.post("/auth/forgot-password", json={"email": "expired@example.com"})

    token = captured["url"].split("token=")[1]

    Token = Query()
    expired_at = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()
    password_reset_tokens_table.update(
        {"expires_at": expired_at},
        Token.token_hash == auth.hash_reset_token(token)
    )

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"}
    )

    assert response.status_code == 400


def test_reset_password_invalid_token():
    response = client.post(
        "/auth/reset-password",
        json={"token": "does-not-exist", "new_password": "NewPassword123!"}
    )

    assert response.status_code == 400


def test_change_password_success():
    register_user(email="change@example.com", password="OldPassword123!")
    token = login("change@example.com", "OldPassword123!").json()["access_token"]

    response = client.post(
        "/auth/change-password",
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewPassword123!"
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert login("change@example.com", "NewPassword123!").status_code == 200


def test_change_password_wrong_current_password():
    register_user(email="wrongcurrent@example.com", password="OldPassword123!")
    token = login(
        "wrongcurrent@example.com", "OldPassword123!"
    ).json()["access_token"]

    response = client.post(
        "/auth/change-password",
        json={
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword123!"
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 400


def test_change_password_requires_authentication():
    response = client.post(
        "/auth/change-password",
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewPassword123!"
        }
    )

    assert response.status_code == 401
