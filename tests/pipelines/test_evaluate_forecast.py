from __future__ import annotations

from pathlib import Path
import sys
import unittest

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.evaluate_forecast import (
    build_causal_features,
    evaluate_cross_validation,
    validate_temporal_folds,
)
from scripts.forecast_sales import DEFAULT_DATASET, load_sales


class TemporalCrossValidationTests(unittest.TestCase):
    def test_time_series_folds_preserve_chronological_order(self) -> None:
        rows = load_sales(DEFAULT_DATASET)[:96]
        _, folds = evaluate_cross_validation(rows, n_splits=5)

        self.assertEqual(len(folds), 5)
        previous_validation_end = -1
        for train_indices, validation_indices in folds:
            self.assertTrue(np.all(np.diff(train_indices) > 0))
            self.assertTrue(np.all(np.diff(validation_indices) > 0))
            self.assertLess(train_indices[-1], validation_indices[0])
            self.assertGreater(validation_indices[0], previous_validation_end)
            self.assertLess(rows[int(train_indices[-1])].month, rows[int(validation_indices[0])].month)
            previous_validation_end = int(validation_indices[-1])

    def test_validator_rejects_shuffled_or_temporally_mixed_folds(self) -> None:
        with self.assertRaises(ValueError):
            validate_temporal_folds(
                [(np.asarray([0, 2, 1]), np.asarray([3, 4]))], sample_count=5
            )
        with self.assertRaises(ValueError):
            validate_temporal_folds(
                [(np.asarray([0, 3]), np.asarray([2, 4]))], sample_count=5
            )

    def test_lag_and_rolling_features_use_only_preceding_observations(self) -> None:
        rows = load_sales(DEFAULT_DATASET)[:24]
        target_indices = [12, 13]

        features = build_causal_features(rows, target_indices)

        self.assertEqual(features[0, 3], rows[11].revenue_usd)  # lag 1 at 2017-01
        self.assertEqual(features[0, 5], rows[0].revenue_usd)  # lag 12 at 2017-01
        self.assertAlmostEqual(
            features[0, 7], np.mean([row.revenue_usd for row in rows[:12]])
        )
        self.assertEqual(features[1, 3], rows[12].revenue_usd)  # prior validation month is observed
        self.assertLess(rows[12].month, rows[13].month)

    def test_target_and_future_revenue_cannot_change_its_features(self) -> None:
        rows = load_sales(DEFAULT_DATASET)[:24]
        target_index = 12
        original = build_causal_features(rows, [target_index])
        mutated = list(rows)
        for index in range(target_index, len(mutated)):
            row = mutated[index]
            mutated[index] = row.__class__(
                month=row.month,
                revenue_usd=row.revenue_usd * 10,
                active_contracts=row.active_contracts,
                avg_contract_value_usd=row.avg_contract_value_usd,
                business_line=row.business_line,
            )

        after_mutation = build_causal_features(mutated, [target_index])

        np.testing.assert_array_equal(original, after_mutation)

if __name__ == "__main__":
    unittest.main()
