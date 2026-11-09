"""Repeatable Hito 6 checks; unittest works without pytest/TestClient dependencies."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import unittest
from uuid import uuid4
from unittest.mock import patch

from sqlmodel import Session, SQLModel, create_engine

from reporting.pipeline import aggregate, validate_week
from cache import TTLCache
from telemetry.router import get_report
from telemetry.analysis import EVENT_TYPES, technical_report
from telemetry.models import TelemetryEvent


def event(kind: str, **properties) -> TelemetryEvent:
    return TelemetryEvent(
        event_type=kind, source_id=str(uuid4()),
        occurred_at=datetime(2026, 10, 26, tzinfo=timezone.utc),
        actor_id="fictional-test-actor",
        properties={
            "office": "valencia", "product_id": 1, "product_category": "training_kit",
            "programme_id": "leadership", "quantity": "5", "currency": "EUR",
            **properties,
        },
    )


class Hito6ReportTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_empty_technical_report_includes_all_five_types(self):
        report = technical_report(self.session)
        self.assertEqual(report.total_events, 0)
        self.assertEqual([e.event_type for e in report.event_counts], list(EVENT_TYPES))
        self.assertTrue(all(e.count == 0 for e in report.event_counts))
        self.assertIsNone(report.first_event_at)

    def test_technical_report_counts_unknown_types_without_exposing_payloads(self):
        self.session.add(event("inbound_order_created", total_cost="37.50"))
        self.session.add(event("direct_stock_edit_rejected"))
        self.session.add(event("unknown_test_event", secret_test_field="not-returned"))
        self.session.commit()
        report = technical_report(self.session)
        self.assertEqual(report.total_events, 3)
        self.assertEqual(report.unknown_event_count, 1)
        self.assertNotIn("not-returned", report.model_dump_json())
        self.assertNotIn("fictional-test-actor", report.model_dump_json())

    def test_technical_report_utc_window_is_half_open_and_read_only(self):
        start = datetime(2026, 10, 26, tzinfo=timezone.utc)
        end = start + timedelta(days=7)
        first = event("outbound_order_created")
        second = event("outbound_order_created")
        second.occurred_at = end
        self.session.add_all([first, second])
        self.session.commit()
        report = technical_report(self.session, start, end)
        self.assertEqual(report.total_events, 1)
        self.assertFalse(self.session.dirty)
        self.assertFalse(self.session.deleted)
        self.assertEqual(technical_report(self.session).total_events, 2)
        with self.assertRaises(ValueError):
            technical_report(self.session, end, start)
        with self.assertRaises(ValueError):
            technical_report(self.session, start.replace(tzinfo=None), end)

    def test_report_cache_hit_and_telemetry_write_invalidation(self):
        from cache import TELEMETRY_REPORT_PREFIX, report_cache

        report_cache.clear()
        manager = {"role": "manager"}
        start = datetime(2026, 10, 26, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        with patch("telemetry.router.technical_report", wraps=technical_report) as source:
            first = get_report(start=start, end=end, session=self.session, user=manager)
            second = get_report(start=start, end=end, session=self.session, user=manager)
            self.assertEqual(first, second)
            self.assertEqual(source.call_count, 1)

            report_cache.invalidate(TELEMETRY_REPORT_PREFIX)
            get_report(start=start, end=end, session=self.session, user=manager)
            self.assertEqual(source.call_count, 2)

    def test_telemetry_report_cache_normalizes_equivalent_utc_offsets(self):
        from datetime import timedelta as td
        from cache import report_cache

        report_cache.clear()
        manager = {"role": "admin"}
        start_utc = datetime(2026, 10, 26, tzinfo=timezone.utc)
        end_utc = start_utc + timedelta(days=1)
        offset = timezone(td(hours=2))
        with patch("telemetry.router.technical_report", wraps=technical_report) as source:
            get_report(start=start_utc, end=end_utc, session=self.session, user=manager)
            get_report(
                start=start_utc.astimezone(offset), end=end_utc.astimezone(offset),
                session=self.session, user=manager,
            )
            self.assertEqual(source.call_count, 1)

    def test_telemetry_authz_happens_before_cache_lookup(self):
        from fastapi import HTTPException
        from cache import report_cache

        report_cache.clear()
        with patch("telemetry.router.technical_report") as source:
            with self.assertRaises(HTTPException) as error:
                get_report(session=self.session, user={"role": "user"})
            self.assertEqual(error.exception.status_code, 403)
            source.assert_not_called()

    def test_telemetry_range_keys_are_distinct_and_cache_failures_fall_back(self):
        from cache import report_cache

        report_cache.clear()
        manager = {"role": "manager"}
        start = datetime(2026, 10, 26, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        with patch("telemetry.router.technical_report", wraps=technical_report) as source:
            get_report(start=start, end=end, session=self.session, user=manager)
            get_report(start=start + timedelta(days=1), end=end + timedelta(days=1), session=self.session, user=manager)
            self.assertEqual(source.call_count, 2)

        report_cache.clear()
        with patch("telemetry.router.report_cache.get", side_effect=RuntimeError("cache unavailable")), patch(
            "telemetry.router.report_cache.set", side_effect=RuntimeError("cache unavailable")
        ), patch("telemetry.router.report_cache.set_if_revision", side_effect=RuntimeError("cache unavailable")), patch(
            "telemetry.router.technical_report", wraps=technical_report
        ) as source:
            result = get_report(start=start, end=end, session=self.session, user=manager)
            self.assertEqual(result.total_events, 0)
            source.assert_called_once()

    def test_ttl_cache_expires_bounds_and_copies_values(self):
        cache = TTLCache(max_entries=1)
        value = {"nested": [1]}
        cache.set("one", value, 60)
        value["nested"].append(2)
        cached = cache.get("one")
        self.assertEqual(cached, {"nested": [1]})
        cached["nested"].append(3)
        self.assertEqual(cache.get("one"), {"nested": [1]})
        cache.set("two", {"ok": True}, 60)
        self.assertIsNone(cache.get("one"))
        cache.set("expired", 1, 0)
        self.assertIsNone(cache.get("expired"))

    def test_ttl_cache_expiration_and_revision_race(self):
        cache = TTLCache(max_entries=2)
        with patch("cache.monotonic", side_effect=[10.0, 12.0]):
            cache.set("expires", "value", 1)
            self.assertIsNone(cache.get("expires"))
        generation = cache.revision("report")
        cache.invalidate("report:")
        cache.set_if_revision("report:key", "stale", 30, "report", generation)
        self.assertIsNone(cache.get("report:key"))

    def test_weekly_cache_avoids_database_work_after_successful_fill(self):
        from cache import WEEKLY_REPORT_PREFIX, report_cache
        from reporting.router import weekly_report

        report_cache.clear()
        week = date(2026, 10, 26)
        key = f"{WEEKLY_REPORT_PREFIX}{week.isoformat()}"
        body = '{"week_start":"2026-10-26","entries":[]}'
        report_cache.set(key, body, 300)
        with patch("reporting.router.validate_week") as validate, patch.object(
            self.session, "scalar", side_effect=AssertionError("database lookup on cache hit")
        ):
            response = weekly_report(week_start=week, session=self.session)
        self.assertEqual(response.body.decode(), body)
        validate.assert_called_once_with(week)

    def test_weekly_cost_is_decimal_and_delivery_counts_events_not_quantity(self):
        rows = aggregate([
            event("inbound_order_created", total_cost="37.50"),
            event("outbound_order_created", quantity="5"),
            event("inbound_order_created", office="miami", currency="USD", total_cost="12.25"),
        ])
        self.assertEqual(len(rows), 2)
        valencia = next(row for row in rows if row["office"] == "valencia")
        self.assertEqual(valencia["total_material_cost"], Decimal("37.50"))
        self.assertEqual(valencia["kits_delivered_count"], 1)

    def test_business_cost_kpi_excludes_historical_price_decreases(self):
        rows = aggregate([
            event("outbound_order_created"),
            event("kit_cost_variance_detected", previous_unit_cost="100", unit_cost="80"),
            event("kit_cost_variance_detected", previous_unit_cost="100", unit_cost="120"),
        ])
        self.assertEqual(rows[0]["cost_variance_events_count"], 1)
        decreases_only = aggregate([
            event("kit_cost_variance_detected", previous_unit_cost="100", unit_cost="80")
        ])
        self.assertEqual(len(decreases_only), 1)
        self.assertEqual(decreases_only[0]["cost_variance_events_count"], 0)

    def test_invalid_cost_currency_and_iso_week_are_rejected(self):
        with self.assertRaises(ValueError):
            aggregate([event("inbound_order_created", currency="USD", total_cost="10")])
        with self.assertRaises(ValueError):
            aggregate([event("kit_cost_variance_detected", previous_unit_cost="0", unit_cost="10")])
        validate_week(date(2026, 12, 28))
        with self.assertRaises(ValueError):
            validate_week(date(2026, 12, 29))


if __name__ == "__main__":
    unittest.main()
