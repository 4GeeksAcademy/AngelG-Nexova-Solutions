# Plan de implementación — Hito 4

**Ámbito:** Gestor Centralizado de Incidencias y Gestor de Inventario  
**Fuente funcional:** `incident-manager-for-devs/nexova-BRIEFING.es.md` e `inventory-manager-for-devs/nexova-BRIEFING.es.md`  
**Contexto de negocio:** `../00-general-contexts/` (briefing corporativo, líneas de servicio, tarifas, SLA de selección y manejo de objeciones).

## Estado consolidado — 2026-11-01

El usuario confirmó aceptación funcional de las pantallas y edición de campos:
«Quedo funcionando perfecto». El dominio, UI, migración aplicada manualmente
y seed de la demo están implementados. Se validaron las rutas actuales contra
PostgreSQL 16 local aislado: 60 carreras concurrentes (10 por cada uno de seis
escenarios), búsqueda paginada y borrado físico con nuevas conexiones, sin
afectar datos ajenos. Se corrigió el orden de inserción de incidencia/auditoría
descubierto por la FK real; ambas escrituras siguen siendo una transacción.

**Cierre técnico del alcance anterior:** comprobado para la demo académica,
con aceptación funcional del usuario; no equivale a certificación de producción.
**Ampliación de esta petición:** buscadores y eliminación definitiva en ambos
listados implementados. Pasaron 17 tests frontend dirigidos, typecheck, lint
focalizado y build. Falta aceptación visual de estos controles nuevos y una
revisión específica móvil/teclado. Las nuevas aserciones pytest están pendientes
de ejecución del usuario (la imagen disponible no incluye pytest); se validó
el comportamiento actual mediante solicitudes HTTP reales a PostgreSQL aislado.

Las evidencias antiguas de cada fase se conservan como historial; este estado
consolidado sustituye sus referencias a tareas pendientes ya completadas.
No se realizaron nuevas migraciones, seeds, borrados en la demo ni publicaciones.

## 1. Objetivo y alcance

Implementar en el monorepo dos capacidades operativas conectadas al backoffice y a la API existente:

1. **Incidencias:** centralizar la entrada de incidencias de las tres líneas de negocio; gestionar su ciclo de vida; hacer visibles severidad y riesgos de SLA; y conservar un historial verificable de los cambios.
2. **Inventario:** gestionar artículos y movimientos por oficina; calcular el stock exclusivamente a partir de movimientos; impedir salidas inválidas y la emisión de lotes caducados; y señalar necesidades de reabastecimiento por oficina.

El briefing general da prioridad a las incidencias de soporte —su SLA comprometido es de 24 h frente a una resolución media actual de 48 h— y sitúa las incidencias de operaciones, tecnología y otras áreas en el contexto de los procesos centrales de Nexova. También justifica el inventario de auriculares y portátiles para los 30 agentes, artículos de onboarding y materiales formativos. Tarifas, reglas de venta y SLA de selección sirven como contexto, pero no amplían los catálogos ni los campos de estas dos funcionalidades.

**Fuera de alcance en este hito:** transferencias de stock entre oficinas, compras/proveedores, gestión de almacén avanzada, nuevas categorías o estados no indicados en los briefs, notificaciones externas, y cambios a las líneas de selección, ventas o formación más allá de usar sus datos como contexto.

## 2. Lectura del estado actual y brechas

### Incidencias

- Ya existen endpoints y almacenamiento para incidencias en `services/api/incidents.py` y servicios asociados, así como UI y cliente API bajo `uis/backoffice/`.
- El modelo actual usa `category`, `origin` y `branch`; no implementa el nuevo dominio de `channel`, `type`, `severity`, `responsible_area`, `client_name`, `assigned_to` ni `sla_deadline`.
- El flujo de estados actual no ofrece todo el ciclo solicitado y no existe un historial por transición con autor y fecha. El estado actual no debe presentarse como cumplimiento del nuevo briefing.
- La UI actual de incidencias y su analizador CSV son funcionalidades existentes; se deben conservar y evaluar al adaptar la experiencia, no eliminar en bloque.

### Inventario

- Ya existen modelos SQLModel y rutas autenticadas en `services/api/models.py` y `services/api/routers/inventory.py`, con productos, entradas y salidas, y cálculo agregado del stock.
- La implementación actual tiene conceptos distintos (`sku`, `supplier`, `exit_type`, `assigned_to`) y solo operaciones de entrada/salida. No ofrece todavía el modelo requerido de artículos/lotes/movimientos con `unit_of_measure`, `reorder_point`, `adjustment`, lotes y caducidades.
- El stock actual se suma por artículo globalmente; el briefing exige segregación estricta por oficina. Hay que corregir el modelo y el cálculo, no simplemente añadir un filtro de interfaz.
- El inventario depende de PostgreSQL configurado en `services/api`; TinyDB permite arrancar otras partes del backend pero no satisface la persistencia de estas tablas.
- El seed actual tiene menos de 12 productos y usa categorías/oficinas ajenas a los catálogos nuevos. Debe sustituirse o migrarse de forma explícita e idempotente, sin mezclar datos antiguos con nuevos.

## 3. Decisiones de diseño que guían el trabajo

> **Estado de aprobación:** estas decisiones son propuestas de trabajo, no decisiones de negocio aprobadas. La inspección de Fase 0 confirmó brechas y contratos existentes; los defaults recomendados y el contrato HTTP propuesto se detallan en [`ESPECIFICACION_TECNICA_FASE0_HITO4.md`](./ESPECIFICACION_TECNICA_FASE0_HITO4.md) y quedan sujetos a revisión. La Fase 1 fue autorizada para implementación de dominio/API bajo estos supuestos conservadores; su exposición en `/v2/incidents` no sustituye el contrato legacy.

1. Los valores persistidos de catálogos serán exactamente los del briefing; la interfaz puede mostrar etiquetas traducidas, conservando los valores canónicos en API/DB.
2. Cada artículo pertenece a una sola oficina (`valencia` o `miami`). Todos sus movimientos y lotes quedan asociados a ese artículo y, por tanto, a esa oficina. No habrá balance compensatorio entre oficinas.
3. El stock será una proyección calculada: `inbound - outbound + adjustment firmado`. Entrada y salida requieren cantidades positivas; el ajuste requiere una cantidad distinta de cero con signo explícito y `reason` obligatorio. Un saldo negativo se rechaza.
4. El punto de reorden se almacena en el artículo, que ya está asociado a una oficina; la alerta se calcula como `stock <= reorder_point` para cada artículo/oficina.
5. Los vales/materiales de formación controlados por lote se emiten vinculando el movimiento al lote. No se aceptará una salida desde lote caducado. Se validará que el lote pertenece al artículo solicitado.
6. Los cambios de estado, `assigned_to` y `responsible_area` de una incidencia crean eventos discretos con instante UTC y autor autenticado; la creación también es trazable. El historial no tiene edición independiente.
7. Se mantiene archivado con preservación de evidencia. Por petición posterior del usuario para la demo académica se añade eliminación definitiva separada, con confirmación: borra la incidencia y su auditoría, o el artículo y sus movimientos/lotes. No es archivado ni permite recuperar historial. Los endpoints originales conservan su comportamiento; no se ejecuta una migración ni se borran datos al actualizar el código.
8. Autenticación/autorización seguirá la infraestructura existente. La API rechazará operaciones no autenticadas; el autor de auditoría se obtendrá de la identidad autenticada, nunca de un campo libre del cliente.
9. Oficina, unidad y control de lotes son editables como corrección de ficha incluso con historial. No se transfieren ni convierten cantidades: la oficina actual clasifica todo el saldo. Exigir lotes afecta solo a movimientos nuevos y no asigna el stock antiguo a lotes.

## 4. Plan por fases

### Fase 0 — Confirmación técnica y especificación ejecutable

- [x] Inspeccionar entrypoint, configuración condicional de PostgreSQL, `create_all`, ausencia de migraciones Alembic, dependencia de auth, rutas Next existentes, proxy y contratos frontend/API.
- [x] Contrastar catálogos/campos con los briefings; identificar la discrepancia de `sla_deadline` y las transiciones de reapertura que requieren precisión.
- [x] Documentar el contrato funcional, brechas actuales, propuesta HTTP, estrategia de pruebas y registro de decisiones en [`ESPECIFICACION_TECNICA_FASE0_HITO4.md`](./ESPECIFICACION_TECNICA_FASE0_HITO4.md).
- [x] Registrar defaults recomendados (aún sujetos a revisión) para persistencia/auth, matriz de estados y archivo, semántica de ajustes/control de lotes, estrategia legacy de inventario y contrato HTTP.
- [x] Confirmar PostgreSQL local aislado para pruebas sin acceder a datos reales/legacy. El usuario decidió aplicar la migración de su demo sin respaldo, advertido previamente; no se presenta como respaldo realizado.

**Salida/puerta:** la inspección y especificación documental de Fase 0 están completadas. PostgreSQL aislado aún no está confirmado; la Fase 1 se valida con SQLite temporal y no debe ejecutar DDL/escrituras sobre una base PostgreSQL desconocida. Los defaults de diseño siguen sujetos a revisión del usuario.

### Fase 1 — API y dominio de incidencias

**Estado: implementación backend completada y probada con SQLite aislado (2026-11-03); pendiente validación PostgreSQL/migración y aprobación de los defaults de diseño. La Fase 2 está implementada y validada automáticamente; ver su sección.**

- [x] Crear esquemas Pydantic para los campos del briefing y catálogos estrictos de canales, tipos, severidad, áreas y estados.
- [x] Persistir campos del dominio, `created_at`/`updated_at`, asignación, fecha SLA, estado y timestamps de resolución/cierre; aplicar nulabilidad y validaciones cruzadas: `sla_breach` exige deadline; tipos no SLA no la rellenan.
- [x] Añadir endpoints autenticados versionados en `/v2/incidents` para crear, listar/filtrar, detalle, editar, archivar, cambiar estado y consultar resumen; conservar `/incidents` legacy.
- [x] Implementar transiciones secuenciales `open → assigned → in_progress → resolved → closed`, y reapertura únicamente desde `resolved`; la ruta no permite saltar a `closed`.
- [x] Crear modelos de incidencia y eventos de auditoría; insertar evento y cambios de incidencia en una misma transacción, usando el actor autenticado.
- [x] Exponer historial de solo lectura, cronológico, incluyendo actor autenticado.
- [x] Asegurar filtros de catálogo, área y SLA vencido, además de paginación; comparación temporal normalizada a UTC.
- [x] Añadir pruebas API aisladas para autenticación, catálogos/SLA, auditoría, transiciones/reapertura, filtros, summary, archivo y compatibilidad legacy.
- [x] Validar esquema y mutaciones contra PostgreSQL aislado; migración de ciclo de vida preparada/probada previamente y aplicada por el usuario a su demo.

**Verificación registrada (repetida tras los ajustes finales):** desde `services/api/`, `./.venv/bin/python -m pytest tests/test_incidents_api.py tests/test_managed_incidents_api.py tests/test_inventory_api.py -q` — 44 passed, con un aviso deprecado Starlette/httpx. `./.venv/bin/python -m compileall -q incident_models.py incident_schemas.py managed_incidents.py main.py tests/test_managed_incidents_api.py` pasó; `git diff --check` pasó; diagnósticos del editor en los cinco archivos Python: sin errores. No se ejecutó contra PostgreSQL ni se ejecutó el startup de API con `DATABASE_URL` de un entorno externo.

### Fase 2 — UI de incidencias

**Estado: implementación y validación automatizada frontend completadas (2026-11-03); pendiente revisión visual/manual e integración contra API desplegada. La Fase 3 puede avanzar con los defaults descritos en la especificación técnica, aún sujetos a revisión.**

- [x] Añadir cliente/tipos dedicados a `/v2/incidents`, preservando el cliente legacy utilizado por el analizador CSV.
- [x] Construir listado con filtros de severidad/área/tipo/estado y resumen por severidad/SLA vencidos.
- [x] Señalar deadlines próximos/vencidos con etiquetas accesibles además del color.
- [x] Añadir alta y edición con catálogos cerrados, deadline condicional y validación en español.
- [x] Añadir detalle con transiciones permitidas y timeline de auditoría con actor/fecha.
- [x] Mantener auth de backoffice y estados de carga, error, vacío y reintento; añadir pruebas de los flujos de componentes y página.
- [ ] Completar revisión manual de accesibilidad/experiencia visual e integración contra una API desplegada.

**Verificación (2026-11-03):** desde `uis/backoffice/`, `npm test -- --run` pasó (27 archivos, 120 tests); `npx tsc --noEmit` pasó; ESLint focalizado para rutas, componentes, tests, tipos y cliente de incidencias pasó; `npm run build` pasó y generó `/incidents/[id]`. `git diff --check` pasó. El build emitió únicamente el aviso de raíz Turbopack por lockfiles en raíz y en `uis/backoffice`; Vitest emitió el aviso informativo de `vite-tsconfig-paths`. No se hizo smoke test visual ni solicitud contra backend en vivo.

### Fase 3 — API y dominio de inventario

**Estado: API/dominio implementados localmente y validados con SQLite aislado. Pendientes PostgreSQL/migración, concurrencia real, seeds, revisión funcional y Fase 4 (UI). Los defaults aplicados siguen sujetos a revisión.**

- [x] Definir modelos y esquemas canónicos para `Item`, `Lot` y `Movement`, respetando los campos de §3 del briefing; claves primarias y referencias internas pueden existir como metadatos técnicos.
- [x] Añadir y validar exactamente: oficinas `valencia`/`miami`; unidades `unit`/`box`; categorías `it_equipment`, `office_supplies`, `training_materials`, `branded_merchandise`; movimientos `inbound`, `outbound`, `adjustment`.
- [x] Implementar CRUD de artículos (sin stock editable), consulta de artículo con stock calculado, registro/listado de movimientos e historial/lotes. Limitar payloads a campos permitidos y evitar conservar `sku`/campos legacy como requisitos funcionales del nuevo dominio.
- [x] Calcular stock desde movimientos por artículo (y lote cuando corresponda), nunca persistir un saldo editable. Se usa transacción y bloqueo por artículo para serializar salidas cuando la base soporte `SELECT FOR UPDATE`; falta probar concurrencia contra PostgreSQL.
- [x] Rechazar referencias inexistentes de artículo/lote, lotes pertenecientes a otro artículo, salidas que excedan stock y salidas de lote caducado. Requerir motivo en ajustes y validar la semántica del signo.
- [x] Implementar consulta/indicador de reorden por artículo y oficina con `current_stock <= reorder_point`. Las alertas no combinarán oficinas.
- [x] Mantener tablas legacy y crear dominio aditivo sin fusionar saldos; no se requiere migración destructiva de inventario. Creación desde PostgreSQL vacío comprobada; migración de ciclo de vida de incidencias previamente probada preservando tablas existentes.

**Evidencia:** se añadieron `services/api/inventory_models.py`, `inventory_schemas.py`, `routers/inventory_v2.py` y `tests/test_inventory_v2_api.py`; `main.py` registra el router/modelos nuevos. El dominio usa tablas nuevas `inventory_item`, `inventory_lot` e `inventory_movement`; los endpoints y tablas legacy se conservan sin migración. Defaults provisionales: ajustes firmados, `lot_tracked` explícito e inmutable tras iniciar movimientos y borrado restringido con historia. La suite relacionada pasó con **41 tests**, `compileall` y `git diff --check` pasaron y el editor no reportó errores en los cinco archivos Python examinados. PostgreSQL, migración de despliegue, concurrencia real, seed e integración UI no están validados.

### Fase 4 — UI de inventario

**Estado (2026-11-01): UI implementada; typecheck, lint de archivos nuevos, build y 22 tests legacy de inventario aprobados. Pendiente prueba manual del flujo nuevo contra API/PostgreSQL aislado.**

**Seguimiento de auditoría (2026-11-01):** interfaz de inventario unificada con
aspecto legacy y contrato canónico, detalle en ruta propia y páginas numeradas
de 10 registros en ambos gestores. Las vistas legacy redirigen; no se fusionan
datos/tablas. Se corrigieron SLA al editar, archivado UI, protección de
oficina/unidad y bloqueo de mutaciones de incidencias. Typecheck, lint focalizado,
build y pruebas frontend dirigidas pasaron; las nuevas aserciones cubren
paginación, detalle protegido, conservación de SLA y archivado. Pendientes
pytest backend y aceptación manual/concurrencia PostgreSQL; no se declara cierre.

- [x] Añadir una sección de inventario autenticada al backoffice, sus tipos y cliente API.
- [x] Crear listado/resumen filtrable por oficina y categoría; mostrar unidad, stock derivado, punto de reorden y señal de alerta visible y accesible.
- [x] Añadir formularios para alta/edición del artículo, lotes y movimientos; no ofrecer control de edición de stock.
- [x] Mostrar historial de movimientos con fecha, tipo, cantidad, motivo cuando aplique y lote asociado. Para `training_materials`, reflejar lotes/caducidad y deshabilitar/explicar vales caducados.
- [x] Manejar validaciones HTTP del backend, concurrencia/error de stock, carga, vacío y permisos.
- [ ] Validar visualmente, con teclado y contra API real los flujos nuevos de artículos, lotes y movimientos.

La ruta nueva es `/backoffice/inventory`; las vistas de productos/órdenes legacy se preservan. Se reutiliza `authRequest`, incluido el cierre de sesión ante 401. El lint de navegación sigue señalando el error de tema preexistente en `setDarkMode` dentro de un efecto; se reprodujo también sobre `HEAD`, sin modificar esa lógica. Los tests ejecutados son regresiones legacy, no cobertura del componente nuevo.

### Fase 5 — Seeds, pruebas integradas y aceptación

**Avance:** seed canónico versionado en `services/api/seed_hito4.py`, conservando
`seed_inventory.py` legacy. El usuario aportó 2 tests del seed aprobados
(SQLite/API aislados) y posteriormente confirmó la migración aplicada sin error
y ejecutó el seed sobre su base, aclarada como demo académica sin usuarios
operativos: 12 artículos, 3 lotes, 36 movimientos, 12 incidencias y 43 eventos
de auditoría insertados. Son resultados aportados por el usuario, no ejecuciones
del agente. La aceptación integrada completa sigue pendiente.

- [x] Versionar el seed de inventario para que sea idempotente y cree al menos 12 artículos repartidos entre ambas oficinas y las cuatro categorías. Cada artículo tendrá historia suficiente para mostrar inbound, outbound y adjustment; se explicitarán los saldos finales.
- Añadir al menos dos artículos/lotes de materiales de formación con lote, uno caducado; asegurar al menos dos artículos por debajo o en el punto de reorden. Incluir movimientos con ajustes justificados.
- Añadir seed de al menos 12 incidencias con las cuatro severidades, tres áreas como mínimo incluyendo `customer_support`, SLA vencido, incidente interno sin cliente y caso reabierto cuyo historial muestre la recurrencia.
- Hacer que los seeds sean explícitos, repetibles y seguros: no crear usuarios inesperados ni enviar notificaciones; reportar qué insertaron y qué ya existía.
- Ejecutar pruebas unitarias, API, integración con DB, componentes/UI, typecheck, lint enfocado y build. Comprobar migración/reinicio y que las vistas muestran datos reales de los seeds.

## 5. Tareas de implementación (backlog)

### Épica A — Incidencias

- [x] A1. Implementar contrato, enums, transiciones, cálculo de vencimiento y archivo bajo los supuestos utilizados; aceptación funcional del usuario para la demo.
- [x] A2. Añadir modelos/migración para nuevo dominio e historial de auditoría.
- [x] A3. Implementar CRUD, filtros, resumen y reglas condicionales de SLA.
- [x] A4. Implementar máquina de estados y reapertura con auditoría atómica; concurrencia validada en PostgreSQL.
- [x] A5. Añadir pruebas de contrato, permisos, restricciones y autoría; historial sin edición, salvo borrado definitivo solicitado explícitamente.
- [x] A6. Adaptar cliente, tipos y vistas; incorporar resumen por severidad y señales SLA.
- [x] A7. Crear seed de 12+ incidencias, carga confirmada por el usuario y aceptación funcional de las vistas.

### Épica B — Inventario

- [x] B1. Implementar ajustes firmados y separación legacy; se conserva borrado protegido y se añade borrado definitivo separado solicitado por el usuario.
- [x] B2. Añadir modelos aditivos Item, Lot y Movement con catálogos estrictos y referencias.
- [x] B3. Implementar CRUD/artículos, lotes, movimientos, historial y stock derivado por oficina.
- [x] B4. Implementar validaciones de stock no negativo, lote/artículo, caducidad, ajustes y reorden.
- [x] B5. Verificar invariantes/referencias/caducidad en tests y concurrencia mediante rutas actuales sobre PostgreSQL aislado.
- [x] B6. Implementar vistas/forms de inventario con stock calculado, historial y alertas.
- [x] B7. Añadir seed idempotente canónico de 12+ artículos y movimientos, conservando el legacy.

### Épica C — Integración y entrega

- [x] C1. Verificar auth/proxy y navegación con las evidencias de pruebas y funcionamiento del usuario; configuración aislada/documentación de ejecución disponibles.
- [x] C2. Ejecutar comprobaciones dirigidas aplicables, typecheck, lint focalizado, build y validación PostgreSQL de rutas actuales. No se afirma repetición de toda la suite monorepo.
- [ ] C3. Revisar accesibilidad, errores y consistencia español/inglés si se decide añadir segundo idioma.
- [x] C4. Actualizar documentación de API, seed, esquema y pruebas; registrar aceptación funcional y límites pendientes de la ampliación.

## 6. Estrategia de pruebas y criterios de aceptación

### Incidencias — aceptación

- Solo se aceptan valores de catálogo definidos; campos adicionales no se guardan silenciosamente.
- `sla_breach` sin fecha límite falla; otro tipo con fecha límite falla. Los errores son legibles y el endpoint devuelve código apropiado.
- Todas las transiciones permitidas generan exactamente un evento con actor y timestamp; las transiciones inválidas no alteran ni estado ni historial.
- Reapertura parte de `resolved`, conserva la resolución anterior y queda visible como evento. Una incidencia crítica no puede saltar directamente a `closed`.
- Cambios de `assigned_to` y `responsible_area` producen eventos incluso cuando se realizan durante una edición; no se crean eventos si el valor no cambió.
- El detalle presenta la auditoría completa y el listado facilita encontrar incidencias abiertas por severidad y distinguir SLAs vencidos.
- Seed: 12 o más registros y cobertura verificable de todos los casos del brief.

### Inventario — aceptación

- Para cada artículo/oficina, stock mostrado equivale a `Σ inbound - Σ outbound + Σ adjustment`; no existe un endpoint/campo editable de saldo.
- No se mezclan Valencia y Miami; mover/emitir stock en una oficina no cambia la disponibilidad de la otra.
- Una salida que produzca saldo negativo, un artículo/lote inexistente, un lote de otro artículo o lote caducado se rechaza sin dejar movimiento parcial.
- `adjustment` requiere `reason` y admite una variación firmada no nula; su efecto sobre el stock está probado.
- La alerta aparece si y solo si el saldo calculado está en o por debajo del umbral del artículo/oficina.
- Seed: 12 o más artículos, ambas oficinas/cuatro categorías, dos lotes de formación como mínimo incluyendo uno vencido, al menos dos alertas y movimientos inbound/outbound/adjustment según lo definido en el brief.

### Calidad transversal

- Probar usuario no autenticado/autenticado, validaciones API y límites de acceso.
- Probar consistencia transaccional y restricciones SQL; si DB soporta concurrencia, probar dos salidas simultáneas contra el mismo saldo.
- Probar UI para éxito, validación, vacío, carga y fallo de red; navegación y formularios accesibles.
- Ejecutar pruebas backend relevantes, pruebas frontend, typecheck, lint del alcance y build, además de `git diff --check`.
- Mantener intactos datos y cambios locales preexistentes. No correr migraciones destructivas ni seed contra producción.

## 7. Dependencias, riesgos y orden recomendado

- **Dependencia fuerte de DB para inventario:** preparar PostgreSQL de desarrollo/test antes de validar flujos end-to-end; el inicio de API sin DB no valida inventario.
- **Incompatibilidad de esquema:** el inventario existente representa productos con SKU, entradas/salidas y oficinas con otros valores. Definir migración/compatibilidad antes del cambio para no perder datos.
- **Persistencia compartida de incidencias:** el servicio actual usa su contrato y almacenamiento actuales; decidir si ampliar/migrar esa persistencia o cambiar de backend de forma compatible. Preservar incidentes existentes.
- **Auditoría y autenticación:** sin identidad autenticada y escritura atómica, los eventos no sirven como evidencia. Resolver identidad de actor antes del endpoint de historial.
- **Riesgo de concurrencia:** validar salidas con transacción y bloqueo en la base efectiva; una validación previa sin bloqueo no garantiza saldo no negativo.
- **Orden recomendado:** decisiones/migraciones → servicios API y pruebas → seeds → clientes y UI → pruebas end-to-end y documentación. Las dos épicas pueden progresar en paralelo después de cerrar autenticación, DB y patrones de migración.

## 8. Definition of Done del Hito 4

El hito se considera listo cuando ambas funcionalidades cumplen los criterios de aceptación, los seeds se ejecutan de forma segura e idempotente en desarrollo, el historial de auditoría es visible y confiable, los invariantes de inventario se validan en backend y pruebas, y las vistas del backoffice muestran los casos sembrados. Todo cambio de esquema y limitación operativa deberá quedar documentado; los tests relevantes, typecheck, lint enfocado y build deberán finalizar satisfactoriamente.
