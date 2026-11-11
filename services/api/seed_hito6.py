"""Explicit, repeatable synthetic material dataset; does not create users/providers."""

import argparse
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlmodel import Session, select

from database import db, engine, users_table
from inventory_models import Item, Movement
from inventory_schemas import ItemCreate, MovementCreate
from reporting.pipeline import run_pipeline, validate_week
from routers.inventory_v2 import create_item, create_movement
from telemetry.capture import require_hito6_schema

MATERIALS = (
    ("leadership", "training_kit", "Kit de liderazgo"),
    ("certification", "certification", "Material de certificación"),
    ("onboarding", "onboarding_equipment", "Kit de incorporación"),
)


def seed(session: Session, user: dict, supplier_id: int, week: date) -> dict:
    validate_week(week)
    inserted = {"items": 0, "inbound": 0, "outbound": 0}
    for office in ("valencia", "miami"):
        for programme, category, name in MATERIALS:
            sku = f"NXV-H6-{office}-{programme}-{week.isoformat()}"
            item = session.exec(select(Item).where(Item.sku == sku)).first()
            if item is None:
                response = create_item(ItemCreate(
                    name=name, sku=sku, office=office, category="training_materials",
                    telemetry_category=category, programme_id=programme,
                    unit_of_measure="unit", reorder_point=2,
                ), session, user)
                item = session.get(Item, response.id)
                inserted["items"] += 1
            # Identity is stable per material/type/timestamp; reruns add no movements.
            operations = (
                (0, "inbound", "6", "10.00"),
                (1, "inbound", "4", "12.00"),
                (2, "outbound", "3", None),
                (3, "outbound", "6", None),
            )
            for offset, kind, quantity, cost in operations:
                created = datetime.combine(week + timedelta(days=offset), time(9), timezone.utc)
                existing = session.exec(select(Movement.id).where(
                    Movement.item_id == item.id, Movement.movement_type == kind,
                    Movement.created_at == created,
                )).first()
                if existing is not None:
                    continue
                create_movement(MovementCreate(
                    item_id=item.id, movement_type=kind, quantity=Decimal(quantity),
                    created_at=created,
                    supplier_id=supplier_id if cost is not None else None,
                    unit_cost=Decimal(cost) if cost is not None else None,
                    exit_type="consumption" if kind == "outbound" else None,
                ), session, user)
                inserted[kind] += 1
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed ficticio del Hito 6 en la base explícitamente configurada.")
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--supplier-id", type=int, required=True)
    parser.add_argument("--week-start", type=date.fromisoformat, default=date(2026, 10, 26))
    args = parser.parse_args()
    if engine is None:
        parser.error("DATABASE_URL debe apuntar a la base PostgreSQL autorizada.")
    user = next((record for record in users_table.all() if record["id"] == args.user_id), None)
    if user is None or not user.get("is_active"):
        parser.error("Indique un usuario existente y activo; no se crearon usuarios.")
    if db.table("suppliers").get(doc_id=args.supplier_id) is None:
        parser.error("Indique un proveedor existente; no se crearon proveedores.")
    require_hito6_schema(engine)
    with Session(engine) as session:
        result = seed(session, user, args.supplier_id, args.week_start)
    run = run_pipeline(engine, args.week_start)
    print(f"Seed Hito 6: {result}; reporte={run.status}, filas={run.rows_written}.")


if __name__ == "__main__":
    main()
