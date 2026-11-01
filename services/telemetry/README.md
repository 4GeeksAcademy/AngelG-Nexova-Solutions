# Telemetria del inventario — Hito 6

Modulo importado por la API principal; no necesita otro servidor.
Reporte tecnico: `GET /telemetry/report`, autenticado y restringido a
admin/manager. Devuelve conteos de los cinco tipos, total, tipos desconocidos,
primer/ultimo evento e instante de calculo; nunca properties ni actores.
Filtros opcionales `start`/`end` con zona horaria, intervalo [start,end).
Fechas invalidas devuelven 422; base vacia devuelve conteos cero.
UI: Inventario → Telemetria tecnica (`/backoffice/inventory/telemetry`).
Reutiliza Item/Lot/Movement y PostgreSQL. Antes del arranque debe aplicarse
[003_hito6.sql](../api/migrations/003_hito6.sql) sobre la base autorizada.
La API comprueba el esquema y no ejecuta esta migracion automaticamente.

## Comportamiento implementado

- Item conserva su categoria anterior y agrega `telemetry_category` y
  `programme_id`, asignados conjuntamente y explicitamente. Categorias:
  `training_kit`, `certification`, `onboarding_equipment`.
- Historial no clasificado no se convierte ni genera eventos retrospectivos.
  La cobertura de telemetria comienza para material explicitamente clasificado.
- Nuevos cambios de stock solo por entradas/salidas. Se rechazan ajustes;
  los ajustes historicos se conservan en el calculo del saldo.
- Entrada instrumentada requiere `supplier_id` existente y `unit_cost`.
  Conserva nombre historico del proveedor; su tarifa mensual no es costo
  unitario de material.
- Moneda de oficina del movimiento: Valencia EUR, Miami USD, sin conversion.
  Costos Decimal(12,2); total = cantidad por costo, ROUND_HALF_UP a centimos.
- Cinco eventos: `inbound_order_created`, `outbound_order_created`,
  `stock_threshold_triggered`, `direct_stock_edit_rejected`,
  `kit_cost_variance_detected`.
- Escasez solo al cruzar de stock >= minimo a stock < minimo.
  La alerta visual de inventario sigue usando <= para preservar su UX.
- Variacion absoluta estrictamente >10% de la ultima entrada capturada del
  mismo articulo/proveedor/moneda/unidad; tanto aumentos como disminuciones.
  Base cero/primera entrada no generan comparacion ficticia. El umbral esta
  centralizado en `capture.COST_VARIANCE_THRESHOLD`.

Movimiento y eventos se guardan en una transaccion bajo bloqueo del Item.
Ambos contratos de inventario usan esa misma captura, sin doble emision.
Un origen/evento es unico; repetir un POST sin clave de idempotencia puede
crear otra operacion real: no se promete idempotencia de peticiones.

El envelope conserva ID de evento, version, instantes UTC, origen y
`actor_id` interno para trazabilidad incluso tras borrar el movimiento.
Properties solo incluyen campos tecnicos permitidos, no nombres, notas,
destinatarios, emails, bodies ni tokens. Reporting no expone el actor.
Un rechazo autenticado con Item instrumentado identificado se guarda
independientemente sin cambiar saldo. Intentos sin Item/clasificacion
identificable se rechazan y registran tecnicamente, sin inventar properties.

## Seed manual

Desde `services/api/`, con el entorno del proyecto y DATABASE_URL ya
configurado para la base de desarrollo expresamente autorizada:

```bash
./.venv/bin/python -B seed_hito6.py \
  --user-id ID_USUARIO_EXISTENTE \
  --supplier-id ID_PROVEEDOR_EXISTENTE \
  --week-start 2026-10-26
```

No crea usuarios/proveedores. Inserta 6 materiales, 12 entradas y 12 salidas,
3 categorias/programas y ambas oficinas; genera 6 cruces y 6 variaciones.
Repetir misma semana no duplica el dataset. Calcula despues el reporte.
El usuario confirmo la ejecucion: 6 materiales, 12 entradas y 12 salidas;
reporte succeeded con 6 filas. La captura posterior confirmo 36 eventos
y los valores esperados por oficina/programa.

## Validacion actual

Validacion HTTP/PostgreSQL aislada: seed, idempotencia, cinco eventos,
limites exactos, privacidad, ambos adaptadores, error de pipeline,
publicacion atomica y concurrencia de stock/corridas pasaron.
Comprobacion adicional: disminuciones, base cero, actor y rollback pasaron.
Tras autorizacion para continuar se corrigio el `DetachedInstanceError` del
script y pasaron los casos adicionales UTC/ano ISO/eventos tardios y scheduler.
El usuario confirmo migracion 003 exitosa en SQL Editor, seed y validacion
visual del reporte semanal. Las credenciales/base local no fueron inspeccionadas.
Tambien aporto captura del scheduler con corrida completada; no se ha
observado todavia su siguiente ejecucion automatica del lunes.

Fase de cierre: seis pruebas reproducibles en
`services/api/tests/test_hito6_reports.py` pasaron en runtime Docker aislado.
Incluyen reporte vacio, cinco tipos, privacidad, limites UTC, monedas/costos,
conteo de salidas y exclusion de rebajas del KPI de subidas.
Comprobacion HTTP aislada paso para permisos 401/403/200, shape y fechas 422.
Para repetir desde raiz, con el entorno del proyecto:

```bash
PYTHONPATH=services/api:services services/api/.venv/bin/python -B services/api/tests/test_hito6_reports.py -v
```

La telemetria conserva variaciones absolutas historicas; el reporte semanal
cuenta solo las que tienen costo nuevo mayor que el anterior. Los eventos
no se reescriben. Recalcular una semana aplica la nueva regla del KPI.

No se ejecutaron los pytest locales: el runtime aislado no proporciona
el entorno de desarrollo local. No se instalaron dependencias del proyecto.
Pylance informa `reportMissingImports` en su entorno; no es un typecheck
backend aprobado. Los imports/sintaxis se ejercitaron en el runtime aislado.
