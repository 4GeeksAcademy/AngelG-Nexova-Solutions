from datetime import date
from pathlib import Path
import sys
import unittest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import numpy as np

from scripts.forecast_sales import (
    DEFAULT_DATASET,
    _business_line_mix_psi,
    _synthetic_business_line_revenue,
    calculate_metrics,
    chronological_split,
    load_sales,
    make_features,
)


class SalesForecastSplitTests(unittest.TestCase):
    def test_split_reserves_latest_two_years_without_overlap(self) -> None:
        rows = load_sales(DEFAULT_DATASET)
        train, test = chronological_split(rows)

        self.assertEqual(len(rows), 120)
        self.assertEqual(len(train), 96)
        self.assertEqual(len(test), 24)
        self.assertEqual(train[0].month, date(2016, 1, 1))
        self.assertEqual(train[-1].month, date(2023, 12, 1))
        self.assertEqual(test[0].month, date(2024, 1, 1))
        self.assertEqual(test[-1].month, date(2025, 12, 1))
        self.assertLess(train[-1].month, test[0].month)
        self.assertTrue({row.month for row in train}.isdisjoint(row.month for row in test))

    def test_test_features_use_only_history_before_target_month(self) -> None:
        rows = load_sales(DEFAULT_DATASET)
        history = rows[:96]
        target = date(2024, 1, 1)

        features = make_features(history, target)

        self.assertEqual(features["lag_1_revenue"], history[-1].revenue_usd)
        self.assertEqual(features["lag_12_revenue"], history[-12].revenue_usd)
        self.assertEqual(len(history), 96)


class SalesForecastSyntheticMetricTests(unittest.TestCase):
    def test_synthetic_lines_reconcile_and_mix_psi_is_positive(self) -> None:
        rows = load_sales(DEFAULT_DATASET)
        split = 96
        allocated = _synthetic_business_line_revenue(rows)

        self.assertEqual(len(allocated), len(rows) * 3)
        totals_by_month: dict[date, float] = {}
        for month, _, value in allocated:
            totals_by_month[month] = totals_by_month.get(month, 0.0) + value
        for row in rows:
            self.assertAlmostEqual(totals_by_month[row.month], row.revenue_usd, places=2)

        train_months = {row.month for row in rows[:split]}
        reference = [item for item in allocated if item[0] in train_months]
        current = [item for item in allocated if item[0] not in train_months]
        total_psi, contributions = _business_line_mix_psi(reference, current)
        self.assertGreater(total_psi, 0.0)
        self.assertAlmostEqual(total_psi, sum(contributions.values()))
        self.assertEqual(set(contributions), {"outsourcing", "headhunting", "training"})

    def test_holdout_discrimination_reports_unavailable_without_two_classes(self) -> None:
        rows = load_sales(DEFAULT_DATASET)
        train, test = chronological_split(rows)
        actual = np.asarray([row.revenue_usd for row in test])
        metrics = calculate_metrics(train, test, actual)

        self.assertIsNone(metrics.gini_anomaly_discrimination_test)
        self.assertIsNone(metrics.k2_ks_anomaly_discrimination_test)
        self.assertEqual(metrics.anomaly_months_in_test, 0)
        self.assertIsNotNone(metrics.test_discrimination_unavailable_reason)
        self.assertGreaterEqual(metrics.gini_synthetic_anomaly_benchmark, -1.0)
        self.assertLessEqual(metrics.gini_synthetic_anomaly_benchmark, 1.0)
        self.assertGreaterEqual(metrics.k2_ks_synthetic_anomaly_benchmark, 0.0)
        self.assertLessEqual(metrics.k2_ks_synthetic_anomaly_benchmark, 1.0)
        self.assertEqual(metrics.synthetic_anomaly_months, 6)

    def test_holdout_metrics_use_forecasts_to_rank_shocks(self) -> None:
        rows = load_sales(DEFAULT_DATASET)
        train, test = chronological_split(rows)
        actual = np.asarray([row.revenue_usd for row in test])
        metrics = calculate_metrics(train, test, actual)

        self.assertLess(metrics.gini_synthetic_anomaly_benchmark, 1.0)
        self.assertLess(metrics.k2_ks_synthetic_anomaly_benchmark, 1.0)

    def test_business_line_psi_is_zero_for_identical_mix(self) -> None:
        reference = [
            (date(2020, month, 1), line, amount)
            for month in (1, 2)
            for line, amount in (("outsourcing", 45.0), ("headhunting", 35.0), ("training", 20.0))
        ]
        current = [
            (date(2021, month, 1), line, amount)
            for month in (1, 2)
            for line, amount in (("outsourcing", 90.0), ("headhunting", 70.0), ("training", 40.0))
        ]

        total_psi, contributions = _business_line_mix_psi(reference, current)

        self.assertAlmostEqual(total_psi, 0.0)
        self.assertTrue(all(value == 0.0 for value in contributions.values()))


if __name__ == "__main__":
    unittest.main()
