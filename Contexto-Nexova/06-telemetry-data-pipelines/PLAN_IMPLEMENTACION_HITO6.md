# Hito 6 — Plan de implementacion

Actualizacion de cierre: migracion/seed y pantalla semanal confirmados por
el usuario. Se agregaron reporte tecnico, UI contextual, COPY de modulos
hermanos en Docker y seis pruebas reproducibles. El KPI semanal cuenta
subidas de costo; la telemetria conserva variaciones en ambas direcciones.
No hubo nuevas migraciones ni reescritura de eventos. Build completo Docker
y deploy no ejecutados. Los estados historicos siguientes son antecedentes.

**Estado: codigo funcional incorporado siguiendo el Hito 6.
Validacion principal aislada, frontend y validacion adicional aprobados.
Migracion/seed/scheduler en el entorno del usuario no ejecutados.**

Estado operativo: [telemetria](../../services/telemetry/README.md) y
[reporting](../../services/reporting/README.md).
El usuario autorizo seguir el brief y adaptar lo existente: nuevas escrituras
solo por entradas/salidas, historial conservado, categorias/programas
adicionales sin inferencia historica, conteo de salidas y variacion absoluta >10%.
Los puntos de decision abajo se conservan como antecedentes, no bloquean codigo.
La validacion adicional fallo inicialmente en su script con DetachedInstanceError.
Tras autorizar continuar se corrigio y pasaron UTC/ano ISO/offsets, eventos
tardios y calculo del lunes. La migracion real esta autorizada pero no aplicada:
sin DATABASE_URL disponible y configuracion restringida; se solicito SQL Editor.

Documentos de Fase 0:
[contrato de telemetria](../../services/telemetry/TELEMETRY_PLAN.md) y
[diseno del pipeline](../../services/reporting/PIPELINE_DESIGN.md).
Se solicito confirmacion de las reglas pendientes, pero no se recibio
respuesta disponible. Las opciones recomendadas no se consideran aprobadas.

## 1. Fuentes leidas y alcance

Se leyeron completos los cuatro briefs de esta carpeta:

- [Telemetria ES](telemetry/nexova-BRIEFING.es.md) y [EN](telemetry/nexova-BRIEFING.md).
- [Pipeline ES](data-pipelines/nexova-BRIEFING.es.md) y [EN](data-pipelines/nexova-BRIEFING.md).

Tambien los diez documentos de [contexto general](../00-general-contexts/):
brief empresarial ES/EN y las parejas ES/EN de lineas de servicio, tarifas,
SLA de contratacion y manejo de objeciones. Se contrastaron con el contexto
raiz, la eleccion empresarial, las reglas y el banco de memoria ya leidos.
Las referencias de los briefs del pipeline a nombres de traduccion que no
existen se interpretan usando los archivos realmente presentes arriba.

Objetivo: telemetria del inventario de material formativo/incorporacion y un
**Reporte Semanal de Desempeno por Oficina y Programa** para direccion/L&D.
No incluye IA, RAG, CRM, matriculas/finalizacion de cursos, integraciones
externas, conversion de monedas ni reconstruccion de actividad historica.
Las tarifas comerciales del contexto general no son costos unitarios de kits:
no se usaran como fuente de costos de inventario.

## 2. Diagnostico del repositorio

Inspeccion de fuentes actuales, no de datos privados:

| Superficie | Estado observado |
| --- | --- |
| Inventario unico | Item/Lot/Movement, stock derivado, oficinas, SKU, proveedor, actor, ajustes y bloqueo de filas |
| Adaptadores Hito 5 | Usan la misma persistencia y la creacion canonica de movimientos; instrumentar una vez en la capa compartida |
| Categorias actuales | TI, oficina, formacion, marca, hardware y perifericos; no son el catalogo formativo del Hito 6 |
| Programa y costos | No hay `programme_id`, clasificacion formativa ni costo de entrada en modelos actuales |
| Proveedores | Directorio TinyDB; los movimientos guardan nombre historico, sin ID estable de proveedor |
| Telemetria | No se encontraron `services/telemetry/`, `telemetry_events` ni los cinco eventos obligatorios en fuentes inspeccionadas |
| Reporting | No se encontraron `services/reporting/`, tabla semanal ni endpoints/corridas del pipeline |
| UI | Inventario y proveedores disponibles; sin vista de telemetria/reporte semanal |

**Conclusion:** el repositorio no cumple todavia el Hito 6. La base operativa
del inventario sirve como punto de partida; no crear otro inventario.
La migracion 002 del inventario fue ejecutada segun salida aportada por el
usuario; antes de una nueva migracion se verificara esquema, sin asumirlo.

## 3. Decisiones que deben quedar autorizadas antes de cambios funcionales

1. **Clasificacion formativa:** propuesta de campos adicionales en Item:
   `telemetry_category` (`training_kit`, `certification`,
   `onboarding_equipment`) y `programme_id`. Mantener `category` actual.
   Son datos explicitamente asignados, no inferidos por nombre, SKU u oficina.
   Los articulos existentes quedan sin clasificar; no fingir cobertura total.
   El material instrumentado requiere ambos campos. Acordar si todos los
   articulos deben clasificarse o solo el subconjunto del brief.
2. **Ajustes:** conflicto real: el brief exige solo entradas/salidas para cambiar
   stock; la app permite ajustes firmados. No retirarlos silenciosamente.
   Resolver si se prohiben para material del Hito 6, si se retiran globalmente
   o si el responsable acepta una desviacion documentada. Bloquea esa parte.
3. **Identidad de proveedor:** para comparar costos del mismo material/proveedor
   hace falta una clave estable; proponer identificador adicional de proveedor
   en nuevas entradas, preservando el texto historico. TinyDB y PostgreSQL
   no admiten una FK entre si: validar explicitamente y conservar la identidad
   historica aun si se borra el proveedor. No enlazar historicos por nombre.
4. **Costo y moneda:** costo unitario Decimal en entradas instrumentadas,
   costo total calculado `unit_cost * quantity`, moneda de oficina del
   movimiento: Valencia EUR, Miami USD. Fijar precision/redondeo monetarios;
   no floats para calculo ni conversion monetaria. Costos desconocidos no son
   cero. Oficina del evento es una instantanea, no la ficha editable actual.
5. **Escasez:** propuesta `stock_before >= reorder_point` y
   `stock_after < reorder_point`, una vez por cruce. No repetir en cada
   operacion que permanece por debajo; no confundir con alerta UI `<=`.
   Fijar tratamiento de cambio del umbral y primer saldo/cero.
6. **Variacion de costo:** el 10% es ejemplo, no requisito fijo. Proponer
   aumento estrictamente mayor que 10% frente a la ultima entrada comparable
   previa, mismo articulo/proveedor/moneda/unidad; fijar formula e historico
   aceptado. Primer costo o base cero: no afirmar variacion calculable.
7. **Kits entregados:** el brief prescribe contar eventos de salida, aunque
   describe unidades entregadas. La v1 respetara `COUNT(outbound events)`
   en `kits_delivered_count`, no `SUM(quantity)`; confirmar expresamente esta
   distincion antes de presentar el KPI a negocio.
8. **Semanas y ejecucion:** UTC, lunes ISO, intervalo [lunes, lunes siguiente).
   Programar lunes para semana completa anterior; confirmar hora UTC concreta
   y lugar autorizado del scheduler. No desplegarlo por aprobar codigo.
9. **Envelope de eventos:** los briefs mencionan uno estandar pero no lo
   especifican completo. Proponer y aprobar contrato versionado con UUID
   de evento, tipo, instante UTC, version, origen/correlacion y properties.
   Actor trazable en movimiento/envelope segun politica aprobada; nunca
   nombres, email, destinatarios, notas, tokens o payloads de solicitudes.

No editar briefs de negocio para resolver estos puntos. Registrar decisiones
en el diseno, y conservar explicita cualquier discrepancia autorizada.

## 4. Fases de implementacion propuestas

### Fase 0 — Contratos y criterios definitivos

- Resolver los nueve puntos anteriores.
- Redactar `services/telemetry/TELEMETRY_PLAN.md`: catalogo de eventos,
  disparadores, properties, formula, hipotesis/decision, privacidad, retencion,
  integridad y comportamiento ante fallos.
- Redactar `services/reporting/PIPELINE_DESIGN.md`: cuatro KPIs, linaje,
  semana, subflows, idempotencia, corridas, atrasos y operacion semanal.
- Proponer listado concreto de campos, tablas, rutas, permisos y migraciones;
  revisar impacto antes de editar contratos protegidos.

**Salida:** diseno aprobado y casos de aceptacion con resultados exactos.

### Fase 1 — Datos del inventario y almacenamiento

- Extender modelo/schema/UI canonicos con clasificacion, programa y costos
  autorizados, sin cambiar IDs, cantidades ni historial existente.
- Crear modulo `services/telemetry/` y tabla PostgreSQL `telemetry_events`;
  eventos append-only, indices por instante/tipo/oficina/programa y unicidad
  de identidad de origen para evitar doble emision.
- Agregar migracion SQL versionada, transaccional y no destructiva; no
  ejecutar sobre demo sin confirmar destino y autorizacion de esa operacion.
- Crear esquema `reporting` y tabla
  `reporting.weekly_office_program_performance` exactamente con los campos
  del brief y UNIQUE `(office, programme_id, week_start)`.
- Persistir metadata de corridas (ID, estado, periodo, tiempos, cantidad
  de eventos/filas y error sanitizado) en reporting, no en telemetria.
- Seeds existentes no fabrican programas/costos ni eventos del pasado.
  Una semilla nueva sera ficticia, separada, idempotente y de ejecucion manual.

**Salida:** esquema validado aisladamente, compatibilidad de datos viejos
y nuevas escrituras con validaciones explicitas.

### Fase 2 — Captura de los cinco eventos

| Evento obligatorio | Captura propuesta |
| --- | --- |
| `inbound_order_created` | Entrada instrumentada confirmada; incluye cantidad y costo unitario/total |
| `outbound_order_created` | Salida instrumentada confirmada |
| `stock_threshold_triggered` | Cruce al saldo estrictamente inferior al minimo, segun decision aprobada |
| `direct_stock_edit_rejected` | Intento autenticado de cambiar stock mutable rechazado; no cambia inventario |
| `kit_cost_variance_detected` | Entrada comparable cuyo costo supera el umbral aprobado |

- Properties minimas: `office`, `product_id`, `product_category`,
  `programme_id`, `quantity`, `currency`; costos y claves de comparacion
  adicionales solo donde corresponden.
- Entrada/salida y eventos se guardan en la misma transaccion PostgreSQL;
  rollback no deja evento de una operacion inexistente. Bloqueo por Item
  conserva stock y serializa cruces/comparaciones.
- Los adaptadores Hito 5 invocan esa misma capa, sin emitir duplicados.
- Capturar rechazo antes de perder el contexto por validacion, usando lista
  permitida de campos. No guardar el body ni inventar programa/producto.
  Para intentos que no identifiquen un Item instrumentado, definir evento
  tecnico diferenciado o ausencia explicita de cobertura, no properties falsas.
- El evento de rechazo requiere transaccion independiente porque no hay
  movimiento exitoso. Persistirlo sin cambiar el HTTP de validacion existente;
  un fallo de captura se registra explicitamente, no como exito.
- Definir idempotencia de peticion: una clave de evento evita reemision del
  mismo origen, pero no evita dos movimientos si el cliente repite POST.
  Acordar clave de idempotencia de escrituras si se requiere esa garantia.

**Salida:** cinco eventos reales, validos, trazables y sin datos personales.

### Fase 3 — Pipeline semanal y subflows

1. Seleccionar semana y snapshot de origen por instante del evento.
2. Extraer exclusivamente los cuatro tipos que alimentan KPIs.
3. Validar properties, fechas, costos, oficina/moneda y unicidad.
4. Agregar por oficina/programa/semana, sin unir EUR y USD.
5. Publicar por UPSERT y registrar corrida completa.

- `total_material_cost`: suma exacta de costos totales de entradas.
- `kits_delivered_count`: conteo de eventos de salida conforme al brief.
- Escasez y variacion: conteos de sus respectivos eventos.
- `direct_stock_edit_rejected` se conserva en telemetria, pero no es KPI v1.
- Cada run reemplaza valores calculados, no incrementa acumulados anteriores.
  Repetir periodo no duplica filas ni cantidades.
- Publicacion atomica: una corrida fallida no deja resultados parciales;
  registrar fallo en transaccion separada y mantener ultimo resultado valido.
- Tratar eventos tardios mediante recalculo explicito del periodo; registrar
  corte de origen y `computed_at`. Evitar dos corridas simultaneas del periodo.
- Si un recalculo ya no genera una fila existente, definir su conciliacion
  para no conservar cifras obsoletas; cualquier DELETE sera acotado al periodo
  autorizado de reporting, nunca a la fuente.
- Datos invalidos fallan con explicacion sanitaria; no omitirlos silenciosamente.

**Salida:** consolidado semanal auditable e idempotente.

### Fase 4 — Endpoints y acceso desde backoffice

Crear modulo **separado** `services/reporting/`, registrado en la API
principal, sin un segundo proceso obligatorio para esta app academica:

- `GET /reporting/weekly-office-program-performance?week_start=YYYY-MM-DD`
  devuelve `{week_start, entries}` conforme al ejemplo del brief.
  Por defecto semana calculada mas reciente, no semana del ultimo fallo.
- `GET /reporting/pipeline-runs/latest`: estado y metadata persistente.
- `POST /reporting/pipeline-runs`: corrida manual con permisos acordados;
  v1 sin broker, cola o servicio externo innecesarios.

Validar lunes ISO y fechas; definir respuesta explicita para semana sin
calcular, ausencia de corridas y colision de ejecuciones.
Separar ausencia valida de datos de indisponibilidad de pipeline/base.

UI propuesta: boton **Reporte semanal** desde Inventario, como Proveedores,
sin nuevo navbar; tabla por oficina/programa, EUR/USD separados, seleccion
de semana, estado/fecha de corrida y ejecucion manual segun permisos.
No exponer eventos crudos/datos de actor a direccion.
El reporte es un consolidado de material, no un dashboard de matriculas.

`services/telemetry/analysis.py` y `GET /telemetry/report` no existen en la
copia inspeccionada. El brief del pipeline los excluye: no inventar su
implementacion ni convertirlos en dependencia. Si la rubrica de captura
exige reporte tecnico propio, pedirla y delimitar una fase aparte antes de
implementar; el reporte semanal no los sustituye automaticamente.

**Salida:** contrato de reporte utilizable y UI conectada, sin rutas huérfanas.

### Fase 5 — Programacion, validacion y cierre

- CLI/manual primero; scheduler semanal solo tras confirmar entorno/hora.
  No afirmar automatizacion si solo se ejecuto manualmente.
- Reutilizar tooling existente; para nuevas pruebas, pedir autorizacion
  explicita, ya que las instrucciones del repositorio no permiten crearlas
  por defecto. No instalar paquetes para evitar limitaciones sin permiso.
- Registrar comandos realmente ejecutados, fallos y alcance de cada prueba.
- Actualizar README de ambos modulos, API/backoffice y progreso con evidencia.
- Entregar reporte semanal de ejemplo ficticio y guia de operacion/reintento.
- No commit, push, deploy ni ejecucion sobre demo incluidos en esta aprobacion.

## 5. Verificaciones y criterios de aceptacion

| Criterio | Evidencia prevista |
| --- | --- |
| Cinco tipos obligatorios | Provocar cada caso mediante API; verificar evento/propiedades exactos |
| Misma persistencia inventario | Movimiento via cada contrato produce un solo origen/evento |
| No stock directo | Intento rechazado, saldo intacto, rechazo instrumentado sin body |
| Umbral exacto | Igual al minimo no dispara; cruce por debajo si; operaciones debajo no duplican; reposicion permite nuevo cruce |
| Variacion exacta | Base 100, costo 110 no dispara y 110,01 si bajo propuesta >10%; primer costo/base cero definidos |
| Costo correcto | Cantidad 3 x costo 12,50 = 37,50; no confundir costo con tarifa mensual proveedor |
| Conteo vs cantidad | Una salida de cantidad 5 cuenta 1 evento, no 5, si se aprueba lectura literal del brief |
| Monedas | Valencia EUR y Miami USD en filas separadas; moneda incompatible rechazada |
| Semana ISO UTC | Casos domingo/lunes, timestamps con offsets y cambio de ano ISO |
| Idempotencia | Dos runs de misma semana producen mismas cifras y numero de filas |
| Atomicidad | Error de evento/publicacion no deja movimiento/evento/reporte parcial segun transaccion aplicable |
| Concurrencia | Dos salidas compiten por saldo; un solo cruce; runs simultaneos controlados |
| Privacidad | Lista permitida de properties, sin nombres, email, notas, destinatarios ni secretos |
| Fuente solo lectura | Comparar eventos antes/despues del pipeline y permisos de lectura sin UPDATE/DELETE |
| API/reportes | Shape exacto, fecha invalida, semana ausente, auth/permisos, fallo y reintento |
| Datos de prueba | 6–8 materiales, 3 categorias, >=3 programas, 12–15 entradas y 12–15 salidas, ambas oficinas, >=2 escaseces y >=1 variacion |
| UI | Boton desde inventario, semana/moneda, carga/error/vacio, ejecucion segun permisos |
| Automatizacion | Scheduler autorizado produce semana anterior el lunes; run registrado |

Los casos SQL/concurrencia se ejecutaran en PostgreSQL aislado, sin bases o
archivos privados. El seed de prueba usa programas/costos ficticios y no
requiere borrar o reiniciar los inventarios existentes.
Pytest local estuvo restringido en tareas anteriores; no prometer acceso.
Typecheck/lint/frontend se ejecutaran focalizados, con webpack en desarrollo
si se reproduce el bloqueo de Turbopack ya documentado.

## 6. Archivos previstos y exclusiones

- Nuevos: `services/telemetry/` (contratos/captura/almacenamiento/README),
  `services/reporting/` (subflows/modelos/router/CLI/README/diseno),
  migraciones de esquema y seed ficticio separado.
- Modificados: modelos/schemas/creacion de movimientos y validacion de
  inventario, registro de routers principal, formulario/historial del
  inventario y cliente/vista del reporte en `uis/backoffice/`.
- Reutilizados: autenticacion, sesiones SQL, controles de stock/lotes,
  directorio de proveedores, proxy API y componentes de UI existentes.
- Tests nuevos solo con autorizacion; no tocar dependencias/lockfiles,
  workflows/despliegue ni variables reales por conveniencia.
- Fuera: dos contratos de incidencias, analizador CSV, pipeline candidatos,
  Usuarios, RAG/IA y reportes generales de otros departamentos.
- No borrar historial ni recalcular telemetria antigua con informacion
  inferida. La cobertura comienza con escrituras instrumentadas.

## 7. Autorizacion

El usuario autorizo continuar y se inicio la documentacion de Fase 0.
La siguiente accion requiere respuesta del usuario: **resolver las decisiones
de negocio antes de implementar las fases funcionales**.
La autorizacion general no resuelve por si sola los conflictos
de categorias/ajustes ni permite modificar datos reales, instalar dependencias
o publicar cambios. Las decisiones pendientes se consultan antes de sus
fases afectadas. Se crearon los dos documentos tecnicos enlazados arriba;
no se implementaron modelos, eventos, migraciones, APIs ni pantallas del Hito 6.
