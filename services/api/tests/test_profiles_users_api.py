from fastapi.testclient import TestClient

from main import app


client = TestClient(app, raise_server_exceptions=False)


def auth_headers(email="admin@example.com"):
    registered = client.post(
        "/users",
        json={"email": email, "password": "Password123!"},
    )
    assert registered.status_code == 200
    login = client.post(
        "/auth/login",
        data={"username": email, "password": "Password123!"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def login_headers(email):
    login = client.post(
        "/auth/login",
        data={"username": email, "password": "Password123!"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_profiles_group_reads_and_updates_current_profile():
    headers = auth_headers()

    current = client.get("/profiles/me", headers=headers)
    updated = client.put(
        "/profiles/me",
        headers=headers,
        json={"name": "Updated Name", "phone": "+34 600 111 222"},
    )

    assert current.status_code == 200
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Name"
    assert updated.json()["phone"] == "+34 600 111 222"


def test_profiles_group_handles_empty_optional_values():
    headers = auth_headers("profile-edge@example.com")

    initialized = client.put(
        "/profiles/me",
        headers=headers,
        json={"name": "Keeps Existing", "phone": "+34 600 999 999"},
    )
    response = client.put(
        "/profiles/me",
        headers=headers,
        json={},
    )

    assert initialized.status_code == 200
    assert response.status_code == 200
    assert response.json()["name"] == "Keeps Existing"
    assert response.json()["phone"] == "+34 600 999 999"


def test_profiles_group_rejects_unauthenticated_access():
    response = client.get("/profiles/me")

    assert response.status_code == 401


def test_users_group_restricts_listing_and_reads_own_user():
    headers = auth_headers("users@example.com")
    listing = client.get("/users", headers=headers)
    owner_id = client.get("/auth/me", headers=headers).json()["id"]
    detail = client.get(f"/users/{owner_id}", headers=headers)

    assert listing.status_code == 403
    assert detail.status_code == 200
    assert detail.json()["email"] == "users@example.com"


def test_admin_can_list_users(client):
    headers = auth_headers("admin-list@example.com")
    admin_id = client.get("/auth/me", headers=headers).json()["id"]
    from database import users_table
    from tinydb import Query

    users_table.update({"role": "admin"}, Query().id == admin_id)
    headers = login_headers("admin-list@example.com")
    listing = client.get("/users", headers=headers)

    assert listing.status_code == 200
    assert {item["email"] for item in listing.json()} == {"admin-list@example.com"}


def test_user_administration_is_admin_only(client):
    headers = auth_headers("admin-only@example.com")
    admin_id = client.get("/auth/me", headers=headers).json()["id"]
    from database import users_table
    from tinydb import Query

    users_table.update({"role": "user"}, Query().id == admin_id)
    user_headers = login_headers("admin-only@example.com")

    assert client.get("/users", headers=user_headers).status_code == 403
    assert client.post(
        "/users/admin", headers=user_headers,
        json={"email": "managed@example.com", "role": "manager"},
    ).status_code == 403


def test_admin_can_create_list_reset_and_delete_managed_user(client, monkeypatch):
    admin_headers = auth_headers("admin-manager@example.com")
    admin_id = client.get("/auth/me", headers=admin_headers).json()["id"]
    from database import users_table
    from tinydb import Query

    users_table.update({"role": "admin"}, Query().id == admin_id)
    admin_headers = login_headers("admin-manager@example.com")
    sent = {}

    import auth
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda email, url: sent.update(email=email, url=url) or True,
    )

    created = client.post(
        "/users/admin",
        headers=admin_headers,
        json={"email": "managed@example.com", "role": "manager", "name": "Managed"},
    )
    body = created.json()
    assert created.status_code == 201
    assert body["role"] == "manager"
    assert body["password_setup_email_sent"] is True
    assert body["name"] == "Managed"
    assert "hashed_password" not in created.text
    assert sent["email"] == "managed@example.com"
    assert "token=" in sent["url"]
    assert client.get("/users", headers=admin_headers).json()[0]["email"] in {
        "admin-manager@example.com", "managed@example.com"
    }

    assert client.put(
        f"/users/{body['id']}", headers=admin_headers, json={"role": "supervisor"},
    ).status_code == 400
    assert client.put(
        f"/users/{body['id']}", headers=admin_headers, json={"role": "admin"},
    ).json()["role"] == "admin"

    assert client.put(
        f"/users/{body['id']}", headers=admin_headers, json={"password": "short"},
    ).status_code == 400
    password_update = client.put(
        f"/users/{body['id']}", headers=admin_headers,
        json={"password": "NewPassword123!"},
    )
    assert password_update.status_code == 200
    assert "hashed_password" not in password_update.text
    new_login = client.post(
        "/auth/login",
        data={"username": "managed@example.com", "password": "NewPassword123!"},
    )
    old_login = client.post(
        "/auth/login",
        data={"username": "managed@example.com", "password": "Password123!"},
    )
    assert new_login.status_code == 200
    assert old_login.status_code == 401

    forced = client.post(
        f"/users/{body['id']}/force-password-reset", headers=admin_headers,
    )
    assert forced.status_code == 200
    assert client.delete(f"/users/{body['id']}", headers=admin_headers).status_code == 200


def test_admin_cannot_delete_self_or_last_active_admin(client):
    headers = auth_headers("last-admin@example.com")
    admin_id = client.get("/auth/me", headers=headers).json()["id"]
    from database import users_table
    from tinydb import Query

    users_table.update({"role": "admin"}, Query().id == admin_id)
    headers = login_headers("last-admin@example.com")
    assert client.delete(f"/users/{admin_id}", headers=headers).status_code == 400
    assert client.put(
        f"/users/{admin_id}", headers=headers, json={"role": "user"},
    ).status_code == 400


def test_users_group_rejects_duplicate_email_and_missing_user():
    headers = auth_headers("duplicate-owner@example.com")
    duplicate = client.post(
        "/users",
        headers=headers,
        json={"email": "duplicate-owner@example.com", "password": "Password123!"},
    )
    missing = client.get("/users/not-found", headers=headers)

    assert duplicate.status_code == 400
    assert missing.status_code == 403


def test_users_group_forbids_non_admin_user_updates_and_deletes():
    headers = auth_headers("owner@example.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]

    updated = client.put(
        f"/users/{user_id}",
        headers=headers,
        json={"email": "owner-updated@example.com"},
    )
    deleted = client.delete(f"/users/{user_id}", headers=headers)

    assert updated.status_code == 403
    assert deleted.status_code == 403
