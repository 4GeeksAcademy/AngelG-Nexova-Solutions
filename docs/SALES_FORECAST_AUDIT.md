# Auditoría de criterios — pronóstico de ventas Nexova

**Fecha:** 2026-11-10  
**Alcance:** contraste de los siete criterios solicitados con el código, los datos y los artefactos actuales. La promoción solo cambió la ubicación de la fuente: su contenido se verificó idéntico byte por byte; después se ejecutaron las pruebas y el pipeline con la ruta canónica.

## Resumen ejecutivo

**Resultado: implementación y pruebas finalizadas; no es defendible afirmar cumplimiento empírico completo de los siete criterios.** El dataset canónico conserva sus 120 meses consolidados y no se alteró. Para resolver la falta de desglose de líneas se genera una serie auxiliar sintética; no se presenta como dato real. El holdout real no contiene eventos de caída >=20% respecto al promedio histórico del mismo mes, por lo que Gini/K2 reales no están definidos y se reportan como `null`. El benchmark de etiquetas sintéticas utiliza scores de pronóstico sin fuga del valor real inyectado (Gini ≈ 0.306; KS ≈ 0.375), pero no sustituye la evaluación real. El cierre es válido como ejercicio escolar bajo supuestos explícitos; si la rúbrica exige valores reales de Gini/K2, el criterio sigue condicionado por falta de etiquetas/eventos en el holdout.

| # | Criterio | Estado | Evidencia y observaciones |
|---|---|---|---|
| 1 | Split 8 años / 2 años, sin mezclar conjuntos | **Cumple, con alcance temporal que aclarar** | `scripts/forecast_sales.py`: `chronological_split()` separa 96 meses (2016-01–2023-12) y 24 (2024-01–2025-12), en orden, y verifica no solapamiento. El modelo se ajusta solo sobre `train`. La evaluación test es *rolling one-step-ahead*: para meses posteriores del test se usan ingresos reales de meses de test anteriores al crear lags. No hay reentrenamiento con test, pero esto no es un forecast único de 24 meses emitido al final de 2023. La limitación está descrita en `scripts/README.es.md`. |
| 2 | XGBoost o Random Forest, con elección justificada | **Cumple** | Se usa `RandomForestRegressor` con 500 árboles, `min_samples_leaf=2`, `n_jobs=-1`. La justificación en el script es usar un baseline de pocos ajustes para 120 observaciones mensuales y obtener variabilidad entre árboles. La guía documenta esa elección. |
| 3 | MSE, PSI, Gini y K2 Score sobre test | **Parcial / condicionado por ausencia de clases reales** | MSE = **3,509,186,192.95 USD²** (MSE normalizado = 0.3813%; RMSE relativo = 6.1748%); PSI de ingresos consolidados = **8.1602**; PSI sintético del mix de líneas = **0.003394**. El caso real no contiene meses bajo el umbral de anomalía (caída >=20% frente al promedio train del mismo mes), por tanto Gini/K2 de anomalías del test se emiten como `null`, con motivo registrado. El benchmark contrafactual con 6 shocks de 50% y scores basados solo en pronósticos da Gini = **0.3056**, KS = **0.375**; prueba el cálculo sobre etiquetas sintéticas, no representa desempeño real. La frase del brief que pide MSE como porcentaje del ingreso mensual promedio no especifica normalización; se documenta el MSE en USD², su normalización por media² y RMSE relativo, pendiente de confirmar la fórmula esperada por la rúbrica. |
| 4 | Visualización de predicción y rango de variabilidad | **Cumple** | `data/processed/sales-forecasting/sales_forecast.png` muestra los ingresos reales, predicción y banda P5–P95 entre árboles; el CSV acompaña la serie mensual y límites. El rango es dispersión entre árboles, **no** intervalo predictivo calibrado ni cobertura garantizada. |
| 5 | Dataset en `data/raw/<empresa>_sales.csv`, sin alterar patrón | **Cumple** | La fuente canónica es `data/raw/nexova_sales.csv` y es la ruta predeterminada en `scripts/forecast_sales.py`. Se copió desde la ubicación inicial y se comprobó identidad byte por byte con `cmp` y SHA-256 idéntico (`e3af15657506fae36a81eec6a9a544a54473bf38f41f2ee1bb066799ff94440a`); solo después se eliminó la copia antigua de `Contexto-Nexova/sales-forecasting/nexova/`. El pipeline valida 120 meses consecutivos, fechas 2016-01 a 2025-12, ingresos positivos y filas `consolidated`. La inspección descriptiva concuerda con el briefing: medias enero/febrero ≈ **$957k/$954k**, agosto ≈ **$644k** (caída estacional); crecimiento interanual agregado anual observado ≈ **0.5–7.35%**, alternando valores próximos a 1% y 7%. |
| 6 | Semilla aleatoria fija | **Cumple** | `RANDOM_STATE = 42` y se pasa a `RandomForestRegressor(random_state=RANDOM_STATE)`. |
| 7 | Prueba unitaria del split pasa | **Cumple** | Ejecución: `.venv/bin/python -m unittest tests.pipelines.test_forecast_sales -v` — **6 pruebas OK**, incluyendo tamaños, límites de fechas, ausencia de solapamiento, causalidad de features y métricas sintéticas. También pasaron `py_compile` y `git diff --check`. |

## Hallazgos y resolución de métricas

1. **Definición del evento:** el brief no fija umbral ni fórmula de K2. Para el ejercicio se declaró evento una caída de 20% o más frente al promedio histórico de train del mismo mes calendario; el score adverso es `0.8×baseline - predicción`, Gini = `2×AUC-1` y K2 se implementa como separación KS. La definición queda expuesta en las métricas y `scripts/README.es.md`.
2. **Datos de mix:** se generó `data/processed/sales-forecasting/synthetic_business_line_revenue.csv`, con proporciones iniciales aproximadas 45/35/20 que cambian linealmente mes a mes hasta 51/31/18 en diciembre de 2025. Cada mes reconcilia al centavo con el consolidado. PSI del mix train/test es **0.003394**; esto es resultado de escenario sintético y no demuestra drift empresarial observado.
3. **Caso real:** el holdout no contiene eventos etiquetados con el umbral acordado, por lo que Gini/K2 de test no existen. El benchmark separado agrega seis caídas hipotéticas de 50%, vuelve a etiquetar usando la regla definida y puntúa con el pronóstico del modelo: Gini = 0.3056 y KS = 0.375. Es una comprobación sobre etiquetas sintéticas, no capacidad predictiva real.
4. **MSE normalizado:** `mse_normalized_percent_of_mean_squared` = `100×MSE/media_test²` expresa el MSE como porcentaje de la media al cuadrado, no como porcentaje lineal del ingreso. RMSE relativo = **6.1748%** es la expresión porcentual lineal interpretable. La fórmula exacta exigida por el brief/rúbrica debe confirmarse.
5. **Split rolling:** la evaluación usa ingresos reales de meses test anteriores para los lags posteriores; corresponde a reforecast mensual y no a un forecast fijo de 24 meses emitido al cierre de 2023.

## Referencias revisadas

- `scripts/forecast_sales.py`
- `tests/pipelines/test_forecast_sales.py`
- `scripts/README.es.md`
- `data/processed/sales-forecasting/sales_forecast_metrics.json`
- `data/processed/sales-forecasting/sales_forecast.csv`
- `data/processed/sales-forecasting/synthetic_business_line_revenue.csv` (escenario sintético escolar, no fuente real)
- `data/raw/nexova_sales.csv` (fuente canónica; SHA-256: `e3af15657506fae36a81eec6a9a544a54473bf38f41f2ee1bb066799ff94440a`)
- `Contexto-Nexova/sales-forecasting/nexova/nexova-BRIEFING.es.md`
- `CONTEXT.md` (contexto general de empresa; los detalles numéricos de crecimiento/estacionalidad se tomaron del briefing específico de forecasting)
