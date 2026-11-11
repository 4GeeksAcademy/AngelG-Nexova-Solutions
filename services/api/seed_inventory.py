"""Idempotently seed the minimum Nexova inventory development dataset.

Run from the repository root with:
    uv run --directory services/api python seed_inventory.py

The seed reuses an existing TinyDB user ID for every order and never creates
or modifies users. PostgreSQL remains the only destination for inventory data.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlmodel import Session, SQLModel, select

from database import engine, users_table
from inventory_models import Item as Asset, Movement, require_unified_inventory
from routers.inventory_v2 import _item_stock


ASSETS = (
    {
        "name": 'Portátil 14" Business',
        "sku": "NXV-IT-001",
        "category": "hardware",
        "office": "Valencia",
    },
    {
        "name": 'Portátil 14" Business',
        "sku": "NXV-IT-002",
        "category": "hardware",
        "office": "Miami",
    },
    {
        "name": "Ratón ergonómico",
        "sku": "NXV-PER-001",
        "category": "peripherals",
        "office": "Valencia",
    },
    {
        "name": "Hub USB-C",
        "sku": "NXV-PER-002",
        "category": "peripherals",
        "office": "Miami",
    },
    {
        "name": "Resma de papel A4",
        "sku": "NXV-OFF-001",
        "category": "office_supplies",
        "office": "Valencia",
    },
    {
        "name": "Cuaderno de formación en liderazgo",
        "sku": "NXV-TRN-001",
        "category": "training_materials",
        "office": "Valencia",
    },
)

# Fixed timestamps are part of the seed identity: reruns recognize the same
# orders without requiring schema changes or a Supabase users table.
INBOUND_ORDERS = (
    {
        "sku": "NXV-IT-001",
        "quantity": 10,
        "supplier": "TechDistrib Valencia S.L.",
        "office": "Valencia",
        "created_at": datetime(2026, 1, 5, 9, 0, tzinfo=timezone.utc),
    },
    {
        "sku": "NXV-IT-001",
        "quantity": 5,
        "supplier": "TechDistrib Valencia S.L.",
        "office": "Valencia",
        "created_at": datetime(2026, 1, 6, 9, 0, tzinfo=timezone.utc),
    },
    {
        "sku": "NXV-PER-001",
        "quantity": 6,
        "supplier": "TechDistrib Valencia S.L.",
        "office": "Valencia",
        "created_at": datetime(2026, 1, 7, 9, 0, tzinfo=timezone.utc),
    },
    {
        "sku": "NXV-OFF-001",
        "quantity": 20,
        "supplier": "Office Depot Valencia",
        "office": "Valencia",
        "created_at": datetime(2026, 1, 8, 9, 0, tzinfo=timezone.utc),
    },
)

OUTBOUND_ORDERS = (
    {
        "sku": "NXV-IT-001",
        "quantity": 2,
        "exit_type": "allocation",
        "assigned_to": "Equipo de IT Valencia",
        "office": "Valencia",
        "created_at": datetime(2026, 1, 9, 9, 0, tzinfo=timezone.utc),
    },
    {
        "sku": "NXV-PER-001",
        "quantity": 1,
        "exit_type": "allocation",
        "assigned_to": "Equipo de soporte Valencia",
        "office": "Valencia",
        "created_at": datetime(2026, 1, 10, 9, 0, tzinfo=timezone.utc),
    },
    {
        "sku": "NXV-OFF-001",
        "quantity": 3,
        "exit_type": "consumption",
        "assigned_to": None,
        "office": "Valencia",
        "created_at": datetime(2026, 1, 11, 9, 0, tzinfo=timezone.utc),
    },
)


class SeedDataConflict(RuntimeError):
    """Raised when a known seed SKU already exists with different attributes."""


def _stock_totals(session: Session, asset_id: int) -> tuple[Decimal, Decimal, Decimal]:
    inbound = session.exec(
        select(Movement.quantity).where(Movement.item_id == asset_id, Movement.movement_type == "inbound")
    ).all()
    outbound = session.exec(
        select(Movement.quantity).where(Movement.item_id == asset_id, Movement.movement_type == "outbound")
    ).all()
    entries = sum(inbound, Decimal("0"))
    exits = sum(outbound, Decimal("0"))
    return entries, exits, _item_stock(session, asset_id)


def seed_inventory(session: Session, user_uuid: str) -> dict[str, Any]:
    """Insert missing seed rows and report inserted counts and net stock."""
    if not user_uuid:
        raise ValueError("user_uuid must be an existing TinyDB user ID")

    stats: dict[str, Any] = {
        "products_inserted": 0,
        "products_existing": 0,
        "inbound_inserted": 0,
        "inbound_existing": 0,
        "outbound_inserted": 0,
        "outbound_existing": 0,
        "stock": {},
    }

    with session.begin():
        # Serialize concurrent seed runs on PostgreSQL. No ORM/schema changes
        # are needed for the lock; SQLite tests use the same idempotent checks.
        if session.get_bind().dialect.name == "postgresql":
            session.execute(
                text("SELECT pg_advisory_xact_lock(:lock_key)"),
                {"lock_key": 731_204_201},
            )

        assets_by_sku: dict[str, Asset] = {}
        for data in ASSETS:
            asset = session.exec(
                select(Asset).where(Asset.sku == data["sku"]).with_for_update()
            ).first()
            if asset is None:
                asset = Asset(**{**data, "office": data["office"].lower()}, unit_of_measure="unit", reorder_point=0)
                session.add(asset)
                session.flush()
                stats["products_inserted"] += 1
            else:
                differences = {
                    key: (getattr(asset, key), expected)
                    for key, expected in data.items()
                    if getattr(asset, key) != (expected.lower() if key == "office" else expected)
                }
                if differences:
                    raise SeedDataConflict(
                        f"Asset SKU {data['sku']} conflicts with seed values: "
                        f"{differences}"
                    )
                stats["products_existing"] += 1
            assets_by_sku[data["sku"]] = asset

        for data in INBOUND_ORDERS:
            asset = assets_by_sku[data["sku"]]
            existing = session.exec(
                select(Movement).where(
                    Movement.item_id == asset.id,
                    Movement.movement_type == "inbound",
                    Movement.quantity == data["quantity"],
                    Movement.supplier == data["supplier"],
                    Movement.office == data["office"].lower(),
                    Movement.created_at == data["created_at"],
                    Movement.user_uuid == user_uuid,
                )
            ).first()
            if existing is None:
                session.add(
                    Movement(
                        item_id=asset.id, movement_type="inbound",
                        quantity=data["quantity"],
                        supplier=data["supplier"],
                        office=data["office"].lower(),
                        created_at=data["created_at"],
                        user_uuid=user_uuid,
                    )
                )
                stats["inbound_inserted"] += 1
            else:
                stats["inbound_existing"] += 1

        for data in OUTBOUND_ORDERS:
            asset = assets_by_sku[data["sku"]]
            existing = session.exec(
                select(Movement).where(
                    Movement.item_id == asset.id,
                    Movement.movement_type == "outbound",
                    Movement.quantity == data["quantity"],
                    Movement.exit_type == data["exit_type"],
                    Movement.assigned_to == data["assigned_to"],
                    Movement.office == data["office"].lower(),
                    Movement.created_at == data["created_at"],
                    Movement.user_uuid == user_uuid,
                )
            ).first()
            if existing is None:
                session.add(
                    Movement(
                        item_id=asset.id, movement_type="outbound",
                        quantity=data["quantity"],
                        exit_type=data["exit_type"],
                        assigned_to=data["assigned_to"],
                        office=data["office"].lower(),
                        created_at=data["created_at"],
                        user_uuid=user_uuid,
                    )
                )
                stats["outbound_inserted"] += 1
            else:
                stats["outbound_existing"] += 1

        session.flush()
        for sku, asset in assets_by_sku.items():
            entries, exits, stock = _stock_totals(session, asset.id)
            stats["stock"][sku] = {
                "entries": entries,
                "exits": exits,
                "current_stock": int(stock) if stock == stock.to_integral_value() else stock,
            }

    return stats


def existing_tinydb_user_uuid() -> str:
    """Return an existing TinyDB user ID, without creating a Supabase user."""
    users = users_table.all()
    for user in users:
        user_id = user.get("id")
        if isinstance(user_id, str) and user_id:
            return user_id
    raise RuntimeError(
        "No existe ningún usuario con ID válido en TinyDB. Registra un usuario "
        "en la API antes de sembrar las órdenes de inventario."
    )


def main() -> None:
    if engine is None:
        raise SystemExit(
            "DATABASE_URL no está configurada; el seed requiere PostgreSQL/Supabase."
        )

    user_uuid = existing_tinydb_user_uuid()
    require_unified_inventory(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        stats = seed_inventory(session, user_uuid)

    print(
        "Seed de inventario completado. "
        f"Productos insertados={stats['products_inserted']} "
        f"(existentes={stats['products_existing']}), "
        f"entradas insertadas={stats['inbound_inserted']} "
        f"(existentes={stats['inbound_existing']}), "
        f"salidas insertadas={stats['outbound_inserted']} "
        f"(existentes={stats['outbound_existing']})."
    )
    print("Stock calculado (entradas - salidas):")
    for sku, stock in stats["stock"].items():
        print(
            f"  {sku}: {stock['entries']} - {stock['exits']} "
            f"= {stock['current_stock']}"
        )


if __name__ == "__main__":
    main()
