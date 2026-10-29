# Plan de implementación — Hito 4

**Ámbito:** Gestor Centralizado de Incidencias y Gestor de Inventario  
**Fuente funcional:** `incident-manager-for-devs/nexova-BRIEFING.es.md` e `inventory-manager-for-devs/nexova-BRIEFING.es.md`  
**Contexto de negocio:** `../00-general-contexts/` (briefing corporativo, líneas de servicio, tarifas, SLA de selección y manejo de objeciones).

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

1. Los valores persistidos de catálogos serán exactamente los del briefing; la interfaz puede mostrar etiquetas traducidas, conservando los valores canónicos en API/DB.
2. Cada artículo pertenece a una sola oficina (`valencia` o `miami`). Todos sus movimientos y lotes quedan asociados a ese artículo y, por tanto, a esa oficina. No habrá balance compensatorio entre oficinas.
3. El stock será una proyección calculada: `inbound - outbound + adjustment firmado`. Entrada y salida requieren cantidades positivas; el ajuste requiere una cantidad distinta de cero con signo explícito y `reason` obligatorio. Un saldo negativo se rechaza.
4. El punto de reorden se almacena en el artículo, que ya está asociado a una oficina; la alerta se calcula como `stock <= reorder_point` para cada artículo/oficina.
5. Los vales/materiales de formación controlados por lote se emiten vinculando el movimiento al lote. No se aceptará una salida desde lote caducado. Se validará que el lote pertenece al artículo solicitado.
6. Los cambios de estado, `assigned_to` y `responsible_area` de una incidencia crearán eventos de auditoría discretos con instante UTC y autor autenticado. El evento inicial de creación también será trazable. No se editará ni borrará el historial.
7. La eliminación de una incidencia debe preservar evidencia. Preferencia: archivado/borrado lógico y exclusión por defecto de las listas operativas; no borrar eventos. Si el contrato actual exige borrado físico, resolver esa incompatibilidad antes de implementar CRUD destructivo.
8. Autenticación/autorización seguirá la infraestructura existente. La API rechazará operaciones no autenticadas; el autor de auditoría se obtendrá de la identidad autenticada, nunca de un campo libre del cliente.

## 4. Plan por fases

### Fase 0 — Confirmación técnica y especificación ejecutable

- Inspeccionar la configuración efectiva de la base SQL, migraciones/creación de tablas, fixture de auth, rutas Next existentes, proxy API y contratos de frontend.
- Definir contrato OpenAPI para ambas funcionalidades, incluidas respuestas de errores y filtros/paginación. Fijar la matriz de transiciones de estado y política de archivado antes de codificar.
- Preparar una especificación funcional concisa y tareas derivadas de este plan; contrastar cada campo y catálogo con los briefs.
- Identificar estrategia para datos ya guardados en el esquema anterior de inventario: migración reversible/compatibilidad o entorno de desarrollo limpio con respaldo. No borrar tablas ni datos sin aprobación.

**Salida/puerta:** especificación, contratos, decisiones sobre migración y un entorno de pruebas con PostgreSQL.

### Fase 1 — API y dominio de incidencias

- Crear/ajustar esquemas Pydantic para los campos del briefing y enums de canales, tipos, severidad, áreas y estados.
- Persistir campos del dominio, `created_at`/`updated_at`, asignación, fecha SLA y estado; aplicar nulabilidad y validaciones cruzadas: `sla_breach` exige deadline; tipos no SLA no la rellenan.
- Completar endpoints autenticados para crear, listar/filtrar, detalle, editar campos permitidos y archivar/eliminar según la decisión de auditoría. Incluir actualización de estado y resumen por severidad/estado.
- Implementar transiciones secuenciales del ciclo `open → assigned → in_progress → resolved → closed`, y reapertura únicamente desde `resolved`, preservando el evento de resolución anterior. Prohibir `critical → closed` si no pasó por `resolved`.
- Crear tabla/modelo de eventos de auditoría con `incident_id`, tipo de cambio, valor anterior/nuevo, `occurred_at` UTC y actor; insertar evento y actualización de incidencia en una misma transacción.
- Exponer historial por incidencia de solo lectura, ordenado cronológicamente y con identidad de autor legible.
- Asegurar filtros por estado, severidad, tipo, área y SLA vencido/en riesgo; distinguir deadline vencido con comparación temporal definida en UTC.

### Fase 2 — UI de incidencias

- Adaptar `uis/backoffice/lib/incidents-api.ts`, tipos y componentes existentes para el nuevo contrato, conservando la herramienta de análisis CSV cuando sea compatible.
- Construir una vista operativa de incidencias abiertas con filtros de severidad/área/tipo/estado y un resumen de volumen por severidad.
- Dar una señal visual consistente a `sla_breach`, deadlines próximos y vencidos; no depender solo del color (texto/ícono/etiqueta accesibles).
- Añadir formulario de alta y edición con catálogos cerrados, obligatoriedad condicional del deadline y mensajes de validación en español. Evitar enviar campos fuera del modelo.
- Añadir detalle con acciones de transición válidas y timeline de auditoría (estado, reasignación y cambio de área, autor y fecha). Bloquear acciones inválidas en UI y validar de nuevo en servidor.
- Mantener estados de carga, error, vacío, accesibilidad por teclado y protección de rutas/autenticación coherentes con el backoffice actual.

### Fase 3 — API y dominio de inventario

- Definir modelos y esquemas canónicos para `Item`, `Lot` y `Movement`, respetando los campos de §3 del briefing; claves primarias y referencias internas pueden existir como metadatos técnicos.
- Añadir y validar exactamente: oficinas `valencia`/`miami`; unidades `unit`/`box`; categorías `it_equipment`, `office_supplies`, `training_materials`, `branded_merchandise`; movimientos `inbound`, `outbound`, `adjustment`.
- Implementar CRUD de artículos (sin stock editable), consulta de artículo con stock calculado, registro/listado de movimientos e historial/lotes. Limitar payloads a campos permitidos y evitar conservar `sku`/campos legacy como requisitos funcionales del nuevo dominio.
- Calcular stock desde movimientos por artículo (y lote cuando corresponda), nunca persistir un saldo editable. Usar transacción y bloqueo apropiado para serializar salidas concurrentes y evitar stock negativo.
- Rechazar referencias inexistentes de artículo/lote, lotes pertenecientes a otro artículo, salidas que excedan stock y salidas de lote caducado. Requerir motivo en ajustes y validar la semántica del signo.
- Implementar consulta/indicador de reorden por artículo y oficina con `current_stock <= reorder_point`. Las alertas no combinarán oficinas.
- Preparar migración de esquema conservando datos antiguos cuando aplique; probar desde una base vacía y desde una base con tablas previas. No ejecutar seed en producción por defecto.

### Fase 4 — UI de inventario

- Añadir una sección de inventario autenticada al backoffice, sus tipos y cliente API.
- Crear listado/resumen filtrable por oficina y categoría; mostrar unidad, stock derivado, punto de reorden y señal de alerta visible y accesible.
- Añadir formularios para alta/edición del artículo, lotes y movimientos; no ofrecer control de edición de stock.
- Mostrar historial de movimientos con fecha, tipo, cantidad, motivo cuando aplique y lote asociado. Para `training_materials`, reflejar lotes/caducidad y deshabilitar/explicar vales caducados.
- Manejar validaciones HTTP del backend, concurrencia/error de stock, carga, vacío y permisos.

### Fase 5 — Seeds, pruebas integradas y aceptación

- Actualizar `services/api/seed_inventory.py` para que sea idempotente y cree al menos 12 artículos repartidos entre ambas oficinas y las cuatro categorías. Cada artículo tendrá historia suficiente para mostrar inbound, outbound y adjustment; se explicitarán los saldos finales.
- Añadir al menos dos artículos/lotes de materiales de formación con lote, uno caducado; asegurar al menos dos artículos por debajo o en el punto de reorden. Incluir movimientos con ajustes justificados.
- Añadir seed de al menos 12 incidencias con las cuatro severidades, tres áreas como mínimo incluyendo `customer_support`, SLA vencido, incidente interno sin cliente y caso reabierto cuyo historial muestre la recurrencia.
- Hacer que los seeds sean explícitos, repetibles y seguros: no crear usuarios inesperados ni enviar notificaciones; reportar qué insertaron y qué ya existía.
- Ejecutar pruebas unitarias, API, integración con DB, componentes/UI, typecheck, lint enfocado y build. Comprobar migración/reinicio y que las vistas muestran datos reales de los seeds.

## 5. Tareas de implementación (backlog)

### Épica A — Incidencias

- [ ] A1. Aprobar contrato, enums, transiciones, cálculo de vencimiento y política de archivo.
- [ ] A2. Añadir modelos/migración para nuevo dominio e historial de auditoría.
- [ ] A3. Implementar CRUD, filtros, resumen y reglas condicionales de SLA.
- [ ] A4. Implementar máquina de estados y reapertura con auditoría atómica.
- [ ] A5. Añadir pruebas de contrato, permisos, restricciones, autoría e inmutabilidad del historial.
- [ ] A6. Adaptar cliente, tipos y vistas; incorporar resumen por severidad y señales SLA.
- [ ] A7. Crear seed de 12+ incidencias y verificar visualmente los escenarios requeridos.

### Épica B — Inventario

- [ ] B1. Aprobar convención de cantidad de ajuste, borrado de artículos con movimientos y estrategia de migración legacy.
- [ ] B2. Añadir modelos/migraciones Item, Lot y Movement con catálogos estrictos y referencias.
- [ ] B3. Implementar CRUD/artículos, lotes, movimientos, historial y stock derivado por oficina.
- [ ] B4. Implementar validaciones de stock no negativo, lote/artículo, caducidad, ajustes y reorden.
- [ ] B5. Añadir pruebas de invariante, concurrencia, referencias inexistentes, vencimiento y stock separado por oficina.
- [ ] B6. Implementar vistas/forms de inventario con stock calculado, historial y alertas.
- [ ] B7. Sustituir o versionar el seed actual por un seed idempotente del nuevo contrato con 12+ artículos y movimientos.

### Épica C — Integración y entrega

- [ ] C1. Verificar auth/proxy, navegación, configuración de DB y documentación local de ejecución.
- [ ] C2. Ejecutar suite completa aplicable y resolver regresiones en las vistas existentes.
- [ ] C3. Revisar accesibilidad, errores y consistencia español/inglés si se decide añadir segundo idioma.
- [ ] C4. Actualizar documentación de API, seed, esquema y pruebas; registrar resultado de aceptación.

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
