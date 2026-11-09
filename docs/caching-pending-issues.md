# Diagnóstico de incidencias pendientes — Optimización de rendimiento / Caching

**Fase:** 9.1 — Resolución focalizada del conflicto SKU  
**Estado:** cambio de código y actualización de diagnóstico preparados para revisión; sin commit ni push.

## Alcance y método

Se preservaron los cambios locales preexistentes y se comparó el helper de inventario con `HEAD`. Se inspeccionaron la ruta legacy, el handler global de `HTTPException`, los modelos/migraciones, la prueba de regresión y la configuración de PostgreSQL. La única expectativa elegida es la ya presente en el test; no se expone texto SQL ni nombres de constraints en HTTP. No se hicieron benchmarks.

## Incidencias

### 1. Conflicto SKU duplicado: detalle HTTP distinto al esperado

**Estado:** discrepancia preexistente corregida en el cambio propuesto; no atribuida a la caché.

- `services/api/tests/test_inventory_api.py::test_duplicate_product_sku_rolls_back_and_api_remains_usable` espera HTTP 409 y el detalle exacto `Ya existe un registro con esos datos únicos.`. El test existe ya en `HEAD`.
- La ruta legacy `POST /inventory/products` delega en `routers.inventory_v2.create_item`. El helper `_commit` captura `IntegrityError` y hace rollback. El handler global envuelve los detalles string de `HTTPException` como `detail.message`, que es la forma que espera la prueba.
- La decisión es honrar esa expectativa con un 409 específico solo cuando se identifica con certeza la restricción SKU: SQLite mediante su mensaje estructurado de tabla/columna para `inventory_item.sku`, PostgreSQL mediante el nombre del índice único conocido (índice de modelo o índice de migración). La detección lee metadatos del driver internamente y no devuelve errores SQL, nombres de tabla ni constraints al cliente.
- El resto de `IntegrityError` mantiene el 409 genérico existente; el helper es compartido por otras mutaciones y no se deben reclasificar conflictos de `source_asset_id`, lotes, claves foráneas o checks como SKU. Se conserva el rollback único antes de emitir la respuesta.
- Validación focalizada actual: `tests/test_inventory_api.py::test_duplicate_product_sku_rolls_back_and_api_remains_usable` pasó (**1 passed**). La prueba comprueba 409 con mensaje, exactamente un rollback, GET posterior satisfactorio y conservación del producto original. Hubo una advertencia deprecada de Starlette/httpx. La prueba corre en SQLite; la clasificación PostgreSQL está basada en los nombres del modelo/migración, no se ejecutó aquí contra una instancia PostgreSQL.

**Atribución:** la expectativa y el handler son anteriores a los cambios actuales. El fallo indicaba una discrepancia previa entre contrato de prueba y contrato de API, no un defecto causado por la caché. La ruta comparte archivo con cambios de rendimiento; el cambio se limita a clasificar la excepción en `_commit`, sin alterar esas optimizaciones.

**Archivos de esta resolución:** `services/api/routers/inventory_v2.py` (clasificación acotada, rollback y fallback genérico preservados) y este informe. No se alteró la prueba porque ahora verifica el comportamiento de extremo a extremo esperado. No se modificó el frontend; no se encontraron consumidores de los dos textos de error.

### 2. Recolección completa detenida por `services.api.models` ausente

**Estado:** bloqueo de colección por referencia a un módulo inexistente en el árbol versionado inspeccionado.

- `services/api/tests/test_models.py` importa `SupplierDict`, modelos y constantes desde `services.api.models`.
- Ese test y esa importación existen en `HEAD`, pero `services/api/models.py` no aparece en el árbol de `HEAD` ni en el actual. Los esquemas de proveedor actualmente visibles están en `services/api/supplier_schemas.py`; no contienen todo el contrato importado por el test (por ejemplo, `SupplierDict` y las constantes citadas).
- `services/api/pyproject.toml` configura `testpaths = ["tests"]`; pytest encuentra `test_models.py` durante la recogida. `tests/conftest.py` agrega rutas y prepara fixtures, pero no proporciona ese módulo. Cambiar `pythonpath` no resolvería la ausencia del módulo.
- La suite completa, por ello, no llega a ejecutar todos los tests. En FASE 7 se reportó que, excluyendo `test_models.py`, hubo 208 pasados, 6 xfailed y un fallo (el detalle SKU anterior).

**Atribución:** inconsistencia preexistente en el árbol versionado, no introducida por la implementación de caching observada. La sustitución directa por `supplier_schemas.py` no es segura sin comparar los esquemas históricos y las reglas/campos que el test pretendía validar.

**Alternativas para resolver posteriormente:** recuperar/restaurar el módulo contractual correcto, o migrar conscientemente las pruebas y consumidores al módulo de esquemas actual. En ambos casos, preservar o reemplazar con cobertura equivalente la validación de categorías, estados, moneda/país, fechas y compatibilidad del API. No añadir un alias superficial que deje símbolos faltantes o cambie validaciones sin revisión. Validar primero import/colección y después la suite total.

### 3. Dos errores ESLint `react-hooks/set-state-in-effect`

**Estado:** lint global falla en dos efectos de inicialización de UI.

| Archivo y línea | Operación | Contexto y riesgo |
| --- | --- | --- |
| `uis/backoffice/components/AuthenticatedNavigation.tsx:92` | `setDarkMode(shouldUseDark)` | El efecto lee `localStorage` y `matchMedia`, actualiza la clase `dark` del documento y sincroniza el estado React. La lectura del navegador requiere ejecución cliente; quitar la sincronización sin reemplazarla puede dejar el botón/ARIA desincronizados del tema aplicado. |
| `uis/backoffice/lib/auth-context.tsx:70` | `setIsReady(true)` | En ausencia de token, el efecto marca listo inmediatamente para liberar navegación/UI. La rama con token hace la resolución asíncrona y también marca listo al terminar. Cambiar solo la rama sin token puede mantener la aplicación en estado de carga o permitir renderizar contenido antes de verificar auth. |

Ambos archivos coinciden con `HEAD` (sin cambios locales), así que estos errores no fueron introducidos por la optimización de caching. No son errores de compilación: FASE 7 reportó TypeScript y build del backoffice correctos; el lint global no pasa. El lint focalizado de los archivos de la optimización sí pasó.

**Alternativas para resolver posteriormente:**

- Para el tema, escoger un único origen de verdad y un diseño compatible con hidratación: por ejemplo, inicialización de tema antes del render cliente con estado coherente, o suscripción a un almacén externo para el tema. La solución debe preservar persistencia, preferencia del sistema, alternancia, accesibilidad y ausencia de desajuste servidor/cliente; no trasladar simplemente el mismo `setState` a otro efecto.
- Para auth, modelar explícitamente estados de inicialización (p. ej., `checking`/`ready`) y verificar que el flujo sin token, con token válido y con token inválido termina siempre correctamente. Una inicialización externa/hidratación-safe puede evitar la transición síncrona en el efecto; no usar temporizadores ni desactivar la regla como atajo.
- Añadir/priorizar pruebas de tema e inicialización auth antes de cambiar el flujo y volver a ejecutar lint global, tests, TypeScript y build.

**Nota:** no se confirmó por inspección aislada si estas dos ubicaciones son los únicos resultados de la versión/configuración actual de ESLint; son los dos errores concretos comunicados por la validación FASE 7.

## Estado Git y preservación de cambios

La inspección inicial reportó un worktree muy sucio: **0 cambios staged**, **197 entradas modificadas**, **565 eliminaciones** y **7 archivos no rastreados** en el resumen de estado. Gran parte del volumen corresponde a `services/api/.venv`; también existen cambios ajenos en documentación, scripts, servicios y pruebas. Entre los archivos de aplicación relacionados con las incidencias, `services/api/routers/inventory_v2.py`, `services/api/supplier_schemas.py` y `services/api/tests/conftest.py` ya tenían cambios locales; los tests SKU/modelos y los dos archivos React no aparecieron como modificados. Los siete no rastreados al inventario de estado incluían `CACHING_REPORT.md`, `docs/caching-audit.md`, `services/api/cache.py`, `services/api/seed_admin.py`, `services/api/tests/test_request_timing.py`, `services/reporting/schemas.py` y una prueba del backoffice.

No se limpió, restauró, sobrescribió ni revirtió ninguno de esos archivos. `docs/caching-pending-issues.md` no existía al inicio y se creó como único entregable de esta fase.

## Validación y límites

Resultados previos de FASE 7, sin repetir pruebas ni cambiar el entorno:

- Pruebas backend enfocadas: **27 passed**, con una advertencia deprecada Starlette/httpx.
- Suite backend amplia omitiendo `test_models.py`: **208 passed, 6 xfailed, 1 failed**; el fallo fue la aserción de detalle del conflicto SKU.
- Recogida completa: bloqueada por `ModuleNotFoundError: No module named 'services.api.models'`.
- Backoffice: **24 archivos / 91 pruebas Vitest pasaron**; TypeScript y build pasaron; lint global falló en los dos efectos indicados.
- Website: typecheck, lint y build pasaron.
- No hay benchmark backend ni datos representativos de frecuencia, hit ratio o latencias antes/después. Las pruebas de hit/miss prueban comportamiento, no mejora de rendimiento.

Este documento registra diagnóstico, atribución basada en `HEAD` y líneas de investigación. No declara resueltos los fallos ni recomienda alterar su contrato sin confirmación.
