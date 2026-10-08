from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import models  # noqa: F401 — register inventory tables
from auth import get_current_user
from database import get_db
from main import app
from models import Asset, AssetEntry, AssetExit
from routers.inventory import create_inbound_order, create_outbound_order
from routers.inventory import router as inventory_router
from schemas import (
    AssetEntryCreate,
    AssetEntryResponse,
    AssetExitCreate,
    AssetExitResponse,
)


@pytest.fixture
def inventory_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def inventory_client(inventory_engine) -> Generator[TestClient, None, None]:

    def override_get_db():
        with Session(inventory_engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {"id": "test-user-uuid"}
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def create_product(client: TestClient, sku: str = "NXV-IT-001"):
    response = client.post(
        "/inventory/products",
        json={
            "name": "Portátil 14\" Business",
            "sku": sku,
            "category": "hardware",
            "office": "Valencia",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_inventory_product_stock_and_orders(inventory_client: TestClient):
    product = create_product(inventory_client)
    assert product["current_stock"] == 0
    asset_id = product["id"]

    inbound = inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": asset_id,
            "quantity": 5,
            "supplier": "Proveedor",
            "office": "Valencia",
        },
    )
    assert inbound.status_code == 201
    assert inbound.json()["user_uuid"] == "test-user-uuid"

    outbound = inventory_client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": asset_id,
            "quantity": 2,
            "exit_type": "allocation",
            "assigned_to": "Empleado",
            "office": "Valencia",
        },
    )
    assert outbound.status_code == 201
    assert outbound.json()["user_uuid"] == "test-user-uuid"

    assert inventory_client.get("/inventory/products").json()[0]["current_stock"] == 3
    assert (
        inventory_client.get(f"/inventory/products/{asset_id}").json()["current_stock"]
        == 3
    )

    orders = inventory_client.get("/inventory/orders")
    assert orders.status_code == 200
    assert len(orders.json()) == 2
    assert orders.json()[0]["asset"]["sku"] == "NXV-IT-001"
    assert all(order["user_uuid"] == "test-user-uuid" for order in orders.json())


def test_inventory_asset_and_order_office_fields_are_validated(
    inventory_client: TestClient,
):
    invalid_product = inventory_client.post(
        "/inventory/products",
        json={
            "name": "Unknown office asset",
            "sku": "NXV-INVALID-OFFICE",
            "category": "hardware",
            "office": "Madrid",
        },
    )
    assert invalid_product.status_code == 422

    product = create_product(inventory_client, "NXV-OFFICE-VALIDATION")
    invalid_entry = inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": product["id"],
            "quantity": 1,
            "supplier": "Proveedor",
            "office": "Madrid",
        },
    )
    assert invalid_entry.status_code == 422
    assert inventory_client.get("/inventory/orders").json() == []


def test_inventory_stock_is_global_per_asset_across_order_offices(
    inventory_client: TestClient,
):
    product = create_product(inventory_client, "NXV-GLOBAL-STOCK")
    inbound = inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": product["id"],
            "quantity": 5,
            "supplier": "Proveedor",
            "office": "Valencia",
        },
    )
    assert inbound.status_code == 201

    outbound = inventory_client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": product["id"],
            "quantity": 3,
            "exit_type": "allocation",
            "assigned_to": "Empleado Miami",
            "office": "Miami",
        },
    )

    assert outbound.status_code == 201
    assert inventory_client.get(
        f"/inventory/products/{product['id']}"
    ).json()["current_stock"] == 2


def test_product_creation_requires_authentication(inventory_client: TestClient):
    app.dependency_overrides.pop(get_current_user, None)
    response = inventory_client.post(
        "/inventory/products",
        json={
            "name": "Portátil 14\" Business",
            "sku": "NXV-IT-001",
            "category": "hardware",
            "office": "Valencia",
        },
    )

    assert response.status_code == 401


def test_authenticated_user_can_create_product(inventory_client: TestClient):
    product = create_product(inventory_client)

    assert product["id"]
    assert product["sku"] == "NXV-IT-001"
    assert product["current_stock"] == 0


def test_duplicate_product_sku_rolls_back_and_api_remains_usable(
    inventory_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    create_product(inventory_client)

    rollback_calls = 0
    original_rollback = Session.rollback

    def tracked_rollback(session: Session) -> None:
        nonlocal rollback_calls
        rollback_calls += 1
        original_rollback(session)

    monkeypatch.setattr(Session, "rollback", tracked_rollback)
    duplicate = inventory_client.post(
        "/inventory/products",
        json={
            "name": "Producto duplicado",
            "sku": "NXV-IT-001",
            "category": "hardware",
            "office": "Valencia",
        },
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["message"] == (
        "Ya existe un registro con esos datos únicos."
    )
    assert rollback_calls == 1

    products = inventory_client.get("/inventory/products")
    assert products.status_code == 200
    assert len(products.json()) == 1
    assert products.json()[0]["sku"] == "NXV-IT-001"


def test_outbound_with_insufficient_stock_is_not_persisted(
    inventory_client: TestClient,
):
    product = create_product(inventory_client)
    response = inventory_client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": product["id"],
            "quantity": 1,
            "exit_type": "consumption",
            "assigned_to": None,
            "office": "Valencia",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"]["message"] == (
        'Insufficient stock for asset \'Portátil 14" Business\'. '
        "Available: 0, requested: 1."
    )
    assert inventory_client.get("/inventory/orders").json() == []


def test_inventory_order_routes_require_authentication(
    inventory_client: TestClient,
):
    app.dependency_overrides.pop(get_current_user, None)
    response = inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": 1,
            "quantity": 1,
            "supplier": "Proveedor",
            "office": "Valencia",
        },
    )

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("endpoint", "extra_fields"),
    [
        ("inbound", {"supplier": "Proveedor"}),
        ("outbound", {"exit_type": "consumption", "assigned_to": None}),
    ],
)
def test_orders_reject_client_supplied_user_uuid(
    inventory_client: TestClient,
    endpoint: str,
    extra_fields: dict[str, str | None],
):
    product = create_product(inventory_client)
    if endpoint == "outbound":
        inbound = inventory_client.post(
            "/inventory/orders/inbound",
            json={
                "asset_id": product["id"],
                "quantity": 1,
                "supplier": "Proveedor",
                "office": "Valencia",
            },
        )
        assert inbound.status_code == 201

    response = inventory_client.post(
        f"/inventory/orders/{endpoint}",
        json={
            "asset_id": product["id"],
            "quantity": 1,
            "office": "Valencia",
            "user_uuid": "forged-user",
            **extra_fields,
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "VALIDATION_ERROR"
    saved_orders = inventory_client.get("/inventory/orders").json()
    assert all(order["user_uuid"] == "test-user-uuid" for order in saved_orders)
    assert len(saved_orders) == (1 if endpoint == "outbound" else 0)


@pytest.mark.parametrize(
    "payload",
    [
        {"exit_type": "allocation", "assigned_to": None},
        {"exit_type": "consumption", "assigned_to": "Juan"},
        {"exit_type": "transfer", "assigned_to": None},
    ],
)
def test_invalid_exit_schema_returns_validation_error_without_writing(
    inventory_client: TestClient,
    payload: dict[str, str | None],
):
    product = create_product(inventory_client)
    response = inventory_client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": product["id"],
            "quantity": 1,
            "office": "Valencia",
            **payload,
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "VALIDATION_ERROR"
    assert inventory_client.get("/inventory/orders").json() == []


def test_order_handlers_return_explicit_pydantic_response_schemas(
    inventory_client: TestClient,
    inventory_engine,
):
    product = create_product(inventory_client)
    with Session(inventory_engine) as session:
        asset = session.get(Asset, product["id"])
        assert asset is not None
        inbound = create_inbound_order(
            AssetEntryCreate(
                asset_id=asset.id,
                quantity=2,
                supplier="Supplier",
                office="Valencia",
            ),
            session,
            {"id": "authenticated-user"},
        )
        outbound = create_outbound_order(
            AssetExitCreate(
                asset_id=asset.id,
                quantity=1,
                exit_type="consumption",
                assigned_to=None,
                office="Valencia",
            ),
            session,
            {"id": "authenticated-user"},
        )

        assert isinstance(inbound, AssetEntryResponse)
        assert isinstance(outbound, AssetExitResponse)
        assert not isinstance(inbound, AssetEntry)
        assert not isinstance(outbound, AssetExit)
        assert inbound.user_uuid == "authenticated-user"
        assert outbound.user_uuid == "authenticated-user"


def test_list_orders_uses_bounded_queries_without_n_plus_one(
    inventory_client: TestClient,
    inventory_engine,
):
    assets = [
        create_product(inventory_client, f"NXV-IT-{index:03d}")
        for index in range(3)
    ]
    for index, asset in enumerate(assets):
        inbound = inventory_client.post(
            "/inventory/orders/inbound",
            json={
                "asset_id": asset["id"],
                "quantity": 3,
                "supplier": f"Supplier {index}",
                "office": "Valencia",
            },
        )
        assert inbound.status_code == 201
        outbound = inventory_client.post(
            "/inventory/orders/outbound",
            json={
                "asset_id": asset["id"],
                "quantity": 1,
                "exit_type": "consumption",
                "assigned_to": None,
                "office": "Valencia",
            },
        )
        assert outbound.status_code == 201

    statements: list[str] = []

    def record_statement(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(inventory_engine, "before_cursor_execute", record_statement)
    response = inventory_client.get("/inventory/orders")
    event.remove(inventory_engine, "before_cursor_execute", record_statement)

    assert response.status_code == 200
    assert len(response.json()) == 6
    assert len(statements) == 2


def test_inventory_routes_are_registered_only_under_required_prefix():
    inventory_paths = {
        route.path
        for route in inventory_router.routes
    }

    assert inventory_paths == {
        "/inventory/products",
        "/inventory/products/{id}",
        "/inventory/orders/inbound",
        "/inventory/orders/outbound",
        "/inventory/orders",
    }
