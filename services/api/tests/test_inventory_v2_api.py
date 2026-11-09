from collections.abc import Generator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from tinydb import TinyDB

import database
import inventory_models  # noqa: F401 — registers new tables
from auth import get_current_user
from database import get_db
from main import app
import routes.suppliers as suppliers_routes


@pytest.fixture
def inventory_v2_client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enforce_foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")

    SQLModel.metadata.create_all(engine)

    def override_get_db():
        with Session(engine) as session:
            yield session

    previous_engine = database.engine
    database.engine = None
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {"id": "inventory-user"}
    try:
        with TestClient(app) as client:
            yield client
    finally:
        database.engine = previous_engine
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        engine.dispose()


def item_payload(**overrides):
    result = {
        "office": "valencia",
        "name": "Auriculares soporte",
        "category": "it_equipment",
        "unit_of_measure": "unit",
        "reorder_point": 2,
    }
    result.update(overrides)
    return result


def create_item(client: TestClient, **overrides):
    response = client.post("/inventory/items", json=item_payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def movement(client: TestClient, item_id: int, kind: str, quantity, **extra):
    return client.post(
        "/inventory/movements",
        json={
            "item_id": item_id,
            "movement_type": kind,
            "quantity": quantity,
            **extra,
        },
    )


def test_both_contracts_share_items_stock_history_and_deletion(inventory_v2_client):
    new_item = create_item(inventory_v2_client)
    legacy = inventory_v2_client.post(
        "/inventory/products",
        json={
            "name": "Legacy laptop",
            "sku": "LEGACY-1",
            "category": "hardware",
            "office": "Valencia",
        },
    )
    assert new_item["id"] == 1
    assert legacy.status_code == 201
    products = inventory_v2_client.get("/inventory/products").json()
    assert products[0]["id"] == new_item["id"]
    assert products[1]["sku"] == "LEGACY-1"
    legacy_item = legacy.json()
    assert inventory_v2_client.get(f"/inventory/items/{legacy_item['id']}").json()["sku"] == "LEGACY-1"
    assert movement(inventory_v2_client, new_item["id"], "inbound", "2.75", supplier="Proveedor demo").status_code == 201
    assert inventory_v2_client.get(f"/inventory/products/{new_item['id']}").json()["current_stock"] == "2.75"
    order = inventory_v2_client.get("/inventory/orders").json()[0]
    assert order["quantity"] == "2.75"
    assert order["supplier"] == "Proveedor demo"
    assert inventory_v2_client.delete(f"/inventory/items/{new_item['id']}/permanent").status_code == 204
    assert inventory_v2_client.get(f"/inventory/products/{new_item['id']}").status_code == 404
    assert inventory_v2_client.get("/inventory/orders").json() == []


def test_stock_is_derived_separated_by_office_and_reorder_alert(inventory_v2_client):
    valencia = create_item(inventory_v2_client, reorder_point=2)
    miami = create_item(
        inventory_v2_client,
        office="miami",
        name="Auriculares Miami",
        reorder_point=2,
    )
    assert movement(inventory_v2_client, valencia["id"], "inbound", 5).status_code == 201
    assert movement(inventory_v2_client, valencia["id"], "adjustment", -1, reason="count_correction").status_code == 422
    assert movement(inventory_v2_client, valencia["id"], "outbound", 3).status_code == 201
    assert movement(inventory_v2_client, miami["id"], "inbound", 1).status_code == 201

    valencia_result = inventory_v2_client.get(f"/inventory/items/{valencia['id']}").json()
    miami_result = inventory_v2_client.get(f"/inventory/items/{miami['id']}").json()
    assert valencia_result["current_stock"] == "2.00"
    assert valencia_result["reorder_alert"] is True
    assert miami_result["current_stock"] == "1.00"
    assert miami_result["reorder_alert"] is True
    assert len(inventory_v2_client.get("/inventory/items?reorder_only=true").json()) == 2
    assert len(inventory_v2_client.get("/inventory/items?office=valencia").json()) == 1
    assert inventory_v2_client.get("/inventory/items/999").status_code == 404
    # Stock is not an accepted mutable field.
    assert inventory_v2_client.patch(
        f"/inventory/items/{valencia['id']}", json={"current_stock": 999}
    ).status_code == 422


def test_item_list_aggregates_stock_and_preserves_decimal_signs(inventory_v2_client):
    items = [
        create_item(inventory_v2_client, name=f"Item {index}")
        for index in range(3)
    ]
    assert movement(inventory_v2_client, items[0]["id"], "inbound", "5.25").status_code == 201
    assert movement(inventory_v2_client, items[0]["id"], "outbound", "1.10").status_code == 201
    assert movement(inventory_v2_client, items[1]["id"], "inbound", "3.00").status_code == 201

    response = inventory_v2_client.get("/inventory/items")
    assert response.status_code == 200
    by_id = {item["id"]: item for item in response.json()}
    assert by_id[items[0]["id"]]["current_stock"] == "4.15"
    assert by_id[items[1]["id"]]["current_stock"] == "3.00"
    assert Decimal(by_id[items[2]["id"]]["current_stock"]) == Decimal("0")
    assert by_id[items[2]["id"]]["reorder_alert"] is True


def test_negative_stock_adjustments_and_outbound_roll_back(inventory_v2_client):
    item = create_item(inventory_v2_client)
    assert movement(inventory_v2_client, item["id"], "outbound", 1).status_code == 409
    assert movement(inventory_v2_client, item["id"], "adjustment", -1, reason="lost").status_code == 422
    assert inventory_v2_client.get("/inventory/movements").json() == []


def test_invalid_movement_shapes_and_catalogs_are_rejected(inventory_v2_client):
    invalid_item = inventory_v2_client.post(
        "/inventory/items", json=item_payload(office="Madrid")
    )
    assert invalid_item.status_code == 422
    item = create_item(inventory_v2_client)
    assert movement(inventory_v2_client, item["id"], "adjustment", 0, reason="x").status_code == 422
    assert movement(inventory_v2_client, item["id"], "adjustment", 1).status_code == 422
    assert movement(inventory_v2_client, item["id"], "inbound", -1).status_code == 422
    assert movement(inventory_v2_client, 999, "inbound", 1).status_code == 404
    assert inventory_v2_client.post(
        "/inventory/movements",
        json={"item_id": item["id"], "movement_type": "inbound", "quantity": 1, "reason": "not allowed"},
    ).status_code == 422


def test_lot_references_tracking_expiry_and_lot_stock(inventory_v2_client):
    tracked = create_item(
        inventory_v2_client,
        category="training_materials",
        name="Bono certificación",
        lot_tracked=True,
    )
    plain = create_item(inventory_v2_client, name="Otro artículo", office="miami")
    assert movement(inventory_v2_client, tracked["id"], "inbound", 5).status_code == 422
    assert inventory_v2_client.post(
        "/inventory/lots", json={"item_id": 999, "lot_code": "NO"}
    ).status_code == 404
    assert inventory_v2_client.post(
        "/inventory/lots", json={"item_id": tracked["id"], "lot_code": "MISSING"}
    ).status_code == 201

    expired_response = inventory_v2_client.post(
        "/inventory/lots",
        json={
            "item_id": tracked["id"],
            "lot_code": "EXPIRED",
            "expiry_date": (date.today() - timedelta(days=1)).isoformat(),
        },
    )
    valid_response = inventory_v2_client.post(
        "/inventory/lots",
        json={"item_id": tracked["id"], "lot_code": "VALID"},
    )
    assert expired_response.status_code == valid_response.status_code == 201
    expired_id = expired_response.json()["id"]
    valid_id = valid_response.json()["id"]
    other_item_lot = inventory_v2_client.post(
        "/inventory/lots", json={"item_id": plain["id"], "lot_code": "OTHER"}
    ).json()
    assert movement(
        inventory_v2_client, tracked["id"], "inbound", 3, lot_id=expired_id
    ).status_code == 201
    assert movement(
        inventory_v2_client, tracked["id"], "outbound", 1, lot_id=expired_id
    ).status_code == 409
    assert movement(
        inventory_v2_client, tracked["id"], "inbound", 3, lot_id=other_item_lot["id"]
    ).status_code == 422
    assert movement(
        inventory_v2_client, tracked["id"], "outbound", 1, lot_id=valid_id
    ).status_code == 409
    assert inventory_v2_client.get(f"/inventory/items/{tracked['id']}").json()["current_stock"] == "3.00"


def test_delete_only_unused_item_and_preserve_history(inventory_v2_client):
    used = create_item(inventory_v2_client)
    unused = create_item(inventory_v2_client, name="Sin uso")
    assert movement(inventory_v2_client, used["id"], "inbound", 2).status_code == 201
    assert inventory_v2_client.delete(f"/inventory/items/{used['id']}").status_code == 409
    assert inventory_v2_client.get(f"/inventory/items/{used['id']}").status_code == 200
    assert inventory_v2_client.delete(f"/inventory/items/{unused['id']}").status_code == 204
    lot = inventory_v2_client.post(
        "/inventory/lots", json={"item_id": used["id"], "lot_code": "DELETE-RELATED"}
    ).json()
    other = create_item(inventory_v2_client, name="No borrar")
    assert movement(inventory_v2_client, other["id"], "inbound", 5).status_code == 201
    assert inventory_v2_client.delete(f"/inventory/items/{used['id']}/permanent").status_code == 204
    assert inventory_v2_client.get(f"/inventory/items/{used['id']}").status_code == 404
    assert inventory_v2_client.get(f"/inventory/movements?item_id={used['id']}").json() == []
    assert inventory_v2_client.get(f"/inventory/lots?item_id={used['id']}").json() == []
    assert inventory_v2_client.get(f"/inventory/items/{other['id']}").json()["current_stock"] == "5.00"
    assert lot["item_id"] == used["id"]
    assert inventory_v2_client.delete(f"/inventory/items/{used['id']}/permanent").status_code == 404


def test_item_corrections_preserve_history_and_tracking_applies_to_new_movements(inventory_v2_client):
    item = create_item(inventory_v2_client)
    assert movement(inventory_v2_client, item["id"], "inbound", 2).status_code == 201
    history = inventory_v2_client.get("/inventory/movements").json()
    response = inventory_v2_client.patch(
        f"/inventory/items/{item['id']}",
        json={"lot_tracked": True, "office": "miami", "unit_of_measure": "box"},
    )
    assert response.status_code == 200, response.text
    corrected = response.json()
    assert corrected["lot_tracked"] is True
    assert corrected["office"] == "miami"
    assert corrected["unit_of_measure"] == "box"
    assert corrected["current_stock"] == "2.00"
    assert inventory_v2_client.get("/inventory/movements").json() == history
    assert inventory_v2_client.get("/inventory/items?office=valencia").json() == []
    assert inventory_v2_client.get("/inventory/items?office=miami").json()[0]["id"] == item["id"]
    assert movement(inventory_v2_client, item["id"], "inbound", 1).status_code == 422
    lot = inventory_v2_client.post(
        "/inventory/lots", json={"item_id": item["id"], "lot_code": "AFTER-CORRECTION"}
    ).json()
    assert movement(
        inventory_v2_client, item["id"], "outbound", 1, lot_id=lot["id"]
    ).status_code == 409
    assert movement(
        inventory_v2_client, item["id"], "inbound", 1, lot_id=lot["id"]
    ).status_code == 201
    tracked_history = inventory_v2_client.get("/inventory/movements").json()
    assert inventory_v2_client.patch(
        f"/inventory/items/{item['id']}", json={"lot_tracked": False}
    ).status_code == 200
    assert inventory_v2_client.get("/inventory/movements").json() == tracked_history
    assert inventory_v2_client.get("/inventory/lots").json()[0]["id"] == lot["id"]
    assert movement(inventory_v2_client, item["id"], "inbound", 1).status_code == 201
    assert inventory_v2_client.get(f"/inventory/items/{item['id']}").json()["current_stock"] == "4.00"


def test_inventory_v2_endpoints_require_auth(inventory_v2_client):
    app.dependency_overrides.pop(get_current_user, None)
    assert inventory_v2_client.get("/inventory/items").status_code == 401
    assert inventory_v2_client.delete("/inventory/items/1/permanent").status_code == 401


def test_supplier_list_uses_compact_response(inventory_v2_client, monkeypatch, tmp_path):
    supplier_db = TinyDB(str(tmp_path / "suppliers.json"))
    monkeypatch.setattr(suppliers_routes, "db", supplier_db)
    supplier_db.table("suppliers").insert(
        {
            "name": "Supplier",
            "country": "Spain",
            "categories": ["job_boards"],
            "monthly_rate": 120.0,
            "currency": "EUR",
            "status": "active",
            "updated_at": "2026-11-07T00:00:00+00:00",
            "contact_email": "private@example.test",
            "notes": "detail-only field",
        }
    )

    response = inventory_v2_client.get("/suppliers")
    assert response.status_code == 200
    assert response.json() == [
        {
            "id": 1,
            "name": "Supplier",
            "country": "Spain",
            "categories": ["job_boards"],
            "monthly_rate": 120.0,
            "currency": "EUR",
            "status": "active",
        }
    ]
    supplier_db.close()
