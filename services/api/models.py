"""
models.py — Pydantic models for the Nexova Supplier Directory.

All field names, categories, statuses, and validation rules are derived
exclusively from the project context files (CONTEXT-nexova.es.md,
company-choice.md, CONTEXT.md).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Constants (from context) ──────────────────────────────────────────────

VALID_CATEGORIES: list[str] = [
    "job_boards",
    "ats_software",
    "assessment_tools",
    "training_platforms",
    "payroll_and_hr_software",
    "video_interview",
    "background_check",
    "office_and_facilities",
    "it_and_software_licenses",
]

VALID_STATUSES: list[str] = ["active", "suspended"]

VALID_COUNTRIES: list[str] = ["Spain", "USA"]

COUNTRY_CURRENCY_MAP: dict[str, str] = {
    "Spain": "EUR",
    "USA": "USD",
}


# ── Enums ─────────────────────────────────────────────────────────────────

class SupplierStatus(str, Enum):
    active = "active"
    suspended = "suspended"


# ── Internal / Storage model ──────────────────────────────────────────────

class SupplierDict(BaseModel):
    """Internal representation stored in TinyDB. All fields are present."""

    name: str = Field(..., min_length=1, description="Nombre comercial")
    country: str = Field(..., description="País del contrato: Spain o USA")
    categories: list[str] = Field(..., min_length=1, description="Categorías de servicio")
    monthly_rate: float = Field(..., gt=0, description="Coste mensual")
    currency: str = Field(..., description="EUR para Spain, USD para USA")
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Timestamp de la última actualización",
    )
    status: str = Field(default="active", description="active o suspended")
    contract_renewal_date: Optional[str] = Field(
        None, description="Fecha de renovación (YYYY-MM-DD)"
    )
    contact_email: Optional[str] = Field(
        None, description="Email del account manager"
    )
    notes: Optional[str] = Field(None, description="Observaciones internas")

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str) -> str:
        if v not in VALID_COUNTRIES:
            raise ValueError(f"País no válido: {v}. Debe ser Spain o USA.")
        return v

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Debe especificar al menos una categoría.")
        invalid = [c for c in v if c not in VALID_CATEGORIES]
        if invalid:
            raise ValueError(
                f"Categorías no válidas: {invalid}. "
                f"Válidas: {VALID_CATEGORIES}"
            )
        return v

    @field_validator("monthly_rate")
    @classmethod
    def validate_monthly_rate(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("La tarifa mensual debe ser mayor que 0.")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(
                f"Estado no válido: {v}. Debe ser {VALID_STATUSES}."
            )
        return v

    @field_validator("contract_renewal_date")
    @classmethod
    def validate_renewal_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError(
                    "contract_renewal_date debe tener formato YYYY-MM-DD."
                )
        return v

    @model_validator(mode="after")
    def set_currency_from_country(self) -> "SupplierDict":
        """Auto-set currency based on country if not explicitly provided."""
        if self.country in COUNTRY_CURRENCY_MAP:
            expected = COUNTRY_CURRENCY_MAP[self.country]
            if self.currency != expected:
                self.currency = expected
        return self


# ── API request / response models ─────────────────────────────────────────

class SupplierCreate(BaseModel):
    """Model for creating a new supplier. Client cannot set id, updated_at."""

    name: str = Field(..., min_length=1, description="Nombre comercial")
    country: str = Field(..., description='País: "Spain" o "USA"')
    categories: list[str] = Field(
        ..., min_length=1, description="Categorías de servicio"
    )
    monthly_rate: float = Field(..., gt=0, description="Coste mensual > 0")
    currency: str = Field(..., description='"EUR" o "USD"')
    status: str = Field(default="active", description="Estado inicial")
    contract_renewal_date: Optional[str] = Field(
        None, description="Fecha de renovación (YYYY-MM-DD)"
    )
    contact_email: Optional[str] = Field(
        None, description="Email del account manager"
    )
    notes: Optional[str] = Field(None, description="Observaciones internas")

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str) -> str:
        if v not in VALID_COUNTRIES:
            raise ValueError(f"País no válido: {v}. Debe ser Spain o USA.")
        return v

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Debe especificar al menos una categoría.")
        invalid = [c for c in v if c not in VALID_CATEGORIES]
        if invalid:
            raise ValueError(
                f"Categorías no válidas: {invalid}. "
                f"Válidas: {VALID_CATEGORIES}"
            )
        return v

    @field_validator("monthly_rate")
    @classmethod
    def validate_monthly_rate(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("La tarifa mensual debe ser mayor que 0.")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(
                f"Estado no válido: {v}. Debe ser {VALID_STATUSES}."
            )
        return v

    @field_validator("contract_renewal_date")
    @classmethod
    def validate_renewal_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError(
                    "contract_renewal_date debe tener formato YYYY-MM-DD."
                )
        return v

    @model_validator(mode="after")
    def set_currency_from_country(self) -> "SupplierCreate":
        if self.country in COUNTRY_CURRENCY_MAP:
            expected = COUNTRY_CURRENCY_MAP[self.country]
            if self.currency != expected:
                self.currency = expected
        return self


class SupplierUpdate(BaseModel):
    """Model for partial updates. Only editable fields are included."""

    pass  # No generic update endpoint; specialised PATCH endpoints per field.


class RateUpdate(BaseModel):
    """Body model for PATCH /suppliers/{id}/rate."""

    monthly_rate: float = Field(..., gt=0, description="Nuevo coste mensual > 0")


class StatusUpdate(BaseModel):
    """Body model for PATCH /suppliers/{id}/status."""

    status: str = Field(..., description="active o suspended")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(
                f"Estado no válido: {v}. Debe ser {VALID_STATUSES}."
            )
        return v


class SupplierResponse(BaseModel):
    """Model returned to the client — includes the TinyDB-assigned id."""

    id: int = Field(..., description="ID asignado por TinyDB")
    name: str
    country: str
    categories: list[str]
    monthly_rate: float
    currency: str
    updated_at: str
    status: str
    contract_renewal_date: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None