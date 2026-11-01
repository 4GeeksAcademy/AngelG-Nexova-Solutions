# Telemetria del inventario — Hito 6

Modulo importado por la API principal; no necesita otro servidor.
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
No se ejecuto sobre la base del usuario.

## Validacion actual

Validacion HTTP/PostgreSQL aislada: seed, idempotencia, cinco eventos,
limites exactos, privacidad, ambos adaptadores, error de pipeline,
publicacion atomica y concurrencia de stock/corridas pasaron.
Comprobacion adicional: disminuciones, base cero, actor y rollback pasaron.
Tras autorizacion para continuar se corrigio el `DetachedInstanceError` del
script y pasaron los casos adicionales UTC/ano ISO/eventos tardios y scheduler.
La migracion 003 fue autorizada para la base del usuario, pero no aplicada:
DATABASE_URL no esta disponible en la terminal y la configuracion local
esta restringida. Se solicito ejecucion desde SQL Editor; sin confirmacion.

No se ejecutaron los pytest locales: el runtime aislado no proporciona
el entorno de desarrollo local. No se instalaron dependencias del proyecto.
Pylance informa `reportMissingImports` en su entorno; no es un typecheck
backend aprobado. Los imports/sintaxis se ejercitaron en el runtime aislado.
