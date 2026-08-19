"""
test_models.py — Tests for Pydantic models and validators.

Covers:
    - SupplierDict valid creation
    - SupplierCreate valid creation
    - Missing required fields
    - Invalid status
    - Invalid category
    - Invalid country
    - Zero / negative monthly_rate
    - Wrong types for fields
    - Currency auto-set from country
    - contract_renewal_date format validation
    - RateUpdate validation
    - StatusUpdate validation
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from services.api.models import (
    SupplierDict,
    SupplierCreate,
    RateUpdate,
    StatusUpdate,
    SupplierResponse,
    VALID_CATEGORIES,
    VALID_STATUSES,
    COUNTRY_CURRENCY_MAP,
)


# ── SupplierDict ──────────────────────────────────────────────────────────

class TestSupplierDictValid:
    """Valid SupplierDict creation scenarios."""

    def test_minimal_valid_spain(self):
        """Minimal valid supplier in Spain."""
        s = SupplierDict(
            name="Test Supplier",
            country="Spain",
            categories=["job_boards"],
            monthly_rate=100.0,
            currency="EUR",
        )
        assert s.name == "Test Supplier"
        assert s.country == "Spain"
        assert s.categories == ["job_boards"]
        assert s.monthly_rate == 100.0
        assert s.currency == "EUR"
        assert s.status == "active"
        assert s.updated_at is not None

    def test_minimal_valid_usa(self):
        """Minimal valid supplier in USA."""
        s = SupplierDict(
            name="US Supplier",
            country="USA",
            categories=["ats_software"],
            monthly_rate=500.0,
            currency="USD",
        )
        assert s.country == "USA"
        assert s.currency == "USD"

    def test_all_fields_provided(self):
        """Supplier with all optional fields filled."""
        s = SupplierDict(
            name="Full Supplier",
            country="Spain",
            categories=["assessment_tools", "training_platforms"],
            monthly_rate=999.99,
            currency="EUR",
            status="active",
            contract_renewal_date="2026-06-15",
            contact_email="admin@supplier.com",
            notes="All fields test.",
        )
        assert s.contract_renewal_date == "2026-06-15"
        assert s.contact_email == "admin@supplier.com"
        assert s.notes == "All fields test."

    def test_currency_auto_set_from_country_spain(self):
        """Currency auto-set to EUR when country is Spain."""
        s = SupplierDict(
            name="Auto EUR",
            country="Spain",
            categories=["job_boards"],
            monthly_rate=100.0,
            currency="USD",  # Wrong — should be overridden to EUR
        )
        assert s.currency == "EUR"

    def test_currency_auto_set_from_country_usa(self):
        """Currency auto-set to USD when country is USA."""
        s = SupplierDict(
            name="Auto USD",
            country="USA",
            categories=["job_boards"],
            monthly_rate=100.0,
            currency="EUR",  # Wrong — should be overridden to USD
        )
        assert s.currency == "USD"

    def test_updated_at_auto_generated(self):
        """updated_at is auto-generated on creation."""
        s = SupplierDict(
            name="Time Test",
            country="Spain",
            categories=["job_boards"],
            monthly_rate=100.0,
            currency="EUR",
        )
        assert s.updated_at is not None
        assert "T" in s.updated_at  # ISO format contains T


class TestSupplierDictInvalid:
    """Invalid SupplierDict creation scenarios."""

    def test_missing_name(self):
        """Name is required."""
        with pytest.raises(ValidationError):
            SupplierDict(
                country="Spain",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
            )

    def test_empty_name(self):
        """Name must not be empty."""
        with pytest.raises(ValidationError):
            SupplierDict(
                name="",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
            )

    def test_invalid_country(self):
        """Country must be Spain or USA."""
        with pytest.raises(ValidationError) as exc:
            SupplierDict(
                name="Bad Country",
                country="France",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
            )
        assert "País no válido" in str(exc.value)

    def test_missing_country(self):
        """Country is required."""
        with pytest.raises(ValidationError):
            SupplierDict(
                name="No Country",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
            )

    def test_invalid_category(self):
        """Category must be from VALID_CATEGORIES."""
        with pytest.raises(ValidationError) as exc:
            SupplierDict(
                name="Bad Category",
                country="Spain",
                categories=["invalid_category_xyz"],
                monthly_rate=100.0,
                currency="EUR",
            )
        assert "Categorías no válidas" in str(exc.value)

    def test_mixed_valid_and_invalid_categories(self):
        """Mixed valid/invalid categories should still fail."""
        with pytest.raises(ValidationError) as exc:
            SupplierDict(
                name="Mixed Cats",
                country="Spain",
                categories=["job_boards", "nonexistent_cat"],
                monthly_rate=100.0,
                currency="EUR",
            )
        assert "Categorías no válidas" in str(exc.value)

    def test_empty_categories(self):
        """At least one category is required."""
        with pytest.raises(ValidationError):
            SupplierDict(
                name="No Cats",
                country="Spain",
                categories=[],
                monthly_rate=100.0,
                currency="EUR",
            )

    def test_zero_rate(self):
        """Monthly rate must be > 0."""
        with pytest.raises(ValidationError):
            SupplierDict(
                name="Zero Rate",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=0,
                currency="EUR",
            )

    def test_negative_rate(self):
        """Monthly rate must be > 0."""
        with pytest.raises(ValidationError):
            SupplierDict(
                name="Negative Rate",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=-100.0,
                currency="EUR",
            )

    def test_invalid_status(self):
        """Status must be active or suspended."""
        with pytest.raises(ValidationError) as exc:
            SupplierDict(
                name="Bad Status",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
                status="terminated",
            )
        assert "Estado no válido" in str(exc.value)

    def test_invalid_renewal_date_format(self):
        """contract_renewal_date must be YYYY-MM-DD."""
        with pytest.raises(ValidationError) as exc:
            SupplierDict(
                name="Bad Date",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
                contract_renewal_date="31-12-2025",
            )
        assert "YYYY-MM-DD" in str(exc.value)

    def test_invalid_renewal_date_not_a_date(self):
        """contract_renewal_date must be a valid date string."""
        with pytest.raises(ValidationError) as exc:
            SupplierDict(
                name="Bad Date",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
                contract_renewal_date="not-a-date",
            )
        assert "YYYY-MM-DD" in str(exc.value)

    def test_wrong_name_type(self):
        """Name must be a string."""
        with pytest.raises(ValidationError):
            SupplierDict(
                name=123,
                country="Spain",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
            )

    def test_wrong_rate_type(self):
        """Rate must be a number."""
        with pytest.raises(ValidationError):
            SupplierDict(
                name="Test",
                country="Spain",
                categories=["job_boards"],
                monthly_rate="free",
                currency="EUR",
            )


# ── SupplierCreate ────────────────────────────────────────────────────────

class TestSupplierCreateValid:
    """Valid SupplierCreate scenarios."""

    def test_valid_spain(self):
        """Valid creation payload for Spain."""
        s = SupplierCreate(
            name="New Supplier",
            country="Spain",
            categories=["payroll_and_hr_software"],
            monthly_rate=250.0,
            currency="EUR",
        )
        assert s.name == "New Supplier"

    def test_valid_usa_with_currency_override(self):
        """Currency auto-corrected from country."""
        s = SupplierCreate(
            name="US Supplier",
            country="USA",
            categories=["video_interview"],
            monthly_rate=300.0,
            currency="EUR",  # wrong — should become USD
        )
        assert s.currency == "USD"


class TestSupplierCreateInvalid:
    """Invalid SupplierCreate scenarios."""

    def test_missing_required_fields(self):
        """Missing all required fields."""
        with pytest.raises(ValidationError):
            SupplierCreate()

    def test_missing_monthly_rate(self):
        """monthly_rate is required."""
        with pytest.raises(ValidationError):
            SupplierCreate(
                name="Test",
                country="Spain",
                categories=["job_boards"],
                currency="EUR",
            )

    def test_missing_categories(self):
        """categories is required."""
        with pytest.raises(ValidationError):
            SupplierCreate(
                name="Test",
                country="Spain",
                monthly_rate=100.0,
                currency="EUR",
            )

    def test_empty_categories(self):
        """categories must not be empty."""
        with pytest.raises(ValidationError):
            SupplierCreate(
                name="Test",
                country="Spain",
                categories=[],
                monthly_rate=100.0,
                currency="EUR",
            )

    def test_invalid_category(self):
        """Category must be valid."""
        with pytest.raises(ValidationError):
            SupplierCreate(
                name="Test",
                country="Spain",
                categories=["bogus_category"],
                monthly_rate=100.0,
                currency="EUR",
            )

    def test_zero_rate(self):
        """Rate must be > 0."""
        with pytest.raises(ValidationError):
            SupplierCreate(
                name="Test",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=0,
                currency="EUR",
            )

    def test_negative_rate(self):
        """Rate must be > 0."""
        with pytest.raises(ValidationError):
            SupplierCreate(
                name="Test",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=-50.0,
                currency="EUR",
            )

    def test_invalid_status(self):
        """Status must be active or suspended."""
        with pytest.raises(ValidationError):
            SupplierCreate(
                name="Test",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
                status="invalid",
            )

    def test_invalid_renewal_date_format(self):
        """Date must be YYYY-MM-DD."""
        with pytest.raises(ValidationError):
            SupplierCreate(
                name="Test",
                country="Spain",
                categories=["job_boards"],
                monthly_rate=100.0,
                currency="EUR",
                contract_renewal_date="01/01/2025",
            )


# ── RateUpdate ────────────────────────────────────────────────────────────

class TestRateUpdate:
    """RateUpdate model tests."""

    def test_valid_rate(self):
        """Valid rate."""
        r = RateUpdate(monthly_rate=150.0)
        assert r.monthly_rate == 150.0

    def test_zero_rate(self):
        """Rate must be > 0."""
        with pytest.raises(ValidationError):
            RateUpdate(monthly_rate=0)

    def test_negative_rate(self):
        """Rate must be > 0."""
        with pytest.raises(ValidationError):
            RateUpdate(monthly_rate=-10.0)


# ── StatusUpdate ──────────────────────────────────────────────────────────

class TestStatusUpdate:
    """StatusUpdate model tests."""

    def test_valid_active(self):
        """Valid active status."""
        s = StatusUpdate(status="active")
        assert s.status == "active"

    def test_valid_suspended(self):
        """Valid suspended status."""
        s = StatusUpdate(status="suspended")
        assert s.status == "suspended"

    def test_invalid_status(self):
        """Invalid status raises error."""
        with pytest.raises(ValidationError) as exc:
            StatusUpdate(status="terminated")
        assert "Estado no válido" in str(exc.value)


# ── SupplierResponse ──────────────────────────────────────────────────────

class TestSupplierResponse:
    """SupplierResponse model tests."""

    def test_valid_response(self):
        """Valid response with all fields."""
        r = SupplierResponse(
            id=1,
            name="Test",
            country="Spain",
            categories=["job_boards"],
            monthly_rate=100.0,
            currency="EUR",
            updated_at="2025-01-01T00:00:00",
            status="active",
        )
        assert r.id == 1
        assert r.name == "Test"

    def test_response_with_optional_fields(self):
        """Response with all optional fields."""
        r = SupplierResponse(
            id=42,
            name="Full",
            country="USA",
            categories=["background_check"],
            monthly_rate=195.0,
            currency="USD",
            updated_at="2025-06-15T12:30:00+00:00",
            status="suspended",
            contract_renewal_date="2026-01-01",
            contact_email="bob@example.com",
            notes="Some notes.",
        )
        assert r.contact_email == "bob@example.com"
        assert r.notes == "Some notes."