from collections.abc import Generator
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import incident_models  # noqa: F401 — register managed incident tables
import inventory_models  # noqa: F401 — register canonical inventory tables
import database
from auth import get_current_user
from database import get_db
from incident_models import IncidentAuditEvent, ManagedIncident
from inventory_models import Item, Lot, Movement
from main import app
from seed_hito4 import INCIDENTS, ITEMS, seed_hito4


SEED_ACTOR_ID = "hito4-seed-test-user"


def test_hito4_seed_is_idempotent_and_covers_acceptance_data():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        first = seed_hito4(session, SEED_ACTOR_ID)
        second = seed_hito4(session, SEED_ACTOR_ID)

        assert first["items_inserted"] == len(ITEMS) == 12
        assert first["lots_inserted"] == 3
        assert first["movements_inserted"] == len(ITEMS) * 3
        assert first["incidents_inserted"] == len(INCIDENTS) == 12
        assert first["audit_events_inserted"] > len(INCIDENTS)
        assert second["items_inserted"] == 0
        assert second["lots_inserted"] == 0
        assert second["movements_inserted"] == 0
        assert second["incidents_inserted"] == 0
        assert second["audit_events_inserted"] == 0
        assert second["items_existing"] == len(ITEMS)
        assert second["movements_existing"] == len(ITEMS) * 3
        assert second["incidents_existing"] == len(INCIDENTS)
        assert second["audit_events_existing"] == first["audit_events_inserted"]

        items = session.exec(select(Item)).all()
        lots = session.exec(select(Lot)).all()
        movements = session.exec(select(Movement)).all()
        incidents = session.exec(select(ManagedIncident)).all()
        events = session.exec(select(IncidentAuditEvent)).all()
        assert len(items) == 12
        assert len(lots) == 3
        assert len(movements) == 36
        assert len(incidents) == 12
        assert {item.office for item in items} == {"valencia", "miami"}
        assert sum(item.office == "valencia" for item in items) == 6
        assert sum(item.office == "miami" for item in items) == 6
        assert {item.category for item in items} == {
            "it_equipment",
            "office_supplies",
            "training_materials",
            "branded_merchandise",
        }
        assert all(
            {
                movement.movement_type
                for movement in movements
                if movement.item_id == item.id
            }
            == {"inbound", "outbound", "adjustment"}
            for item in items
        )
        assert sum(stock["reorder_alert"] for stock in second["stock"].values()) >= 2
        assert [
            lot.expiry_date for lot in lots if lot.expiry_date is not None
        ] == [date(2025, 12, 31)]

        for item in items:
            item_movements = [
                movement for movement in movements if movement.item_id == item.id
            ]
            derived_stock = sum(
                movement.quantity
                if movement.movement_type in {"inbound", "adjustment"}
                else -movement.quantity
                for movement in item_movements
            )
            assert derived_stock == second["stock"][
                f"{item.office}/{item.name}"
            ]["current_stock"]

        reopened = next(incident for incident in incidents if incident.status == "reopened")
        reopened_history = [
            event
            for event in events
            if event.incident_id == reopened.id and event.change_type == "status"
        ]
        assert [(event.old_value, event.new_value) for event in reopened_history] == [
            ("open", "assigned"),
            ("assigned", "in_progress"),
            ("in_progress", "resolved"),
            ("resolved", "reopened"),
        ]
        assert all(event.actor_id == SEED_ACTOR_ID for event in events)
        assert any(incident.client_name is None for incident in incidents)
        assert {incident.severity for incident in incidents} == {
            "critical",
            "high",
            "medium",
            "low",
        }
        assert {incident.status for incident in incidents} == {
            "open",
            "assigned",
            "in_progress",
            "resolved",
            "closed",
            "reopened",
        }
        assert all(
            (incident.type == "sla_breach")
            == (incident.sla_deadline is not None)
            for incident in incidents
        )
        assert any(
            incident.sla_deadline is not None
            and incident.sla_deadline.date() < date(2026, 11, 1)
            and incident.status not in {"resolved", "closed"}
            for incident in incidents
        )
        assert {incident.responsible_area for incident in incidents} >= {
            "customer_support",
            "technology",
            "hr_internal",
        }

    engine.dispose()


def test_seeded_data_is_visible_through_authenticated_api() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    def override_get_db() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {
        "id": SEED_ACTOR_ID,
        "email": "seed@example.test",
    }
    configured_engine = database.engine
    database.engine = None
    try:
        with Session(engine) as session:
            seed_hito4(session, SEED_ACTOR_ID)
        with TestClient(app) as client:
            item_response = client.get(
                "/inventory/items",
                params={"office": "miami", "reorder_only": "true"},
            )
            incident_response = client.get("/v2/incidents")
            incident_summary = client.get("/v2/incidents/summary")

        assert item_response.status_code == 200
        assert len(item_response.json()) >= 2
        assert all(item["reorder_alert"] is True for item in item_response.json())
        assert incident_response.status_code == 200
        assert incident_response.json()["total"] == 12
        assert incident_summary.status_code == 200
        assert incident_summary.json()["overdue_sla"] >= 1
    finally:
        database.engine = configured_engine
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        engine.dispose()
