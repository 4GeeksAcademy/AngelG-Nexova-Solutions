# Telemetria de inventario — contrato propuesto v1

Estado: propuesta original de Fase 0, conservada como antecedente.
El usuario autorizo seguir literalmente el Hito 6 y modificar lo existente.
La [implementacion actual](README.md) reemplaza las opciones pendientes:
ajustes nuevos prohibidos globalmente, variacion absoluta >10%, actor interno
en envelope, sin correlation_id adicional. Codigo presente, validacion parcial.
Fuente: [plan Hito 6](../../Contexto-Nexova/06-telemetry-data-pipelines/PLAN_IMPLEMENTACION_HITO6.md).

## Cobertura y compatibilidad

Una sola persistencia Item/Lot/Movement. Propuesta: agregar
`telemetry_category` y `programme_id` a Item sin sustituir `category`.
Ambos se asignan explicitamente o ambos permanecen sin asignar.
Un articulo instrumentado requiere programa y una de las categorias
`training_kit`, `certification`, `onboarding_equipment`.

No inferir programas/costos del historial ni emitir eventos retrospectivos.
Los eventos conservan instantaneas: editar el articulo despues no cambia
su oficina, programa, categoria, costo ni semana historicos.

Pendiente: prohibir ajustes solo en material instrumentado. No modificar
la politica de ajustes existente hasta recibir decision expresa.

## Envelope

Propuesta de tabla PostgreSQL `telemetry_events`:

- `event_id`: UUID generado en servidor, clave primaria.
- `event_type`: uno de los cinco tipos abajo.
- `event_version`: entero, inicialmente 1.
- `occurred_at`: timestamptz UTC de la operacion/rechazo.
- `recorded_at`: timestamptz UTC de persistencia.
- `source`: identificador tecnico fijo `inventory`.
- `source_id`: identificador del movimiento, o UUID del intento rechazado.
- `correlation_id`: UUID tecnico generado/validado, nunca texto libre.
- `properties`: JSON con campos permitidos y contrato por tipo.

Unicidad `(source, source_id, event_type, event_version)` evita reemitir
el mismo evento. No garantiza idempotencia del POST de movimientos:
esa garantia requiere contrato de peticion adicional si se solicita.
El actor permanece trazable mediante Movement; el rechazo no incluye
identidad personal. Definir politica de auditoria y retencion antes de
persistir identificadores de actor adicionales.

Properties comunes obligatorias: `office`, `product_id`,
`product_category`, `programme_id`, `quantity`, `currency`.
`office` es `valencia` o `miami`; moneda EUR o USD respectivamente.
IDs y cantidad corresponden al movimiento validado, no al body sin validar.

Valores Decimal se serializan como cadenas decimales, sin calculo float.
Propuesta monetaria: costo unitario Numeric(12,2), total Numeric(24,2),
redondeo ROUND_HALF_UP tras multiplicar por cantidad; confirmar esta regla.
Rechazar exceso de precision/rango, costos negativos y moneda incompatible.
Una entrada instrumentada necesita costo y proveedor estable.
No tratar costo desconocido como cero.

## Catalogo y disparadores

| Evento | Properties adicionales permitidas | Disparador propuesto |
| --- | --- | --- |
| `inbound_order_created` | `movement_id`, `supplier_id`, `unit_cost`, `total_cost`, `unit_of_measure` | Entrada confirmada de material instrumentado |
| `outbound_order_created` | `movement_id`, `unit_of_measure` | Salida confirmada de material instrumentado |
| `stock_threshold_triggered` | `movement_id`, `stock_before`, `stock_after`, `reorder_point` | Antes >= minimo y despues < minimo |
| `direct_stock_edit_rejected` | `reason_code` fijo | Intento autenticado de stock mutable, Item instrumentado identificado |
| `kit_cost_variance_detected` | `movement_id`, `supplier_id`, `previous_movement_id`, `previous_unit_cost`, `unit_cost`, `variance_percent`, `threshold_percent` | Aumento estrictamente >10% frente a ultima entrada comparable |

Variacion propuesta: `(nuevo - anterior) / anterior * 100`.
Comparable: mismo Item, proveedor estable, moneda y unidad.
Sin entrada previa/base cero no hay variacion calculable; no generar alerta
ficticia. La regla >10% y su direccion estan pendientes de aprobacion.

No generar escasez repetida mientras el saldo siga por debajo. Una
reposicion que lo recupera permite un futuro cruce. Cambiar el minimo
no dispara evento en v1; la alerta visual existente no cambia por defecto.

Identidad de proveedor: nueva referencia estable validada contra TinyDB,
sin FK cruzada; mantener nombre historico ya existente en Movement.
Borrar proveedor no borra ni invalida eventos historicos.
No reconciliar proveedores antiguos por coincidencia de nombres.

## Integridad y errores

Capturar una vez en la creacion canonica compartida por ambos contratos
de inventario, con bloqueo del Item y eventos en la misma transaccion SQL.
Fallo de captura revierte movimiento y eventos; no devolver exito.
No agregar commit independiente al flujo de entradas/salidas.

Rechazos de stock: detectar solo rutas y campos acordados, preservando
el status HTTP y formato de validacion actuales. Persistencia independiente,
sin modificar saldo. Fallos de captura se notifican en logging tecnico
sanitizado; nunca se ocultan como evento guardado.
Si no se identifica un Item instrumentado, no inventar properties
obligatorias: documentar ausencia de cobertura del evento de negocio.

Lista permitida estricta: no nombres, email, destinatarios, notas, razones
libres, body, cookies, tokens ni URL con query sensible.
Un ID tecnico no autoriza exponer identidad al reporte.

## Verificacion prevista

Provocar los cinco tipos, rollback y doble contrato; medir limites exactos
del minimo y >10%; validar cantidades Decimal, proveedor borrado,
instantaneas y campos permitidos. Usar datos ficticios en PostgreSQL
aislado. Pruebas nuevas requieren autorizacion; no ejecutadas en Fase 0.

## Puerta de salida

Antes de implementar: confirmar cobertura, ajustes, costo/variacion,
proveedor estable, envelope y tratamiento de intentos no identificables.
No se autoriza migracion de datos ni publicacion con este documento.
