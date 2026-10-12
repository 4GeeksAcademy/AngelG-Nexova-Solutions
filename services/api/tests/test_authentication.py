from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import pytest
from jose import jwt

import auth
from database import password_reset_tokens_table, users_table
from main import app
from services import get_user_by_email
from tinydb import Query


client = TestClient(app)


def register_user(email="user@example.com", password="OldPassword123!"):
    response = client.post(
        "/users",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["user"]


def test_register_creates_active_user_and_profile_without_exposing_password():
    response = client.post(
        "/users",
        json={
            "email": "new@example.com",
            "password": "NewPassword123!",
            "name": "New User",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["is_active"] is True
    assert body["user"]["role"] == "user"
    assert "hashed_password" not in body["user"]
    assert body["profile"]["user_id"] == body["user"]["id"]


def test_register_accepts_minimum_password_length_and_optional_fields():
    response = client.post(
        "/users",
        json={"email": "minimum@example.com", "password": "12345678"},
    )

    assert response.status_code == 200
    assert response.json()["profile"]["name"] is None


def test_register_rejects_duplicate_email_and_missing_credentials():
    register_user(email="duplicate@example.com")

    duplicate_response = client.post(
        "/users",
        json={"email": "duplicate@example.com", "password": "OtherPassword123!"},
    )
    missing_password_response = client.post(
        "/users",
        json={"email": "missing-password@example.com"},
    )

    assert duplicate_response.status_code == 400
    assert missing_password_response.status_code == 400


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "empty-password@example.com", "password": ""},
        {"email": "invalid-email", "password": "Password123!"},
        {"email": "", "password": "Password123!"},
        {"email": " ", "password": "Password123!"},
    ],
)
@pytest.mark.xfail(
    strict=True,
    reason="UserCreate actualmente no valida formato de email ni longitud de password",
)
def test_register_rejects_empty_or_invalid_credentials(payload):
    response = client.post("/users", json=payload)

    assert response.status_code == 422


def login(email, password):
    return client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )


def auth_header(email="user@example.com", password="OldPassword123!"):
    token = login(email, password).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_login_rejects_unknown_email_and_wrong_password():
    register_user()

    assert login("missing@example.com", "OldPassword123!").status_code == 401
    assert login("user@example.com", "WrongPassword123!").status_code == 401


def test_login_returns_access_token_for_valid_credentials():
    register_user(email="login@example.com")

    response = login("login@example.com", "OldPassword123!")

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    ).status_code == 200


def test_login_rejects_missing_credentials():
    response = client.post("/auth/login", data={})

    assert response.status_code == 400


def test_login_rejects_inactive_user():
    user = register_user(email="inactive@example.com")
    users_table.update({"is_active": False}, Query().id == user["id"])

    response = login("inactive@example.com", "OldPassword123!")

    assert response.status_code == 401


def test_me_accepts_valid_token_and_rejects_malformed_token():
    register_user()

    valid_response = client.get("/auth/me", headers=auth_header())
    malformed_response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer not-a-jwt"},
    )

    assert valid_response.status_code == 200
    assert valid_response.json()["email"] == "user@example.com"
    assert malformed_response.status_code == 401


def test_me_rejects_expired_access_token():
    register_user()
    expired_token = jwt.encode(
        {
            "sub": get_user_by_email("user@example.com")["id"],
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        },
        auth.JWT_SECRET,
        algorithm=auth.ALGORITHM,
    )

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401


@pytest.mark.xfail(
    strict=True,
    reason="python-jose acepta exp igual al segundo actual; auth no aplica una comprobación adicional",
)
def test_me_rejects_access_token_at_exact_expiration_boundary():
    user = register_user(email="jwt-boundary@example.com")
    expiration = int(datetime.now(timezone.utc).timestamp())
    token = jwt.encode(
        {"sub": user["id"], "exp": expiration},
        auth.JWT_SECRET,
        algorithm=auth.ALGORITHM,
    )

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_me_accepts_access_token_that_expires_in_the_future():
    user = register_user(email="jwt-future@example.com")
    expiration = int(datetime.now(timezone.utc).timestamp()) + 60
    token = jwt.encode(
        {"sub": user["id"], "exp": expiration},
        auth.JWT_SECRET,
        algorithm=auth.ALGORITHM,
    )

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200


def test_me_rejects_invalid_access_token_with_valid_jwt_shape():
    register_user()
    invalid_token = jwt.encode(
        {"sub": "user-that-does-not-exist", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "different-secret",
        algorithm=auth.ALGORITHM,
    )

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {invalid_token}"},
    )

    assert response.status_code == 401


def test_me_rejects_validly_signed_token_for_unknown_user():
    token = jwt.encode(
        {
            "sub": "user-that-does-not-exist",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        auth.JWT_SECRET,
        algorithm=auth.ALGORITHM,
    )

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"]["message"] == "Usuario no válido"


def test_me_rejects_signed_token_without_subject():
    token = jwt.encode(
        {"exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        auth.JWT_SECRET,
        algorithm=auth.ALGORITHM,
    )

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401


@pytest.mark.parametrize("subject", ["", 123, None])
def test_me_rejects_token_with_invalid_subject(subject):
    token = jwt.encode(
        {"sub": subject, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        auth.JWT_SECRET,
        algorithm=auth.ALGORITHM,
    )

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_create_access_token_uses_configured_expiration(monkeypatch):
    fixed_now = datetime(2026, 9, 17, 12, 0, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(
        auth,
        "datetime",
        type(
            "FrozenDateTime",
            (datetime,),
            {"now": classmethod(lambda cls, tz=None: fixed_now)},
        ),
    )
    monkeypatch.setattr(auth, "ACCESS_TOKEN_EXPIRE_MINUTES", 5)

    token = auth.create_access_token("user-id")
    payload = jwt.decode(
        token,
        auth.JWT_SECRET,
        algorithms=[auth.ALGORITHM],
        options={"verify_exp": False},
    )

    assert payload["sub"] == "user-id"
    assert payload["exp"] == int((fixed_now + timedelta(minutes=5)).timestamp())


def test_me_rejects_token_for_inactive_user():
    user = register_user()
    token = login("user@example.com", "OldPassword123!").json()["access_token"]
    users_table.update({"is_active": False}, Query().id == user["id"])

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401


def test_forgot_password_invalidates_previous_active_token(monkeypatch):
    captured_urls = []
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda _email, reset_url: captured_urls.append(reset_url),
    )

    register_user(email="multiple@example.com")
    client.post("/auth/forgot-password", json={"email": "multiple@example.com"})
    client.post("/auth/forgot-password", json={"email": "multiple@example.com"})

    first_token = captured_urls[0].split("token=")[1]
    second_token = captured_urls[1].split("token=")[1]

    first_response = client.post(
        "/auth/reset-password",
        json={"token": first_token, "new_password": "NewPassword123!"},
    )
    second_response = client.post(
        "/auth/reset-password",
        json={"token": second_token, "new_password": "NewPassword123!"},
    )

    assert first_response.status_code == 400
    assert second_response.status_code == 200


def test_forgot_password_rejects_empty_or_missing_email():
    empty_response = client.post("/auth/forgot-password", json={"email": ""})
    missing_response = client.post("/auth/forgot-password", json={})

    assert empty_response.status_code == 400
    assert missing_response.status_code == 400


def test_forgot_password_still_returns_generic_response_when_email_sending_fails(monkeypatch):
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("mail down")),
    )
    register_user(email="mail-failure@example.com")

    response = client.post(
        "/auth/forgot-password",
        json={"email": "mail-failure@example.com"},
    )

    assert response.status_code == 200
    assert "Si esa dirección está registrada" in response.json()["message"]


def test_forgot_password_uses_minutes_for_token_expiration(monkeypatch):
    captured = {}
    fixed_now = datetime(2026, 9, 17, 12, 0, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(
        auth,
        "datetime",
        type(
            "FrozenDateTime",
            (datetime,),
            {"now": classmethod(lambda cls, tz=None: fixed_now)},
        ),
    )
    monkeypatch.setattr(auth, "PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES", 2)
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda _email, reset_url: captured.setdefault("url", reset_url),
    )
    register_user(email="expiration-units@example.com")

    response = client.post(
        "/auth/forgot-password",
        json={"email": "expiration-units@example.com"},
    )

    assert response.status_code == 200
    token = captured["url"].split("token=")[1]
    record = password_reset_tokens_table.get(
        Query().token_hash == auth.hash_reset_token(token)
    )
    assert datetime.fromisoformat(record["expires_at"]) == fixed_now + timedelta(minutes=2)


def test_reset_password_returns_controlled_error_when_user_update_fails(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda _email, reset_url: captured.setdefault("url", reset_url),
    )
    register_user(email="update-failure@example.com")
    client.post("/auth/forgot-password", json={"email": "update-failure@example.com"})
    token = captured["url"].split("token=")[1]
    monkeypatch.setattr(
        auth,
        "update_user",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("database down")),
    )

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"},
    )

    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "PASSWORD_UPDATE_FAILED"


def test_login_rejects_corrupt_stored_password_hash(monkeypatch):
    register_user(email="corrupt-hash@example.com")
    users_table.update(
        {"hashed_password": "not-a-bcrypt-hash"},
        Query().email == "corrupt-hash@example.com",
    )

    response = login("corrupt-hash@example.com", "OldPassword123!")

    assert response.status_code == 401


def test_reset_password_token_at_exact_expiration_is_rejected(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda _email, reset_url: captured.setdefault("url", reset_url),
    )

    register_user(email="boundary@example.com")
    client.post("/auth/forgot-password", json={"email": "boundary@example.com"})
    token = captured["url"].split("token=")[1]

    fixed_now = datetime(2026, 9, 17, 12, 0, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(
        auth,
        "datetime",
        type(
            "FrozenDateTime",
            (datetime,),
            {"now": classmethod(lambda cls, tz=None: fixed_now)},
        ),
    )
    password_reset_tokens_table.update(
        {"expires_at": fixed_now.isoformat()},
        Query().token_hash == auth.hash_reset_token(token),
    )

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["message"] == "El token expiró"


@pytest.mark.xfail(
    strict=True,
    reason="reset_password compara timestamps ISO como strings y no normaliza offsets",
)
def test_reset_password_compares_expiration_by_instant_not_string(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda _email, reset_url: captured.setdefault("url", reset_url),
    )
    register_user(email="offset-boundary@example.com")
    client.post("/auth/forgot-password", json={"email": "offset-boundary@example.com"})
    token = captured["url"].split("token=")[1]

    fixed_now = datetime(2026, 9, 17, 12, 0, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(
        auth,
        "datetime",
        type(
            "FrozenDateTime",
            (datetime,),
            {"now": classmethod(lambda cls, tz=None: fixed_now)},
        ),
    )
    password_reset_tokens_table.update(
        {"expires_at": "2026-09-17T14:00:00+02:00"},
        Query().token_hash == auth.hash_reset_token(token),
    )

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"},
    )

    assert response.status_code == 400


def test_reset_password_rejects_empty_token():
    response = client.post(
        "/auth/reset-password",
        json={"token": "", "new_password": "NewPassword123!"},
    )

    assert response.status_code == 400


def test_register_returns_controlled_error_when_password_hashing_fails(monkeypatch):
    monkeypatch.setattr(
        auth.bcrypt,
        "hash",
        lambda _password: (_ for _ in ()).throw(RuntimeError("hash down")),
    )

    response = client.post(
        "/users",
        json={"email": "hash-registration@example.com", "password": "Password123!"},
    )

    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "REGISTRATION_FAILED"


def test_get_frontend_url_removes_trailing_slash_outside_codespaces(monkeypatch):
    monkeypatch.delenv("CODESPACES", raising=False)
    monkeypatch.delenv("CODESPACE_NAME", raising=False)
    monkeypatch.delenv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", raising=False)
    monkeypatch.setenv("FRONTEND_URL", "https://frontend.example/")

    assert auth.get_frontend_url() == "https://frontend.example"


def test_reset_password_rejects_token_for_missing_user(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda _email, reset_url: captured.setdefault("url", reset_url),
    )
    register_user(email="orphan-reset@example.com")
    client.post("/auth/forgot-password", json={"email": "orphan-reset@example.com"})
    token = captured["url"].split("token=")[1]
    password_reset_tokens_table.update(
        {"user_id": "missing-user-id"},
        Query().token_hash == auth.hash_reset_token(token),
    )

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["message"] == "Token inválido"


def test_reset_password_handles_concurrent_token_consumption(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda _email, reset_url: captured.setdefault("url", reset_url),
    )
    register_user(email="race-reset@example.com")
    client.post("/auth/forgot-password", json={"email": "race-reset@example.com"})
    token = captured["url"].split("token=")[1]
    monkeypatch.setattr(auth, "consume_reset_token", lambda *_args: False)

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["message"] == "El token ya fue utilizado"


def test_change_password_handles_password_verification_exception(monkeypatch):
    register_user(email="verify-error@example.com")
    headers = auth_header("verify-error@example.com")
    monkeypatch.setattr(
        auth.bcrypt,
        "verify",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("verify down")),
    )

    response = client.post(
        "/auth/change-password",
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewPassword123!",
        },
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"]["message"] == "La contraseña actual es incorrecta"


def test_change_password_returns_controlled_error_when_hashing_fails(monkeypatch):
    register_user(email="hash-change@example.com")
    monkeypatch.setattr(
        auth.bcrypt,
        "hash",
        lambda _password: (_ for _ in ()).throw(RuntimeError("hash down")),
    )

    response = client.post(
        "/auth/change-password",
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewPassword123!",
        },
        headers=auth_header("hash-change@example.com"),
    )

    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "PASSWORD_UPDATE_FAILED"


def test_reset_password_returns_controlled_error_when_hashing_fails(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda _email, reset_url: captured.setdefault("url", reset_url),
    )
    register_user(email="hash-reset@example.com")
    client.post("/auth/forgot-password", json={"email": "hash-reset@example.com"})
    token = captured["url"].split("token=")[1]
    monkeypatch.setattr(
        auth.bcrypt,
        "hash",
        lambda _password: (_ for _ in ()).throw(RuntimeError("hash down")),
    )

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"},
    )

    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "PASSWORD_UPDATE_FAILED"


def test_reset_password_rejects_missing_token_and_short_password():
    missing_token = client.post(
        "/auth/reset-password",
        json={"new_password": "NewPassword123!"},
    )
    short_password = client.post(
        "/auth/reset-password",
        json={"token": "some-token", "new_password": "short"},
    )

    assert missing_token.status_code == 400
    assert short_password.status_code == 400


def test_change_password_rejects_short_new_password_before_updating():
    register_user(email="short-password@example.com")
    response = client.post(
        "/auth/change-password",
        json={
            "current_password": "OldPassword123!",
            "new_password": "short",
        },
        headers=auth_header("short-password@example.com"),
    )

    assert response.status_code == 400
    assert login("short-password@example.com", "OldPassword123!").status_code == 200
