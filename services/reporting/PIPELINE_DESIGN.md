# Reporte semanal — diseno propuesto v1

Estado: propuesta original de Fase 0, conservada como antecedente.
Pipeline, rutas y comando scheduler implementados; ver [estado actual](README.md).
La migracion en datos del usuario, despliegue y verificaciones adicionales
UTC/eventos tardios siguen pendientes. No se afirma automatizacion activa.
Fuente: [brief del pipeline](../../Contexto-Nexova/06-telemetry-data-pipelines/data-pipelines/nexova-BRIEFING.es.md).
Contrato de origen: [telemetria](../telemetry/TELEMETRY_PLAN.md).

## Alcance y grano

Fuente unica `telemetry_events`, de solo lectura.
Grano `(office, programme_id, week_start)` con semana ISO lunes UTC
y ventana semiabierta [lunes, lunes siguiente).
No deducir dimensiones del estado actual de Item ni leer datos personales.
No mezclar monedas: Valencia EUR, Miami USD.

| KPI | Fuente | Formula |
| --- | --- | --- |
| `total_material_cost` | `inbound_order_created` | SUM de `total_cost`, Decimal |
| `kits_delivered_count` | `outbound_order_created` | COUNT de eventos, pendiente de confirmar frente a unidades |
| `shortage_events_count` | `stock_threshold_triggered` | COUNT de eventos |
| `cost_variance_events_count` | `kit_cost_variance_detected` | COUNT de eventos |

`direct_stock_edit_rejected` no alimenta KPIs v1.
Costos faltantes no se convierten a cero. Tarifas comerciales de formacion
o proveedores no son costos de entradas.

## Persistencia destino

Crear exactamente la tabla del brief:

```sql
create table reporting.weekly_office_program_performance (
  id uuid primary key default gen_random_uuid(),
  office text not null,
  programme_id text not null,
  week_start date not null,
  total_material_cost numeric not null default 0,
  kits_delivered_count integer not null default 0,
  shortage_events_count integer not null default 0,
  cost_variance_events_count integer not null default 0,
  currency text not null,
  computed_at timestamptz not null default now(),
  unique (office, programme_id, week_start)
);
```

Tabla adicional de corridas: UUID, `status` (running/succeeded/failed),
semana, inicio/fin UTC, corte de origen, eventos leidos, filas publicadas
y codigo de error sanitizado. Sin bodies ni mensajes de DB que revelen
valores privados. Un periodo vacio puede completar con cero filas:
la existencia de una corrida exitosa distingue vacio de no calculado.

## Subflows y transacciones

1. Validar semana y permisos; adquirir bloqueo por periodo.
2. Crear corrida running; tomar snapshot consistente de origen.
3. Leer solo los cuatro tipos v1 dentro de ventana temporal.
4. Validar version, IDs, cantidades/costos y oficina/moneda.
5. Agregar por grano con operaciones Decimal exactas.
6. UPSERT que reemplaza valores, nunca suma sobre el resultado previo.
7. Marcar corrida succeeded y publicar en la misma transaccion.

Registrar fallo en transaccion independiente; conservar ultimo reporte
valido. No publicar parcialmente, omitir eventos invalidos ni devolver
exito por un error. Una corrida concurrente del periodo se rechaza
explicitamente. Recalculo manual incorpora eventos tardios.

Conciliar filas obsoletas solo dentro del periodo recalculado y destino
reporting, con politica aprobada; nunca UPDATE/DELETE sobre telemetria.
No borrar filas de otras semanas. Retencion/destruccion de reportes y
eventos queda fuera de alcance hasta autorizacion.

## API propuesta

Modulo separado `services/reporting/`, registrado en API principal.
Sin nuevo proceso, broker o dependencia externa obligatoria para la v1.
Reutilizar autenticacion y sesiones existentes.

- GET `/reporting/weekly-office-program-performance?week_start=YYYY-MM-DD`:
  lunes valido; default periodo mas reciente con corrida exitosa.
- GET `/reporting/pipeline-runs/latest`: ultima corrida incluso si fallo.
- POST `/reporting/pipeline-runs`: ejecutar periodo explicitado, o semana
  completa anterior por defecto; respuesta solo tras conocer resultado.

Shape obligatorio de reporte:

```json
{
  "week_start": "2026-10-26",
  "entries": [{
    "office": "valencia",
    "programme_id": "leadership",
    "total_material_cost": 37.50,
    "kits_delivered_count": 1,
    "shortage_events_count": 0,
    "cost_variance_events_count": 0,
    "currency": "EUR"
  }]
}
```

Mantener costo como numero JSON conforme al brief, calculando con Decimal
internamente; validar serializacion y precision antes de publicar contrato.
Orden estable por oficina/programa.
Propuesta: 422 para fecha/no-lunes invalido, 404 para periodo no calculado
o ausencia de corridas, 409 para run concurrente, 5xx para fallo tecnico.
La integracion con el handler global debe preservar estos status y no
alterar errores de otros routers.
Reporte calculado vacio devuelve 200 y `entries: []`.

Lectura para usuarios autenticados con politica de roles existente;
trigger manual restringido a roles de administracion ya existentes.
Los roles concretos se verifican en codigo antes de implementar; no
inventar permisos ni usuarios nuevos.

## UI y operacion

Boton Reporte semanal desde Inventario, pagina contextual en backoffice.
Seleccion de semana, tabla separando EUR/USD, fecha y estado de corrida,
estados carga/error/vacio y trigger visible solo al rol permitido.
No eventos crudos ni identidades de actores en esta vista.

Manual/CLI primero. Scheduler lunes para semana anterior solo despues
de confirmar hora UTC y entorno; no se considera desplegado por existir
una funcion o comando. No modificar `services/telemetry/analysis.py`
ni `/telemetry/report`; no existen en la copia inspeccionada y no son
dependencia del reporte semanal.

## Aceptacion y pendientes

Verificar: domingo/lunes UTC y ano ISO; costo 3 x 12,50 = 37,50;
una salida de 5 cuenta 1 bajo lectura literal; dos oficinas sin FX;
dos runs iguales mantienen cifras/filas; fallos sin publicacion parcial;
eventos tardios; fuente intacta; respuesta exacta y permisos.
No se ejecutaron pruebas en esta fase documental.

Bloquean codigo: decisiones de telemetria, definicion final del KPI,
precision API y roles verificados. Scheduler/migraciones sobre datos
reales requieren autorizacion adicional, no incluida en este diseno.
