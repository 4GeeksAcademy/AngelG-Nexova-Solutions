"""Single inventory storage shared by the Hito 4 and Hito 5 contracts."""

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, Date, DateTime, Engine, Numeric, UniqueConstraint, inspect
from sqlmodel import Field, SQLModel


def require_unified_inventory(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    required = {
        "inventory_item": {"sku", "source_asset_id"},
        "inventory_movement": {"supplier", "exit_type", "assigned_to", "office", "user_uuid", "source_order_id"},
    }
    if tables.intersection({"asset", "assetentry", "assetexit"}) or any(
        table in tables and not columns.issubset(
            {column["name"] for column in inspector.get_columns(table)}
        )
        for table, columns in required.items()
    ):
        raise RuntimeError(
            "Inventario pendiente de migración: ejecutar migrations/002_unify_inventory.sql "
            "antes de iniciar la API o cargar seeds. No se modificaron las tablas."
        )


class Item(SQLModel, table=True):
    __tablename__ = "inventory_item"
    __table_args__ = (
        CheckConstraint(
            "office IN ('valencia', 'miami')", name="ck_inventory_item_office"
        ),
        CheckConstraint(
            "category IN ('it_equipment', 'office_supplies', "
            "'training_materials', 'branded_merchandise', 'hardware', 'peripherals')",
            name="ck_inventory_item_category",
        ),
        CheckConstraint(
            "unit_of_measure IN ('unit', 'box')", name="ck_inventory_item_unit"
        ),
        CheckConstraint("reorder_point >= 0", name="ck_inventory_item_reorder_point"),
    )

    id: int | None = Field(default=None, primary_key=True)
    office: str = Field(index=True)
    name: str = Field(min_length=1, max_length=200)
    sku: str | None = Field(default_factory=lambda: f"NXV-ITEM-{uuid4()}", unique=True, index=True)
    source_asset_id: int | None = Field(default=None, unique=True)
    telemetry_category: str | None = None
    programme_id: str | None = Field(default=None, index=True)
    category: str = Field(index=True)
    unit_of_measure: str
    reorder_point: Decimal = Field(sa_type=Numeric(12, 2))
    # Explicit domain control: when enabled, every movement is attached to a lot.
    lot_tracked: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
    )


class Lot(SQLModel, table=True):
    __tablename__ = "inventory_lot"
    __table_args__ = (
        UniqueConstraint("item_id", "lot_code", name="uq_inventory_lot_item_code"),
    )

    id: int | None = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="inventory_item.id", index=True)
    lot_code: str = Field(min_length=1, max_length=100)
    expiry_date: date | None = Field(default=None, sa_type=Date)
    received_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
    )


class Movement(SQLModel, table=True):
    __tablename__ = "inventory_movement"
    __table_args__ = (
        CheckConstraint(
            "movement_type IN ('inbound', 'outbound', 'adjustment')",
            name="ck_inventory_movement_type",
        ),
        CheckConstraint(
            "(movement_type IN ('inbound', 'outbound') AND quantity > 0) OR "
            "(movement_type = 'adjustment' AND quantity <> 0 AND reason IS NOT NULL)",
            name="ck_inventory_movement_quantity_reason",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="inventory_item.id", index=True)
    lot_id: int | None = Field(default=None, foreign_key="inventory_lot.id", index=True)
    movement_type: str = Field(index=True)
    quantity: Decimal = Field(sa_type=Numeric(12, 2))
    reason: str | None = Field(default=None, max_length=500)
    supplier: str | None = None
    supplier_id: int | None = None
    unit_cost: Decimal | None = Field(default=None, sa_type=Numeric(12, 2))
    currency: str | None = None
    exit_type: str | None = None
    assigned_to: str | None = None
    office: str | None = None
    user_uuid: str | None = None
    source_order_id: int | None = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
    )
