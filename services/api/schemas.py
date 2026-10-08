from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


AssetCategory = Literal[
    "hardware",
    "peripherals",
    "office_supplies",
    "training_materials",
]
Office = Literal["Valencia", "Miami"]
ExitType = Literal["allocation", "consumption"]


class AssetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    sku: str
    category: AssetCategory
    office: Office


class AssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str
    sku: str
    category: AssetCategory
    office: Office
    current_stock: int


class AssetEntryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: int
    quantity: int = Field(gt=0)
    supplier: str
    office: Office


class AssetEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    asset_id: int
    quantity: int
    supplier: str
    office: Office
    created_at: datetime
    user_uuid: str


class AssetOrderProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str
    sku: str
    category: AssetCategory
    office: Office


class AssetExitCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: int
    quantity: int = Field(gt=0)
    exit_type: ExitType
    assigned_to: str | None = None
    office: Office

    @model_validator(mode="after")
    def validate_assigned_to_for_exit_type(self) -> "AssetExitCreate":
        if self.exit_type == "allocation" and not self.assigned_to:
            raise ValueError("assigned_to is required when exit_type is 'allocation'")
        if self.exit_type == "consumption" and self.assigned_to is not None:
            raise ValueError("assigned_to must be null when exit_type is 'consumption'")
        return self


class AssetExitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    asset_id: int
    quantity: int
    exit_type: ExitType
    assigned_to: str | None
    office: Office
    created_at: datetime
    user_uuid: str


class InventoryOrderResponse(BaseModel):
    """Unified inbound/outbound order representation with its related asset."""

    model_config = ConfigDict(extra="forbid")

    id: int
    order_type: Literal["inbound", "outbound"]
    asset_id: int
    quantity: int
    office: Office
    created_at: datetime
    user_uuid: str
    supplier: str | None = None
    exit_type: ExitType | None = None
    assigned_to: str | None = None
    asset: AssetOrderProduct
