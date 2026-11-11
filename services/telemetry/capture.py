import logging
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from inventory_models import Item, Movement
from telemetry.models import TelemetryEvent

logger = logging.getLogger(__name__)
CURRENCIES = {"valencia": "EUR", "miami": "USD"}
COST_VARIANCE_THRESHOLD = Decimal("10")


def require_hito6_schema(engine) -> None:
    inspector = inspect(engine)
    required = {
        "inventory_item": {"telemetry_category", "programme_id"},
        "inventory_movement": {"supplier_id", "unit_cost", "currency"},
        "telemetry_events": {"event_id", "event_type", "properties", "actor_id"},
    }
    for table, fields in required.items():
        if not inspector.has_table(table) or not fields.issubset(
            {column["name"] for column in inspector.get_columns(table)}
        ):
            raise RuntimeError(
                "Hito 6 pendiente de migración: ejecutar migrations/003_hito6.sql "
                "en la base autorizada antes de iniciar. No se modificó el esquema."
            )
    if not inspector.has_table("weekly_office_program_performance", schema="reporting") or not inspector.has_table("pipeline_runs", schema="reporting"):
        raise RuntimeError("Falta esquema reporting: ejecutar migrations/003_hito6.sql.")


def properties_for(item: Item, office: str, quantity: Decimal) -> dict:
    return {
        "office": office,
        "product_id": item.id,
        "product_category": item.telemetry_category,
        "programme_id": item.programme_id,
        "quantity": str(quantity),
        "currency": CURRENCIES[office],
    }


def capture_movement(session: Session, item: Item, movement: Movement, stock_before: Decimal) -> None:
    if item.telemetry_category is None:
        return
    if movement.office not in CURRENCIES or not item.programme_id:
        raise ValueError("Instrumented movement requires office and programme")
    props = properties_for(item, movement.office, movement.quantity)
    origin = f"movement:{movement.id}"

    def add(kind: str, extra: dict) -> None:
        session.add(TelemetryEvent(
            event_type=kind, source_id=origin, occurred_at=movement.created_at,
            actor_id=movement.user_uuid,
            properties={**props, **extra},
        ))

    if movement.movement_type == "inbound":
        if movement.unit_cost is None or movement.supplier_id is None:
            raise ValueError("Instrumented inbound requires cost and supplier")
        total = (movement.quantity * movement.unit_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        add("inbound_order_created", {
            "movement_id": movement.id, "supplier_id": movement.supplier_id,
            "unit_cost": str(movement.unit_cost), "total_cost": str(total),
            "unit_of_measure": item.unit_of_measure,
        })
        baseline = session.exec(
            select(TelemetryEvent).where(
                TelemetryEvent.event_type == "inbound_order_created",
                TelemetryEvent.source_id != origin,
                TelemetryEvent.properties["product_id"].as_integer() == item.id,
                TelemetryEvent.properties["supplier_id"].as_integer() == movement.supplier_id,
                TelemetryEvent.properties["currency"].as_string() == props["currency"],
                TelemetryEvent.properties["unit_of_measure"].as_string() == item.unit_of_measure,
            )
            .order_by(TelemetryEvent.recorded_at.desc(), TelemetryEvent.event_id.desc())
        ).first()
        if baseline is not None:
            old = Decimal(baseline.properties["unit_cost"])
            # Compare without rounding the boundary; 10% exactly does not trigger.
            if old > 0 and abs(movement.unit_cost - old) * 100 > old * COST_VARIANCE_THRESHOLD:
                add("kit_cost_variance_detected", {
                    "movement_id": movement.id, "supplier_id": movement.supplier_id,
                    "previous_unit_cost": str(old), "unit_cost": str(movement.unit_cost),
                    "threshold_percent": str(COST_VARIANCE_THRESHOLD),
                    "variance_percent": str((movement.unit_cost - old) / old * 100),
                })
    else:
        add("outbound_order_created", {"movement_id": movement.id})
    after = stock_before + (movement.quantity if movement.movement_type == "inbound" else -movement.quantity)
    if stock_before >= item.reorder_point and after < item.reorder_point:
        add("stock_threshold_triggered", {
            "movement_id": movement.id, "stock_before": str(stock_before),
            "stock_after": str(after), "reorder_point": str(item.reorder_point),
        })


def capture_rejection(session: Session, item: Item, actor_id: str) -> None:
    from datetime import datetime, timezone

    if item.telemetry_category is None:
        logger.warning("Direct stock edit rejected for an unclassified inventory item")
        return
    session.add(TelemetryEvent(
        event_type="direct_stock_edit_rejected", source_id=f"rejection:{uuid4()}",
        actor_id=actor_id,
        occurred_at=datetime.now(timezone.utc),
        properties={**properties_for(item, item.office, Decimal("0")), "reason_code": "DIRECT_STOCK_EDIT"},
    ))
    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        logger.error("Failed to persist direct_stock_edit_rejected; inventory unchanged")
        raise
