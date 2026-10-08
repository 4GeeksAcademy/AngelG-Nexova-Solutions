"""Idempotently seed the minimum Nexova inventory development dataset.

Run from the repository root with:
    uv run --directory services/api python seed_inventory.py

The seed reuses an existing TinyDB user ID for every order and never creates
or modifies users. PostgreSQL remains the only destination for inventory data.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlmodel import Session, SQLModel, select

import models  # noqa: F401 — register inventory tables in SQLModel metadata
from database import engine, users_table
from models import Asset, AssetEntry, AssetExit


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


def _stock_totals(session: Session, asset_id: int) -> tuple[int, int, int]:
    inbound = session.exec(
        select(AssetEntry.quantity).where(AssetEntry.asset_id == asset_id)
    ).all()
    outbound = session.exec(
        select(AssetExit.quantity).where(AssetExit.asset_id == asset_id)
    ).all()
    entries = sum(inbound)
    exits = sum(outbound)
    return entries, exits, entries - exits


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
                select(Asset).where(Asset.sku == data["sku"])
            ).first()
            if asset is None:
                asset = Asset(**data)
                session.add(asset)
                session.flush()
                stats["products_inserted"] += 1
            else:
                differences = {
                    key: (getattr(asset, key), expected)
                    for key, expected in data.items()
                    if getattr(asset, key) != expected
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
                select(AssetEntry).where(
                    AssetEntry.asset_id == asset.id,
                    AssetEntry.quantity == data["quantity"],
                    AssetEntry.supplier == data["supplier"],
                    AssetEntry.office == data["office"],
                    AssetEntry.created_at == data["created_at"],
                    AssetEntry.user_uuid == user_uuid,
                )
            ).first()
            if existing is None:
                session.add(
                    AssetEntry(
                        asset_id=asset.id,
                        quantity=data["quantity"],
                        supplier=data["supplier"],
                        office=data["office"],
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
                select(AssetExit).where(
                    AssetExit.asset_id == asset.id,
                    AssetExit.quantity == data["quantity"],
                    AssetExit.exit_type == data["exit_type"],
                    AssetExit.assigned_to == data["assigned_to"],
                    AssetExit.office == data["office"],
                    AssetExit.created_at == data["created_at"],
                    AssetExit.user_uuid == user_uuid,
                )
            ).first()
            if existing is None:
                session.add(
                    AssetExit(
                        asset_id=asset.id,
                        quantity=data["quantity"],
                        exit_type=data["exit_type"],
                        assigned_to=data["assigned_to"],
                        office=data["office"],
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
                "current_stock": stock,
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
