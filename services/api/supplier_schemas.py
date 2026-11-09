"""Supplier Directory contract from the Hito 09 brief."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SupplierCategory = Literal[
    "job_boards", "ats_software", "assessment_tools", "training_platforms",
    "payroll_and_hr_software", "video_interview", "background_check",
    "office_and_facilities", "it_and_software_licenses",
]


class SupplierCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    country: Literal["Spain", "USA"]
    categories: list[SupplierCategory] = Field(min_length=1)
    monthly_rate: float = Field(gt=0, allow_inf_nan=False)
    currency: Literal["EUR", "USD"]
    status: Literal["active", "suspended"] = "active"
    contract_renewal_date: date | None = None
    contact_email: str | None = Field(default=None, max_length=254)
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def validate_contract(self):
        if not self.name.strip():
            raise ValueError("El nombre del proveedor no puede estar vacío.")
        expected = "EUR" if self.country == "Spain" else "USD"
        if self.currency != expected:
            raise ValueError(f"La moneda para {self.country} debe ser {expected}.")
        return self


class SupplierResponse(SupplierCreate):
    id: int
    updated_at: datetime


class SupplierListResponse(BaseModel):
    """Supplier fields required by directory rows and inventory selectors."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    country: Literal["Spain", "USA"]
    categories: list[SupplierCategory]
    monthly_rate: float
    currency: Literal["EUR", "USD"]
    status: Literal["active", "suspended"]


class RateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    monthly_rate: float = Field(gt=0, allow_inf_nan=False)


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["active", "suspended"]
