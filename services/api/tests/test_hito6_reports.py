"""Repeatable Hito 6 checks; unittest works without pytest/TestClient dependencies."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import unittest
from uuid import uuid4

from sqlmodel import Session, SQLModel, create_engine

from reporting.pipeline import aggregate, validate_week
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
