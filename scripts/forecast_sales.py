"""Train and evaluate a Nexova revenue forecast on a temporal holdout.

The test period is evaluated as a rolling one-step-ahead forecast, with actual
revenue from earlier test months available when forecasting later months. The
model is never refit on the 2024-2025 holdout period.
"""

from __future__ import annotations

import argparse
import csv
import json
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Sequence

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, roc_auc_score
from sklearn.pipeline import make_pipeline

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = REPO_ROOT / "data/raw/nexova_sales.csv"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "data/processed/sales-forecasting"
EXPECTED_COLUMNS = (
    "month",
    "revenue_usd",
    "active_contracts",
    "avg_contract_value_usd",
    "business_line",
)
TEST_MONTHS = 24
RANDOM_STATE = 42


@dataclass(frozen=True)
class MonthlySales:
    month: date
    revenue_usd: float
    active_contracts: int
    avg_contract_value_usd: float
    business_line: str


@dataclass(frozen=True)
class ForecastMetrics:
    mse_usd_squared: float
    mse_normalized_percent_of_mean_squared: float
    mae_usd: float
    rmse_usd: float
    rmse_as_percent_of_mean_revenue: float
    r2: float
    psi_revenue_distribution: float
    psi_business_line_mix: float
    psi_business_line_mix_by_line: dict[str, float]
    gini_anomaly_discrimination_test: float | None
    k2_ks_anomaly_discrimination_test: float | None
    gini_synthetic_anomaly_benchmark: float
    k2_ks_synthetic_anomaly_benchmark: float
    synthetic_anomaly_months: int
    anomaly_definition: str
    test_discrimination_unavailable_reason: str | None
    anomaly_months_in_test: int


def load_sales(path: Path) -> list[MonthlySales]:
    """Load and validate the supplied consolidated monthly CSV."""
    if not path.is_file():
        raise FileNotFoundError(f"No se encontró el dataset de ventas: {path}")

    rows: list[MonthlySales] = []
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if tuple(reader.fieldnames or ()) != EXPECTED_COLUMNS:
            raise ValueError(
                "Columnas inesperadas. Se requieren exactamente: "
                + ", ".join(EXPECTED_COLUMNS)
            )
        for line_number, row in enumerate(reader, start=2):
            if any(row[column] is None or not row[column].strip() for column in EXPECTED_COLUMNS):
                raise ValueError(f"Hay un valor vacío en la fila {line_number}.")
            try:
                month = date.fromisoformat(row["month"])
                revenue = float(row["revenue_usd"])
                active_contracts = int(row["active_contracts"])
                average_contract_value = float(row["avg_contract_value_usd"])
            except (TypeError, ValueError) as error:
                raise ValueError(f"Datos inválidos en la fila {line_number}: {error}") from error

            if month.day != 1:
                raise ValueError(f"La fecha de la fila {line_number} no es el primer día del mes.")
            if not np.isfinite(revenue) or revenue <= 0:
                raise ValueError(f"revenue_usd debe ser positivo y finito (fila {line_number}).")
            if active_contracts < 0 or not np.isfinite(average_contract_value):
                raise ValueError(f"Features inválidas en la fila {line_number}.")
            if row["business_line"] != "consolidated":
                raise ValueError(
                    "El brief de Nexova especifica que este dataset contiene únicamente "
                    f"filas consolidated; se encontró {row['business_line']!r} en fila {line_number}."
                )
            rows.append(
                MonthlySales(
                    month=month,
                    revenue_usd=revenue,
                    active_contracts=active_contracts,
                    avg_contract_value_usd=average_contract_value,
                    business_line=row["business_line"],
                )
            )

    if len(rows) != 120:
        raise ValueError(f"Se esperaban 120 meses (2016-01 a 2025-12); se encontraron {len(rows)}.")
    if rows != sorted(rows, key=lambda record: record.month):
        raise ValueError("Las filas del dataset deben estar ordenadas cronológicamente.")
    if len({record.month for record in rows}) != len(rows):
        raise ValueError("El dataset contiene meses duplicados.")
    for previous, current in zip(rows, rows[1:]):
        expected_year = previous.month.year + int(previous.month.month == 12)
        expected_month = 1 if previous.month.month == 12 else previous.month.month + 1
        if (current.month.year, current.month.month) != (expected_year, expected_month):
            raise ValueError(f"Falta al menos un mes entre {previous.month} y {current.month}.")
    if rows[0].month != date(2016, 1, 1) or rows[-1].month != date(2025, 12, 1):
        raise ValueError("El rango de fechas debe ser 2016-01 a 2025-12.")
    return rows


def chronological_split(
    rows: Sequence[MonthlySales], test_months: int = TEST_MONTHS
) -> tuple[list[MonthlySales], list[MonthlySales]]:
    """Split a sorted monthly series into an initial train period and final holdout."""
    if test_months <= 0 or test_months >= len(rows):
        raise ValueError("test_months debe ser mayor que cero y menor al total de filas.")
    train, test = list(rows[:-test_months]), list(rows[-test_months:])
    if train[-1].month >= test[0].month or set(row.month for row in train) & set(
        row.month for row in test
    ):
        raise ValueError("El split temporal contiene solapamiento entre train y test.")
    return train, test


def make_features(history: Sequence[MonthlySales], target_month: date) -> dict[str, float]:
    """Build causal calendar and revenue-lag features using only prior months.

    Missing lags at the beginning of the series are represented as NaN and later
    imputed using medians fitted on the training period only.
    """
    prior = [row for row in history if row.month < target_month]
    if prior and prior[-1].month >= target_month:
        raise ValueError("El historial debe terminar antes del mes pronosticado.")
    prior_revenue = [row.revenue_usd for row in prior]
    month_number = target_month.month
    angle = 2 * np.pi * month_number / 12
    return {
        "year_index": float(target_month.year - 2016),
        "month_sin": float(np.sin(angle)),
        "month_cos": float(np.cos(angle)),
        "lag_1_revenue": prior_revenue[-1] if len(prior_revenue) >= 1 else float("nan"),
        "lag_2_revenue": prior_revenue[-2] if len(prior_revenue) >= 2 else float("nan"),
        "lag_12_revenue": prior_revenue[-12] if len(prior_revenue) >= 12 else float("nan"),
        "rolling_mean_3": float(np.mean(prior_revenue[-3:])) if prior_revenue else float("nan"),
        "rolling_mean_12": (
            float(np.mean(prior_revenue[-12:])) if len(prior_revenue) >= 12 else float("nan")
        ),
    }


def _population_stability_index(reference: np.ndarray, current: np.ndarray) -> float:
    """PSI comparing actual train/test revenue distributions using train deciles."""
    bins = np.unique(np.quantile(reference, np.linspace(0, 1, 11)))
    if len(bins) < 2:
        return 0.0
    bins[0] = -np.inf
    bins[-1] = np.inf
    reference_share = np.histogram(reference, bins=bins)[0] / len(reference)
    current_share = np.histogram(current, bins=bins)[0] / len(current)
    epsilon = 1e-6
    reference_share = np.clip(reference_share, epsilon, None)
    current_share = np.clip(current_share, epsilon, None)
    return float(np.sum((current_share - reference_share) * np.log(current_share / reference_share)))


def _synthetic_business_line_revenue(
    rows: Sequence[MonthlySales],
) -> list[tuple[date, str, float]]:
    """Create an explicitly fictional line split for this school exercise.

    The business brief only supplies consolidated revenue and approximate initial
    mix. This deterministic scenario starts at 45/35/20 and gradually shifts by
    2025 to 51/31/18 (outsourcing/headhunting/training). Generated line values
    always sum exactly to each consolidated monthly total and are not actual data.
    """
    baseline = {"outsourcing": 0.45, "headhunting": 0.35, "training": 0.20}
    end_change = {"outsourcing": 0.06, "headhunting": -0.04, "training": -0.02}
    synthetic: list[tuple[date, str, float]] = []
    for row in rows:
        months_since_start = (row.month.year - 2016) * 12 + row.month.month - 1
        progress = months_since_start / 119
        shares = {line: baseline[line] + end_change[line] * progress for line in baseline}
        line_values = {
            line: round(row.revenue_usd * share, 2) for line, share in shares.items()
        }
        # Assign any cent-rounding residual to the final line so the synthetic
        # allocation reconciles exactly to the supplied consolidated total.
        line_values["training"] = round(
            row.revenue_usd - line_values["outsourcing"] - line_values["headhunting"], 2
        )
        for line, value in line_values.items():
            synthetic.append((row.month, line, value))
    return synthetic


def _business_line_mix_psi(
    reference: Sequence[tuple[date, str, float]],
    current: Sequence[tuple[date, str, float]],
) -> tuple[float, dict[str, float]]:
    """Compute categorical PSI from generated line revenue shares."""
    if not reference or not current:
        raise ValueError("Se requieren datos de referencia y actuales para calcular PSI del mix.")
    lines = sorted({line for _, line, _ in reference} | {line for _, line, _ in current})
    reference_total = sum(value for _, _, value in reference)
    current_total = sum(value for _, _, value in current)
    epsilon = 1e-6
    contributions: dict[str, float] = {}
    for line in lines:
        reference_share = sum(value for _, category, value in reference if category == line) / reference_total
        current_share = sum(value for _, category, value in current if category == line) / current_total
        reference_share = max(reference_share, epsilon)
        current_share = max(current_share, epsilon)
        contributions[line] = (current_share - reference_share) * np.log(
            current_share / reference_share
        )
    return float(sum(contributions.values())), contributions


def _ks_statistic(positive_scores: np.ndarray, negative_scores: np.ndarray) -> float:
    """Two-sample Kolmogorov-Smirnov separation statistic, in [0, 1]."""
    values = np.sort(np.concatenate((positive_scores, negative_scores)))
    positive_cdf = np.searchsorted(np.sort(positive_scores), values, side="right") / len(
        positive_scores
    )
    negative_cdf = np.searchsorted(np.sort(negative_scores), values, side="right") / len(
        negative_scores
    )
    return float(np.max(np.abs(positive_cdf - negative_cdf)))


def calculate_metrics(
    train: Sequence[MonthlySales],
    test: Sequence[MonthlySales],
    predictions: np.ndarray,
) -> ForecastMetrics:
    """Compute regression errors and clearly labeled scoring diagnostics.

    Gini/K2 assess ranking of test months that are below their calendar month's
    mean revenue in train. PSI for line mix uses a disclosed fictional allocation,
    because only consolidated revenue is supplied in the school dataset.
    """
    train_actual = np.asarray([row.revenue_usd for row in train], dtype=float)
    test_actual = np.asarray([row.revenue_usd for row in test], dtype=float)
    if len(test_actual) != len(predictions) or not len(test_actual):
        raise ValueError("El conjunto real y las predicciones deben tener igual longitud no vacía.")
    mean_revenue = float(np.mean(test_actual))
    mse = float(mean_squared_error(test_actual, predictions))
    rmse = float(np.sqrt(mse))
    # Compare each holdout month with its own seasonal baseline from train. This
    # labels a weak August relative to August, not merely because August is
    # normally below the annual median.
    seasonal_baselines = np.asarray(
        [
            np.mean([row.revenue_usd for row in train if row.month.month == test_row.month.month])
            for test_row in test
        ],
        dtype=float,
    )
    # For real test discrimination, an anomaly is a downside residual beyond a
    # 20% tolerance relative to the month-of-year baseline. This creates a
    # business-sized event definition rather than labeling ordinary variation.
    actual_low = test_actual < 0.80 * seasonal_baselines
    low_count = int(np.sum(actual_low))
    if 0 < low_count < len(test_actual):
        test_scores = 0.80 * seasonal_baselines - predictions
        test_auc = float(roc_auc_score(actual_low, test_scores))
        test_gini: float | None = 2 * test_auc - 1
        test_k2: float | None = _ks_statistic(test_scores[actual_low], test_scores[~actual_low])
        unavailable_reason = None
    else:
        test_gini = None
        test_k2 = None
        unavailable_reason = (
            "El test real no contiene ambas clases respecto al umbral de 80% del promedio "
            "histórico del mismo mes calendario; ROC AUC/Gini y KS no están definidos."
        )

    # Separate counterfactual benchmark: duplicate the 24 holdout observations and
    # inject a known 50% downside shock into six fixed months to create labels.
    # Scores still come only from the model's forecasts (never from injected
    # actuals), so this measures forecast ranking on synthetic labels without
    # target leakage. It is not model performance on observed anomaly labels.
    anomaly_mask = np.zeros(len(test_actual), dtype=bool)
    anomaly_mask[::4] = True
    synthetic_actual = np.concatenate(
        (test_actual, test_actual[anomaly_mask] - 0.50 * seasonal_baselines[anomaly_mask])
    )
    synthetic_predictions = np.concatenate((predictions, predictions[anomaly_mask]))
    synthetic_baselines = np.concatenate(
        (seasonal_baselines, seasonal_baselines[anomaly_mask])
    )
    synthetic_labels = synthetic_actual < 0.80 * synthetic_baselines
    synthetic_scores = 0.80 * synthetic_baselines - synthetic_predictions
    synthetic_auc = float(roc_auc_score(synthetic_labels, synthetic_scores))
    synthetic_gini = 2 * synthetic_auc - 1
    synthetic_k2 = _ks_statistic(
        synthetic_scores[synthetic_labels], synthetic_scores[~synthetic_labels]
    )
    synthetic_lines = _synthetic_business_line_revenue([*train, *test])
    train_months = {row.month for row in train}
    synthetic_train = [record for record in synthetic_lines if record[0] in train_months]
    synthetic_test = [record for record in synthetic_lines if record[0] not in train_months]
    mix_psi, mix_psi_by_line = _business_line_mix_psi(synthetic_train, synthetic_test)
    return ForecastMetrics(
        mse_usd_squared=mse,
        mse_normalized_percent_of_mean_squared=100 * mse / (mean_revenue**2),
        mae_usd=float(mean_absolute_error(test_actual, predictions)),
        rmse_usd=rmse,
        rmse_as_percent_of_mean_revenue=100 * rmse / mean_revenue,
        r2=float(r2_score(test_actual, predictions)),
        psi_revenue_distribution=_population_stability_index(train_actual, test_actual),
        psi_business_line_mix=mix_psi,
        psi_business_line_mix_by_line=mix_psi_by_line,
        gini_anomaly_discrimination_test=test_gini,
        k2_ks_anomaly_discrimination_test=test_k2,
        gini_synthetic_anomaly_benchmark=synthetic_gini,
        k2_ks_synthetic_anomaly_benchmark=synthetic_k2,
        synthetic_anomaly_months=int(np.sum(anomaly_mask)),
        anomaly_definition=(
            "anomaly = actual below 80% of training mean for the same calendar month; "
            "score = 80% seasonal baseline minus forecast; synthetic benchmark adds a "
            "50% downside shock to every fourth holdout month"
        ),
        test_discrimination_unavailable_reason=unavailable_reason,
        anomaly_months_in_test=low_count,
    )


def _plot_forecast(
    test: Sequence[MonthlySales],
    actual: np.ndarray,
    predictions: np.ndarray,
    lower: np.ndarray,
    upper: np.ndarray,
    path: Path,
) -> None:
    dates = [row.month for row in test]
    fig, axis = plt.subplots(figsize=(12, 6))
    axis.plot(dates, actual, color="#1f2937", marker="o", label="Ingresos reales")
    axis.plot(dates, predictions, color="#2563eb", marker="o", label="Random Forest")
    axis.fill_between(dates, lower, upper, color="#60a5fa", alpha=0.25, label="P5–P95 entre árboles")
    axis.set_title("Nexova — pronóstico mensual de ingresos (prueba 2024–2025)")
    axis.set_ylabel("Ingresos (USD)")
    axis.set_xlabel("Mes")
    axis.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    axis.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    axis.grid(True, alpha=0.25)
    axis.legend()
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def run_forecast(
    dataset: Path = DEFAULT_DATASET, output_dir: Path = DEFAULT_OUTPUT_DIR
) -> ForecastMetrics:
    """Train only on the first eight years, evaluate, and save reproducible outputs."""
    rows = load_sales(dataset)
    train, test = chronological_split(rows)

    feature_names = list(make_features([], train[0].month))
    x_train = np.asarray(
        [
            [make_features(train[:index], row.month)[name] for name in feature_names]
            for index, row in enumerate(train)
        ],
        dtype=float,
    )
    y_train = np.asarray([row.revenue_usd for row in train])
    # This evaluates rolling one-month-ahead forecasts: for each test month,
    # revenue observed in earlier test months is available to build the lags.
    test_rows = list(test)
    x_test = np.asarray(
        [
            [make_features(rows[: len(train) + index], row.month)[name] for name in feature_names]
            for index, row in enumerate(test_rows)
        ],
        dtype=float,
    )
    y_test = np.asarray([row.revenue_usd for row in test_rows])

    # Random Forest is chosen as a transparent, low-tuning baseline for 120
    # monthly observations; averaging many trees also exposes a useful variability band.
    model = make_pipeline(
        SimpleImputer(strategy="median"),
        RandomForestRegressor(
            n_estimators=500,
            min_samples_leaf=2,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
    )
    model.fit(x_train, y_train)
    predictions = model.predict(x_test)
    forest = model.named_steps["randomforestregressor"]
    x_test_imputed = model.named_steps["simpleimputer"].transform(x_test)
    tree_predictions = np.vstack(
        [tree.predict(x_test_imputed) for tree in forest.estimators_]
    )
    lower, upper = np.percentile(tree_predictions, [5, 95], axis=0)
    metrics = calculate_metrics(train, test_rows, predictions)

    output_dir.mkdir(parents=True, exist_ok=True)
    _plot_forecast(test_rows, y_test, predictions, lower, upper, output_dir / "sales_forecast.png")
    synthetic_lines = _synthetic_business_line_revenue(rows)
    with (output_dir / "synthetic_business_line_revenue.csv").open(
        "w", encoding="utf-8", newline=""
    ) as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(("month", "business_line", "synthetic_revenue_usd"))
        writer.writerows(
            (month.isoformat(), line, f"{revenue:.2f}")
            for month, line, revenue in synthetic_lines
        )
    with (output_dir / "sales_forecast.csv").open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(("month", "actual_revenue_usd", "predicted_revenue_usd", "tree_p05_usd", "tree_p95_usd"))
        for row, actual, prediction, low, high in zip(test_rows, y_test, predictions, lower, upper):
            writer.writerow((row.month.isoformat(), f"{actual:.2f}", f"{prediction:.2f}", f"{low:.2f}", f"{high:.2f}"))
    with (output_dir / "sales_forecast_metrics.json").open("w", encoding="utf-8") as json_file:
        json.dump(asdict(metrics), json_file, ensure_ascii=False, indent=2)
        json_file.write("\n")
    return metrics


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()
    metrics = run_forecast(args.dataset, args.output_dir)
    print(json.dumps(asdict(metrics), ensure_ascii=False, indent=2))
    print(f"Artefactos guardados en: {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
