"""Evaluate Nexova's revenue Random Forest with chronological CV and learning curves."""

from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Sequence

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "data/eval"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
from scripts.forecast_sales import DEFAULT_DATASET, MonthlySales, load_sales, make_features

N_SPLITS = 5
RANDOM_STATE = 42
FEATURE_NAMES = (
    "year_index",
    "month_sin",
    "month_cos",
    "lag_1_revenue",
    "lag_2_revenue",
    "lag_12_revenue",
    "rolling_mean_3",
    "rolling_mean_12",
)


@dataclass(frozen=True)
class FoldMetrics:
    fold: int
    train_start: str
    train_end: str
    validation_start: str
    validation_end: str
    train_size: int
    validation_size: int
    train_mae_usd: float
    train_rmse_usd: float
    validation_mae_usd: float
    validation_rmse_usd: float


@dataclass(frozen=True)
class LearningPoint:
    train_size: int
    train_mae_usd: float
    validation_mae_usd: float
    train_rmse_usd: float
    validation_rmse_usd: float


def make_model():
    """Match the existing forecasting model and fit imputation within each fold."""
    return make_pipeline(
        SimpleImputer(strategy="median"),
        RandomForestRegressor(
            n_estimators=500,
            min_samples_leaf=2,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
    )


def validate_temporal_folds(
    folds: Sequence[tuple[np.ndarray, np.ndarray]], sample_count: int
) -> None:
    """Reject shuffled, overlapping, non-chronological, or out-of-range folds."""
    previous_validation_end = -1
    for fold_number, (train_indices, validation_indices) in enumerate(folds, start=1):
        if not len(train_indices) or not len(validation_indices):
            raise ValueError(f"Fold {fold_number} no puede tener conjuntos vacíos.")
        if np.any(np.diff(train_indices) <= 0) or np.any(np.diff(validation_indices) <= 0):
            raise ValueError(f"Fold {fold_number} debe conservar índices estrictamente crecientes.")
        if train_indices[0] < 0 or validation_indices[-1] >= sample_count:
            raise ValueError(f"Fold {fold_number} contiene índices fuera del conjunto de entrenamiento.")
        if train_indices[-1] >= validation_indices[0]:
            raise ValueError(f"Fold {fold_number} mezcla entrenamiento con validación futura.")
        if validation_indices[0] <= previous_validation_end:
            raise ValueError("Los bloques de validación deben avanzar cronológicamente sin solaparse.")
        previous_validation_end = int(validation_indices[-1])


def build_causal_features(
    rows: Sequence[MonthlySales], target_indices: Sequence[int]
) -> np.ndarray:
    """Build each row's lags from observations strictly before its target month."""
    matrix: list[list[float]] = []
    for index in target_indices:
        if index < 0 or index >= len(rows):
            raise IndexError(f"Índice objetivo fuera de rango: {index}")
        row = rows[index]
        features = make_features(rows[:index], row.month)
        matrix.append([features[name] for name in FEATURE_NAMES])
    return np.asarray(matrix, dtype=float)


def _scores(actual: np.ndarray, predicted: np.ndarray) -> tuple[float, float]:
    return (
        float(mean_absolute_error(actual, predicted)),
        float(np.sqrt(mean_squared_error(actual, predicted))),
    )


def evaluate_cross_validation(
    train_rows: Sequence[MonthlySales], n_splits: int = N_SPLITS
) -> tuple[list[FoldMetrics], list[tuple[np.ndarray, np.ndarray]]]:
    """Run expanding-window TimeSeriesSplit; validation is rolling one-step-ahead."""
    if n_splits < 5:
        raise ValueError("La evaluación requiere al menos cinco folds temporales.")
    splitter = TimeSeriesSplit(n_splits=n_splits)
    folds = [(train_idx, val_idx) for train_idx, val_idx in splitter.split(train_rows)]
    validate_temporal_folds(folds, len(train_rows))

    fold_metrics: list[FoldMetrics] = []
    all_targets = np.asarray([row.revenue_usd for row in train_rows], dtype=float)
    for fold_number, (train_idx, val_idx) in enumerate(folds, start=1):
        x_fit = build_causal_features(train_rows, train_idx)
        x_val = build_causal_features(train_rows, val_idx)
        y_fit, y_val = all_targets[train_idx], all_targets[val_idx]
        model = make_model()
        model.fit(x_fit, y_fit)
        train_mae, train_rmse = _scores(y_fit, model.predict(x_fit))
        val_mae, val_rmse = _scores(y_val, model.predict(x_val))
        fold_metrics.append(
            FoldMetrics(
                fold=fold_number,
                train_start=train_rows[int(train_idx[0])].month.isoformat(),
                train_end=train_rows[int(train_idx[-1])].month.isoformat(),
                validation_start=train_rows[int(val_idx[0])].month.isoformat(),
                validation_end=train_rows[int(val_idx[-1])].month.isoformat(),
                train_size=len(train_idx),
                validation_size=len(val_idx),
                train_mae_usd=train_mae,
                train_rmse_usd=train_rmse,
                validation_mae_usd=val_mae,
                validation_rmse_usd=val_rmse,
            )
        )
    return fold_metrics, folds


def calculate_learning_curve(
    train_rows: Sequence[MonthlySales], final_fold: tuple[np.ndarray, np.ndarray]
) -> list[LearningPoint]:
    """Grow the final fold's chronological training prefix against a fixed future block."""
    train_idx, validation_idx = final_fold
    candidate_sizes = sorted(
        {
            max(12, int(round(len(train_idx) * fraction)))
            for fraction in (0.25, 0.4375, 0.625, 0.8125, 1.0)
        }
    )
    candidate_sizes = [size for size in candidate_sizes if size <= len(train_idx)]
    targets = np.asarray([row.revenue_usd for row in train_rows], dtype=float)
    x_validation = build_causal_features(train_rows, validation_idx)
    y_validation = targets[validation_idx]
    points: list[LearningPoint] = []

    for size in candidate_sizes:
        subset_indices = train_idx[:size]
        x_fit = build_causal_features(train_rows, subset_indices)
        y_fit = targets[subset_indices]
        model = make_model()
        model.fit(x_fit, y_fit)
        train_mae, train_rmse = _scores(y_fit, model.predict(x_fit))
        validation_mae, validation_rmse = _scores(y_validation, model.predict(x_validation))
        points.append(
            LearningPoint(
                train_size=size,
                train_mae_usd=train_mae,
                validation_mae_usd=validation_mae,
                train_rmse_usd=train_rmse,
                validation_rmse_usd=validation_rmse,
            )
        )
    return points


def _mean_std(values: Sequence[float]) -> tuple[float, float]:
    return float(np.mean(values)), float(np.std(values, ddof=1))


def diagnose_model(fold_metrics: Sequence[FoldMetrics], curve: Sequence[LearningPoint]) -> tuple[str, str]:
    """Apply explicit heuristic criteria to the final training-size learning-curve point."""
    final = curve[-1]
    gap = final.validation_mae_usd / max(final.train_mae_usd, 1e-9)
    validation_mae_mean, validation_mae_std = _mean_std(
        [fold.validation_mae_usd for fold in fold_metrics]
    )
    relative_cv_std = validation_mae_std / max(validation_mae_mean, 1e-9)
    if gap >= 1.50:
        diagnosis = "overfitting"
        evidence = (
            f"En el último punto de la curva, MAE validación/train = {gap:.2f}×, "
            "por encima del umbral operativo >=1.50×; no se afirma persistencia porque "
            "la curva aún muestra sensibilidad al tamaño de entrenamiento."
        )
    elif gap <= 1.25:
        diagnosis = "brecha reducida; ajuste global no concluyente"
        evidence = (
            f"En el último punto, MAE validación/train = {gap:.2f}×, dentro del criterio "
            "operativo de brecha reducida <=1.25×; esto no demuestra por sí solo que ambos "
            "errores sean bajos ni que el modelo esté bien ajustado."
        )
    else:
        diagnosis = "brecha intermedia; diagnóstico no concluyente"
        evidence = (
            f"En el último punto, MAE validación/train = {gap:.2f}×: no presenta la brecha "
            "amplia definida para una señal de overfitting, pero tampoco alcanza el criterio "
            "de brecha reducida. No se etiqueta como underfitting porque la brecha por sí sola "
            "no demuestra que los errores absolutos de train y validación sean altos."
        )
    evidence += (
        f" La variación entre folds de MAE de validación (desviación estándar/media) es "
        f"{relative_cv_std:.1%}; interpretar con cautela por la muestra mensual pequeña."
    )
    return diagnosis, evidence


def _plot_learning_curve(points: Sequence[LearningPoint], path: Path) -> None:
    sizes = [point.train_size for point in points]
    fig, axis = plt.subplots(figsize=(9, 6))
    axis.plot(sizes, [point.train_mae_usd for point in points], marker="o", label="MAE entrenamiento")
    axis.plot(sizes, [point.validation_mae_usd for point in points], marker="o", label="MAE validación")
    axis.set_title("Nexova — curva de aprendizaje temporal (MAE)")
    axis.set_xlabel("Meses de entrenamiento usados")
    axis.set_ylabel("MAE (USD)")
    axis.grid(True, alpha=0.3)
    axis.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def _render_report(
    folds: Sequence[FoldMetrics], curve: Sequence[LearningPoint], image_name: str
) -> str:
    diagnosis, evidence = diagnose_model(folds, curve)
    cv_mae_mean, cv_mae_std = _mean_std([fold.validation_mae_usd for fold in folds])
    cv_rmse_mean, cv_rmse_std = _mean_std([fold.validation_rmse_usd for fold in folds])
    train_mae_mean, train_mae_std = _mean_std([fold.train_mae_usd for fold in folds])
    train_rmse_mean, train_rmse_std = _mean_std([fold.train_rmse_usd for fold in folds])
    curve_final = curve[-1]

    if diagnosis == "overfitting":
        action = (
            "Realizar una búsqueda temporal controlada de `min_samples_leaf` = 2, 4 y 6, "
            "manteniendo 500 árboles, semilla, features y folds fijos. Seleccionar un valor "
            "mayor solo si reduce MAE media de validación y no eleva su desviación estándar; "
            "la brecha observada justifica probar regularización antes de aumentar la capacidad. "
            "No cambiar el modelo sin esa comparación."
        )
    else:
        action = (
            "No inferir underfitting solo a partir de la brecha. Mantener el modelo como baseline "
            "y comparar sus errores con un baseline estacional ingenuo, además de revisar si ambos "
            "errores absolutos exceden un umbral de negocio acordado. Hasta contar con ese umbral, "
            "no aplicar una corrección de complejidad preventiva."
        )

    fold_rows = "\n".join(
        f"| {f.fold} | {f.train_start[:7]}–{f.train_end[:7]} ({f.train_size}) | "
        f"{f.validation_start[:7]}–{f.validation_end[:7]} ({f.validation_size}) | "
        f"${f.train_mae_usd:,.0f} | ${f.train_rmse_usd:,.0f} | "
        f"${f.validation_mae_usd:,.0f} | ${f.validation_rmse_usd:,.0f} |"
        for f in folds
    )
    curve_rows = "\n".join(
        f"| {p.train_size} | ${p.train_mae_usd:,.0f} | ${p.validation_mae_usd:,.0f} | "
        f"${p.train_rmse_usd:,.0f} | ${p.validation_rmse_usd:,.0f} |"
        for p in curve
    )
    return f"""# Evaluación técnica del modelo de pronóstico de ingresos Nexova

## Veredicto

**Diagnóstico: {diagnosis}.** {evidence}

La curva mantiene fijo el último bloque temporal de validación (los meses finales del set de entrenamiento) y amplía cronológicamente el prefijo de entrenamiento. La decisión se apoya en MAE, elegida como métrica principal porque representa directamente el error absoluto típico en USD y es más interpretable para planificar ingresos; RMSE se conserva para penalizar más los errores grandes. El briefing de empresa no define costos monetarios diferenciales por tipo de error, así que MAE es una elección operativa interpretable, no una estimación de pérdida financiera.

## Datos y protocolo

- Fuente: `data/raw/nexova_sales.csv`, objetivo `revenue_usd` de filas `consolidated`.
- Se evalúan los 96 meses 2016-01–2023-12; los 24 meses 2024–2025 del holdout final no participan en esta evaluación.
- Modelo: Random Forest con 500 árboles, `min_samples_leaf=2`, semilla 42; imputación dentro de un pipeline ajustado de nuevo por fold.
- Validación: `TimeSeriesSplit`, 5 folds expansivos, sin shuffle. En cada fold los índices de entrenamiento son anteriores a validación, y los bloques de validación avanzan en orden. Las pruebas automatizadas comprueban también que alterar el target y el futuro no cambia los features del objetivo.
- Features: calendario, lags 1/2/12 y medias rodantes 3/12 calculados para cada mes usando exclusivamente registros anteriores al mes objetivo. Durante cada bloque de validación se evalúa rolling one-step-ahead: observaciones reales anteriores dentro del bloque pueden alimentar lags de meses posteriores, sin reentrenar el modelo. Esto representa reforecast mensual, no predicción multi-horizonte sin observaciones intermedias.
- Las medias ± desviaciones estándar de CV describen cinco períodos de validación temporal distintos; no son intervalos de confianza estadísticos.

## Validación cruzada temporal

| Fold | Entrenamiento | Validación | Train MAE | Train RMSE | Validación MAE | Validación RMSE |
|---:|---|---|---:|---:|---:|---:|
{fold_rows}
| **Media ± DE** | — | 5 folds | **${train_mae_mean:,.0f} ± ${train_mae_std:,.0f}** | **${train_rmse_mean:,.0f} ± ${train_rmse_std:,.0f}** | **${cv_mae_mean:,.0f} ± ${cv_mae_std:,.0f}** | **${cv_rmse_mean:,.0f} ± ${cv_rmse_std:,.0f}** |

## Curva de aprendizaje

![Curva de aprendizaje temporal: MAE de entrenamiento y validación]({image_name})

| Meses de entrenamiento | Train MAE | Validación MAE | Train RMSE | Validación RMSE |
|---:|---:|---:|---:|---:|
{curve_rows}

En el tamaño máximo de la curva ({curve_final.train_size} meses), train MAE es **${curve_final.train_mae_usd:,.0f}** y validación MAE **${curve_final.validation_mae_usd:,.0f}**. {evidence} La curva aún mejora y fluctúa al aumentar las observaciones; la brecha indica generalización débil, pero no demuestra por sí sola memorización del ruido. Los umbrales son reglas operativas explícitas, no universales.

## Acción correctiva concreta

{action}

## Límites de interpretación

El dataset contiene solo 96 observaciones para esta evaluación, la validación consiste en cinco ventanas temporales y las variables de negocio del CSV son agregadas. Las conclusiones describen estabilidad temporal dentro del período 2016–2023. La evaluación no reemplaza el holdout 2024–2025 ni prueba generalización a otros regímenes económicos. El briefing de negocio describe estacionalidad de agosto y enero-febrero, pero no asigna costos diferentes a sobreestimar frente a subestimar ingresos. La razón train-validación solo permite identificar una brecha amplia compatible con una señal operacional de overfitting; una brecha reducida o intermedia no basta para afirmar buen ajuste o underfitting sin umbrales de error absoluto definidos por negocio y comparación con un baseline. La curva sigue sensible al tamaño del prefijo, por lo que se propone validar la regularización con CV antes de adoptarla.
"""


def run_evaluation(
    dataset: Path = DEFAULT_DATASET, output_dir: Path = DEFAULT_OUTPUT_DIR
) -> dict[str, object]:
    rows = load_sales(dataset)
    train_rows = rows[:-24]
    fold_metrics, folds = evaluate_cross_validation(train_rows)
    curve = calculate_learning_curve(train_rows, folds[-1])
    output_dir.mkdir(parents=True, exist_ok=True)
    image_path = output_dir / "learning_curve.png"
    _plot_learning_curve(curve, image_path)
    report = _render_report(fold_metrics, curve, image_path.name)
    (output_dir / "evaluation_report.md").write_text(report, encoding="utf-8")
    result = {
        "dataset": str(dataset.relative_to(REPO_ROOT) if dataset.is_relative_to(REPO_ROOT) else dataset),
        "training_period": [train_rows[0].month.isoformat(), train_rows[-1].month.isoformat()],
        "folds": [asdict(fold) for fold in fold_metrics],
        "cross_validation_summary": {
            "train_mae_mean_usd": _mean_std([fold.train_mae_usd for fold in fold_metrics])[0],
            "train_mae_std_usd": _mean_std([fold.train_mae_usd for fold in fold_metrics])[1],
            "train_rmse_mean_usd": _mean_std([fold.train_rmse_usd for fold in fold_metrics])[0],
            "train_rmse_std_usd": _mean_std([fold.train_rmse_usd for fold in fold_metrics])[1],
            "validation_mae_mean_usd": _mean_std([fold.validation_mae_usd for fold in fold_metrics])[0],
            "validation_mae_std_usd": _mean_std([fold.validation_mae_usd for fold in fold_metrics])[1],
            "validation_rmse_mean_usd": _mean_std([fold.validation_rmse_usd for fold in fold_metrics])[0],
            "validation_rmse_std_usd": _mean_std([fold.validation_rmse_usd for fold in fold_metrics])[1],
        },
        "learning_curve": [asdict(point) for point in curve],
        "diagnosis": diagnose_model(fold_metrics, curve)[0],
        "diagnosis_evidence": diagnose_model(fold_metrics, curve)[1],
        "artifacts": ["learning_curve.png", "evaluation_report.md"],
    }
    (output_dir / "evaluation_metrics.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return result


def main() -> int:
    result = run_evaluation()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"Artefactos guardados en: {DEFAULT_OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
