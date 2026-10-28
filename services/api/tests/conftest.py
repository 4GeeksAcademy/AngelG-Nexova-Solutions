"""Shared fixtures for the Nexova Suppliers API tests."""

from __future__ import annotations

from collections.abc import Generator
import importlib.util
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient
from tinydb import TinyDB

# This API uses a local ``services.py`` module. Pytest may put the monorepo
# root first on sys.path, where ``services/`` is a different package.
API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

# The monorepo already has a ``services`` package, while this API subproject
# also has a legacy ``services.py`` module imported by its top-level modules.
# Keep the monorepo package (needed by tests importing services.api.*), and
# expose the API module's functions on it for imports such as ``from services
# import get_user_by_id``.
import services as monorepo_services

_api_services_spec = importlib.util.spec_from_file_location(
    "_nexova_api_services", API_ROOT / "services.py"
)
if _api_services_spec is None or _api_services_spec.loader is None:
    raise ImportError("Could not load the API services module for tests.")
_api_services = importlib.util.module_from_spec(_api_services_spec)
_api_services_spec.loader.exec_module(_api_services)
for _name in dir(_api_services):
    if not _name.startswith("_"):
        setattr(monorepo_services, _name, getattr(_api_services, _name))

from main import app


@pytest.fixture(autouse=True)
def _temp_db(monkeypatch: pytest.MonkeyPatch, tmp_path) -> Generator[TinyDB, None, None]:
    """Replace TinyDB access with an isolated temporary database per test."""
    tmp_db = TinyDB(str(tmp_path / "test-db.json"))

    # Existing modules keep references to their imported TinyDB tables, so
    # patch the module-level tables to point at the temporary database.
    import database

    table_names = (
        "users",
        "profiles",
        "password_reset_tokens",
        "records",
        "notes",
        "incidents",
    )
    for table_name in table_names:
        table = tmp_db.table(table_name)
        monkeypatch.setattr(database, f"{table_name}_table", table)
        if hasattr(_api_services, f"{table_name}_table"):
            monkeypatch.setattr(_api_services, f"{table_name}_table", table)
        if hasattr(monorepo_services, f"{table_name}_table"):
            monkeypatch.setattr(monorepo_services, f"{table_name}_table", table)

    # Keep aliases imported by application modules pointed at this test DB.
    import auth
    import incidents
    import profiles
    import records
    import users

    for table_name in table_names:
        for module in (auth, incidents, profiles, records, users):
            if hasattr(module, f"{table_name}_table"):
                monkeypatch.setattr(module, f"{table_name}_table", tmp_db.table(table_name))

    import records as records_module

    # Tests may import database tables directly, before this fixture runs.
    # Keep those module-level aliases aligned with the temporary DB too.
    for module_name, module in tuple(sys.modules.items()):
        if not module_name.startswith(("tests.", "services.api.tests.")):
            continue
        for table_name in table_names:
            if hasattr(module, f"{table_name}_table"):
                monkeypatch.setattr(
                    module,
                    f"{table_name}_table",
                    tmp_db.table(table_name),
                )

    with records_module._public_rate_lock:
        records_module._public_request_times.clear()

    monkeypatch.setattr(database, "db", tmp_db)

    try:
        yield tmp_db
    finally:
        tmp_db.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient."""
    with TestClient(app) as test_client:
        yield test_client


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
