"""
test_api.py — Integration tests for the Suppliers REST API endpoints.

Covers:
    - Health check endpoint
    - Create supplier (POST /suppliers)
    - List suppliers (GET /suppliers) with filters
    - Get single supplier (GET /suppliers/{id})
    - Update rate (PATCH /suppliers/{id}/rate)
    - Update status (PATCH /suppliers/{id}/status)
    - Delete supplier (DELETE /suppliers/{id})
    - Edge cases (404, 422, lifecycle)
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from tinydb import TinyDB


# ── Health ─────────────────────────────────────────────────────────────────

class TestHealth:
    """Health check endpoint tests."""

    def test_health_returns_ok(self, client: TestClient):
        """GET /health returns 200 with status ok."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


# ── Create Supplier ────────────────────────────────────────────────────────

class TestCreateSupplier:
    """POST /suppliers endpoint tests."""

    def test_create_valid_supplier(self, client: TestClient, valid_payload: dict):
        """Create a valid supplier returns 201 with full object."""
        resp = client.post("/suppliers", json=valid_payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == valid_payload["name"]
        assert data["country"] == valid_payload["country"]
        assert data["monthly_rate"] == valid_payload["monthly_rate"]
        assert data["currency"] == valid_payload["currency"]
        assert data["status"] == valid_payload["status"]
        assert "id" in data
        assert data["id"] > 0
        assert "updated_at" in data

    def test_create_supplier_auto_currency(self, client: TestClient):
        """Currency auto-corrected to EUR for Spain."""
        resp = client.post("/suppliers", json={
            "name": "Auto Currency",
            "country": "Spain",
            "categories": ["job_boards"],
            "monthly_rate": 100.0,
            "currency": "USD",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["currency"] == "EUR"

    def test_create_supplier_missing_name(self, client: TestClient):
        """Missing name returns 422."""
        resp = client.post("/suppliers", json={
            "country": "Spain",
            "categories": ["job_boards"],
            "monthly_rate": 100.0,
            "currency": "EUR",
        })
        assert resp.status_code == 422

    def test_create_supplier_empty_name(self, client: TestClient, valid_payload: dict):
        """Empty name returns 422."""
        payload = valid_payload.copy()
        payload["name"] = ""
        resp = client.post("/suppliers", json=payload)
        assert resp.status_code == 422

    def test_create_supplier_invalid_country(self, client: TestClient, valid_payload: dict):
        """Invalid country returns 422."""
        payload = valid_payload.copy()
        payload["country"] = "France"
        resp = client.post("/suppliers", json=payload)
        assert resp.status_code == 422

    def test_create_supplier_invalid_category(self, client: TestClient, valid_payload: dict):
        """Invalid category returns 422."""
        payload = valid_payload.copy()
        payload["categories"] = ["invalid_cat"]
        resp = client.post("/suppliers", json=payload)
        assert resp.status_code == 422

    def test_create_supplier_zero_rate(self, client: TestClient, valid_payload: dict):
        """Zero rate returns 422."""
        payload = valid_payload.copy()
        payload["monthly_rate"] = 0
        resp = client.post("/suppliers", json=payload)
        assert resp.status_code == 422

    def test_create_supplier_negative_rate(self, client: TestClient, valid_payload: dict):
        """Negative rate returns 422."""
        payload = valid_payload.copy()
        payload["monthly_rate"] = -100.0
        resp = client.post("/suppliers", json=payload)
        assert resp.status_code == 422

    def test_create_supplier_invalid_status(self, client: TestClient, valid_payload: dict):
        """Invalid status returns 422."""
        payload = valid_payload.copy()
        payload["status"] = "terminated"
        resp = client.post("/suppliers", json=payload)
        assert resp.status_code == 422

    def test_create_supplier_invalid_date(self, client: TestClient, valid_payload: dict):
        """Invalid date format returns 422."""
        payload = valid_payload.copy()
        payload["contract_renewal_date"] = "31-12-2025"
        resp = client.post("/suppliers", json=payload)
        assert resp.status_code == 422


# ── List Suppliers ────────────────────────────────────────────────────────

class TestListSuppliers:
    """GET /suppliers endpoint tests."""

    def test_list_all_empty(self, client: TestClient):
        """Empty database returns empty list."""
        resp = client.get("/suppliers")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_all_with_seeded_data(self, client: TestClient, seeded_db: TinyDB):
        """Seeded database returns all 15 suppliers."""
        resp = client.get("/suppliers")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 15

    def test_list_all_response_structure(self, client: TestClient, seeded_db: TinyDB):
        """Each supplier has the expected fields."""
        resp = client.get("/suppliers")
        data = resp.json()
        supplier = data[0]
        assert "id" in supplier
        assert "name" in supplier
        assert "country" in supplier
        assert "categories" in supplier
        assert "monthly_rate" in supplier
        assert "currency" in supplier
        assert "updated_at" in supplier
        assert "status" in supplier

    def test_filter_by_country_spain(self, client: TestClient, seeded_db: TinyDB):
        """Filter by country=Spain returns only Spain suppliers."""
        resp = client.get("/suppliers?country=Spain")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 8
        for s in data:
            assert s["country"] == "Spain"

    def test_filter_by_country_usa(self, client: TestClient, seeded_db: TinyDB):
        """Filter by country=USA returns only USA suppliers."""
        resp = client.get("/suppliers?country=USA")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 7
        for s in data:
            assert s["country"] == "USA"

    def test_filter_by_category_job_boards(self, client: TestClient, seeded_db: TinyDB):
        """Filter by category=job_boards returns matching suppliers."""
        resp = client.get("/suppliers?category=job_boards")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3
        for s in data:
            assert "job_boards" in s["categories"]

    def test_filter_by_country_and_category(self, client: TestClient, seeded_db: TinyDB):
        """Filter by country AND category combined."""
        resp = client.get("/suppliers?country=Spain&category=job_boards")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        for s in data:
            assert s["country"] == "Spain"
            assert "job_boards" in s["categories"]

    def test_filter_no_match(self, client: TestClient, seeded_db: TinyDB):
        """Filter with no matches returns empty list."""
        resp = client.get("/suppliers?country=Spain&category=background_check")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_filter_by_country_office(self, client: TestClient, seeded_db: TinyDB):
        """Filter by category=office_and_facilities returns 2 suppliers."""
        resp = client.get("/suppliers?category=office_and_facilities")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        for s in data:
            assert "office_and_facilities" in s["categories"]


# ── Get Supplier ──────────────────────────────────────────────────────────

class TestGetSupplier:
    """GET /suppliers/{id} endpoint tests."""

    def test_get_existing(self, client: TestClient, seeded_db: TinyDB):
        """Get existing supplier returns 200."""
        resp = client.get("/suppliers/1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "LinkedIn Talent Solutions"
        assert data["country"] == "Spain"
        assert data["monthly_rate"] == 1200.0

    def test_get_suspended_supplier(self, client: TestClient, seeded_db: TinyDB):
        """Get a suspended supplier (Greenhouse, id=5)."""
        resp = client.get("/suppliers/5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Greenhouse"
        assert data["status"] == "suspended"

    def test_get_not_found(self, client: TestClient):
        """Non-existent ID returns 404."""
        resp = client.get("/suppliers/999")
        assert resp.status_code == 404
        assert "no encontrado" in resp.json()["detail"].lower()


# ── Update Rate ───────────────────────────────────────────────────────────

class TestUpdateRate:
    """PATCH /suppliers/{id}/rate endpoint tests."""

    def test_update_rate_valid(self, client: TestClient, seeded_db: TinyDB):
        """Valid rate update returns 200."""
        resp = client.patch("/suppliers/1/rate", json={"monthly_rate": 1500.0})
        assert resp.status_code == 200
        data = resp.json()
        assert data["monthly_rate"] == 1500.0

    def test_update_rate_updates_timestamp(self, client: TestClient, seeded_db: TinyDB):
        """Rate update changes updated_at timestamp."""
        resp_before = client.get("/suppliers/1")
        ts_before = resp_before.json()["updated_at"]

        client.patch("/suppliers/1/rate", json={"monthly_rate": 1600.0})
        resp_after = client.get("/suppliers/1")
        ts_after = resp_after.json()["updated_at"]

        assert ts_after != ts_before

    def test_update_rate_same_rate(self, client: TestClient, seeded_db: TinyDB):
        """Same rate returns 422."""
        # First update to a known value
        client.patch("/suppliers/1/rate", json={"monthly_rate": 1250.0})
        # Try to set the same rate again
        resp = client.patch("/suppliers/1/rate", json={"monthly_rate": 1250.0})
        assert resp.status_code == 422
        assert "diferente" in resp.json()["detail"].lower()

    def test_update_rate_zero(self, client: TestClient, seeded_db: TinyDB):
        """Zero rate returns 422."""
        resp = client.patch("/suppliers/1/rate", json={"monthly_rate": 0})
        assert resp.status_code == 422

    def test_update_rate_negative(self, client: TestClient, seeded_db: TinyDB):
        """Negative rate returns 422."""
        resp = client.patch("/suppliers/1/rate", json={"monthly_rate": -50.0})
        assert resp.status_code == 422

    def test_update_rate_not_found(self, client: TestClient):
        """Non-existent ID returns 404."""
        resp = client.patch("/suppliers/999/rate", json={"monthly_rate": 100.0})
        assert resp.status_code == 404


# ── Update Status ─────────────────────────────────────────────────────────

class TestUpdateStatus:
    """PATCH /suppliers/{id}/status endpoint tests."""

    def test_suspend_supplier(self, client: TestClient, seeded_db: TinyDB):
        """Suspend an active supplier."""
        resp = client.patch("/suppliers/1/status", json={"status": "suspended"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "suspended"

    def test_activate_supplier(self, client: TestClient, seeded_db: TinyDB):
        """Activate a suspended supplier (Greenhouse)."""
        # First verify it's suspended
        resp_before = client.get("/suppliers/5")
        assert resp_before.json()["status"] == "suspended"

        # Activate
        resp = client.patch("/suppliers/5/status", json={"status": "active"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"

    def test_invalid_status(self, client: TestClient, seeded_db: TinyDB):
        """Invalid status returns 422."""
        resp = client.patch("/suppliers/1/status", json={"status": "terminated"})
        assert resp.status_code == 422

    def test_status_not_found(self, client: TestClient):
        """Non-existent ID returns 404."""
        resp = client.patch("/suppliers/999/status", json={"status": "active"})
        assert resp.status_code == 404


# ── Delete Supplier ───────────────────────────────────────────────────────

class TestDeleteSupplier:
    """DELETE /suppliers/{id} endpoint tests."""

    def test_delete_existing(self, client: TestClient, seeded_db: TinyDB):
        """Delete existing supplier returns 204."""
        resp = client.delete("/suppliers/1")
        assert resp.status_code == 204

    def test_delete_removes_supplier(self, client: TestClient, seeded_db: TinyDB):
        """Deleted supplier is no longer accessible."""
        client.delete("/suppliers/1")
        resp = client.get("/suppliers/1")
        assert resp.status_code == 404

    def test_delete_not_found(self, client: TestClient):
        """Non-existent ID returns 404."""
        resp = client.delete("/suppliers/999")
        assert resp.status_code == 404


# ── Edge Cases ────────────────────────────────────────────────────────────

class TestEdgeCases:
    """Edge case and integration tests."""

    def test_create_then_get(self, client: TestClient, valid_payload: dict):
        """Create a supplier then retrieve it by ID."""
        create_resp = client.post("/suppliers", json=valid_payload)
        assert create_resp.status_code == 201
        supplier_id = create_resp.json()["id"]

        get_resp = client.get(f"/suppliers/{supplier_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["name"] == valid_payload["name"]

    def test_create_then_delete(self, client: TestClient, valid_payload: dict):
        """Create a supplier then delete it."""
        create_resp = client.post("/suppliers", json=valid_payload)
        supplier_id = create_resp.json()["id"]

        delete_resp = client.delete(f"/suppliers/{supplier_id}")
        assert delete_resp.status_code == 204

        get_resp = client.get(f"/suppliers/{supplier_id}")
        assert get_resp.status_code == 404

    def test_create_supplier_with_multiple_categories(self, client: TestClient):
        """Create supplier with multiple valid categories."""
        resp = client.post("/suppliers", json={
            "name": "Multi Category Supplier",
            "country": "Spain",
            "categories": ["job_boards", "assessment_tools", "training_platforms"],
            "monthly_rate": 999.0,
            "currency": "EUR",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["categories"]) == 3

    def test_full_lifecycle(self, client: TestClient, valid_payload: dict):
        """Full lifecycle: create, read, update rate, update status, delete."""
        # Create
        create_resp = client.post("/suppliers", json=valid_payload)
        assert create_resp.status_code == 201
        sid = create_resp.json()["id"]
        assert create_resp.json()["status"] == "active"

        # Read
        get_resp = client.get(f"/suppliers/{sid}")
        assert get_resp.status_code == 200

        # Update rate
        rate_resp = client.patch(f"/suppliers/{sid}/rate", json={"monthly_rate": 750.0})
        assert rate_resp.status_code == 200
        assert rate_resp.json()["monthly_rate"] == 750.0

        # Suspend
        suspend_resp = client.patch(f"/suppliers/{sid}/status", json={"status": "suspended"})
        assert suspend_resp.status_code == 200
        assert suspend_resp.json()["status"] == "suspended"

        # Reactivate
        activate_resp = client.patch(f"/suppliers/{sid}/status", json={"status": "active"})
        assert activate_resp.status_code == 200
        assert activate_resp.json()["status"] == "active"

        # Delete
        delete_resp = client.delete(f"/suppliers/{sid}")
        assert delete_resp.status_code == 204

        # Verify deleted
        get_resp = client.get(f"/suppliers/{sid}")
        assert get_resp.status_code == 404