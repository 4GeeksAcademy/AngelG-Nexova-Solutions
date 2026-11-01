# Reporte semanal de oficina/programa — Hito 6

Modulo separado de telemetria, registrado en la misma API FastAPI.
Fuente: `telemetry_events`, solo SELECT en el pipeline; destino:
`reporting.weekly_office_program_performance` y `reporting.pipeline_runs`.
Se requiere [migracion 003](../api/migrations/003_hito6.sql), de ejecucion
manual autorizada. No se modifica `/telemetry/report` ni `analysis.py`.

## Contrato y reglas

- Grano oficina/programa/semana. Semana lunes UTC, intervalo [lunes, siguiente lunes).
- Costo total: SUM de costos de entradas, Decimal; salida JSON numerica sin
  convertir el costo a float en el backend.
- `kits_delivered_count`: COUNT de eventos de salida, no SUM de unidades.
- Escasez/variacion: COUNT de los respectivos eventos. Rechazos no son KPI.
- EUR/USD permanecen separados. No deduce dimensiones del Item actual.
- UPSERT reemplaza valores por grano. Fuente append-only; no se borra ni
  modifica telemetria. Recalcular incorpora eventos tardios.
- Bloqueo PostgreSQL por semana impide runs simultaneos.
  Publicacion y estado succeeded son atomicos; fallo conserva ultimo reporte
  valido y registra estado failed con codigo de error sanitizado.
  Eventos invalidos no se omiten silenciosamente.

Rutas autenticadas:

| Ruta | Comportamiento |
| --- | --- |
| GET `/reporting/weekly-office-program-performance` | `{week_start, entries}`; por defecto ultima semana con corrida exitosa |
| GET `/reporting/weekly-office-program-performance?week_start=YYYY-MM-DD` | Semana explicitada; 422 si no es lunes/fecha valida, 404 si no calculada |
| GET `/reporting/pipeline-runs/latest` | Ultima corrida, incluso fallida; 404 si no existe |
| POST `/reporting/pipeline-runs` | Body `{week_start: fecha_o_null}`; admin/manager; null calcula semana anterior completa |

Una semana calculada sin eventos devuelve 200 y entries vacio.
Run concurrente: 409. Fallo tecnico: error, no respuesta de exito.
Cada entrada incluye office, programme_id, total_material_cost,
kits_delivered_count, shortage_events_count, cost_variance_events_count,
currency. Orden estable por oficina/programa.

## Ejecucion manual y programada

Desde `services/api/`, entorno del proyecto y base autorizada configurados:

```bash
./.venv/bin/python -B reporting_job.py --week-start 2026-10-26
./.venv/bin/python -B reporting_job.py --schedule
```

El scheduler recupera la ultima semana completa al arrancar y despues ejecuta
cada lunes a las 06:00 UTC. Hace hasta tres intentos, separados 60 segundos,
registra fallos y continua con la siguiente fecha semanal.
Debe mantenerse el proceso activo; no se instalo ni inicio scheduler,
cron, servicio del sistema o workflow en el entorno del usuario.
Si el proceso se interrumpe abruptamente una corrida puede quedar running:
consultar el proceso/logs; no asumir exito a partir de ese estado.

No se modificaron Dockerfile ni despliegues protegidos. La imagen existente
solo copia `api/`; incorporar estos dos modulos al empaquetado Docker
requiere autorizacion especifica. Los comandos locales usan el arbol actual.

## UI y verificaciones

Acceso: Inventario → Reporte semanal, ruta
`/backoffice/inventory/reporting`, no nuevo navbar.
Selector de lunes, cifras por moneda, ultima corrida y trigger admin/manager.
Para material, clasificar programa/categoria y capturar costos en nuevas
entradas. Las filas antiguas no reciben costos/programas inventados.

Pasaron validacion HTTP/PostgreSQL aislada (shape exacto, monedas,
conteo, idempotencia, vacio, permisos, fallo atomico y locks), typegen,
TypeScript, lint focalizado y cuatro tests existentes del inventario.
Tras autorizacion para continuar y corregir el script, pasaron los casos
adicionales de limites UTC/ano ISO/offsets, eventos tardios y calculo del
proximo lunes del scheduler. Esto no demuestra un scheduler desplegado.
La migracion en datos del usuario esta autorizada, pero no aplicada:
DATABASE_URL no esta disponible y la configuracion esta restringida.
Se solicito ejecutarla desde SQL Editor; sin confirmacion recibida.
Seed, arranque y validacion visual en la app del usuario siguen pendientes.
