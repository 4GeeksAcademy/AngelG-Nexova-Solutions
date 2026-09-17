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


def test_users_group_lists_and_reads_users():
    headers = auth_headers("users@example.com")
    listing = client.get("/users", headers=headers)
    owner_id = client.get("/auth/me", headers=headers).json()["id"]
    detail = client.get(f"/users/{owner_id}", headers=headers)

    assert listing.status_code == 200
    assert detail.status_code == 200
    assert detail.json()["email"] == "users@example.com"


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


def test_users_group_updates_and_deletes_user():
    headers = auth_headers("owner@example.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]

    updated = client.put(
        f"/users/{user_id}",
        headers=headers,
        json={"email": "owner-updated@example.com"},
    )
    updated_headers = login_headers("owner-updated@example.com")
    deleted = client.delete(f"/users/{user_id}", headers=updated_headers)

    assert updated.status_code == 200
    assert updated.json()["email"] == "owner-updated@example.com"
    assert deleted.status_code == 200
