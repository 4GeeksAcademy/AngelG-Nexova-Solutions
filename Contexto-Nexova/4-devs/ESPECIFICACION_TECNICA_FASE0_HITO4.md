# Especificación técnica — Fase 0 del Hito 4

**Estado:** borrador de confirmación técnica; las decisiones marcadas «pendiente» requieren confirmación antes de implementar.  
**Alcance:** preparación de los gestores de incidencias e inventario. No implementa endpoints, modelos, migraciones, seeds ni interfaz.

## 1. Fuentes y objetivo

Se contrastaron los briefings español/inglés de incidencias e inventario en `Contexto-Nexova/4-devs/`, el briefing general y el contexto de servicio/SLA en `Contexto-Nexova/00-general-contexts/`, el plan `PLAN_IMPLEMENTACION_HITO4.md` y el código/README/configuración de API y backoffice.

Esta especificación traduce los requisitos de ambos briefings en un contrato técnico de trabajo. Los campos y catálogos indicados como requisitos proceden de los briefings; rutas, paginación y estrategias todavía no aprobadas son propuestas, no decisiones vigentes.

## 2. Hechos técnicos confirmados

- El entrypoint activo es `services/api/main.py`. Incluye los routers de incidencias e inventario y crea las tablas SQLModel registradas al iniciar si `DATABASE_URL` configura un engine. `SQLModel.metadata.create_all()` crea tablas ausentes, pero no representa una migración de tablas existentes.
- Incidencias se persiste actualmente en TinyDB (`incidents_table` de `services/api/database.py`) mediante `services/api/services.py`. `services/api/incidents.py` expone CRUD parcial con `category`, `origin`, `branch` y estados antiguos. Sus endpoints no declaran `get_current_user`.
- El analizador CSV es otra aplicación (`services/api/app/main.py`) con endpoints `/api/incidents/analyze` y `/api/incidents/results/export`; debe seguir separado del CRUD y conservarse.
- Inventario se persiste en PostgreSQL mediante SQLModel (`Asset`, `AssetEntry`, `AssetExit`). Actualmente el stock se agrega globalmente por producto, no por oficina; el esquema y catálogo son incompatibles con el nuevo briefing. Sus endpoints sí requieren `get_current_user` y almacenan el UUID autenticado en órdenes.
- No se encontró configuración Alembic/migraciones en `services/api/`; los modelos activos se crean mediante `create_all()`. Existe un `seed_inventory.py` que opera sobre las tablas legacy y un usuario TinyDB existente.
- El backoffice tiene rutas protegidas existentes para incidencias e inventario. `lib/incidents-api.ts` usa `fetch` sin añadir el Bearer token; el cliente de inventario usa `authRequest` y el token almacenado. El proxy Next `/api/:path*` reenvía al host de API configurado.
- Las pruebas de incidencias existentes ejercitan el contrato legacy y el analizador. Las pruebas de inventario usan SQLite de prueba y comprueban, entre otros, el comportamiento legacy de stock global. No prueban el nuevo contrato.
- El Git inspeccionado antes de redactar esta fase estaba limpio en `Auditoria-Monorepo`, siguiendo `origin/Auditoria-Monorepo`; no había archivos sin seguimiento. No se han leído ni expuesto valores de `.env`.

## 3. Contrato funcional requerido

### 3.1 Incidencias

Campos mínimos: `client_name` nullable, `channel`, `type`, `severity`, `responsible_area`, `title`, `description`, `status`, `assigned_to`, `sla_deadline` nullable, `created_at`, `updated_at`.

Catálogos canónicos exactos:

- `channel`: `email`, `slack`, `helpdesk_ticket`, `client_call`, `dashboard`.
- `type`: `sla_breach`, `client_escalation`, `system_outage`, `data_issue`, `staffing_gap`, `compliance_flag`.
- `severity`: `critical`, `high`, `medium`, `low`.
- `responsible_area`: `marketing`, `sales`, `hr_internal`, `talent_selection`, `corporate_training`, `customer_support`, `technology`.
- Estados nombrados por el brief: `open`, `assigned`, `in_progress`, `resolved`, `closed`, `reopened`.
- Restricción SLA del brief: `sla_breach` requiere `sla_deadline`; cualquier otro tipo debe llevarlo nulo. Fechas comparables en UTC.
- Cada transición y cambio efectivo de `assigned_to` o `responsible_area` requiere un evento de auditoría separado, con autor y timestamp; el historial debe ser visible por incidencia.
- El CRUD, los filtros/resumen por severidad y la visualización clara de riesgos/vencimientos deben permanecer en la UI autenticada. El analizador CSV existente es una capacidad aparte.

**Matriz de transiciones:** pendiente de aprobación. El brief indica la secuencia `open → assigned → in_progress → resolved → closed` y una reapertura desde `resolved` antes de cierre, pero no completa las transiciones que salen de `reopened` ni si se permiten saltos.

### 3.2 Inventario

- Artículo: `office`, `name`, `category`, `unit_of_measure`, `reorder_point`, `created_at`, `updated_at`.
- Lote: `item_id`, `lot_code`, `expiry_date`, `received_at`; obligatorio para material formativo controlado por lote y opcional en los demás casos según el brief.
- Movimiento: `item_id`, `lot_id` nullable cuando no aplica, `movement_type`, `quantity`, `reason` (obligatorio en `adjustment`), `created_at`.
- Catálogos exactos: oficina `valencia`/`miami`; unidad `unit`/`box`; categoría `it_equipment`/`office_supplies`/`training_materials`/`branded_merchandise`; movimiento `inbound`/`outbound`/`adjustment`.
- Stock derivado (no editable ni almacenado como saldo): suma de entradas menos salidas más el efecto de ajustes, por artículo/oficina; nunca combinar oficinas. Alerta de reorden cuando `stock <= reorder_point`.
- Rechazar salidas que dejen stock negativo, referencias inexistentes o lote ajeno al artículo, y salidas desde lotes caducados cuando aplique control de lote.

**Convención de cantidad de ajuste y señal de qué artículos controlan lote:** pendientes de aprobación. El brief no define el signo de `quantity` de un ajuste ni un campo explícito de artículo que indique control obligatorio por lote.

## 4. Contrato HTTP propuesto (no aprobado)

Mantener la API FastAPI activa y el proxy `/api`, proteger rutas operativas con Bearer JWT y derivar el autor de auditoría del usuario autenticado. El cliente nunca puede suministrar el actor de un evento. Requiere adaptar `incidents-api.ts`, hoy sin Bearer token.

Rutas propuestas para incidencias: `POST/GET /incidents`, `GET/PATCH /incidents/{id}`, `PATCH /incidents/{id}/status`, `GET /incidents/{id}/history`, `GET /incidents/summary`. Filtros: `status`, `severity`, `type`, `responsible_area`, y filtro de SLA vencido. Rutas propuestas para inventario: CRUD `/inventory/items`, alta/listado de `/inventory/lots` y `/inventory/movements`, con lectura de stock calculado y alerta incluida en el recurso/resumen.

Propuesta de errores: `401` sin sesión, `404` recurso/referencia inexistente, `409` conflicto de estado/stock/duplicidad, `422` payload o transición/regla inválida, `500` error inesperado sin detalles internos. Alinear al manejador común FastAPI vigente, preservando el formato `detail.code/message/fields` donde corresponda.

Propuesta de lista paginada: `limit` con default 100 y máximo 200, `offset` default 0, respuesta `{items, total, limit, offset}`. Esto difiere de las listas legacy actuales; acordar antes de cambiar consumidores.

## 5. Persistencia, compatibilidad y pruebas

- Incidencias necesita una decisión entre ampliar la persistencia TinyDB actual o migrar el dominio a SQLModel/PostgreSQL. La auditoría debe guardarse atómicamente junto con la modificación de incidencia; la implementación elegida debe proporcionar esa garantía.
- Inventario requiere un esquema nuevo incompatible con `asset`/`assetentry`/`assetexit` y con el seed legacy. No ejecutar `DROP`, recrear, renombrar ni sobrescribir tablas/datos ni lanzar seeds sin estrategia aprobada y respaldo verificable.
- Antes de integración se necesita base PostgreSQL de desarrollo/pruebas y pruebas que validen migración/compatibilidad sin afectar datos. No se ha confirmado en esta fase una conexión de prueba disponible.
- Casos mínimos de pruebas quedan definidos por los criterios de aceptación de `PLAN_IMPLEMENTACION_HITO4.md`: validaciones/catálogos, auth, transiciones, auditoría, idempotencia del seed, stock por oficina, ajustes, concurrencia, lote/caducidad y señal de reorden.
- Para cualquier cambio Next.js, cumplir `uis/backoffice/AGENTS.md` y consultar la documentación instalada en `uis/backoffice/node_modules/next/dist/docs/` antes de editar código de UI. No se modificó frontend en esta fase.

## 6. Decisiones técnicas por defecto y revisión

Ante la indicación de trabajar autónomamente, se fijan las siguientes **decisiones recomendadas por defecto para revisión del usuario**. Son decisiones de diseño propuestas, no afirmaciones de que el usuario o negocio ya las hayan aprobado. Se eligen por consistencia transaccional, trazabilidad y preservación de los datos:

1. **Persistencia y auth de incidencias:** PostgreSQL/SQLModel para incidencias y auditoría, exigiendo JWT en CRUD, resumen e historial. Guardar modificación y evento en la misma transacción; actor exclusivamente desde `get_current_user`. Adaptar `incidents-api.ts` para Bearer. La API existente TinyDB/legacy y el analizador CSV se mantienen disponibles durante una transición compatible; no migrar/borrar registros hasta definir mapeo y validar backup/restauración.
2. **Estados y archivo:** matriz secuencial `open → assigned → in_progress → resolved → closed`; `resolved → reopened → assigned → in_progress → resolved` para reabrir. Sin saltos, salvo cierre posterior a resolución; toda transición válida audita. `reopened` no puede cerrarse directamente. Usar archivo lógico, excluir archivadas por defecto y nunca borrar historial.
3. **Ajustes y lotes:** `adjustment.quantity` firmado, distinto de cero; positivo aumenta, negativo reduce y nunca puede producir saldo negativo. Incorporar `lot_tracked` al artículo; si es verdadero, todo movimiento de salida requiere lote; los artículos no controlados pueden tener lotes opcionales, y toda salida que refiera un lote valida pertenencia y caducidad.
4. **Datos de inventario legacy:** desplegar el modelo nuevo en tablas con nombres nuevos y conservar intactas las tablas legacy. No hacer migración automática de activos/órdenes porque no hay mapeo fiable para todas las nuevas propiedades. Cualquier importación futura deberá ser explícita, reversible, con respaldo probado y reporte de mapeos/excepciones.
5. **SLA:** aplicar literalmente el briefing de incidencias en español: deadline obligatorio únicamente para `sla_breach`; para los demás tipos debe ser nulo. Los SLA de selección del contexto general son promedios, no amplían este contrato.
6. **Listas:** aprobar como contrato de diseño recomendado `limit/offset` (default 100, máximo 200) y `{items, total, limit, offset}`. Validar consumidores antes de sustituir respuestas legacy.
7. **Entorno:** exigir PostgreSQL de desarrollo/pruebas separado de producción, con base/schema dedicado y respaldo/restauración comprobables. Usar configuración explícita del test target (`TEST_DATABASE_URL` o equivalente), validar el nombre/host antes de operaciones de esquema y no imprimir URL/secretos. **La disponibilidad real de ese entorno no ha sido verificada**; no ejecutar migraciones, seeds ni escrituras mientras siga sin confirmar.

## 7. Puerta de fase

Fase 0 ha producido la inspección, el contrato propuesto, las decisiones por defecto y el registro de riesgos. Queda como condición técnica previa a integración con datos confirmar/provisionar PostgreSQL aislado y probar restauración; no se consultaron ni expusieron secretos para averiguarlo. Esta revisión documental no autoriza escrituras sobre bases de datos ni migraciones.

La siguiente fase requiere aprobación explícita del usuario según la instrucción de avanzar fase a fase. Antes de empezar, el usuario podrá aceptar o corregir los defaults de §6; si no hay respuesta, se conservan como **propuestas sujetas a revisión**, sin presentarlas como aprobadas. No iniciar Fase 1 automáticamente.
