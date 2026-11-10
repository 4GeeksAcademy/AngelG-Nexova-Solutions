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

### 2. Ausencia de `services.api.models` en las pruebas de proveedores

**Estado:** resuelto en el árbol de trabajo; pendiente de aprobación. Sin commit ni push.

**Causa e investigación:**

- `services/api/tests/test_models.py` importaba `SupplierDict`, `SupplierCreate`, `RateUpdate`, `StatusUpdate`, `SupplierResponse`, `VALID_CATEGORIES`, `VALID_STATUSES` y `COUNTRY_CURRENCY_MAP` desde `services.api.models`.
- `services/api/models.py` no existía en `HEAD`. Git muestra que el archivo borrado en `c703576` no era un módulo Pydantic de proveedores, sino los modelos SQLModel legacy `Asset`, `AssetEntry` y `AssetExit`. El inventario actual está consolidado en `services/api/inventory_models.py`; traer de vuelta el antiguo `models.py` no restauraría los modelos solicitados y arriesgaría reintroducir tablas ya sustituidas.
- La implementación histórica de Supplier (visible en `e18ce79`) tenía `SupplierDict` y las constantes indicadas. La misma implementación ya definía `SupplierCreate`, respuestas y updates; el esquema actual `services/api/supplier_schemas.py` es el contrato canónico empleado por `routes/suppliers.py`, `seed.py` y los tests de proveedor.
- La configuración relevante es `services/api/pyproject.toml` (`testpaths = ["tests"]`). El `conftest.py` agrega el root de API al `sys.path` y carga la app, pero no crea el módulo faltante. El `pyproject.toml` raíz también apunta a `services/api/tests`; no se resolvía cambiando configuración de pytest.

**Decisión arquitectónica:** migrar el test al módulo canónico `supplier_schemas.py` y completar allí el contrato público que faltaba, sin recrear `models.py`, aliases duplicados ni modelos SQLAlchemy/SQLModel. `SupplierDict` ahora deriva del esquema de creación, añade el timestamp de storage y normaliza moneda de acuerdo con el contrato histórico. `SupplierCreate` permanece estricto con moneda/país, tal y como espera la API de ejecución. No se cambió ningún consumidor de runtime.

**Archivos modificados:**

- `services/api/supplier_schemas.py`: constantes derivadas de los tipos/reglas canónicos; validaciones de país, categoría y estado con mensajes compatibles; `SupplierDict` con `updated_at` automático y fecha ISO `YYYY-MM-DD`; verificación estricta de moneda para request/API.
- `services/api/tests/test_models.py`: importa el esquema actual, no el inexistente `services.api.models`; conserva cobertura y alinea la expectativa de moneda para `SupplierCreate` con la API activa (moneda discordante rechazada). La expectativa de normalización queda en `SupplierDict`.
- `docs/caching-pending-issues.md`: este registro.

**Símbolos migrados/recuperados:** `SupplierDict` se recuperó como esquema específico de almacenamiento; `SupplierCreate`, `SupplierResponse`, `RateUpdate` y `StatusUpdate` siguen siendo los esquemas canónicos actuales. `VALID_CATEGORIES`, `VALID_STATUSES` y `COUNTRY_CURRENCY_MAP` se exponen desde `supplier_schemas.py`. `SupplierUpdate` no fue importado por el test ni tiene un endpoint genérico actual, por lo que no se restauró.

**Validaciones preservadas:** nombre requerido/no vacío; categorías conocidas y mínimo una; países Spain/USA; estado active/suspended; rate finito y > 0; fechas de renovación exactamente `YYYY-MM-DD`; campos y tipos de Pydantic; moneda compatible con país. La respuesta API conserva sus campos, fechas tipadas y timestamp. Los consumidores `routes/suppliers.py`, `seed.py` y tests siguen usando los mismos esquemas actuales.

**Pruebas ejecutadas:**

- Primero: `python -m pytest --collect-only -q services/api/tests/test_models.py`: 39 pruebas recolectadas; importación exitosa.
- `python -m pytest -q services/api/tests/test_models.py`: 39 passed (antes del ajuste final de validación exacta de fecha).
- `python -m pytest -q services/api/tests/test_models.py services/api/tests/test_seed.py services/api/tests/test_api.py`: 91 passed, 1 warning.
- Suite backend completa `services/api/.venv/bin/python -m pytest -q`: **248 passed, 6 xfailed, 1 warning**.
- Warning pendiente: Starlette avisa de la deprecación de usar `httpx` con `starlette.testclient` y sugiere `httpx2`; no se ocultó ni se alteraron dependencias.

**Errores pendientes:** no quedaron fallos inesperados en la suite backend ejecutada. Permanecen 6 pruebas `xfail` intencionales y la advertencia deprecada anterior. La antigua colisión de tablas por volver a importar `services.api.models` se evita al no resucitar ese módulo; el inventario actual sigue siendo `inventory_models.py`.

### 3. Error ESLint `react-hooks/set-state-in-effect` al inicializar el tema

**Estado:** corregido en el árbol de trabajo para el tema; pendiente de aprobación. Sin commit ni push.

**Causa:** `AuthenticatedNavigation` mantenía estado React `darkMode` inicializado siempre como claro, y en un efecto posterior leía `localStorage`/`matchMedia`, cambiaba la clase global y llamaba `setDarkMode`. Además de infringir `react-hooks/set-state-in-effect`, las preferencias solo se aplicaban después de hidratar y podían producir un flash claro. La preferencia del sistema tampoco se observaba si cambiaba mientras la aplicación estaba abierta.

**Decisión:** mantener `localStorage["theme"]` como preferencia manual (`dark` o `light`) y usar la preferencia del sistema solo cuando no hay elección guardada. `lib/theme-store.ts` concentra lectura, persistencia, sincronización de la clase `html.dark` y suscripciones. `AuthenticatedNavigation` consume el snapshot mediante `useSyncExternalStore`, con snapshot servidor determinista claro; no duplica la fuente de verdad en `useState`. Un script Next `beforeInteractive` en el root layout aplica la clase correcta antes del pintado. `suppressHydrationWarning` se limita al `<html>` porque el script modifica intencionalmente su clase antes de la hidratación; el markup React del botón conserva el mismo snapshot inicial y se actualiza desde la suscripción.

Se conservan el botón flotante/persistente de navegación, etiquetas y estado accesibles (`aria-label`, `title`, `aria-pressed`), alternancia manual y estilos Tailwind/CSS basados en `.dark`. Se añade además seguimiento de cambios de `prefers-color-scheme` solo mientras no exista preferencia almacenada, y sincronización de cambios de storage de otras pestañas.

**Pruebas añadidas:** preferencias guardadas y de sistema (ambos modos), cambios del sistema solo mientras no haya preferencia manual, persistencia tras remontar, alternancia con clase/ARIA e hidratación React de servidor a cliente con preferencia oscura sin warning de hidratación. En Vitest/jsdom se prueba el efecto de hidratación de React; el tiempo de ejecución del script `beforeInteractive` previo al primer pintado no es verificable por jsdom y requeriría una prueba E2E en navegador.

**Validación ejecutada en esta revisión:** ESLint focalizado en los cuatro archivos del tema pasó. Vitest focalizado en `AuthenticatedNavigation.theme.test.tsx` y `rootNavigation.test.tsx`: **2 archivos, 10 pruebas pasaron**. Suite Vitest completa: **25 archivos, 98 pruebas pasaron**. `npx tsc --noEmit` terminó sin errores. El lint global sigue fallando solo por el error distinto de auth descrito a continuación (`auth-context.tsx:70`); no hay ya diagnóstico del tema. Vite emite una advertencia informativa de que `vite-tsconfig-paths` podría reemplazarse por soporte nativo de rutas; no afecta a las pruebas.

**Archivos:** `uis/backoffice/app/layout.tsx`, `uis/backoffice/components/AuthenticatedNavigation.tsx`, `uis/backoffice/lib/theme-store.ts`, `uis/backoffice/components/__tests__/AuthenticatedNavigation.theme.test.tsx` y este informe.

### 4. Error ESLint `react-hooks/set-state-in-effect` en inicialización de auth

**Estado:** lint global falla en un efecto de inicialización de auth.

| Archivo y línea | Operación | Contexto y riesgo |
| --- | --- | --- |
| `uis/backoffice/lib/auth-context.tsx:70` | `setIsReady(true)` | En ausencia de token, el efecto marca listo inmediatamente para liberar navegación/UI. La rama con token hace la resolución asíncrona y también marca listo al terminar. Cambiar solo la rama sin token puede mantener la aplicación en estado de carga o permitir renderizar contenido antes de verificar auth. |

El error de auth coincide con `HEAD` (sin cambios locales) y no fue introducido por la optimización de caching. No es un error de compilación: FASE 7 reportó TypeScript y build del backoffice correctos; el lint global no pasa. El error del tema quedó resuelto en el cambio propuesto de esta sección; el error restante está en auth.

**Alternativas para resolver posteriormente:**

- Para auth, modelar explícitamente estados de inicialización (p. ej., `checking`/`ready`) y verificar que el flujo sin token, con token válido y con token inválido termina siempre correctamente. Una inicialización externa/hidratación-safe puede evitar la transición síncrona en el efecto; no usar temporizadores ni desactivar la regla como atajo.
- Resolver el flujo auth con pruebas de inicialización y volver a ejecutar lint global, tests, TypeScript y build.

**Nota:** la ejecución actual de ESLint global encontró solo este error de auth; no se amplía el alcance de esta tarea para modificarlo.

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

## Resultado de FASE 9

**Corte de validación:** HEAD `2e4a04e` (`feature/caching-optimisation`); sin commit ni push durante esta validación. Se conservaron los cambios locales existentes. La clasificación indica el resultado de la corrección y de las verificaciones realizadas, no sustituye las limitaciones anotadas abajo.

| Incidencia / requisito de FASE 9 | Estado | Evidencia | Observaciones |
| --- | --- | --- | --- |
| Conflicto por SKU duplicado conserva rollback y devuelve el 409 esperado | RESUELTO | `test_duplicate_product_sku_rolls_back_and_api_remains_usable`: 1 passed; suite backend completa: 248 passed, 6 xfailed | Se verificó con SQLite. No se ejecutó contra PostgreSQL real; la detección PostgreSQL se basa en los nombres de índice/constraint conocidos. |
| Colección de tests de proveedores y contrato de esquemas activos | RESUELTO | Suite backend completa: 248 passed, 6 xfailed; `test_models.py` recolecta y ejecuta contra `supplier_schemas.py` | Se mantiene `supplier_schemas.py` como contrato canónico; no se recreó `services.api.models`. |
| Inicialización del tema y diagnóstico ESLint del tema | RESUELTO | Suite backoffice: 25 archivos / 98 pruebas passed; TypeScript y build passed; ESLint focalizado en los archivos del tema passed | La hidratación se probó con React/jsdom. El comportamiento del script `beforeInteractive` antes del primer pintado requiere E2E en navegador y no se verificó aquí. |
| Inicialización de auth y lint global del backoffice | PENDIENTE | `npm run lint` señala `uis/backoffice/lib/auth-context.tsx:70` (`react-hooks/set-state-in-effect`); el archivo no fue modificado | Se encontraron tests de provider/guard, rutas protegidas y manejo de 401 en utilidades, pero no se verificó específicamente el ciclo completo de inicialización sin token, token válido/inválido y fallo de red. No se amplió el alcance para corregir auth. |
| Preservación de las funcionalidades de caching/timing examinadas | RESUELTO | TTLCache, RequestTimingMiddleware, invalidación, `useMemo`, lazy loading y artefactos de auditoría siguen presentes; `test_hito6_reports.py` + `test_request_timing.py`: 15 passed | Esta comprobación confirma presencia y regresión focalizada, no demuestra mejora de rendimiento mediante benchmark. |

### Validación consolidada

- **Backend:** suite completa **248 passed, 6 xfailed, 1 warning**. Las pruebas de caché/reporting/timing ejecutadas por separado: **15 passed, 1 warning**. La advertencia es la deprecación de Starlette sobre `httpx` en `starlette.testclient`.
- **Backoffice:** Vitest **25 archivos / 98 pruebas passed**; TypeScript passed; build de producción passed; lint focalizado del tema passed. El lint global no pasa por el diagnóstico preexistente de auth indicado en la tabla. El build informó del aviso de raíz de workspace/múltiples lockfiles, pero terminó correctamente; Vitest mostró además una nota informativa de `vite-tsconfig-paths`.
- **Website:** TypeScript, ESLint y build de producción passed.
- **Cobertura no realizada:** PostgreSQL real, E2E en navegador del prepaint del tema y flujo integral de inicialización de auth. Tampoco se ejecutó benchmark de rendimiento; las pruebas de caché/timing verifican comportamiento, no cuantifican mejora.

### Estado Git y preparación

Al cierre, `git status --short --untracked-files=all` muestra siete rutas relacionadas con esta revisión: cinco modificadas (`docs/caching-pending-issues.md`, `services/api/supplier_schemas.py`, `services/api/tests/test_models.py`, `uis/backoffice/app/layout.tsx` y `uis/backoffice/components/AuthenticatedNavigation.tsx`) y dos no rastreadas (`uis/backoffice/components/__tests__/AuthenticatedNavigation.theme.test.tsx` y `uis/backoffice/lib/theme-store.ts`). El helper de SKU está en HEAD `2e4a04e`; no es una modificación local pendiente. No se hicieron commits, pushes ni limpiezas del árbol.

**Evaluación:** las correcciones SKU, esquemas de proveedores y tema pasan sus verificaciones disponibles, y las pruebas backend/frontend principales y los builds concluyen correctamente. Sin embargo, no se puede declarar FASE 9 completamente cerrada ni recomendar iniciar FASE 10 todavía: el lint global del backoffice continúa fallando por auth y faltan las verificaciones de auth indicadas. Se espera aprobación antes de iniciar FASE 10; no se hicieron cambios automáticos de código para resolver el pendiente de auth.

### Investigación del flujo de autenticación — PROMPT 9.6.1

**Alcance de esta intervención:** investigación y documentación solamente. No se modificaron código, pruebas ni configuración; no se ejecutaron cambios de backend ni de caching. El árbol ya tenía cambios locales en los archivos del tema/proveedores y en este informe; se conservaron.

#### Arquitectura actual

- `AuthProvider` está en `uis/backoffice/app/layout.tsx` y envuelve la navegación y el contenido de todas las rutas. Mantiene `user` y `isReady` con estado React. El estado inicial, tanto al renderizar en servidor como al hidratar, es `user = null`, `isReady = false`.
- En un efecto de montaje se lee `localStorage["token"]`. Si no hay token, el efecto llama inmediatamente a `setIsReady(true)` y termina. Ese `setState` síncrono dentro del efecto es la causa directa del diagnóstico `react-hooks/set-state-in-effect` en `uis/backoffice/lib/auth-context.tsx:70`.
- Si hay token, un `useRef` (`fetchedMe`) evita iniciar más de una consulta desde la instancia del provider. `getMe()` llama a `authRequest("/auth/me")`; ante éxito, el provider adapta y guarda el usuario, ante error elimina el token, y en `finally` marca `isReady=true`.
- Los dos clientes HTTP (`lib/api-client.ts` y `lib/api.ts`) leen el mismo token de `localStorage` a través de `getToken()`, agregan `Authorization: Bearer …`, y usan `cache: "no-store"`. Ambos borran el token ante 401 y llaman a un callback global opcional registrado por el provider. El cliente `api-client` traduce error de red en un `Error` legible y el HTTP no exitoso en `ApiRequestError`; el cliente `api` tiene comportamiento paralelo para sus endpoints.
- `login()` llama a `loginRequest()`, guarda el access token, consulta `getMe()` y sólo entonces establece `user`. Si `getMe()` falla, elimina el token y propaga un error. La pantalla de login redirige al inicio después del `await login()`; también reacciona a `isAuthenticated`. Registro crea la cuenta y después navega a `/login`, sin login automático.
- `logout()` borra el token, limpia `user` y navega a `/login`. El callback común de 401 hace lo mismo. El `ProtectedRoute` muestra carga mientras `isReady=false`, redirige con `router.replace("/login")` cuando está listo y no autenticado, y sólo renderiza hijos cuando está autenticado. El layout del grupo `(auth)` envuelve sus páginas con ese guard. La navegación espera `isReady` para mostrar controles de usuario.
- Los consumidores runtime de `isReady` son `ProtectedRoute` y `AuthenticatedNavigation`. `login` y `register` usan `isAuthenticated` para redirección; otras vistas consumen `user`, perfil, actualización de nombre o logout. El provider de root es el único que registra los callbacks globales de 401.
- `AuthProvider` es un Client Component bajo el layout raíz. La decisión de sesión se produce en cliente porque `localStorage` no existe en SSR; la respuesta inicial del servidor e hidratación es el estado no autenticado/no listo y el guard oculta el contenido protegido.

#### Escenarios

| Escenario | Estado inicial y operaciones | Estado final y navegación esperados | Riesgos observados |
| --- | --- | --- | --- |
| 1. Sin token | `user=null`, `isReady=false`; el efecto lee storage y ejecuta `setIsReady(true)` | `user=null`, listo; el guard reemplaza la ruta protegida por `/login`; rutas públicas quedan accesibles | La transición síncrona causa el lint. Si se cambia sin rediseñar readiness, se puede quedar cargando o revelar contenido. |
| 2. Token válido | `user=null`, no listo; `getMe()` envía Bearer y obtiene perfil | Guarda usuario y marca listo; el guard permite acceso; login/register si fueran visitados redirigen al inicio | No se conserva un estado de sesión previa en memoria a través de una recarga; hay una fase de carga intencional. El payload de `getMe()` se asume conforme al tipo y no se valida en runtime. |
| 3. Token inválido | Se consulta `/auth/me`; ante 401, `authRequest` borra token y notifica callback, y la promesa rechaza | El `catch` también borra token; `finally` marca listo; callback intenta `router.push("/login")` y el guard también `replace` | Dos caminos de redirección (push del callback y replace del guard), posible duplicación/no determinismo y manejo redundante. La petición inicial puede recibir el callback antes de que se complete la inicialización del efecto que registra handlers (efectos pasivos en orden del árbol normalmente corren de hijos a padres). |
| 4. Token expira con 401 en una petición posterior | El helper borra token y llama callback global si ya se registró; el callback borra token/usuario y hace push a login | El guard observa `isAuthenticated=false` si el provider renderiza y reemplaza a login; no se debe permitir contenido protegido después del 401 | Doble navegación push + replace. La callback se registra en otro efecto y puede no estar todavía disponible durante una carrera temprana; el guard sólo da cobertura a rutas que efectivamente están envueltas. |
| 5. Error de conexión durante `getMe()` | Se rechaza `fetch`; `catch` genérico borra el token indistintamente de un error de red; `finally` marca listo | Sesión no autenticada y ruta protegida a login | Se pierde un token potencialmente válido por indisponibilidad temporal y se confunden error transitorio y credenciales inválidas; no se muestra feedback específico al usuario durante la inicialización. |
| 6. Respuesta inesperada del backend | `authRequest` parsea JSON y tipa mediante aserción, no validación runtime; shape incompleto/mal formado puede no lanzar o puede lanzar al acceder a campos | Puede almacenarse un `user` parcial o una excepción ser absorbida por `catch`, con borrado del token y finalización | Se confunde fallo de protocolo/servidor con token inválido; un JSON inesperado puede causar estado incoherente. La ruta de éxito tampoco comprueba que los campos esenciales estén presentes. |
| 7. Montaje/desmontaje del provider | El `useEffect` arranca `getMe`; no hay `AbortController` ni bandera `disposed`. El segundo efecto instala y elimina callbacks globales | En montaje normal finaliza en listo; en desmontaje, la petición continúa y el `finally`/`then` aún intentaría actualizar el estado del provider desmontado | Riesgo de efectos obsoletos/actualización tras desmontaje y de callbacks globales sobrescritos o limpiados si hubiera providers solapados. React moderno puede no reportar warning, pero el control de ciclo de vida sigue sin ser explícito. |
| 8. React Strict Mode | En desarrollo, Strict Mode monta, ejecuta efectos, limpia y vuelve a ejecutar efectos para detectar efectos no idempotentes. `fetchedMe` es ref local de instancia | En la primera instancia se podría empezar una solicitud y en la instancia recreada iniciar otra; el segundo ciclo debería acabar en el estado correcto, pero no se garantiza cancelar la primera | La ref sólo deduplica dentro de una instancia y no impide la repetición simulada de montaje. La primera petición puede quedar sin dueño y callbacks globales pueden instalarse/limpiarse en ciclos consecutivos. Necesita prueba bajo `<StrictMode>`. |

#### Diagnóstico, alternativa y plan de implementación

**Causa exacta:** la rama de ausencia de token hace `setIsReady(true)` en el mismo turno síncrono del efecto pasivo. React recomienda derivar la salida del render cuando sea posible o completar asincrónicamente la inicialización; ESLint detecta esta actualización inmediata que provoca render adicional. El problema no es `useMemo`, ni la lectura de storage por sí misma, ni el efecto asíncrono para validar token.

**Problemas a resolver conjuntamente:** readiness tiene que representar una decisión terminada, no sólo “ya se ejecutó el efecto”; los errores de red no deberían invalidar credenciales automáticamente sin una decisión explícita de producto; 401 durante boot puede disparar tanto callback como guard; `getMe()` no valida la forma de respuesta; no hay cancelación/ignorancia de resultado al desmontar; `fetchedMe` no proporciona deduplicación robusta en Strict Mode y no protege contra cambios de token mientras la petición está pendiente.

**Alternativa recomendada:** reemplazar los dos booleanos implícitos por una pequeña máquina de estados tipada en `AuthProvider`, conceptualmente `initializing | anonymous | authenticated | error/retryable`. `isReady` se conserva como compatibilidad derivada (`status !== "initializing"`) y `isAuthenticated` se deriva de `status === "authenticated"` con usuario presente. Mantener el estado inicial neutral idéntico en SSR/hidratación; iniciar una única operación de bootstrap coordinada fuera de la lógica de render y hacer que el efecto sólo la suscriba/consuma, con cancelación lógica o `AbortController` donde sea viable. Ninguna transición de inicialización debe conceder acceso: `ProtectedRoute` sigue mostrando carga hasta que el resultado final sea anonymous o authenticated.

La política por resultado debe distinguir: ausencia de token => anonymous sin petición; éxito válido de `/auth/me` => authenticated; 401 => borrar token y anonymous, con un solo dueño de la redirección (preferiblemente el guard al observar el estado); error de red/5xx => error recuperable, conservar token pero no renderizar contenido protegido y ofrecer reintento/feedback, salvo que producto defina otra política; respuesta inválida => error de protocolo recuperable y fail-closed. Login sólo pasa a authenticated después de verificar usuario; fallo de `getMe()` tras login conserva la política actual de no dejar token no validado y no navega. Logout y 401 usan una transición común a anonymous y limpieza coherente.

Una máquina de estados **no elimina por sí sola** el `setState` síncrono si se sigue invocando desde el efecto; debe implementarse como inicialización realmente asíncrona/cancelable o como snapshot externo con API estable. No se recomienda derivar el estado inicial directamente de `localStorage`: `AuthProvider` participa en SSR, acceso a storage durante render no es seguro y un snapshot distinto entre servidor y cliente puede romper hidratación o permitir un frame incorrecto. `useSyncExternalStore` encajaría sólo si se adopta un store compartido auténtico para toda la sesión, con snapshot de servidor neutral y suscripción estable; para el provider actual añade complejidad de ownership, serialización y callbacks sin una necesidad actual. Recomendación concreta: conservar React Context como interfaz pública y crear un bootstrap de sesión deduplicado/cancelable con resultado tipado; no introducir un store global ni dependencias nuevas salvo que la implementación pruebe que son necesarias.

**Archivos previstos para una implementación aprobada:**

- `uis/backoffice/lib/auth-context.tsx`: estado/transiciones, bootstrap, registro/limpieza de callback y unificación de login/logout/401.
- `uis/backoffice/lib/api-client.ts` y `uis/backoffice/lib/api.ts`: sólo si el diseño centraliza o estandariza el resultado 401/cancelación; evitar dos callbacks divergentes.
- `uis/backoffice/components/ProtectedRoute.tsx`: mantener el fail-closed y contemplar estado recuperable/reintento sin dejar montar hijos.
- `uis/backoffice/app/login/page.tsx` (y quizá `register/page.tsx`): verificar redirecciones con estados de inicialización y sesión recuperable.
- Tests nuevos de `AuthProvider` y de integración del guard; actualizar mocks existentes de `useAuth` sólo si cambia la interfaz observable. Sin cambios a la configuración ESLint, backend o caching.

**Pruebas necesarias antes de cerrar:**

1. Provider con storage vacío: se vuelve anonymous/listo, una sola transición; nunca muestra hijos protegidos antes de la decisión.
2. Token válido: una llamada a `getMe`, usuario/rol/nombre esperados y acceso después de validación.
3. Token inválido/401 en bootstrap: token eliminado, estado anonymous, redirección exactamente una vez.
4. 401 posterior a inicialización desde ambos clientes HTTP: callback/estado/logout coherentes y sin doble navegación.
5. Error de red y 5xx: estado recuperable explícito, política de token verificada, guard fail-closed y reintento que puede recuperar sesión.
6. Respuesta JSON inválida o campos requeridos ausentes: no authenticated, sin usuario parcial ni contenido protegido.
7. Login exitoso y fallido, fallo de `getMe()` después del login, registro, logout manual, actualización de nombre y expiración durante petición.
8. Montaje/desmontaje con promesa pendiente: no hay actualización efectiva del provider desmontado; callbacks no sobreviven al cleanup.
9. `<React.StrictMode>`: llamadas/redirecciones sin duplicación observable y estado final determinista.
10. SSR y `hydrateRoot`: markup inicial neutral igual en servidor/cliente, sin warnings; verificar que la ruta protegida no aparece antes del bootstrap.
11. Regresión: suite completa Vitest, TypeScript, ESLint global y build de producción del backoffice; conservar tests del website y backend como controles sin tocar sus archivos.

**Riesgos de regresión:** cambio accidental de cuándo `isReady` pasa a true podría mostrar o bloquear rutas; un error de red tratado como anonymous puede destruir una sesión válida; conservar el token ante 401 es inseguro; callbacks de dos clientes pueden duplicar logout; manejo de reintento puede crear ciclos; diferir bootstrap puede dejar pantallas públicas con UX inesperada; incompatibilidad SSR/hidratación si el snapshot inicial lee storage; Strict Mode puede duplicar fetches sin deduplicación compartida; cambios en interfaz del contexto pueden romper componentes/test mocks.

**Recomendación de aprobación:** aprobar primero la política de sesión ante error de conexión/5xx (conservar token y permitir reintento es la propuesta), la presentación del estado de error y si se acepta separar la operación de bootstrap en un módulo pequeño junto al provider. No se implementó nada en esta fase. Se espera aprobación explícita antes de modificar archivos de código o pruebas.

### Resultado de FASE 9.6.2 — Implementación del flujo de autenticación

**Estado: IMPLEMENTADO Y VALIDADO.** Esta sección actualiza el pendiente y la recomendación de aprobación que quedaron registrados en la investigación 9.6.1. La autorización recibida cubrió únicamente el flujo de autenticación; no se inició FASE 10.

#### Comportamiento implementado

- `AuthProvider` conserva la interfaz pública de Context (`user`, `isReady`, `isAuthenticated`, `login`, `register`, `logout`, `updateProfileName`) y añade el estado tipado `authState` y `retryAuthentication`. El estado inicial es neutral (`initializing`) para SSR/hidratación y `isReady`/`isAuthenticated` se derivan de la máquina de estados.
- Sin token, la sesión termina en `anonymous` sin consultar `/auth/me`. Con token, bootstrap valida el usuario y evita duplicar/aceptar operaciones obsoletas ante cambios de sesión. La forma del usuario se valida en runtime antes de autenticar.
- Un 401 elimina el token y lleva a `anonymous`. Los errores de red, 5xx o respuesta no válida conservan el token en estado `error`; el contenido protegido sigue bloqueado y se ofrece reintento explícito. Login sólo autentica después de validar el usuario. Logout limpia token y sesión.
- Los clientes HTTP comparten la invalidación 401, con protección contra callbacks obsoletos; la navegación queda a cargo del guard y no se duplica desde el callback. `ProtectedRoute` es fail-closed: muestra carga durante inicialización, presenta error/reintento ante error recuperable, redirige en `anonymous` y monta hijos sólo en sesión autenticada.
- Se añadieron pruebas de provider para escenarios de token, validación, error/reintento, logout, SSR/hidratación y Strict Mode, y se extendieron las pruebas del guard. Se conservan almacenamiento `localStorage["token"]`, rutas y contratos públicos existentes.

#### Archivos de la intervención

- `uis/backoffice/lib/auth-context.tsx`
- `uis/backoffice/lib/api-client.ts`
- `uis/backoffice/lib/api.ts`
- `uis/backoffice/components/ProtectedRoute.tsx`
- `uis/backoffice/lib/__tests__/auth-context.test.tsx` (nuevo)
- `uis/backoffice/components/__tests__/ProtectedRoute.test.tsx`
- `docs/caching-pending-issues.md`

El guard también conserva compatibilidad con consumidores/mocks antiguos que exponen sólo `isReady` e `isAuthenticated`, sin debilitar el estado tipado del provider real.

#### Validación final

- **Vitest completo (backoffice):** 26 archivos y **115 pruebas passed**.
- **TypeScript:** `npx tsc --noEmit` — passed.
- **ESLint global:** `npm run lint` — passed, sin diagnósticos.
- **Build de producción:** `npm run build` — passed; Next.js compiló y generó las 21 páginas estáticas. Permanecen avisos informativos de raíz de workspace/múltiples lockfiles; Vitest también presenta la nota informativa sobre `vite-tsconfig-paths`.
- SSR e hidratación se validaron mediante pruebas jsdom; no se ejecutó E2E en navegador.

**Evaluación:** el pendiente de lint y ciclo de autenticación identificado en 9.6.1 queda resuelto para el alcance solicitado. No se realizaron commits ni pushes y no se inició FASE 10; se requiere aprobación independiente para comenzar esa fase.
