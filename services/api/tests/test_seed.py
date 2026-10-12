"""
test_seed.py — Tests for the seeder module.

Covers:
    - Initial insertion creates all 15 suppliers
    - Repeated execution is idempotent (no duplicates)
    - Seed data validates against SupplierDict
    - All seed entries have valid categories
    - All seed entries have valid countries
    - All seed entries have valid statuses
    - All seed entries have correct currency for their country
"""

from __future__ import annotations

import pytest
from tinydb import TinyDB

from services.api.models import (
    SupplierDict,
    VALID_CATEGORIES,
    VALID_COUNTRIES,
    VALID_STATUSES,
    COUNTRY_CURRENCY_MAP,
)
from services.api.seed import SUPPLIERS_SEED, main


class TestSeedData:
    """Tests for the seed data constants."""

    def test_seed_has_15_suppliers(self):
        """There are exactly 15 suppliers in the seed data."""
        assert len(SUPPLIERS_SEED) == 15

    def test_all_seed_entries_valid_against_supplier_dict(self):
        """Every seed entry passes SupplierDict validation."""
        for item in SUPPLIERS_SEED:
            s = SupplierDict(**item)
            assert s.name is not None
            assert s.country in VALID_COUNTRIES
            assert all(c in VALID_CATEGORIES for c in s.categories)
            assert s.monthly_rate > 0
            assert s.currency == COUNTRY_CURRENCY_MAP[s.country]
            assert s.status in VALID_STATUSES

    def test_all_seed_entries_have_valid_categories(self):
        """All seed categories are in the valid list."""
        for item in SUPPLIERS_SEED:
            for cat in item["categories"]:
                assert cat in VALID_CATEGORIES, (
                    f"Invalid category '{cat}' in {item['name']}"
                )

    def test_all_seed_entries_have_valid_countries(self):
        """All seed countries are Spain or USA."""
        for item in SUPPLIERS_SEED:
            assert item["country"] in VALID_COUNTRIES, (
                f"Invalid country '{item['country']}' in {item['name']}"
            )

    def test_all_seed_entries_have_valid_statuses(self):
        """All seed statuses are active or suspended."""
        for item in SUPPLIERS_SEED:
            assert item["status"] in VALID_STATUSES, (
                f"Invalid status '{item['status']}' in {item['name']}"
            )

    def test_all_seed_entries_have_correct_currency(self):
        """Currency matches country for all seed entries."""
        for item in SUPPLIERS_SEED:
            expected = COUNTRY_CURRENCY_MAP[item["country"]]
            assert item["currency"] == expected, (
                f"{item['name']}: expected {expected}, got {item['currency']}"
            )

    def test_seed_names_are_unique(self):
        """All seed supplier names are unique."""
        names = [item["name"] for item in SUPPLIERS_SEED]
        assert len(names) == len(set(names)), "Duplicate supplier names found!"

    def test_seed_entries_have_positive_rates(self):
        """All seed monthly rates are > 0."""
        for item in SUPPLIERS_SEED:
            assert item["monthly_rate"] > 0, (
                f"{item['name']} has non-positive rate: {item['monthly_rate']}"
            )


class TestSeedExecution:
    """Tests for the seed execution (main function)."""

    def test_seed_inserts_all_suppliers(self, _temp_db: TinyDB):
        """Running main() inserts all 15 suppliers."""
        main()
        table = _temp_db.table("suppliers")
        assert len(table.all()) == 15

    def test_seed_is_idempotent(self, _temp_db: TinyDB):
        """Running main() twice does not create duplicates."""
        main()
        main()
        table = _temp_db.table("suppliers")
        assert len(table.all()) == 15

    def test_seed_inserted_suppliers_have_expected_data(self, _temp_db: TinyDB):
        """After seeding, suppliers have the expected fields."""
        main()
        table = _temp_db.table("suppliers")
        linkedin = table.get(doc_id=1)
        assert linkedin is not None
        assert linkedin["name"] == "LinkedIn Talent Solutions"
        assert linkedin["country"] == "Spain"
        assert linkedin["monthly_rate"] == 1200.0
        assert linkedin["currency"] == "EUR"
        assert linkedin["status"] == "active"

    def test_seed_creates_15_individual_documents(self, _temp_db: TinyDB):
        """Each supplier is a separate document (15 distinct doc_ids)."""
        main()
        table = _temp_db.table("suppliers")
        doc_ids = [doc.doc_id for doc in table.all()]
        assert len(set(doc_ids)) == 15