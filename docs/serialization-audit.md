# Auditoría de serialización de la API

**Fecha de auditoría inicial:** 2026-10-28  
**Fecha de revisión de esta auditoría:** 2026-11-07
**Estado de revisión:** además de la revisión de serialización y la agregación de stock/proyección compacta, esta rama incluye cambios funcionales intencionados de administración/perfil y roles, y el endurecimiento solicitado de rutas legacy. Este documento separa esos alcances; no se afirman mejoras de latencia sin benchmark.
**Entry point principal:** `services/api/main.py`.

## Alcance y criterio

La tabla de estado original y el resumen de implementación abajo reflejan etapas previas; no deben confundirse con los resultados de la revisión actual. La aplicación principal registra usuarios, perfiles, auth, records, incidencias legacy, incidencias gestionadas, los routers de inventario legacy/canónico, proveedores, reporting y telemetry. `services/api/app/main.py` es una aplicación FastAPI separada y no se incluye en las operaciones del entrypoint principal. Las observaciones vigentes se consolidan en “Revisión actual”.

- ✅ **Serializado:** hay `response_model` explícito y la forma observada es apropiada para el consumidor.
- ⚠️ **Parcialmente serializado:** hay esquema de salida, pero la proyección observada incluye campos innecesarios o requiere revisión para el consumidor.
- ❌ **Sin serializar:** no hay `response_model` explícito. Que una función devuelva un dict cuidadosamente construido o que una respuesta tenga forma estable no sustituye un contrato de salida explícito.

Las respuestas exitosas actuales de los routers principales declaran modelos Pydantic o, para respuestas intencionalmente vacías, `response_model=None`. Auth/usuarios/perfiles/records/incidencias legacy/proveedores usan dicts o TinyDB; las superficies administradas de incidencias e inventario, y reporting, usan SQLModel/PostgreSQL en lectura o escritura con proyecciones explícitas. Declarar un modelo no acredita por sí solo que el endpoint haya sido ejecutado con datos reales.

## Revisión actual (2026-11-07; verificación reproducida)

### Conteo y clasificación

Se generó `GET /openapi.json` con el `TestClient` del entorno existente `services/api/.venv`, sin instalar dependencias ni iniciar un servidor. La aplicación principal publica **66 operaciones en 45 paths** (11 routers, `/` y `/health`). La aplicación CSV (`services/api/app/main.py`) es una app separada con **2 operaciones adicionales**; no se suma al OpenAPI principal. El antiguo conteo manual de 65 y la afirmación de que no se podía importar OpenAPI quedan supersedidos por esta comprobación.

Clasificación de serialización (alcance: contratos de salida publicados y estructura/proyección de código, no ejecución con datos reales de cada operación):

| Superficie | VALIDADO | PARCIALMENTE SERIALIZADO | SIN SERIALIZACIÓN ADECUADA | Total |
| --- | ---: | ---: | ---: | ---: |
| API principal | 65 | 1 | 0 | 66 |
| App CSV separada | 2 | 0 | 0 | 2 |
| **Total del servicio documentado** | **67** | **1** | **0** | **68** |

`VALIDADO` significa que OpenAPI publicó el esquema de éxito esperado o, para una operación sin cuerpo, el 204 vacío intencional; no significa que se haya ejecutado cada endpoint con todos sus escenarios de datos. `PARCIALMENTE SERIALIZADO` se reserva aquí para `GET /reporting/weekly-office-program-performance`: publica `WeeklyPerformanceResponse` pero retorna un `Response` JSON manual y por ello FastAPI no aplica la validación/filtrado runtime normal del `response_model`. No se encontró respuesta exitosa JSON sin contrato OpenAPI. El export CSV es `VALIDADO` como archivo `text/csv` binario, no como modelo Pydantic.

Proyecciones compactas del OpenAPI/modelos asociados: `CandidateListItemResponse` = `id,full_name,email,position,status,stage`; `IncidentListItemResponse` = `id,client_name,type,severity,responsible_area,title,description,status,assigned_to,sla_deadline`; `SupplierListResponse` = `id,name,country,categories,monthly_rate,currency,status`. Modelos de detalle correspondientes conservan los campos adicionales publicados por sus schemas (candidatura: teléfono, LinkedIn/CV, años de experiencia, conteo de notas y timestamps; incidencia: canal, fechas de resolución/cierre y archivado; proveedor: renovación, email/notas y `updated_at`).

### Inventario completo por endpoint

Cada fila representa un método/endpoint de OpenAPI. Los campos exactos se definen en el schema enlazado; `—` indica que no hay body de entrada o salida. Todos los 204 listados son intencionalmente sin cuerpo.

| Método y ruta | Schema de entrada | Salida/contrato de éxito | Estado | Notas de proyección/seguridad |
| --- | --- | --- | --- | --- |
| GET `/` | — | `RootResponse` | VALIDADO | mensaje de servicio |
| GET `/health` | — | `HealthResponse` | VALIDADO | estado de salud |
| POST `/auth/login` | `OAuth2PasswordRequestForm` | `TokenResponse` | VALIDADO | solo token de acceso y tipo |
| GET `/auth/me` | Bearer token | `CurrentUserResponse` | VALIDADO | id/email/rol y perfil; perfil incluye id/user_id |
| POST `/auth/forgot-password` | `ForgotPasswordRequest` | `MessageResponse` | VALIDADO | respuesta genérica, evita enumeración |
| POST `/auth/reset-password` | `ResetPasswordRequest` | `MessageResponse` | VALIDADO | token no se devuelve |
| POST `/auth/change-password` | `ChangePasswordRequest` | `MessageResponse` | VALIDADO | requiere autenticación; hashes excluidos |
| POST `/users` | `UserCreate` | `UserRegistrationResponse` | VALIDADO | confirmación mínima; email/contraseña no se reflejan |
| GET `/users` | Bearer token | `list[AdminUserResponse]` | VALIDADO | admin; email/rol/estado/fecha/nombre |
| POST `/users/admin` | `AdminUserCreate` | `AdminUserResponse` | VALIDADO | admin; no expone hash ni contraseña temporal |
| GET `/users/{user_id}` | Bearer token | `UserDetailResponse` | VALIDADO | dueño/admin; email y fecha |
| PUT `/users/{user_id}` | `UserUpdate` | `UserDetailResponse` | VALIDADO | admin; entrada no permite campos internos extras |
| DELETE `/users/{user_id}` | Bearer token | `UserDeleteResponse` | VALIDADO | admin; mensaje |
| POST `/users/{user_id}/force-password-reset` | Bearer token | `UserDeleteResponse` | VALIDADO | admin; no devuelve token/reset hash |
| GET `/profiles/me` | Bearer token | `ProfileResponse` | VALIDADO | datos propios; incluye IDs internos |
| PUT `/profiles/me` | `ProfileUpdate` | `ProfileResponse` | VALIDADO | datos propios |
| GET `/records` | Bearer token + query | `CandidateListResponse{total,page,limit,data:CandidateListItemResponse[]}` | VALIDADO | lista compacta: id/nombre/email/puesto/estado/etapa |
| POST `/records` | `RecordCreate` | `CandidateResponse` | VALIDADO | candidatura autenticada |
| GET `/records/{record_id}` | Bearer token | `CandidateResponse` | VALIDADO | detalle PII/CV protegido |
| PUT `/records/{record_id}` | `RecordUpdate` | `CandidateResponse` | VALIDADO | actualización protegida |
| PATCH `/records/{record_id}` | `RecordPatch` | `CandidateResponse` | VALIDADO | actualización de estado/etapa |
| DELETE `/records/{record_id}` | Bearer token | 204 vacío | VALIDADO | sin cuerpo |
| POST `/records/public` | `PublicRecordCreate` | `PublicRecordAcceptedResponse` | VALIDADO | acuse genérico; no revela datos de candidatura |
| GET `/records/{record_id}/notes` | Bearer token | `NotesListResponse` | VALIDADO | lista/modelo de notas |
| POST `/records/{record_id}/notes` | `NoteCreate` | `NoteResponse` | VALIDADO | nota creada |
| DELETE `/records/{record_id}/notes/{note_id}` | Bearer token | 204 vacío | VALIDADO | sin cuerpo |
| POST `/incidents` | `IncidentCreate` | `IncidentResponse` | VALIDADO | TinyDB; autenticación requerida a nivel de router |
| GET `/incidents` | query filters | `list[IncidentResponse]` | VALIDADO | TinyDB; autenticación requerida a nivel de router |
| PATCH `/incidents/{incident_id}/status` | `IncidentStatusUpdate` | `IncidentResponse` | VALIDADO | autenticación requerida a nivel de router |
| GET `/incidents/summary` | — | `IncidentSummaryResponse` | VALIDADO | agregado; autenticación requerida a nivel de router |
| GET `/incidents/{incident_id}` | — | `IncidentResponse` | VALIDADO | autenticación requerida a nivel de router |
| POST `/v2/incidents` | `IncidentCreate` | `IncidentResponse` | VALIDADO | autenticado; esquema separado de entrada |
| GET `/v2/incidents` | query filters | `IncidentListResponse{items,total,limit,offset}` | VALIDADO | `items` compactos: cliente/tipo/severidad/área/título/descripción/estado/asignación/SLA; autenticado |
| GET `/v2/incidents/summary` | — | `IncidentSummaryResponse` | VALIDADO | autenticado |
| GET `/v2/incidents/{incident_id}/history` | — | `list[IncidentAuditResponse]` | VALIDADO | `actor_id`/`actor_email` visibles en UI; autenticado |
| GET `/v2/incidents/{incident_id}` | — | `IncidentResponse` | VALIDADO | detalle; autenticado |
| PATCH `/v2/incidents/{incident_id}` | `IncidentUpdate` | `IncidentResponse` | VALIDADO | autenticado |
| PATCH `/v2/incidents/{incident_id}/status` | `IncidentStatusUpdate` | `IncidentResponse` | VALIDADO | autenticado |
| DELETE `/v2/incidents/{incident_id}` | — | 204 vacío | VALIDADO | archivo lógico; autenticado |
| DELETE `/v2/incidents/{incident_id}/permanent` | — | 204 vacío | VALIDADO | borrado permanente; autenticado |
| GET `/inventory/products` | — | `list[AssetResponse]` | VALIDADO | adaptador legacy |
| POST `/inventory/products` | `AssetCreate` | `AssetResponse` | VALIDADO | adaptador legacy |
| GET `/inventory/products/{id}` | — | `AssetResponse` | VALIDADO | adaptador legacy |
| POST `/inventory/orders/inbound` | `AssetEntryCreate` | `AssetEntryResponse` | VALIDADO | serialización de orden |
| POST `/inventory/orders/outbound` | `AssetExitCreate` | `AssetExitResponse` | VALIDADO | serialización de orden |
| GET `/inventory/orders` | — | `list[InventoryOrderResponse]` | VALIDADO | incluye activo anidado y autor |
| POST `/inventory/items` | `ItemCreate` | `ItemResponse` | VALIDADO | esquema de entrada estricto |
| GET `/inventory/items` | query filters | `list[ItemResponse]` | VALIDADO | stock agregado; respuesta conserva campos |
| GET `/inventory/items/{item_id}` | — | `ItemResponse` | VALIDADO | detalle |
| PATCH `/inventory/items/{item_id}` | `ItemUpdate` | `ItemResponse` | VALIDADO | actualización parcial |
| DELETE `/inventory/items/{item_id}` | — | 204 vacío | VALIDADO | sin cuerpo |
| POST `/inventory/lots` | `LotCreate` | `LotResponse` | VALIDADO | timestamp generado por servidor |
| GET `/inventory/lots` | query filters | `list[LotResponse]` | VALIDADO | incluye received_at |
| DELETE `/inventory/items/{item_id}/permanent` | — | 204 vacío | VALIDADO | sin cuerpo |
| POST `/inventory/movements` | `MovementCreate` | `MovementResponse` | VALIDADO | timestamps/autor del servidor |
| GET `/inventory/movements` | query filters | `list[MovementResponse]` | VALIDADO | `user_uuid` mostrado como autor |
| POST `/suppliers` | `SupplierCreate` | `SupplierResponse` | VALIDADO | schema de creación separado |
| GET `/suppliers` | query filters | `list[SupplierListResponse]` | VALIDADO | id/nombre/país/categorías/tarifa/moneda/estado; excluye email/notas/renovación/timestamp de detalle; protegido por auth |
| GET `/suppliers/{supplier_id}` | Bearer token | `SupplierResponse` | VALIDADO | detalle incluye email/notas opcionales |
| PATCH `/suppliers/{supplier_id}/rate` | `RateUpdate` | `SupplierResponse` | VALIDADO | protegido por auth |
| PATCH `/suppliers/{supplier_id}/status` | `StatusUpdate` | `SupplierResponse` | VALIDADO | protegido por auth |
| DELETE `/suppliers/{supplier_id}` | Bearer token | 204 vacío | VALIDADO | sin cuerpo |
| GET `/reporting/pipeline-runs/latest` | — | `RunResponse` | VALIDADO | errores limitados a código |
| POST `/reporting/pipeline-runs` | `RunRequest` | `RunResponse` | VALIDADO | rol admin/manager |
| GET `/reporting/weekly-office-program-performance` | — | `WeeklyPerformanceResponse` | PARCIALMENTE SERIALIZADO | `Response` manual; model validation runtime no aplicada por FastAPI |
| GET `/telemetry/report` | query date range | `TechnicalReport` | VALIDADO | reporte agregado sin payload de evento |
| POST `/api/incidents/analyze` (app CSV separada) | multipart `UploadFile` | `AnalysisResponse`; 400 `AnalysisErrorResponse` | VALIDADO | OpenAPI publica multipart y respuestas 200/400/422 |
| GET `/api/incidents/results/export` (app CSV separada) | — | `text/csv` binario; 404 `AnalysisErrorResponse` | VALIDADO | respuesta de archivo, no modelo JSON |

### Verificación OpenAPI, schemas y seguridad

- OpenAPI principal generado correctamente: 45 paths, 66 operaciones; todos los éxitos JSON tienen schema/ref. Los siete 204 sin contenido son: dos records, dos managed incidents, dos inventory v2 y uno supplier. El OpenAPI de la app CSV publica 2 operaciones, multipart de análisis, `AnalysisResponse`/error y descarga binaria `text/csv`.
- Los schemas de entrada revisados separan creación/actualización de salida; `extra="forbid"` está establecido en modelos de entrada de inventario, incidentes gestionadas, proveedores, usuarios y contraseñas. Los campos de timestamps/IDs gestionados por servidor no se aceptan en los DTO de creación correspondientes. En los modelos de respuesta revisados no se proyectan `hashed_password`, `token_hash` ni tokens de reset. `/auth/me` devuelve solamente id/email/rol/perfil, pero el perfil adjunto lleva `id` y `user_id`; minimizar estos identificadores sería una decisión contractual futura, no se cambia aquí.
- Revisiones focales de auth/usuarios/perfiles/records/incidentes/inventario/proveedores y de los contratos publicados no evidenciaron retorno directo de ORM sin modelo. El endpoint semanal de reporting es la excepción al filtrado runtime estándar: realiza validación manual del modelo/JSON, pero envía una `Response` cruda para conservar Decimal numérico exacto.
- Seguridad: los cinco handlers legacy `/incidents` ahora requieren `get_current_user` mediante dependencia de router; se añadió una prueba que verifica 401 anónimo en los cinco métodos/rutas. Las incidencias gestionadas `/v2/incidents` continúan autenticadas. No hay una matriz de roles local en `managed_incidents.py`; la autenticación no equivale a autorización por rol. Los cambios de roles confirmados por el usuario en otras áreas se consideran intencionados y no se redefinieron aquí.
- Compatibilidad frontend: `npm run typecheck` pasa. Las listas compactas de candidaturas, incidencias gestionadas y proveedores se alinean con los consumidores inspeccionados; `ManagedInventory` usa `user_uuid` como autor. `registerRequest` está declarado como si devolviera `{user, profile}`, pero la ruta responde `{message}`; el contexto ignora el valor y hace login aparte, por lo que no se constató rotura del flujo, aunque la anotación TypeScript del cliente no refleja el contrato. No se modificó el cliente en esta revisión.
- TestClient emite una advertencia de deprecación de Starlette sobre `httpx`; no se instaló `httpx2`.

### Pruebas ejecutadas en esta revisión

- Seguimiento de seguridad y fixtures (`tests/test_api.py` + `tests/test_incidents_api.py`): **59 passed, 1 warning**. Incluye las verificaciones anónimas de las cinco rutas legacy y los tests de proveedores con DB aislada y autenticación de test.
- `git diff --check`: pasó; `npm run typecheck`: pasó tras los cambios.
- Suite backend configurada (`cd services/api && .venv/bin/pytest -q`): detuvo la colección por `ModuleNotFoundError: No module named 'services.api.models'` en `tests/test_models.py`; no hubo ejecución de suite completa.
- Selección focalizada de auth, reset, perfiles/usuarios, records, incidencias, managed incidents e inventory v2: **104 passed, 6 xfailed, 1 warning**.
- Frontend `npm run typecheck`: pasó.
- `git diff --check`: pasó.
- Previamente, para el cambio de stock/proyección compacta, `tests/test_inventory_v2_api.py`: **10 passed, 1 warning**. El intento histórico de `tests/test_api.py` no es validación: esperaba fixture `seeded_db` inexistente y algunas peticiones de proveedores recibieron 401.

### Alcance funcional y persistencia (revisión posterior)

- Los cambios de interfaz de administración/perfil y sus consumidores son intencionados según el usuario; no se alteró el comportamiento de páginas como parte de este trabajo de backend/auditoría. Los cambios de acceso por rol en incidencias gestionadas también son intencionados; se preservaron.
- `services/api/README.md` establece que PostgreSQL (configurado por `DATABASE_URL`) se usa para inventario SQLModel, mientras usuarios/autenticación continúan en TinyDB. `database.py` confirma que usuarios, perfiles y tokens de restablecimiento usan tablas TinyDB. El contexto general revisado no define una migración. Por tanto no se migran usuarios/tokens a PostgreSQL en esta tarea: hacerlo sería un cambio arquitectónico independiente.
- `services/api/data/db.json` ya tenía modificaciones locales con estado persistido de la aplicación. Se preservó sin inspeccionar ni divulgar valores. No se reseteó ni se incluyó como parte de los cambios funcionales; antes de preparar un commit, confirmar si ese archivo local debe excluirse.
- `services/api/seed_admin.py` ahora solicita contraseña sin eco, exige al menos 16 caracteres y confirmación, y no imprime el secreto. El seeder no se ejecutó.
- La suite de proveedores fue alineada con la autenticación existente mediante un override limitado al módulo de tests, fixture `seeded_db` aislada y parche del alias TinyDB importado por el router; se actualizaron expectativas obsoletas para ajustarlas a los schemas actuales (por ejemplo, moneda de país inválida se rechaza, no se corrige automáticamente).
- El requisito “sin acceso anónimo” se aplicó a las rutas de incidencias legacy que motivaron la revisión. No se modificaron rutas intencionalmente públicas del producto como `POST /users`, `POST /records/public`, autenticación de recuperación, ni endpoints operativos `/` y `/health`; una política que quiera cerrar también esos flujos requeriría una decisión funcional explícita.

La verificación reproduce los resultados OpenAPI y suites indicadas; no demuestra runtime exhaustivo de los 68 endpoints ni acceso a un PostgreSQL con datos reales. No se instalaron dependencias ni se hicieron migraciones. No se hizo commit.

## API principal: estado original por endpoint (fotografía histórica)

## API principal: estado original por endpoint

### Salud

| Método y ruta | Propósito / consumidor | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `GET /health` | Health check de infraestructura | Dict `{"status": "ok"}` sin esquema | ❌ |
| `GET /` | Mensaje de disponibilidad | Dict `{"message": ...}` sin esquema | ❌ |

### Autenticación (`/auth`)

| Método y ruta | Propósito / consumidor | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `POST /auth/login` | Inicio de sesión; el cliente necesita token y tipo | Dict con `access_token` y `token_type`; no devuelve email ni usuario | ❌ |
| `GET /auth/me` | Usuario autenticado y perfil para el backoffice | Dict con `id`, `email`, `role` y `profile` completo de TinyDB | ❌ |
| `POST /auth/forgot-password` | Solicitar restauración; evitar enumeración de usuarios | Dict con mensaje genérico; no devuelve email ni token | ❌ |
| `POST /auth/reset-password` | Confirmar cambio de contraseña | Dict con mensaje; no devuelve email ni token | ❌ |
| `POST /auth/change-password` | Confirmar cambio autenticado | Dict con mensaje | ❌ |

**Nota de seguridad:** las respuestas actuales de login y restauración no incluyen credenciales. `GET /auth/me` es autenticado y puede incluir email. Se debe tipar explícitamente el resultado sin incluir `hashed_password`, tokens internos ni campos internos del perfil que el cliente no use. El backoffice lee `id`, `email`, `role` y `profile.name/phone/address` para su contexto y vista de perfil.

### Usuarios (`/users`)

| Método y ruta | Propósito / consumidor | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `POST /users` | Registro desde el backoffice | Dict `{user, profile}`. `user` pasa por `public_user()` (id, email, is_active, role, created_at); `profile` contiene también `user_id` | ❌ |
| `GET /users` | Listado para usuario autenticado | Lista de `public_user()` con id, email, is_active, role y created_at | ❌ |
| `GET /users/{user_id}` | Detalle del propio usuario o admin | `public_user()`; incluye email | ❌ |
| `PUT /users/{user_id}` | Actualizar datos del usuario | `public_user()` del usuario actualizado | ❌ |
| `DELETE /users/{user_id}` | Eliminar usuario | Dict `{message}` | ❌ |

**Mejora requerida:** separar respuesta de registro, listado y detalle/actualización si sus consumidores no necesitan la misma proyección. El registro es un flujo no autenticado y no debe devolver email; estudiar confirmación genérica mínima y verificar el flujo de registro del cliente antes de fijar el payload. El listado no debería exponer emails ni timestamps de creación si la UI no los requiere. Nunca devolver credenciales ni hash.

### Perfiles (`/profiles`)

| Método y ruta | Propósito / consumidor | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `GET /profiles/me` | Cargar los datos de perfil propios | Dict completo devuelto por TinyDB; puede incluir `id` y `user_id` además de `name`, `phone`, `address` | ❌ |
| `PUT /profiles/me` | Guardar perfil propio | Dict actualizado completo devuelto por TinyDB | ❌ |

El cliente consume `name`, `phone` y `address`; definir salida con esos campos únicamente y no exponer el identificador interno de usuario sin necesidad.

### Candidaturas (`/records`)

| Método y ruta | Propósito / consumidor | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `GET /records` | Listado paginado del backoffice | Dict `{total, page, limit, data}`; `data` son registros completos de TinyDB | ❌ |
| `GET /records/{record_id}` | Detalle de candidatura | Registro completo de TinyDB | ❌ |
| `POST /records` | Crear candidatura autenticada | Dict de candidatura construido por el servidor | ❌ |
| `POST /records/public` | Envío público de candidatura | Dict de candidatura completa con datos personales; honeypot devuelve `{ok: true}` | ❌ |
| `PUT /records/{record_id}` | Reemplazar datos editables de candidatura | Registro completo actualizado | ❌ |
| `PATCH /records/{record_id}` | Cambiar estado/etapa | Registro completo actualizado | ❌ |
| `DELETE /records/{record_id}` | Eliminar candidatura | Respuesta vacía `204` mediante `Response` | ❌ |
| `GET /records/{record_id}/notes` | Listar notas de una candidatura | Dict `{data, meta: {total}}`; `data` contiene notas completas | ❌ |
| `POST /records/{record_id}/notes` | Añadir nota | Dict de nota con `id`, `record_id`, `content`, `created_at` | ❌ |
| `DELETE /records/{record_id}/notes/{note_id}` | Eliminar nota | Respuesta vacía `204` mediante `Response` | ❌ |

**Estado actual (la fila anterior conserva la fotografía original):** la lista usa `CandidateListResponse` con `CandidateListItemResponse`; detalle/CRUD, paginación y notas tienen modelos explícitos; candidatura pública/honeypot comparten confirmación genérica `PublicRecordAcceptedResponse`; DELETE declara 204 vacío. Los tipos de lista frontend ya usan `CandidateListItem`, distinto del modelo completo de detalle.

### Incidencias (`/incidents`)

| Método y ruta | Propósito / consumidor | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `POST /incidents` | Crear incidencia para la UI | Dict construido y devuelto por servicio TinyDB | ❌ |
| `GET /incidents` | Listar incidencias, con filtros opcionales | Lista de registros completos de TinyDB | ❌ |
| `PATCH /incidents/{incident_id}/status` | Cambiar estado y devolver incidencia actualizada | Dict devuelto por servicio TinyDB | ❌ |
| `GET /incidents/summary` | Resumen agregado para panel | Dict con total y conteos por estado, categoría, origen y sede | ❌ |
| `GET /incidents/{incident_id}` | Detalle de incidencia | Registro completo de TinyDB | ❌ |

La UI consume el contrato de incidencia y un resumen agregado. Definir salida tipada para listado/detalle, creación/actualización y resumen; evitar filtrar campos internos no consumidos y separar entrada de salida. La decisión sobre si los esquemas de listado y detalle comparten exactamente los mismos campos debe quedar reflejada al implementar.

### Inventario (`/inventory`)

| Método y ruta | Propósito / consumidor | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `GET /inventory/products` | Listar productos con stock calculado | `list[AssetResponse]`: id, name, sku, category, office, current_stock | ✅ |
| `POST /inventory/products` | Crear producto | `AssetResponse` | ✅ |
| `GET /inventory/products/{id}` | Detalle de producto | `AssetResponse` | ✅ |
| `POST /inventory/orders/inbound` | Crear entrada de inventario | `AssetEntryResponse` | ⚠️ |
| `POST /inventory/orders/outbound` | Crear salida de inventario | `AssetExitResponse` | ⚠️ |
| `GET /inventory/orders` | Historial combinado de entradas/salidas | `list[InventoryOrderResponse]` con proyección anidada limitada del producto | ⚠️ |

Los tres esquemas de respuesta de órdenes incluyen `user_uuid`, y las órdenes individuales incluyen `asset_id`. El historial además anida una proyección acotada del activo (id, name, sku, category, office). **Nota supersedida por la revisión actual:** el consumidor canónico `ManagedInventory` sí presenta `user_uuid` como autor en la tabla de movimientos. Decidir explícitamente si `asset_id` se conserva como referencia útil junto al activo anidado; no se propone retirar `user_uuid` mientras siga visible en la UI. Los esquemas de entrada existentes son distintos a los de salida y prohíben campos extra.

## Superficies relacionadas fuera del entrypoint principal

Estas rutas se documentan porque forman parte del código del servicio, pero no se cuentan entre las 35 rutas registradas por `services/api/main.py`. La auditoría estática de sus decoradores no garantiza que el módulo importe correctamente ni que haya pruebas funcionales vigentes para este dominio.

### Aplicación alternativa de análisis CSV (`services/api/app/main.py`)

| Método y ruta | Propósito / consumidor | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `POST /api/incidents/analyze` | Analizar CSV; resultados agregados y errores de validación | Éxito como dict convertido a `JSONResponse`; errores como JSON con `error.code/message`; sin `response_model` | ❌ |
| `GET /api/incidents/results/export` | Descargar resultados como CSV | `Response` de texto/csv con `Content-Disposition` y `Cache-Control`; sin `response_model` | ❌* |

`❌*` indica que no hay `response_model` Pydantic. Para el export CSV debe declararse/documentarse el contrato de respuesta binaria/textual y los errores, ya que no corresponde serializarlo como objeto JSON. Esta aplicación tiene un entrypoint separado y su montaje/despliegue efectivo no se da por supuesto.

### Router de proveedores: fotografía histórica (`services/api/routes/suppliers.py`)

| Método y ruta | Propósito | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `POST /suppliers` | Crear proveedor | `SupplierResponse` explícito en código; carga funcional no verificada | ⚠️ |
| `GET /suppliers` | Listar y filtrar proveedores | **Histórico:** `list[SupplierResponse]`, forma de detalle con `contact_email` y `notes` opcionales. **Actual:** `list[SupplierListResponse]`, proyección acotada para filas y selector; carga funcional no verificada en esta revisión. | ⚠️ (histórico) |
| `GET /suppliers/{supplier_id}` | Obtener detalle | `SupplierResponse` explícito en código; carga funcional no verificada | ⚠️ |
| `PATCH /suppliers/{supplier_id}/rate` | Actualizar tarifa | `SupplierResponse` explícito en código; carga funcional no verificada | ⚠️ |
| `PATCH /suppliers/{supplier_id}/status` | Actualizar estado | `SupplierResponse` explícito en código; carga funcional no verificada | ⚠️ |
| `DELETE /suppliers/{supplier_id}` | Eliminar proveedor | Estado 204, sin cuerpo; no lleva `response_model` | ❌ |

La lista cuenta con una proyección ligera `SupplierListResponse`. En el estado actual del workspace el router sí está registrado en `services/api/main.py`; su disponibilidad funcional no se volvió a probar en esta revisión. No se recreó el dominio Supplier legacy.

## Resumen cuantitativo inicial

- **API principal, fotografía histórica:** 35 endpoints: 3 ✅, 3 ⚠️, 29 ❌. El inventario actual de OpenAPI, tras incluir routers posteriores, registra 66 operaciones en 45 paths.
- **Aplicación alternativa CSV:** 2 endpoints adicionales, ambos ❌ por falta de esquema explícito; el export tiene contrato de archivo y no debe convertirse en JSON.
- **Router de proveedores, clasificación histórica:** 6 endpoints declarados: 4 ✅, 1 ⚠️, 1 ❌. En el workspace actual está montado; la carga funcional no se verificó en esta revisión.

## Estado final de implementación y verificación

La auditoría inicial anterior conserva el inventario de riesgos previo a los cambios. En la fase de implementación se añadieron contratos Pydantic explícitos y proyecciones de salida para las rutas principales de auth, usuarios, perfiles, candidaturas e incidencias, además de los endpoints raíz/salud. También se declararon respuestas JSON del analizador CSV y la respuesta de archivo CSV como `text/csv` binaria. Las rutas DELETE que responden `204` conservan cuerpo vacío (`response_model=None`). **Aclaración de estado:** las frases históricas de esta sección que indiquen que proveedores no estaba montado describen una etapa previa; el router está registrado en la aplicación principal actual, aunque su carga funcional no se volvió a validar en esta revisión. El inventario mantiene sus contratos preexistentes.

### Comprobaciones realizadas

- **Pruebas dirigidas de registro y candidatura pública:** 4 pasaron en la ejecución focalizada previa. Se verificaron las respuestas genéricas públicas y que no se devuelven datos personales en esas confirmaciones.
- **OpenAPI con `TestClient`:** `/docs` y `/openapi.json` respondieron `200` en la API principal y en la aplicación alternativa CSV. Se inspeccionaron los contratos publicados de `GET /health` (`HealthResponse`), `POST /auth/login` (`TokenResponse`), `POST /records/public` (`PublicRecordAcceptedResponse`) y `GET /incidents/summary` (`IncidentSummaryResponse`). En la app CSV se comprobó `POST /api/incidents/analyze` (`AnalysisResponse`) y que `GET /api/incidents/results/export` publica `text/csv` con esquema binario. Esto fue una comprobación automatizada del documento OpenAPI vía `TestClient`; no una revisión visual manual de Swagger UI en navegador.
- **Resultado histórico, supersedido:** la primera ejecución ampliada de auth/records tuvo fallos de estado compartido y cabeceras; `test_incidents_api.py` no se podía recolectar por sintaxis inválida. La inspección confirmó que el archivo estaba roto también en `HEAD` y `HEAD^`.
- **Verificación focalizada actual:** `.venv/bin/python -m pytest -q tests/test_authentication.py tests/test_records_api.py tests/test_incidents_api.py`, ejecutado desde `services/api`: **63 passed, 6 xfailed, 1 warning** (23.13 s). Se cubrieron auth, records y ambas superficies de incidencias (API principal y analizador CSV). Los `xfail` son expectativas marcadas explícitamente como pendientes en el propio test; no son fallos inesperados.
- **Correcciones de tests/contrato durante la investigación:** el fixture autouse ahora sustituye también aliases de TinyDB importados directamente por los módulos de test y limpia el estado global del rate limiter antes de cada test. El manejador global de `HTTPException` conserva las cabeceras de la excepción (incluido `Retry-After`). Se reconstruyó el archivo de test que ya tenía sintaxis inválida y se corrigió el nombre del CSV de muestra a `scripts/incidents-nexova.csv`, que es el archivo presente en el repositorio.
- **Integridad de TinyDB:** la prueba focalizada no añadió otra modificación estructural a `services/api/data/db.json`. Su diff local ya existente sigue siendo la tabla vacía `password_reset_tokens`; no se restauró ni se alteró el almacén local.
- **Análisis estático:** `get_errors` no reportó errores en `tests/conftest.py`, `tests/test_incidents_api.py` ni `main.py` después de los cambios.
- **Inventario actualizado (FASE 2.3):** `services/api/main.py` registra 66 operaciones OpenAPI en 45 paths, incluidos auth, users, profiles, records, incidents, managed incidents, ambos routers de inventario, suppliers, reporting y telemetry. Todas publican contrato exitoso; los siete DELETE 204 de esta API usan `response_model=None` y no tienen cuerpo. La app alternativa CSV mantiene modelo de análisis y `response_model=None` para el archivo `text/csv`. El router de suppliers sí está montado en el entrypoint actual.
- **DELETE 204 formalizados:** se añadieron `response_model=None` a `DELETE /v2/incidents/{incident_id}`, `DELETE /v2/incidents/{incident_id}/permanent`, `DELETE /inventory/items/{item_id}` y `DELETE /inventory/items/{item_id}/permanent`. Los dos DELETE de records ya retornaban HTTP 204 mediante `Response`, pero no lo declaraban en el decorador; ahora tienen `status_code=204` explícito para que OpenAPI publique el mismo estado real. No se alteró la lógica de borrado/archivo.
- **Verificación de fase 2.3:** prueba automatizada sobre OpenAPI encontró 66 operaciones y ningún éxito sin content-schema, salvo el contenido deliberadamente vacío de las rutas DELETE 204. `tests/test_managed_incidents_api.py` y `tests/test_inventory_v2_api.py`: 14 passed, 1 warning. `get_errors` no reportó errores en los dos routers editados.
- **Limitación de verificación de rutas:** una inspección directa de `app.routes` antes del contexto de startup devolvió solo 2 rutas directas del objeto app; para cobertura se usó el documento OpenAPI, donde `include_router` publica los 66 endpoints.
- **Serialización runtime pendiente de prueba exhaustiva:** el OpenAPI acredita contratos declarados, no valida cada ruta/fixture. El reporte semanal devuelve un `Response` JSON manual para emitir Decimal como número exacto; el response_model de ese endpoint publica el contrato pero FastAPI no valida el cuerpo raw en runtime. Se conserva por precisión y compatibilidad wire-format.
- **Contratos explícitos pendientes:** no se detectaron operaciones API sin contrato de éxito explícito. En la API principal hay siete rutas con `response_model=None`: siete DELETE 204 (dos records, dos managed incidents, dos inventory v2 y un supplier), todas sin cuerpo. En la app CSV hay una ruta adicional con `response_model=None`: su export, descrito con `responses` como `text/csv` binario, no como un modelo JSON.
- **Compatibilidad de proyecciones revisada:** el listado de candidaturas devuelve solo los campos utilizados por `CandidateCard` y los filtros de `CandidateList`; el detalle conserva `CandidateResponse` con datos de perfil, CV, experiencia y timestamps utilizados en `CandidateDetail`. Los clientes de managed incidents y de inventario mantienen los campos que consumen; no se recortaron contratos adicionales sin evidencia de que fuera compatible.
- **Suite completa del backend (intento actual):** `/workspaces/AngelG-Nexova-Solutions/services/api/.venv/bin/python -m pytest -q` se detuvo durante la colección. `test_models.py` y `test_seed.py` importan los modelos antiguos de Supplier desde `services.api.models`, mientras que la API principal carga `models` como módulo top-level para las tablas SQLModel `asset`/`assetentry`/`assetexit`. La carga duplicada produce `InvalidRequestError` por la tabla `asset` ya registrada. Un intento temporal de aliasar los nombres eliminó la colisión pero confirmó el problema subyacente: `SupplierDict` no existe en los modelos actuales. El cambio temporal se revirtió; no se alteraron modelos ni imports del runtime.
- **Pruebas activas de inventario:** `/workspaces/AngelG-Nexova-Solutions/services/api/.venv/bin/python -m pytest -q services/api/tests/test_inventory_models.py services/api/tests/test_inventory_schemas.py services/api/tests/test_inventory_api.py services/api/tests/test_seed_inventory.py`: **28 passed, 1 warning**. Esto valida el dominio SQLModel actualmente integrado, no el antiguo dominio Supplier.
- **Diagnóstico ampliado anterior (supersedido en la parte de password reset y smoke):** al excluir `test_models.py` y `test_seed.py`, la suite reportó **107 passed, 6 xfailed, 25 failed y 20 errors**. Entre las causas identificadas estaban las expectativas antiguas del payload de registro y del mensaje raíz; ambas se corrigieron en los tests, sin modificar los contratos de la API. Los fallos de proveedores y sus fixtures siguen fuera de alcance.
- **Validación de las expectativas de registro y smoke:** `/workspaces/AngelG-Nexova-Solutions/services/api/.venv/bin/python -m pytest -q services/api/tests/test_password_reset.py services/api/tests/test_smoke.py`: **13 passed, 1 warning**. El helper de reset verifica la confirmación genérica actual de `POST /users`; la prueba smoke verifica el mensaje que declara actualmente `RootResponse`.
- **Suite aplicable tras esos ajustes:** `/workspaces/AngelG-Nexova-Solutions/services/api/.venv/bin/python -m pytest -q services/api/tests --ignore=services/api/tests/test_api.py --ignore=services/api/tests/test_models.py --ignore=services/api/tests/test_seed.py`: **112 passed, 6 xfailed, 1 warning**. Se excluyeron esos tres módulos legacy/asociados al dominio de proveedores incompatible con los modelos actualmente integrados; por tanto, este resultado no equivale a que la suite completa del backend esté verde.
- **Integridad de datos:** las pruebas usan el fixture TinyDB temporal; `services/api/data/db.json` mantiene solo el diff local previamente observado. No se restauraron ni modificaron datos persistentes intencionalmente.
- **Advertencia del entorno:** Starlette avisa que `httpx` con `starlette.testclient` está obsoleto y sugiere `httpx2`. No se instalaron dependencias.

### Límites y archivos fuera de alcance

La comprobación OpenAPI valida que los contratos están publicados, no sustituye una revisión funcional exhaustiva de cada endpoint. La suite completa no queda verde por los errores y discrepancias legacy indicados; la selección focalizada sí pasa. Tampoco se inició un servidor: las rutas y esquemas solicitados se comprobaron con `TestClient`.

Los cambios de aplicación y las expectativas existentes de tests se encuentran en el árbol de trabajo; no se hizo commit, push ni publicación. El resultado de `git status` debe consultarse en la sesión antes de cerrar para distinguir estos cambios de otros archivos ya modificados, incluido el almacén de datos local.
