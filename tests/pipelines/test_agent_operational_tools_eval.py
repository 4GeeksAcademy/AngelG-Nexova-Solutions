"""Offline acceptance checks for the internal agent's read-only tools.

These tests use an isolated in-memory SQLite database. They do not access the
configured application database, PostgreSQL, Qdrant, or a model provider.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy.exc import DBAPIError, TimeoutError as SQLAlchemyTimeoutError
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from services.api.agent import tools
from incident_models import ManagedIncident
from inventory_models import Item, Movement


@pytest.fixture
def operational_tool_db(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(tools.database, "engine", engine)
    yield engine
    engine.dispose()


def test_incidents_eval_matches_accentless_query_and_excludes_archived(
    operational_tool_db,
):
    from sqlmodel import Session

    with Session(operational_tool_db) as session:
        session.add_all(
            [
                ManagedIncident(
                    id="INC-101",
                    client_name="Cliente de prueba",
                    channel="web",
                    type="technical",
                    severity="high",
                    responsible_area="Tecnología",
                    title="Caída del servidor",
                    description="No responde el servicio de autenticación.",
                    status="open",
                    assigned_to="Agente interno",
                    created_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
                    updated_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
                    is_archived=False,
                ),
                ManagedIncident(
                    id="INC-102",
                    client_name="Cliente de prueba",
                    channel="web",
                    type="technical",
                    severity="high",
                    responsible_area="Tecnología",
                    title="Caída del servidor archivada",
                    description="Caso ya archivado.",
                    status="open",
                    created_at=datetime(2026, 2, 2, tzinfo=timezone.utc),
                    updated_at=datetime(2026, 2, 2, tzinfo=timezone.utc),
                    is_archived=True,
                ),
            ]
        )
        session.commit()

    result = tools.search_incidents_tool("caida servidor", status="open")

    assert result.status == "ok"
    assert [incident.id for incident in result.items] == ["INC-101"]
    assert set(result.items[0].model_dump()) == {
        "id",
        "client_name",
        "title",
        "description",
        "status",
        "severity",
        "responsible_area",
        "assigned_to",
        "sla_deadline",
    }


def test_inventory_eval_derives_stock_and_reorder_alert(operational_tool_db):
    from sqlmodel import Session

    with Session(operational_tool_db) as session:
        item = Item(
            office="valencia",
            name="Portátil de soporte",
            sku="LAP-7",
            category="hardware",
            unit_of_measure="unit",
            reorder_point=Decimal("3"),
            lot_tracked=False,
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        session.add_all(
            [
                Movement(
                    item_id=item.id,
                    movement_type="inbound",
                    quantity=Decimal("5"),
                    reason="Recepción de prueba",
                ),
                Movement(
                    item_id=item.id,
                    movement_type="outbound",
                    quantity=Decimal("2"),
                    reason="Entrega de prueba",
                ),
            ]
        )
        session.commit()

    result = tools.search_inventory_tool("portatil soporte", office="valencia")

    assert result.status == "ok"
    assert len(result.items) == 1
    item_result = result.items[0]
    assert item_result.name == "Portátil de soporte"
    assert item_result.current_stock == Decimal("3")
    assert item_result.reorder_point == Decimal("3")
    assert item_result.reorder_alert is True
    assert set(item_result.model_dump()) == {
        "id",
        "name",
        "sku",
        "category",
        "office",
        "unit_of_measure",
        "current_stock",
        "reorder_point",
        "reorder_alert",
    }


def test_inventory_eval_caps_result_count(operational_tool_db):
    from sqlmodel import Session

    with Session(operational_tool_db) as session:
        session.add_all(
            [
                Item(
                    office="valencia",
                    name=f"Monitor de prueba {index:02}",
                    sku=f"MON-{index:02}",
                    category="hardware",
                    unit_of_measure="unit",
                    reorder_point=Decimal("0"),
                    lot_tracked=False,
                )
                for index in range(12)
            ]
        )
        session.commit()

    result = tools.search_inventory_tool("monitor", limit=100)

    assert result.status == "ok"
    assert len(result.items) == tools.MAX_INVENTORY_RESULTS


@pytest.mark.parametrize(
    ("query", "expected_status"),
    [("   ", "invalid_query"), ("x" * 201, "invalid_query")],
)
def test_operational_tools_reject_empty_or_oversized_queries(
    operational_tool_db, query, expected_status
):
    assert tools.search_incidents_tool(query).status == expected_status
    assert tools.search_inventory_tool(query).status == expected_status


def test_operational_tools_fail_closed_without_database(monkeypatch):
    monkeypatch.setattr(tools.database, "engine", None)

    incidents = tools.search_incidents_tool("servidor")
    inventory = tools.search_inventory_tool("portatil")

    assert incidents.status == "unavailable"
    assert incidents.items == []
    assert inventory.status == "unavailable"
    assert inventory.items == []


def test_incident_tool_uses_shared_managed_incident_service(
    operational_tool_db, monkeypatch
):
    calls = []

    def fake_search(session, *, terms, status, limit):
        calls.append((session, terms, status, limit))
        return []

    monkeypatch.setattr(tools, "_set_statement_timeout", lambda session: None)
    monkeypatch.setattr(tools, "search_managed_incidents", fake_search)

    result = tools.search_incidents_tool("caída servidor", status="open", limit=50)

    assert result.status == "ok"
    assert result.items == []
    assert len(calls) == 1
    assert calls[0][1:] == (["caida", "servidor"], "open", tools.MAX_INCIDENT_RESULTS)


@pytest.mark.parametrize(
    ("tool_name", "query"),
    [
        ("search_incidents_tool", "servidor"),
        ("search_inventory_tool", "portatil"),
    ],
)
def test_operational_tools_return_empty_timeout_fallback(
    operational_tool_db, monkeypatch, tool_name, query
):
    def raise_timeout(session):
        raise SQLAlchemyTimeoutError("database operation exceeded its time limit")

    monkeypatch.setattr(tools, "_set_statement_timeout", raise_timeout)

    result = getattr(tools, tool_name)(query)

    assert result.status == "timeout"
    assert result.items == []
    assert "demasiado" in result.message


@pytest.mark.parametrize(
    "driver_message",
    ["connection to server timed out", "timeout expired while connecting"],
)
def test_operational_tools_classify_postgres_connection_timeout(
    operational_tool_db, monkeypatch, driver_message
):
    class OperationalError(Exception):
        pass

    def raise_connection_timeout(session):
        original = OperationalError(driver_message)
        raise DBAPIError("SELECT 1", {}, original)

    monkeypatch.setattr(tools, "_set_statement_timeout", raise_connection_timeout)

    incidents = tools.search_incidents_tool("servidor")
    inventory = tools.search_inventory_tool("portatil")

    assert incidents.status == "timeout"
    assert incidents.items == []
    assert inventory.status == "timeout"
    assert inventory.items == []


def test_operational_tools_do_not_classify_other_connection_errors_as_timeout():
    class OperationalError(Exception):
        pass

    error = DBAPIError("SELECT 1", {}, OperationalError("password authentication failed"))

    assert tools._is_statement_timeout(error) is False
