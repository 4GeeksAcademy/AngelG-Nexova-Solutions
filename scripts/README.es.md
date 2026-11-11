# Carpeta `scripts`

Esta carpeta contiene **scripts auxiliares** del monorepo: automatizaciones de desarrollo, utilidades de mantenimiento, tareas repetitivas (setup, lint, migraciones, generación de datos, etc.) y tooling interno.

- **Propósito principal**: agrupar herramientas de soporte que no pertenecen a una app/agente/pipeline específico, pero facilitan el trabajo del equipo.
- **Recomendación**: documenta cada script (qué hace, parámetros, requisitos, ejemplos de uso) y procura que sean reproducibles (y seguros) en distintos entornos.

## Pronóstico de ventas de Nexova

### Ejecución

Desde la raíz del repositorio, después de sincronizar las dependencias declaradas:

```bash
uv sync
uv run --python .venv/bin/python scripts/forecast_sales.py
```

El CSV canónico predeterminado es `data/raw/nexova_sales.csv`. Para cambiar entrada o salida:

```bash
uv run --python .venv/bin/python scripts/forecast_sales.py \
	--dataset ruta/al/dataset.csv \
	--output-dir ruta/de/salida
```

El pipeline genera `sales_forecast.csv`, `sales_forecast.png`, `sales_forecast_metrics.json` y `synthetic_business_line_revenue.csv` en `data/processed/sales-forecasting/` (o el directorio indicado). No modifica el CSV de origen. El último archivo es un escenario escolar sintético, claramente separado del dataset fuente.

### Método y alcance

El dataset contiene 120 meses consolidados (enero de 2016–diciembre de 2025). Se usan los primeros 96 meses (2016–2023) para entrenamiento y los 24 últimos (2024–2025) para prueba, sin barajar. El modelo es `RandomForestRegressor` con 500 árboles, `min_samples_leaf=2` y semilla 42. Los features son calendario, ingresos rezagados (1, 2 y 12 meses) y medias móviles (3 y 12 meses). Los lags no disponibles al inicio se imputan con medianas aprendidas solamente en train.

La evaluación de prueba es **rolling one-step-ahead**: las features de cada mes pueden usar los ingresos reales observados hasta el mes anterior, incluyendo meses anteriores del período test; el modelo no se reentrena con test. Por tanto, no equivale a emitir en diciembre de 2023 un pronóstico único de 24 meses sin observaciones intermedias.

### Interpretación de métricas

- **MAE (USD)**: error absoluto medio, en dólares.
- **RMSE (USD)**: penaliza más los errores grandes. **RMSE relativo (%)** divide RMSE por el ingreso medio observado en test.
- **MSE (USD²)**: error cuadrático medio. `mse_normalized_percent_of_mean_squared` es `100 × MSE / (media de ingresos reales de test)²`; es un error normalizado adimensional, no un porcentaje del ingreso. El porcentaje interpretable de error es RMSE relativo.
- **R²**: variación de test explicada respecto a predecir la media; puede ser negativa.
- **PSI de ingresos**: compara la distribución univariada de ingresos reales train/test usando deciles de train. PSI mide drift de distribución, no precisión predictiva.
- **PSI del mix por línea**: el CSV fuente solo contiene `consolidated`, sin series por servicio. Para cumplir el ejercicio se genera un escenario explícitamente ficticio: inicia con las proporciones aproximadas 45% outsourcing, 35% headhunting y 20% training descritas en el brief, y cambia linealmente mes a mes hasta 51/31/18 en diciembre de 2025. Cada mes se reconcilia al centavo con el ingreso consolidado. La serie se guarda en `synthetic_business_line_revenue.csv`; no representa registros empresariales ni evidencia histórica real. `psi_business_line_mix` compara la participación agregada train/test; los campos `..._by_line` son sus contribuciones por categoría.
- **Gini y K2/KS para anomalías**: como el brief no define anomalía ni K2, se usa como evento una caída real de al menos 20% bajo el promedio histórico de train para el mismo mes calendario (así agosto no se etiqueta automáticamente por su estacionalidad normal). Se puntúa el residuo adverso (`0.8 × baseline mensual − predicción`); Gini = `2 × ROC AUC − 1`; K2 se interpreta como KS entre scores de los meses con/sin evento. Si el holdout real carece de ambas clases —como en estos datos— las métricas reales se serializan como `null` y se informa la causa; no se fuerza una cifra. Además se incluye un **benchmark contrafactual separado**, que agrega seis copias de meses del test con una caída artificial del 50%, etiqueta con el mismo umbral y puntúa exclusivamente con pronósticos (no con ingresos contrafactuales). En la ejecución actual resulta Gini ≈ 0.306 y KS ≈ 0.375; sirve para probar el cálculo con etiquetas sintéticas, pero no mide el desempeño real ni reemplaza test.

La banda **P5–P95 entre árboles** refleja variabilidad de predicciones de árboles individuales; no es un intervalo predictivo calibrado ni garantiza cobertura del 90%.

### Prueba focalizada

```bash
.venv/bin/python -m unittest tests.pipelines.test_forecast_sales -v
```

## Evaluación técnica del modelo

La evaluación temporal formal se ejecuta con:

```bash
.venv/bin/python scripts/evaluate_forecast.py
.venv/bin/python -m unittest tests.pipelines.test_evaluate_forecast -v
```

Usa los 96 meses 2016–2023 (el holdout final 2024–2025 se reserva) y `TimeSeriesSplit` de cinco folds expansivos, sin barajar. En cada objetivo los lags y medias rodantes se reconstruyen desde los registros anteriores; la validación es rolling one-step-ahead. Calcula MAE y RMSE de train y validación, e informa media ± desviación estándar de folds. Genera `data/eval/learning_curve.png`, `data/eval/evaluation_report.md` y `data/eval/evaluation_metrics.json`.

El informe elige MAE como métrica principal por su interpretación directa en USD; RMSE complementa al penalizar errores grandes. El briefing no cuantifica pérdidas diferentes por sobre/subestimación. Una brecha amplia de MAE train/validación se trata como señal operacional compatible con overfitting; una brecha reducida o intermedia no basta para afirmar buen ajuste o underfitting sin umbrales de error absoluto definidos por negocio y comparación con un baseline. Estas reglas no son pruebas estadísticas.
