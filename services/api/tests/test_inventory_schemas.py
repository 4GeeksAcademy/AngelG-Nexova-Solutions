from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlmodel import SQLModel

from schemas import (
    AssetCreate,
    AssetEntryResponse,
    AssetExitCreate,
    AssetExitResponse,
    AssetResponse,
)


def test_asset_create_does_not_accept_calculated_stock():
    payload = {
        "name": "Portátil 14\" Business",
        "sku": "NXV-IT-001",
        "category": "hardware",
        "office": "Valencia",
    }
    assert AssetCreate.model_validate(payload).sku == "NXV-IT-001"

    try:
        AssetCreate.model_validate({**payload, "current_stock": 10})
    except ValidationError:
        pass
    else:
        raise AssertionError("current_stock must not be accepted on create")


def test_asset_exit_enforces_assigned_to_rule():
    common = {"asset_id": 1, "quantity": 1, "office": "Valencia"}

    assert AssetExitCreate(
        **common, exit_type="allocation", assigned_to="Employee"
    ).assigned_to == "Employee"
    assert AssetExitCreate(
        **common, exit_type="consumption", assigned_to=None
    ).assigned_to is None

    for invalid_payload in (
        {**common, "exit_type": "allocation"},
        {**common, "exit_type": "consumption", "assigned_to": "Employee"},
    ):
        try:
            AssetExitCreate.model_validate(invalid_payload)
        except ValidationError:
            continue
        raise AssertionError("Invalid assigned_to/exit_type combination accepted")


def test_inventory_schemas_are_not_sqlmodel_orm_classes():
    from schemas import (
        AssetEntryCreate,
        AssetExitCreate,
        AssetOrderProduct,
        InventoryOrderResponse,
    )

    for schema in (
        AssetCreate,
        AssetResponse,
        AssetEntryCreate,
        AssetEntryResponse,
        AssetExitCreate,
        AssetExitResponse,
        AssetOrderProduct,
        InventoryOrderResponse,
    ):
        assert not issubclass(schema, SQLModel)


def test_only_asset_response_schema_exposes_calculated_stock():
    from schemas import AssetEntryCreate, AssetExitCreate

    assert "current_stock" in AssetResponse.model_fields
    for schema in (AssetCreate, AssetEntryCreate, AssetExitCreate):
        assert "current_stock" not in schema.model_fields


def test_fastapi_accepts_inventory_schemas_as_request_and_response_models():
    app = FastAPI()

    @app.post("/assets", response_model=AssetResponse)
    def create_asset(payload: AssetCreate):
        return {
            "id": 1,
            **payload.model_dump(),
            "current_stock": 0,
        }

    @app.post("/entries", response_model=AssetEntryResponse)
    def create_entry():
        return {
            "id": 1,
            "asset_id": 1,
            "quantity": 5,
            "supplier": "TechDistrib Valencia S.L.",
            "office": "Valencia",
            "created_at": datetime.now(timezone.utc),
            "user_uuid": "tinydb-user-uuid",
        }

    @app.post("/exits", response_model=AssetExitResponse)
    def create_exit(payload: AssetExitCreate):
        return {
            "id": 1,
            **payload.model_dump(),
            "created_at": datetime.now(timezone.utc),
            "user_uuid": "tinydb-user-uuid",
        }

    client = TestClient(app)
    asset = client.post(
        "/assets",
        json={
            "name": "Portátil 14\" Business",
            "sku": "NXV-IT-001",
            "category": "hardware",
            "office": "Valencia",
        },
    )
    entry = client.post("/entries")
    exit_order = client.post(
        "/exits",
        json={
            "asset_id": 1,
            "quantity": 1,
            "exit_type": "allocation",
            "assigned_to": "Employee",
            "office": "Valencia",
        },
    )

    assert asset.status_code == 200
    assert asset.json()["current_stock"] == 0
    assert entry.status_code == 200
    assert entry.json()["user_uuid"] == "tinydb-user-uuid"
    assert exit_order.status_code == 200
    assert exit_order.json()["assigned_to"] == "Employee"
