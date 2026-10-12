"""
conftest.py — Shared fixtures for the Nexova Suppliers API tests.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from tinydb import TinyDB

from services.api.main import app
from services.api.models import SupplierDict
from services.api.seed import SUPPLIERS_SEED


# ── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _temp_db(monkeypatch: pytest.MonkeyPatch) -> Generator[TinyDB, None, None]:
    """Replace the production TinyDB with a temporary JSON file.

    This fixture runs automatically for every test. It creates a temp file,
    monkeypatches get_db() to point to it, and removes the file after the
    test completes.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()

    tmp_db = TinyDB(str(tmp_path))

    def _mock_db() -> TinyDB:
        return tmp_db

    monkeypatch.setattr("services.api.database.get_db", _mock_db)
    monkeypatch.setattr("services.api.routes.suppliers.get_db", _mock_db)
    monkeypatch.setattr("services.api.seed.get_db", _mock_db)

    yield tmp_db

    tmp_db.close()
    os.unlink(str(tmp_path))


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def seeded_db(_temp_db: TinyDB) -> TinyDB:
    """Pre-populate the database with seed data."""
    table = _temp_db.table("suppliers")
    for item in SUPPLIERS_SEED:
        validated = SupplierDict(**item)
        data = validated.model_dump()
        table.insert(data)
    return _temp_db


@pytest.fixture
def valid_payload() -> dict:
    """A valid supplier creation payload."""
    return {
        "name": "Test Supplier",
        "country": "Spain",
        "categories": ["job_boards"],
        "monthly_rate": 500.0,
        "currency": "EUR",
        "status": "active",
        "contact_email": "test@supplier.com",
        "contract_renewal_date": "2025-12-31",
        "notes": "Test supplier created during testing.",
    }


@pytest.fixture
def valid_payload_usa() -> dict:
    """A valid supplier creation payload for USA."""
    return {
        "name": "US Test Supplier",
        "country": "USA",
        "categories": ["background_check"],
        "monthly_rate": 200.0,
        "currency": "USD",
        "status": "active",
    }