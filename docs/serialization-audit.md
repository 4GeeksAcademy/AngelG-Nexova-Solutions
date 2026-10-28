# Auditoría de serialización de la API

**Fecha de auditoría inicial:** 2026-10-28  
**Estado:** Contratos implementados; verificación focalizada de auth, records e incidencias superada tras reparar el aislamiento de tests.  
**Entry point principal:** `services/api/main.py`.

## Alcance y criterio

Se inspeccionó el entrypoint principal y sus routers registrados: usuarios, perfiles, auth, records, incidencias e inventario. También se inventariaron por separado la aplicación alternativa `services/api/app/main.py` y el router de proveedores `services/api/routes/suppliers.py`, que no está incluido en el entrypoint principal. No se cuentan como endpoints activos de la API principal.

- ✅ **Serializado:** hay `response_model` explícito y la forma observada es apropiada para el consumidor.
- ⚠️ **Parcialmente serializado:** hay esquema de salida, pero la proyección observada incluye campos innecesarios o requiere revisión para el consumidor.
- ❌ **Sin serializar:** no hay `response_model` explícito. Que una función devuelva un dict cuidadosamente construido o que una respuesta tenga forma estable no sustituye un contrato de salida explícito.

No se observó que las rutas activas de usuarios, perfiles, auth, records o incidencias devuelvan instancias ORM; sus almacenes usan TinyDB/dicts. El riesgo allí es principalmente la ausencia de contrato explícito y la posibilidad de devolver campos internos del registro. El inventario sí usa SQLModel, con respuestas Pydantic declaradas.

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

**Mejoras requeridas:** definir esquema ligero de listado y esquema de detalle, con los campos que usa el backoffice; modelar explícitamente la paginación y las notas. Mantener esquemas distintos de entrada y salida. Para `POST /records/public`, se evaluará y propone como objetivo una confirmación genérica y mínima, sin eco de nombre, email, teléfono, CV ni otros datos personales; confirmar también que el honeypot y el flujo normal tienen contrato coherente. En `DELETE`, documentar y declarar el contrato vacío/204 en lugar de inventar un objeto JSON.

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

Los tres esquemas de respuesta de órdenes incluyen `user_uuid`, y las órdenes individuales incluyen `asset_id`. El historial además anida una proyección acotada del activo (id, name, sku, category, office). El cliente tipa `user_uuid`, pero la búsqueda inicial no encontró uso en la UI; revisar consumidores antes de retirarlo. Decidir explícitamente si `asset_id` se conserva como referencia útil junto al activo anidado y si la identidad del usuario debe quedar interna. Los esquemas de entrada existentes son distintos a los de salida y prohíben campos extra.

## Superficies relacionadas fuera del entrypoint principal

Estas rutas se documentan porque forman parte del código del servicio, pero no se cuentan entre las 35 rutas registradas por `services/api/main.py`. La auditoría estática de sus decoradores no garantiza que el módulo importe correctamente ni que haya pruebas funcionales vigentes para este dominio.

### Aplicación alternativa de análisis CSV (`services/api/app/main.py`)

| Método y ruta | Propósito / consumidor | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `POST /api/incidents/analyze` | Analizar CSV; resultados agregados y errores de validación | Éxito como dict convertido a `JSONResponse`; errores como JSON con `error.code/message`; sin `response_model` | ❌ |
| `GET /api/incidents/results/export` | Descargar resultados como CSV | `Response` de texto/csv con `Content-Disposition` y `Cache-Control`; sin `response_model` | ❌* |

`❌*` indica que no hay `response_model` Pydantic. Para el export CSV debe declararse/documentarse el contrato de respuesta binaria/textual y los errores, ya que no corresponde serializarlo como objeto JSON. Esta aplicación tiene un entrypoint separado y su montaje/despliegue efectivo no se da por supuesto.

### Router de proveedores no montado (`services/api/routes/suppliers.py`)

| Método y ruta | Propósito | Respuesta actual observada | Estado original |
| --- | --- | --- | --- |
| `POST /suppliers` | Crear proveedor | `SupplierResponse` explícito en código; carga funcional no verificada | ⚠️ |
| `GET /suppliers` | Listar y filtrar proveedores | `list[SupplierResponse]`; reutiliza forma de detalle, incluidos contact_email y notes opcionales; carga funcional no verificada | ⚠️ |
| `GET /suppliers/{supplier_id}` | Obtener detalle | `SupplierResponse` explícito en código; carga funcional no verificada | ⚠️ |
| `PATCH /suppliers/{supplier_id}/rate` | Actualizar tarifa | `SupplierResponse` explícito en código; carga funcional no verificada | ⚠️ |
| `PATCH /suppliers/{supplier_id}/status` | Actualizar estado | `SupplierResponse` explícito en código; carga funcional no verificada | ⚠️ |
| `DELETE /suppliers/{supplier_id}` | Eliminar proveedor | Estado 204, sin cuerpo; no lleva `response_model` | ❌ |

La lista puede exponer contacto y notas innecesarios si la tabla solo necesita una proyección breve; definir esquema de listado según su consumidor. El router no está registrado en `services/api/main.py`; además, `services/api/routes/suppliers.py` importa `SupplierCreate`, `SupplierDict`, `SupplierResponse`, `RateUpdate` y `StatusUpdate` desde `services/api/models.py`, pero el archivo inspeccionado solo define modelos SQLModel de inventario y no contiene esas clases. Los tests `test_models.py` y `test_seed.py` también pertenecen al antiguo dominio Supplier y fallan durante la recolección al intentar importar `SupplierDict` inexistente. No se recreó ese dominio, ni se montó el router.

## Resumen cuantitativo inicial

- **API principal:** 35 endpoints: 3 ✅, 3 ⚠️, 29 ❌.
- **Aplicación alternativa CSV:** 2 endpoints adicionales, ambos ❌ por falta de esquema explícito; el export tiene contrato de archivo y no debe convertirse en JSON.
- **Router de proveedores no montado:** 6 endpoints declarados: 4 ✅, 1 ⚠️, 1 ❌. Estado de integración/carga no verificado.

## Estado final de implementación y verificación

La auditoría inicial anterior conserva el inventario de riesgos previo a los cambios. En la fase de implementación se añadieron contratos Pydantic explícitos y proyecciones de salida para las rutas principales de auth, usuarios, perfiles, candidaturas e incidencias, además de los endpoints raíz/salud. También se declararon respuestas JSON del analizador CSV y la respuesta de archivo CSV como `text/csv` binaria. Las rutas DELETE que responden `204` conservan cuerpo vacío (`response_model=None`). El router de proveedores sigue sin montarse en la aplicación principal; el inventario mantiene sus contratos preexistentes.

### Comprobaciones realizadas

- **Pruebas dirigidas de registro y candidatura pública:** 4 pasaron en la ejecución focalizada previa. Se verificaron las respuestas genéricas públicas y que no se devuelven datos personales en esas confirmaciones.
- **OpenAPI con `TestClient`:** `/docs` y `/openapi.json` respondieron `200` en la API principal y en la aplicación alternativa CSV. Se inspeccionaron los contratos publicados de `GET /health` (`HealthResponse`), `POST /auth/login` (`TokenResponse`), `POST /records/public` (`PublicRecordAcceptedResponse`) y `GET /incidents/summary` (`IncidentSummaryResponse`). En la app CSV se comprobó `POST /api/incidents/analyze` (`AnalysisResponse`) y que `GET /api/incidents/results/export` publica `text/csv` con esquema binario. Esto fue una comprobación automatizada del documento OpenAPI vía `TestClient`; no una revisión visual manual de Swagger UI en navegador.
- **Resultado histórico, supersedido:** la primera ejecución ampliada de auth/records tuvo fallos de estado compartido y cabeceras; `test_incidents_api.py` no se podía recolectar por sintaxis inválida. La inspección confirmó que el archivo estaba roto también en `HEAD` y `HEAD^`.
- **Verificación focalizada actual:** `.venv/bin/python -m pytest -q tests/test_authentication.py tests/test_records_api.py tests/test_incidents_api.py`, ejecutado desde `services/api`: **63 passed, 6 xfailed, 1 warning** (23.13 s). Se cubrieron auth, records y ambas superficies de incidencias (API principal y analizador CSV). Los `xfail` son expectativas marcadas explícitamente como pendientes en el propio test; no son fallos inesperados.
- **Correcciones de tests/contrato durante la investigación:** el fixture autouse ahora sustituye también aliases de TinyDB importados directamente por los módulos de test y limpia el estado global del rate limiter antes de cada test. El manejador global de `HTTPException` conserva las cabeceras de la excepción (incluido `Retry-After`). Se reconstruyó el archivo de test que ya tenía sintaxis inválida y se corrigió el nombre del CSV de muestra a `scripts/incidents-nexova.csv`, que es el archivo presente en el repositorio.
- **Integridad de TinyDB:** la prueba focalizada no añadió otra modificación estructural a `services/api/data/db.json`. Su diff local ya existente sigue siendo la tabla vacía `password_reset_tokens`; no se restauró ni se alteró el almacén local.
- **Análisis estático:** `get_errors` no reportó errores en `tests/conftest.py`, `tests/test_incidents_api.py` ni `main.py` después de los cambios.
- **Inventario actual de decoradores:** la inspección de los routers registrados en `services/api/main.py` encontró declaraciones `response_model` en los 35 endpoints de la API principal; los dos DELETE de records declaran `response_model=None` y responden 204 sin cuerpo. La app alternativa CSV declara modelo JSON para el análisis y `response_model=None` para el archivo `text/csv`. Los seis endpoints de proveedores también declaran un modelo o `None`, pero pertenecen a un router no montado y no cuentan como rutas disponibles en la API principal.
- **Suite completa del backend (intento actual):** `/workspaces/AngelG-Nexova-Solutions/services/api/.venv/bin/python -m pytest -q` se detuvo durante la colección. `test_models.py` y `test_seed.py` importan los modelos antiguos de Supplier desde `services.api.models`, mientras que la API principal carga `models` como módulo top-level para las tablas SQLModel `asset`/`assetentry`/`assetexit`. La carga duplicada produce `InvalidRequestError` por la tabla `asset` ya registrada. Un intento temporal de aliasar los nombres eliminó la colisión pero confirmó el problema subyacente: `SupplierDict` no existe en los modelos actuales. El cambio temporal se revirtió; no se alteraron modelos ni imports del runtime.
- **Pruebas activas de inventario:** `/workspaces/AngelG-Nexova-Solutions/services/api/.venv/bin/python -m pytest -q services/api/tests/test_inventory_models.py services/api/tests/test_inventory_schemas.py services/api/tests/test_inventory_api.py services/api/tests/test_seed_inventory.py`: **28 passed, 1 warning**. Esto valida el dominio SQLModel actualmente integrado, no el antiguo dominio Supplier.
- **Diagnóstico ampliado anterior (supersedido en la parte de password reset y smoke):** al excluir `test_models.py` y `test_seed.py`, la suite reportó **107 passed, 6 xfailed, 25 failed y 20 errors**. Entre las causas identificadas estaban las expectativas antiguas del payload de registro y del mensaje raíz; ambas se corrigieron en los tests, sin modificar los contratos de la API. Los fallos de proveedores y sus fixtures siguen fuera de alcance.
- **Validación de las expectativas de registro y smoke:** `/workspaces/AngelG-Nexova-Solutions/services/api/.venv/bin/python -m pytest -q services/api/tests/test_password_reset.py services/api/tests/test_smoke.py`: **13 passed, 1 warning**. El helper de reset verifica la confirmación genérica actual de `POST /users`; la prueba smoke verifica el mensaje que declara actualmente `RootResponse`.
- **Suite aplicable tras esos ajustes:** `/workspaces/AngelG-Nexova-Solutions/services/api/.venv/bin/python -m pytest -q services/api/tests --ignore=services/api/tests/test_api.py --ignore=services/api/tests/test_models.py --ignore=services/api/tests/test_seed.py`: **112 passed, 6 xfailed, 1 warning**. Se excluyeron esos tres módulos legacy/asociados al dominio de proveedores no montado; por tanto, este resultado no equivale a que la suite completa del backend esté verde.
- **Integridad de datos:** las pruebas usan el fixture TinyDB temporal; `services/api/data/db.json` mantiene solo el diff local previamente observado. No se restauraron ni modificaron datos persistentes intencionalmente.
- **Advertencia del entorno:** Starlette avisa que `httpx` con `starlette.testclient` está obsoleto y sugiere `httpx2`. No se instalaron dependencias.

### Límites y archivos fuera de alcance

La comprobación OpenAPI valida que los contratos están publicados, no sustituye una revisión funcional exhaustiva de cada endpoint. La suite completa no queda verde por los errores y discrepancias legacy indicados; la selección focalizada sí pasa. Tampoco se inició un servidor: las rutas y esquemas solicitados se comprobaron con `TestClient`.

Los cambios de aplicación y las expectativas existentes de tests se encuentran en el árbol de trabajo; no se hizo commit, push ni publicación. El resultado de `git status` debe consultarse en la sesión antes de cerrar para distinguir estos cambios de otros archivos ya modificados, incluido el almacén de datos local.
