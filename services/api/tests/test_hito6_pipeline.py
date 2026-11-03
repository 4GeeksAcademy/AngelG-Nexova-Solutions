"""Isolated checks for weekly reporting snapshot replacement."""

from datetime import date, datetime, timezone
from decimal import Decimal
import unittest
from uuid import uuid4

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from reporting.models import Base, WeeklyPerformance
from reporting.pipeline import replace_weekly_performance


class WeeklySnapshotReplacementTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        self.sqlite_engine = self.engine.execution_options(
            schema_translate_map={"reporting": None}
        )
        Base.metadata.create_all(self.sqlite_engine)
        self.session = Session(self.sqlite_engine)
        self.week = date(2026, 10, 26)
        self.other_week = date(2026, 11, 2)
        self.computed_at = datetime(2026, 11, 3, tzinfo=timezone.utc)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def row(self, week: date, programme: str, cost: str) -> WeeklyPerformance:
        return WeeklyPerformance(
            id=uuid4(),
            office="valencia",
            programme_id=programme,
            week_start=week,
            total_material_cost=Decimal(cost),
            kits_delivered_count=1,
            shortage_events_count=0,
            cost_variance_events_count=0,
            currency="EUR",
            computed_at=self.computed_at,
        )

    def test_recalculation_removes_stale_groups_only_for_requested_week(self):
        self.session.add_all([
            self.row(self.week, "stale-programme", "10.00"),
            self.row(self.week, "retained-programme", "20.00"),
            self.row(self.other_week, "other-week-programme", "30.00"),
        ])
        self.session.commit()

        replace_weekly_performance(
            self.session,
            [{
                "office": "valencia",
                "programme_id": "retained-programme",
                "currency": "EUR",
                "total_material_cost": Decimal("25.00"),
                "kits_delivered_count": 2,
                "shortage_events_count": 0,
                "cost_variance_events_count": 0,
            }],
            self.week,
            self.computed_at,
        )
        self.session.commit()

        rows = self.session.scalars(
            select(WeeklyPerformance).order_by(
                WeeklyPerformance.week_start, WeeklyPerformance.programme_id
            )
        ).all()
        self.assertEqual(
            [(row.week_start, row.programme_id) for row in rows],
            [(self.week, "retained-programme"), (self.other_week, "other-week-programme")],
        )
        self.assertEqual(rows[0].total_material_cost, Decimal("25.00"))
        self.assertEqual(rows[1].total_material_cost, Decimal("30.00"))

    def test_empty_recalculation_clears_requested_week(self):
        self.session.add(self.row(self.week, "now-empty", "10.00"))
        self.session.add(self.row(self.other_week, "untouched", "30.00"))
        self.session.commit()

        replace_weekly_performance(self.session, [], self.week, self.computed_at)
        self.session.commit()

        rows = self.session.scalars(select(WeeklyPerformance)).all()
        self.assertEqual([(row.week_start, row.programme_id) for row in rows], [
            (self.other_week, "untouched")
        ])

    def test_rollback_preserves_previous_snapshot(self):
        original = self.row(self.week, "published", "10.00")
        self.session.add(original)
        self.session.commit()

        replace_weekly_performance(
            self.session,
            [{
                "office": "valencia",
                "programme_id": "replacement",
                "currency": "EUR",
                "total_material_cost": Decimal("25.00"),
                "kits_delivered_count": 2,
                "shortage_events_count": 0,
                "cost_variance_events_count": 0,
            }],
            self.week,
            self.computed_at,
        )
        self.session.rollback()

        rows = self.session.scalars(select(WeeklyPerformance)).all()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].programme_id, "published")
        self.assertEqual(rows[0].total_material_cost, Decimal("10.00"))


if __name__ == "__main__":
    unittest.main()