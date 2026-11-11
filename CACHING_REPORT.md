# CACHING_REPORT.md

## 1. Introducción

### Objetivo

Este informe documenta las optimizaciones de rendimiento realizadas en el reto **«Optimización de rendimiento: Caching»**: decisiones de carga diferida y memoización en el frontend, instrumentación segura de duración de solicitudes en la API, y una caché TTL acotada para dos reportes. Distingue entre cambios implementados, resultados de pruebas y mediciones de rendimiento reales. No atribuye mejoras de latencia al cache sin benchmarks.

### Arquitectura existente

El monorepo contiene dos aplicaciones Next.js separadas (sitio público y backoffice), construidas con React y TypeScript. La API principal es FastAPI en `services/api/main.py`, con routers de inventario, reporting y telemetría, entre otros. Los reportes elegidos leen datos persistidos mediante SQLModel/SQLAlchemy; hay dominios adicionales que usan otros mecanismos de persistencia. `services/api/app/main.py` es una aplicación aparte para análisis CSV, no montada en la API principal inspeccionada.

### Problemas y oportunidades identificados

- En el perfil del backoffice se importaban componentes de pestañas que no se muestran inicialmente, en particular administración de usuarios y cambio de contraseña.
- En inventario gestionado se repetían derivaciones de filtrado y conteo en renders que no necesariamente cambiaban los datos o filtros.
- Los reportes semanal de rendimiento y técnico de telemetría vuelven a consultar/agregar datos y serializar resultados en solicitudes repetidas. El coste es una inferencia por el código; no se midió en una base de producción.
- La frecuencia real de solicitudes, cardinalidad de datos y latencia backend antes del cambio no están disponibles. Se instaló logging de duración de bajo cardinalidad, pero no se contó con un conjunto de logs representativo para medir esa frecuencia.

### Estrategia general

Se aplicaron optimizaciones localizadas y conservadoras: cargar módulos del perfil cuando el usuario selecciona su pestaña; memoizar una derivación de inventario; instrumentar duración por plantilla de ruta sin registrar datos sensibles; y guardar temporalmente respuestas de los dos reportes elegidos en una caché en memoria de proceso, con TTL y invalidación posterior a escrituras confirmadas. Se mantuvo la autenticación/autorización en cada petición y no se introdujo caché pública, Redis ni caching de endpoints personales o de inventario mutable.

## 2. Decisiones en el frontend

### 2.1 Lazy Loading

| Componente / ruta | Ubicación | Funcionalidad y problema | Técnica y justificación | Beneficio |
| --- | --- | --- | --- | --- |
| `ChangePasswordForm` | `uis/backoffice/components/ChangePasswordForm.tsx`, montado desde `uis/backoffice/app/(auth)/account/profile/page.tsx` | Formulario de cambio de contraseña con validación, estados de envío/error y llamadas de autenticación. Solo es necesario en la pestaña «Cambiar contraseña», pero su import estático lo vinculaba al módulo de perfil. | `next/dynamic` con import explícito del export nombrado y fallback accesible `role="status"`. No se deshabilitó SSR: el módulo no lo necesita para inicializarse. El componente se renderiza al seleccionar la pestaña correspondiente. | Se difiere la dependencia del componente hasta que se usa la pestaña. El ahorro de bytes del chunk y la latencia de carga no se midieron. |
| `UserAdministration` | `uis/backoffice/components/UserAdministration.tsx`, montado desde `uis/backoffice/app/(auth)/account/profile/page.tsx` | Administración de usuarios (listado, creación, rol, eliminación y restablecimiento de contraseñas). Es un módulo relativamente amplio, solo útil en la pestaña de administración y solo disponible para admins. | `next/dynamic` con import explícito y fallback accesible `role="status"`. Se conserva la condición `user?.role === "admin"`; el lazy loading no se considera un control de autorización. La autorización de API sigue siendo necesaria. | Evita requerir el módulo antes de abrir la pestaña. La solicitud de datos ya estaba asociada al montaje del componente y continúa realizándose cuando se muestra. No hay medición de chunk ni de tiempo ahorrado. |

No se añadió otro `dynamic` para `IncidentsAnalyzerPanel`: está en la ruta independiente `/incidents/analyzer`, que Next.js ya puede dividir por ruta. No había evidencia de una ganancia incremental dentro de esa página.

### 2.2 Memoización con `useMemo`

- **Componente:** `ManagedInventory`, `uis/backoffice/components/ManagedInventory.tsx`.
- **Cálculo:** filtrado de inventario según oficina, categoría, alertas de reorden y búsqueda localizada sobre varios campos; la derivación también produce el total de alertas de los resultados visibles.
- **Por qué no es trivial:** recorre la colección y compara texto normalizado en cada render; es trabajo proporcional a la cantidad de elementos. La cantidad de elementos de producción no se conoce, por lo que no se afirma que sea un cuello de botella demostrado.
- **Dependencias:** `[items, office, category, reorderOnly, term]`, donde `term` es la búsqueda normalizada que usa el filtro.
- **Razón para elegir `useMemo`:** reutilizar el resultado cuando los datos y filtros no cambian, evitando repetir recorrido y comparaciones durante renders por cambios de estado no relacionados. Se preservan criterios, orden, paginación y comportamiento funcional.
- **Beneficio:** esperado, no cuantificado. No se usó React Profiler ni datos de inventario representativos. La memoización no elimina el coste cuando cambia cualquiera de las dependencias y añade algo de complejidad.

### 2.3 Otras optimizaciones de frontend incluidas en el conjunto auditado

El trabajo frontend asociado al reto también incluye `font-display: "optional"` para las fuentes del sitio; extracción y reutilización de `SectionTitle` en cinco secciones; eliminación de la descarga global de Geist Mono en el backoffice a favor de la pila monospace del sistema; y retirada de un `aria-label` redundante del enlace de marca para que su nombre accesible derive del texto visible. El cambio de `aria-label` se realizó después de las capturas Lighthouse y no se volvió a medir.

## 3. Decisiones en el backend

### 3.1 Endpoints seleccionados

Los costes de abajo describen trabajo visible en el código, no perfiles cronometrados. La frecuencia no se observó en tráfico representativo: se indica expresamente como desconocida, con la hipótesis cualitativa que motivó la selección.

| Endpoint | Método | Coste de operación | Frecuencia de llamadas | Estabilidad de datos | TTL | Estrategia de invalidación |
| --- | --- | --- | --- | --- | --- | --- |
| `/reporting/weekly-office-program-performance` | GET | Resuelve la semana exitosa más reciente si no se especifica semana, valida el inicio de semana y consulta ejecución/filas persistidas para formar el reporte. En un hit se evita la lectura SQL de los datos del reporte y la reconstrucción de respuesta; la semana por defecto se sigue resolviendo por petición. Coste bajo–moderado inferido; no medido. | **Observada: desconocida.** Estimación cualitativa: una semana de reporte podría revisarse repetidamente; no hay datos de llamadas ni repetición de claves que prueben esa hipótesis. | Alta para una semana ya calculada, salvo una nueva ejecución exitosa del pipeline que reemplace sus resultados. | 300 s (5 min), expiración absoluta. | `POST /reporting/pipeline-runs` invalida la clave de esa semana solo tras el retorno exitoso de `run_pipeline`, cuyo commit ya terminó. Si falla la invalidación, el TTL limita la permanencia del valor en ese proceso. |
| `/telemetry/report` | GET | Ejecuta el reporte técnico `technical_report`, con agregaciones SQL agrupadas (conteos por tipo y mínimo/máximo temporal) sobre un intervalo opcional. Un hit evita esas agregaciones y la construcción repetida del reporte. Coste moderado inferido; no medido. | **Observada: desconocida.** Estimación cualitativa: paneles pueden volver a consultar rangos; no se midió refresco, repetición de rangos ni tráfico. | Variable: rangos abiertos o recientes cambian al llegar eventos; intervalos históricos cerrados tienden a ser más estables, bajo la suposición de que los eventos históricos no se modifican. | 15 s para rango abierto o reciente; 300 s para rango cerrado antiguo. | `inventory_v2` invalida el prefijo de reportes de telemetría después del commit exitoso de movimientos instrumentados y del rechazo de edición directa que haya persistido telemetría. Los adaptadores legacy de entrada/salida pasan por el movimiento canónico. |

La decisión de implementar estos dos endpoints siguió la estrategia aprobada, pero la implementación **no demuestra que la frecuencia sea suficiente**: la instrumentación disponible no llegó acompañada de datos de tráfico. Los TTL son valores iniciales conservadores, no el resultado de una calibración estadística.

### 3.2 Endpoints evaluados y no cacheados

- **`GET /inventory/items`:** devuelve inventario/stock derivado de movimientos. Se descartó por requisitos de frescura y por invalidaciones amplias ante cambios de stock y alertas.
- **Usuarios, perfiles y registros/candidaturas:** no se cachean por datos personales, posible alcance por usuario/rol, mutabilidad e invalidación compleja. Se evita riesgo de compartir respuestas entre identidades.
- **Resúmenes de incidencias:** se consideraron mutables y sensibles; sin frecuencia ni coste medidos, no se justificó añadir una política de cache.
- **Otros endpoints de escritura:** no se cachean.

### 3.3 Instrumentación de solicitudes

En `services/api/main.py` se añadió middleware que mide cada solicitud HTTP con `perf_counter()` y registra método, plantilla de ruta, estado HTTP y duración en milisegundos. No usa el path crudo como fallback para rutas no encontradas y no registra query string, cuerpo, headers, token, identificadores concretos ni texto de excepciones. Esta instrumentación permite alimentar una futura evaluación de latencia, pero no representa por sí sola un benchmark ni un agregado de frecuencia/hit ratio.

## 4. Arquitectura y comportamiento de la caché

La implementación está en `services/api/cache.py` y usa un helper `TTLCache` genérico, en memoria del proceso; no se añadió Redis u otro servicio externo.

- Máximo de 256 entradas, política LRU; vencimiento absoluto basado en `time.monotonic()` (los hits no extienden el TTL).
- `RLock` protege operaciones cortas del mapa. Se guardan y devuelven copias profundas para evitar que el consumidor mutile el valor almacenado.
- El contador de revisión global y `set_if_revision` evitan publicar el resultado de una lectura que empezó antes de una invalidación y terminó después.
- Las claves están versionadas y separadas por prefijo:
  - `reporting:weekly-performance:v1:{week_start ISO}`.
  - `telemetry:report:v1:{start UTC ISO o <open>}:{end UTC ISO o <open>}`.
- Los rangos de telemetría con offsets distintos que representan los mismos instantes se normalizan a UTC y comparten clave. Los parámetros inválidos conservan la validación/422 y no se guardan.
- Cuando no se especifica la semana, la API vuelve a resolver en SQL la semana exitosa más reciente por petición y luego consulta la clave concreta de esa semana; no mantiene una clave alias `latest`.
- La respuesta semanal se conserva como JSON ya validado para evitar perder precisión de valores `Decimal` durante serializaciones posteriores.
- Fallos en operaciones de cache son *fail-open*: se continúa con el origen. El fallo al invalidar no revierte la escritura confirmada. No hay stale-on-error.

Los TTL limitan la antigüedad potencial cuando no se completa una invalidación: hasta 5 minutos para la semana y hasta 15 segundos para telemetría reciente/abierta o 5 minutos para el intervalo histórico, en el proceso afectado. La invalidación exitosa debe adelantar ese límite.

## 5. Invalidación, consistencia y ciclo de vida

La caché semanal se invalida por la semana concreta solo después de que `run_pipeline` haya completado correctamente. La caché de telemetría se invalida por prefijo después de escrituras de telemetría que terminan correctamente; un barrido acotado del namespace evita tener que enumerar todas las claves/rangos afectados.

La caché es **local a cada proceso**, volátil y no distribuida. Se pierde al reiniciar. Distintos workers o réplicas pueden mantener copias diferentes y una invalidación realizada en uno no se propaga a los demás; los TTL solo acotan esa divergencia, no la eliminan inmediatamente. La configuración inspeccionada no declara explícitamente `--workers`, pero tampoco se confirmó la topología productiva. Antes de desplegar en una arquitectura multiworker/multiréplica debe elegirse almacenamiento compartido (por ejemplo, Redis) o aprobar de forma explícita la consistencia eventual. La implementación no afirma coherencia distribuida.

## 6. Seguridad y privacidad

- En telemetría, autenticación y autorización admin/manager ocurren antes de buscar en caché; se verifican en cada petición, incluso si el resultado ya existe.
- El reporte semanal conserva los requisitos de autenticación del endpoint. No se almacenan respuestas de autorización fallida, errores HTTP, sesiones de base de datos, tokens ni contenido personalizado por usuario.
- Las claves contienen exclusivamente dimensiones funcionales normalizadas (semana o límites temporales UTC), con prefijo/versionado. No contienen credenciales.
- No se añadió `Cache-Control: public`, caché CDN ni directiva para compartir reportes fuera de la API autorizada. Los agregados se tratan como información operativa restringida.
- El middleware de timing excluye query strings, valores del path y detalles de excepciones; evita registrar potenciales tokens, identificadores o datos sensibles.
- El lazy loading de `UserAdministration` no reemplaza autorización: tanto la condición visible en UI como los permisos backend deben permanecer.

## 7. Trade-offs y limitaciones

1. **Frescura frente a reducción de trabajo:** TTL corto en intervalos abiertos/recentes y TTL mayor para resultados semanales/históricos. Se priorizó no conservar indefinidamente agregados que pueden cambiar.
2. **Simplicidad frente a distribución:** la caché en proceso no introduce infraestructura ni dependencia operativa, pero no comparte contenido ni invalidaciones entre procesos.
3. **Coste de la propia caché:** copias profundas, lock, expulsión LRU y normalización aportan trabajo y complejidad. Se espera que el ahorro de consultas repetidas lo compense en hits; no se midió.
4. **Invalidación ante fallos:** el comportamiento abierto preserva disponibilidad cuando la caché falla. Si falla la invalidación después de un commit, puede mostrarse un valor previo hasta su expiración local.
5. **Picos de expiración:** al vencer una entrada, las solicitudes posteriores vuelven al origen. No se implementaron stale-while-revalidate ni coalescencia de cargas concurrentes.
6. **Evidencia insuficiente para calibrar:** se desconocen la frecuencia real, hit ratio, tamaño de datos de producción, latencia p50/p95, throughput y topología desplegada. No hay prueba de carga o benchmark backend.
7. **Frontend no perfilado:** no se comparó tamaño de chunks ni se utilizó React Profiler; el ahorro de lazy loading y `useMemo` es esperado, no medido.

## 8. Pruebas y validación

### Backend

La suite enfocada ejecutada desde `services/api` fue:

```bash
uv run --no-sync pytest -q \
  tests/test_hito6_reports.py \
  tests/test_user_roles_telemetry.py \
  tests/test_inventory_v2_api.py \
  tests/test_request_timing.py \
  tests/test_smoke.py
```

**Resultado: 27 passed**, con una advertencia deprecada de Starlette/httpx relacionada con `TestClient`. Las pruebas cubren hits/misses; invalidación y refresco; equivalencia de zonas horarias; claves distintas por intervalos; autorización antes del cache; copias defensivas; límite LRU; expiración; carrera entre carga e invalidación; fallback a origen ante errores de cache; hit semanal que evita consulta SQL; integración con escrituras, middleware y smoke tests. `git diff --check` pasó y Pylance no reportó errores en los archivos Python modificados.

### Frontend

La validación registrada para los cambios de optimización en el backoffice fue: **24 archivos de test y 91 pruebas Vitest pasaron**; `npx tsc --noEmit`, build de producción y ESLint focalizado de archivos modificados pasaron. El lint global no pasó debido a dos errores `react-hooks/set-state-in-effect` en `components/AuthenticatedNavigation.tsx:92` y `lib/auth-context.tsx:70`, archivos ajenos a esos cambios. El build advirtió de lockfiles en raíz y backoffice. No se hizo comparación de chunks ni profiling. Los resultados históricos de `TESTING.md` (73 passed, 6 xfailed, entre otros) corresponden a otra ejecución y no se deben confundir con la validación específica del cambio.

### Lighthouse

Las seis vistas se midieron una vez antes y una vez después, el **27-10-2026**, con Lighthouse 13.5.0 y Chrome 156. Son capturas puntuales, no medianas, y miden el conjunto de cambios frontend: no son una medición del cache backend ni una atribución causal aislada.

| Vista | Performance inicial → final | LCP inicial → final | CLS inicial → final | TBT inicial → final | TTFB inicial → final |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sitio, inicio, escritorio | 75 → 100* | 612 → 596 ms | 1.000 → 0.000 | 0 → 0 ms | 318 → 417 ms |
| Sitio, inicio, móvil | 86 → 100* | 2,097 → 2,013 ms | 0.198 → 0.000 | 112 → 87 ms | 673 → 182 ms |
| Backoffice, inicio, escritorio | 99 → 99 | 646 → 585 ms | 0.000 → 0.000 | 0 → 0 ms | 601 → 596 ms |
| Backoffice, inicio, móvil | 99 → 99 | 2,196 → 1,982 ms | 0.000 → 0.000 | 25 → 15 ms | 185 → 357 ms |
| Backoffice, incidencias, escritorio | 100 → 100 | 641 → 619 ms | 0.030 → 0.030 | 0 → 0 ms | 198 → 186 ms |
| Backoffice, incidencias, móvil | 98 → 98 | 2,322 → 2,292 ms | 0.000 → 0.000 | 82 → 42 ms | 326 → 315 ms |

\* Las capturas muestran Performance 100 para las vistas del sitio, mientras los informes HTML guardan 99. La tabla conserva la puntuación de las capturas y las métricas detalladas de los HTML; no se puede demostrar que captura e informe correspondan a la misma ejecución. El cambio posterior de `aria-label` no se volvió a medir.

Accessibility y Best Practices permanecieron en 100; SEO fue 60 en las seis vistas. La variación de TTFB es ruidosa y no se atribuye a cambios frontend. Estas ejecuciones no miden INP de usuarios reales.

### Resultado medido frente a esperado

- **Medido:** cambios de CLS/LCP/TBT de las ejecuciones Lighthouse indicadas y resultados de tests/build/type/lint descritos arriba.
- **Esperado pero no medido:** ahorro de transferencia inicial por imports diferidos; menos cálculos repetidos de inventario; reducción de agregaciones/serialización SQL en hits de los dos reportes.
- **No medido:** latencia backend antes/después, hit ratio, frecuencia por clave, throughput, beneficio de producción, p50/p95, consumo de memoria comparativo, tamaño de chunks y efecto causal de cada cambio.

Un test prueba que un hit semanal evita una consulta SQL de los datos del reporte; no demuestra una mejora de latencia bajo carga real.

## 9. Archivos y trazabilidad

- Auditoría inicial y resultados Lighthouse: [`AUDIT.md`](AUDIT.md), [`audit/before/`](audit/before/) y [`audit/after/`](audit/after/).
- Auditoría detallada por fases, decisiones frontend/backend, estrategia y limitaciones: [`docs/caching-audit.md`](docs/caching-audit.md).
- Instrumentación de timing: `services/api/main.py`; prueba: `services/api/tests/test_request_timing.py`.
- Helper y prefijos: `services/api/cache.py`.
- Integraciones de endpoints: `services/reporting/router.py`, `services/telemetry/router.py`.
- Invalidación por escritura: `services/api/routers/inventory_v2.py` y captura de eventos en `services/telemetry/capture.py`.
- Pruebas del cache/reportes: `services/api/tests/test_hito6_reports.py`, más pruebas relacionadas de roles, inventario, timing y smoke.
- Lazy loading: `uis/backoffice/app/(auth)/account/profile/page.tsx`; componentes `uis/backoffice/components/ChangePasswordForm.tsx` y `UserAdministration.tsx`; prueba `uis/backoffice/app/(auth)/account/profile/__tests__/page.test.tsx`.
- Memoización: `uis/backoffice/components/ManagedInventory.tsx` y `uis/backoffice/components/__tests__/inventoryProtectedRoutes.test.tsx`.
- Informe complementario de Lighthouse: [`REPORT.md`](REPORT.md); resultados históricos de pruebas generales: [`TESTING.md`](TESTING.md).

## 10. Conclusión y siguientes pasos

El cambio entrega una caché TTL acotada e invalidable para el reporte semanal y el reporte técnico de telemetría, manteniendo controles de acceso y fallback al origen; complementa ese trabajo con optimizaciones frontend y medición segura de duración HTTP. La batería backend focalizada pasó (27 pruebas) y la validación frontend registrada pasó en Vitest, TypeScript, build y lint focalizado.

No hay evidencia suficiente para afirmar que el reto haya reducido la latencia backend o que ambos endpoints tengan frecuencia de repetición que justifique el cache en producción. Tampoco se debe tratar Lighthouse como evidencia del efecto del cache. Antes de considerar una mejora backend comprobada se recomienda: (1) recopilar logs agregados/APM en una ventana representativa y obtener frecuencia, repetición de claves y p50/p95; (2) medir hit/miss/evicción sin registrar datos sensibles; (3) ejecutar benchmark reproducible con base y volumen representativos; (4) confirmar cantidad de procesos/réplicas y política de consistencia; y (5) reevaluar TTL e invalidaciones con los datos observados. Si el despliegue es multiworker y necesita invalidación inmediata, migrar a un backend compartido antes de depender de la caché local.

No se realizaron commits ni pushes como parte de la elaboración de este informe.
