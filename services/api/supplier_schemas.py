"""Supplier Directory contract from the Hito 09 brief."""

from datetime import date, datetime, timezone
from typing import Literal, get_args

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SupplierCategory = Literal[
    "job_boards", "ats_software", "assessment_tools", "training_platforms",
    "payroll_and_hr_software", "video_interview", "background_check",
    "office_and_facilities", "it_and_software_licenses",
]

# Shared directory contract values. Keep these derived from the literal types
# used by the request/response models so the exported constants cannot drift.
VALID_CATEGORIES = list(get_args(SupplierCategory))
VALID_STATUSES = ["active", "suspended"]
COUNTRY_CURRENCY_MAP = {"Spain": "EUR", "USA": "USD"}


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

    @field_validator("country", mode="before")
    @classmethod
    def validate_country(cls, value):
        if value not in COUNTRY_CURRENCY_MAP:
            raise ValueError("País no válido: debe ser Spain o USA.")
        return value

    @field_validator("categories", mode="before")
    @classmethod
    def validate_categories(cls, value):
        if not isinstance(value, list):
            return value
        invalid = [category for category in value if category not in VALID_CATEGORIES]
        if invalid:
            raise ValueError(f"Categorías no válidas: {invalid}.")
        return value

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, value):
        if value not in VALID_STATUSES:
            raise ValueError("Estado no válido: debe ser active o suspended.")
        return value

    @model_validator(mode="after")
    def validate_contract(self):
        if not self.name.strip():
            raise ValueError("El nombre del proveedor no puede estar vacío.")
        expected = COUNTRY_CURRENCY_MAP[self.country]
        if self.currency != expected:
            raise ValueError(f"La moneda para {self.country} debe ser {expected}.")
        return self


class SupplierDict(SupplierCreate):
    """Validated TinyDB supplier record, including its server timestamp."""

    # TinyDB stores contract dates as ISO strings, while the API request schema
    # uses ``date`` for parsing and OpenAPI accuracy.
    contract_renewal_date: str | None = None
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_storage_currency(cls, value):
        """Keep historical storage semantics without weakening API input."""
        if isinstance(value, dict):
            country = value.get("country")
            if country in COUNTRY_CURRENCY_MAP:
                value = {**value, "currency": COUNTRY_CURRENCY_MAP[country]}
        return value

    @field_validator("contract_renewal_date")
    @classmethod
    def validate_renewal_date(cls, value):
        if value is not None:
            try:
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError as error:
                raise ValueError(
                    "contract_renewal_date debe tener formato YYYY-MM-DD."
                ) from error
        return value


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

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, value):
        if value not in VALID_STATUSES:
            raise ValueError("Estado no válido: debe ser active o suspended.")
        return value
