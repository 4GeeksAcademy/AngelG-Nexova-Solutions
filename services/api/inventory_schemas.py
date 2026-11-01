"""Strict request and response schemas for the canonical inventory API."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Office = Literal["valencia", "miami"]
UnitOfMeasure = Literal["unit", "box"]
Category = Literal[
    "it_equipment", "office_supplies", "training_materials", "branded_merchandise",
    "hardware", "peripherals"
]
MovementType = Literal["inbound", "outbound", "adjustment"]
TelemetryCategory = Literal["training_kit", "certification", "onboarding_equipment"]


class ItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    office: Office
    name: str = Field(min_length=1, max_length=200)
    sku: str | None = Field(default=None, min_length=1, max_length=200)
    category: Category
    unit_of_measure: UnitOfMeasure
    reorder_point: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    lot_tracked: bool = False
    telemetry_category: TelemetryCategory | None = None
    programme_id: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)

    @model_validator(mode="after")
    def validate_programme(self) -> "ItemCreate":
        if (self.telemetry_category is None) != (self.programme_id is None):
            raise ValueError("Indique categoría formativa y programa conjuntamente.")
        return self


class ItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    office: Office | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    sku: str | None = Field(default=None, min_length=1, max_length=200)
    category: Category | None = None
    unit_of_measure: UnitOfMeasure | None = None
    reorder_point: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )
    lot_tracked: bool | None = None
    telemetry_category: TelemetryCategory | None = None
    programme_id: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> "ItemUpdate":
        if not self.model_fields_set:
            raise ValueError("Debe indicar al menos un campo para actualizar.")
        if any(getattr(self, key) is None for key in self.model_fields_set - {"telemetry_category", "programme_id"}):
            raise ValueError("Los campos de actualización no pueden ser nulos.")
        return self


class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    office: Office
    name: str
    sku: str | None
    source_asset_id: int | None
    category: Category
    unit_of_measure: UnitOfMeasure
    reorder_point: Decimal
    lot_tracked: bool
    created_at: datetime
    updated_at: datetime
    current_stock: Decimal
    reorder_alert: bool
    telemetry_category: TelemetryCategory | None = None
    programme_id: str | None = None


class LotCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: int = Field(gt=0)
    lot_code: str = Field(min_length=1, max_length=100)
    expiry_date: date | None = None
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    item_id: int
    lot_code: str
    expiry_date: date | None
    received_at: datetime


class MovementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: int = Field(gt=0)
    lot_id: int | None = Field(default=None, gt=0)
    movement_type: Literal["inbound", "outbound"]
    quantity: Decimal = Field(max_digits=12, decimal_places=2)
    reason: str | None = Field(default=None, min_length=1, max_length=500)
    supplier: str | None = Field(default=None, min_length=1, max_length=200)
    exit_type: Literal["allocation", "consumption"] | None = None
    assigned_to: str | None = Field(default=None, min_length=1, max_length=200)
    office: Office | None = None
    supplier_id: int | None = Field(default=None, gt=0)
    unit_cost: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    currency: Literal["EUR", "USD"] | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_quantity_and_reason(self) -> "MovementCreate":
        if self.movement_type in {"inbound", "outbound"} and self.quantity <= 0:
            raise ValueError("inbound y outbound requieren quantity positiva.")
        if self.reason is not None:
            raise ValueError("El stock solo cambia mediante entradas y salidas; no se admiten ajustes.")
        if self.movement_type != "inbound" and self.supplier is not None:
            raise ValueError("supplier solo se permite para inbound.")
        if self.movement_type != "inbound" and (self.supplier_id is not None or self.unit_cost is not None):
            raise ValueError("supplier_id y unit_cost solo se permiten para inbound.")
        if self.created_at.tzinfo is None:
            raise ValueError("created_at requiere zona horaria.")
        if self.movement_type != "outbound" and (self.exit_type is not None or self.assigned_to is not None):
            raise ValueError("exit_type y assigned_to solo se permiten para outbound.")
        if self.exit_type == "allocation" and (not self.assigned_to or not self.assigned_to.strip()):
            raise ValueError("allocation requiere assigned_to.")
        if self.exit_type == "consumption" and self.assigned_to is not None:
            raise ValueError("consumption requiere assigned_to nulo.")
        if self.assigned_to is not None and self.exit_type != "allocation":
            raise ValueError("assigned_to requiere exit_type allocation.")
        return self


class MovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    item_id: int
    lot_id: int | None
    movement_type: MovementType
    quantity: Decimal
    reason: str | None
    supplier: str | None
    exit_type: str | None
    assigned_to: str | None
    office: str | None
    user_uuid: str | None
    source_order_id: int | None
    supplier_id: int | None = None
    unit_cost: Decimal | None = None
    currency: str | None = None
    created_at: datetime
