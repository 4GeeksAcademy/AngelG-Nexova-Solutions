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
- Escasez: COUNT de eventos. Variacion: COUNT de eventos con costo nuevo
  mayor que el anterior; rebajas capturadas en telemetria no son subidas.
  Base/costos invalidos fallan explicitamente. Rechazos no son KPI.
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

En local, desde `services/api/`, con el entorno del proyecto y una base
autorizada configurados, se puede ejecutar una semana concreta o dejar el
scheduler activo:

```bash
./.venv/bin/python -B reporting_job.py --week-start 2026-10-26
./.venv/bin/python -B reporting_job.py --schedule
```

El scheduler recupera la ultima semana completa al arrancar y despues ejecuta
cada lunes a las 06:00 UTC. Hace hasta tres intentos, separados 60 segundos,
registra fallos y continua con la siguiente fecha semanal. El proceso debe
permanecer activo.

En produccion, `infra/compose.production.yml` define el servicio persistente
`reporting-scheduler` con la misma imagen que la API y reinicio automatico.
Tras configurar `infra/production.env` con las variables requeridas, el
despliegue completo lo inicia junto con los demas servicios:

```bash
docker compose --env-file infra/production.env -f infra/compose.production.yml up -d
```

Para iniciarlo o consultar su actividad por separado:

```bash
docker compose --env-file infra/production.env -f infra/compose.production.yml up -d reporting-scheduler
docker compose --env-file infra/production.env -f infra/compose.production.yml logs -f reporting-scheduler
```

El comando manual equivalente dentro de `services/api/` es:

```bash
./.venv/bin/python -B reporting_job.py --schedule
```

Si el proceso se interrumpe abruptamente, una corrida puede quedar `running`:
consultar los logs y el estado del pipeline; no asumir exito a partir de ese
estado. Los cambios en el Dockerfile no actualizan una imagen ya construida:
hay que reconstruir y desplegar la nueva imagen API para que el servicio
scheduler pueda ejecutarse.

El Dockerfile incorpora `telemetry/` y `reporting/` en sus rutas de
importacion. La configuracion de Compose define el scheduler, pero esto no
implica que ya se haya desplegado ni que la siguiente corrida automatica se
haya observado.

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
El usuario confirmo migracion, seed 6/12/12 y reporte visual de 6 filas/36
eventos para 2026-10-26: cada fila 108 EUR/USD, 2 entregas, 1 escasez y
1 variacion. Backend /health y frontend reporte respondieron HTTP 200
durante auditoria posterior. No se accedio a configuracion/datos privados.

Fase de cierre: seis tests reproducibles de reportes y cuatro tests
existentes de inventario pasaron; typegen, TypeScript y lint focalizado
tambien. El reporte tecnico se implementa en telemetria como entregable
independiente, no se usa como fuente ni destino del pipeline.
Eventos historicos no se alteraron; un recalculo actualiza el KPI de
subidas excluyendo rebajas. El seed confirmado contiene solo aumentos,
por lo que conserva sus cifras esperadas.
