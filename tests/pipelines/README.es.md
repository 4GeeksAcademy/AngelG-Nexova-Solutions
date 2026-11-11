# Evaluaciones del agente RAG

## Offline: tools operativas del agente interno

`test_agent_operational_tools_eval.py` ejecuta las tools read-only de
incidencias e inventario sobre SQLite en memoria aislado. Comprueba búsqueda
sin tildes frente a valores almacenados con tildes, exclusión de incidencias
archivadas, cálculo de stock desde movimientos, alertas de reposición, límites
de resultados, validación del tamaño de consulta y respuesta cerrada si la base
no está disponible. No usa la base configurada, PostgreSQL, Qdrant ni modelos.

Desde la raíz, usando el entorno ya configurado del API:

```bash
DATABASE_URL='' PYTHONPATH="$PWD:$PWD/services/api" \
UV_PROJECT_ENVIRONMENT=/tmp/nexova-api-uv \
uv run --directory services/api pytest -q \
  ../../tests/pipelines/test_agent_operational_tools_eval.py \
  ../../tests/pipelines/test_langgraph_agent.py
```

## Offline: corpus y políticas comerciales

`test_langgraph_agent.py` mantiene las pruebas de flujo con retrieval/generación
simulados y añade verificaciones de que los hechos comerciales de aceptación
están presentes en los documentos fuente versionados bajo
`docs/company-knowledge-base/`. Incluye descuento del 22%, condiciones de pago,
objeción sobre la terna, transparencia con competidores, tiempos promedio y
alcance de outsourcing.

Estas pruebas **no** ejecutan el modelo ni consultan Qdrant. Verificar que un
hecho exista en el corpus no demuestra que el modelo lo responda correctamente;
por tanto, no se reporta aquí una métrica offline de faithfulness ni de
Recall@3.

## Live: Recall@3

`test_retrieval_live_eval.py` define ocho preguntas ancladas a documentos
esperados, incluidas objeciones de venta, y calcula Recall@3 sobre el retrieval
configurado. No se ejecuta por defecto: requiere configuración intencional de
embeddings y Qdrant. No indexa, actualiza ni elimina datos.

Desde la raíz del repositorio, con el entorno del API ya preparado:

```bash
RUN_LIVE_RAG_EVAL=1 DATABASE_URL='' \
PYTHONPATH="$PWD:$PWD/services/api" \
UV_PROJECT_ENVIRONMENT=/tmp/nexova-api-uv \
uv run --directory services/api pytest -q \
  ../../tests/pipelines/test_retrieval_live_eval.py
```

El objetivo del brief es Recall@3 >= 80%. Este valor solo se puede afirmar
después de ejecutar la prueba contra el Qdrant y el modelo de embeddings que se
pretenden evaluar. Esta evaluación no mide faithfulness de generación; para ello
se requiere una evaluación independiente de respuestas producidas por el modelo
contra los fragmentos efectivamente recuperados.

### Última ejecución reportada

El usuario ejecutó la evaluación live el 2026-11-11 en su entorno configurado y
reportó `1 passed in 5.82s`. Esto confirma que la comprobación alcanzó el umbral
de Recall@3 >= 80% para las ocho consultas de esa ejecución. La prueba no imprime
el porcentaje exacto; el resultado no debe interpretarse como 100% ni
generalizarse a otros índices, modelos o configuraciones.

## Live: grounding y reglas de negocio de generación

`test_generation_live_eval.py` ejecuta recuperación y generación reales para
ocho casos. Comprueba que se recupere el documento esperado, que la respuesta
incluya hechos/reglas clave, que no incluya frases comerciales prohibidas y que
los números que mencione estén presentes en el texto de evidencia recuperado.
Incluye descuento/aprobación, pagos, terna, transparencia, plazos promedio,
alcance del outsourcing, precio de formación y garantía de reemplazo.

La evaluación es determinista basada en reglas; no usa otro modelo como juez y
no demuestra ausencia absoluta de errores semánticos. Las expresiones y los
hechos esperados son una primera batería de aceptación que se debe mantener al
cambiar el corpus o el estilo de respuesta. Este test sí invoca embeddings,
Qdrant y generación para cada caso, por lo que puede consumir tiempo y créditos.
Solo ejecútalo con acceso y presupuesto autorizados. No modifica Qdrant ni la
base de datos. Además de la configuración de embeddings/Qdrant, requiere el
modelo y las credenciales del proveedor de generación configurados localmente;
el test exige `GENERATION_MODEL_ID` y no muestra valores de credenciales.
Las pruebas locales del mismo archivo verifican paráfrasis conocidas y
afirmaciones inválidas sin invocar proveedores; se ejecutan también cuando la
parte live está omitida.

Desde la raíz del repositorio:

```bash
RUN_LIVE_RAG_GENERATION_EVAL=1 DATABASE_URL='' \
PYTHONPATH="$PWD:$PWD/services/api" \
UV_PROJECT_ENVIRONMENT=/tmp/nexova-api-uv \
uv run --directory services/api pytest -q \\
  ../../tests/pipelines/test_generation_live_eval.py
```

Un resultado `8 passed` significa que los ocho casos superaron estas
comprobaciones para esa ejecución/modelo/índice. No reemplaza revisión humana ni
equivale a una garantía general de faithfulness.
