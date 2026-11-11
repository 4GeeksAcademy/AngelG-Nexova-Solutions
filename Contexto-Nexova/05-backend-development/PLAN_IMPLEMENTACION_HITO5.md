# Hito 5: plan de verificacion y cierre

> Actualizacion posterior autorizada: los resultados originales siguientes
> corresponden al inventario separado. El usuario confirmo 28 tests exitosos
> y seed 6/4/3 ya existente. Ahora los endpoints del Hito 5 son adaptadores
> a Item/Lot/Movement; models.py y las tablas legacy se sustituyen mediante
> [SQL 002](../../services/api/migrations/002_unify_inventory.sql).
> Fusion validada en PostgreSQL aislado; aplicacion en la demo y runner
> posterior pendientes. Ver [estado actual y auditoria](../../services/api/README.es.md#inventario-unico-hitos-4-y-5).

**Fecha:** 2026-11-01.
**Estado:** ejecucion autorizada y contrato funcional verificado en PostgreSQL
aislado. No se encontraron incumplimientos que requieran cambios de codigo.
Pendiente confirmacion del runner pytest del proyecto por el usuario.
**Fuente:** [briefing del Hito 5](./nexova-BRIEFING.es.md), contrastado con su
version inglesa y los documentos de [contexto general](../00-general-contexts/).

## Diagnostico

El repositorio contiene la implementacion principal pedida. No corresponde
crear otro inventario ni sustituir el contrato del Hito 4.
La inspeccion inicial se complemento con ejecucion HTTP real de la API principal,
seed y consultas SQL en PostgreSQL 16 local aislado.

| Requisito | Evidencia presente | Estado |
| --- | --- | --- |
| Asset, AssetEntry y AssetExit con campos del brief | [models.py](../../services/api/models.py), [schemas.py](../../services/api/schemas.py) y respuestas HTTP | Verificado |
| Seis endpoints bajo /inventory | [router](../../services/api/routers/inventory.py), registrado en [main.py](../../services/api/main.py) y ejecutado | Verificado |
| Stock calculado, no almacenado | Saldos del seed y carreras; inspector SQL sin columna current_stock | Verificado |
| Salida excesiva: HTTP 400 y mensaje exacto | Solicitud real de 14 unidades contra saldo 13; sin orden persistida | Verificado |
| Asignacion requiere destinatario; consumo exige null | Requests invalidos devuelven 422 sin escrituras | Verificado |
| UUID de usuario TinyDB obtenido del actor | Actor ficticio existente en TinyDB, JWT real; UUID externo rechazado | Verificado |
| SKU unico y oficinas Valencia/Miami | Duplicado devuelve 409; oficina desconocida devuelve 422 | Verificado |
| Seed de 6 activos, 4 entradas y 3 salidas | [seed_inventory.py](../../services/api/seed_inventory.py) ejecutado en PostgreSQL aislado | Verificado |
| Idempotencia y saldos esperados | Segundo seed con mismo actor: cero inserciones y saldos esperados | Verificado; runner pytest no ejecutado |

Los 14 tests recientes y las 60 carreras PostgreSQL del Hito 4 no certifican
este contrato: usan Item/Movement e incidencias, no AssetEntry/AssetExit.
No se ha consultado ni cargado el dataset del Hito 5 en la demo.

## Resultados de la ejecucion autorizada

Se utilizo la imagen API existente con sus dependencias (Python 3.12), montando
en solo lectura el entrypoint, modelos/schemas, router y seed actuales, junto a
los modulos del Hito 4 requeridos por `main.py`. PostgreSQL 16 efimero sin red
externa ni volumen de datos; TinyDB vacio en tmpfs y actor ficticio con UUID.
No se accedio al entorno virtual restringido, archivos de entorno ni datos de
la demo. Las demas dependencias de soporte proceden de la imagen existente.

La comprobacion temporal se ejecuto con `python -B` dentro de esa imagen,
compartiendo exclusivamente la red del contenedor PostgreSQL aislado.
Resultados:

- Inspeccion SQL: tablas y FK presentes, SKU unico, sin tabla User SQL
  ni columna de stock persistido.
- Seed con el mismo actor dos veces: primera ejecucion 6/4/3 registros nuevos;
  segunda 0/0/0. Saldos por SKU coinciden con la fase 2.
- Seis rutas autenticadas ejercitadas en la API principal; todas rechazaron
  solicitudes sin token con 401. Token y usuario de TinyDB fueron ficticios.
- GET productos/detalle/ordenes devolvieron campos del brief, saldo neto,
  datos del activo y UUID del actor; siete ordenes del seed visibles.
- Stock insuficiente devolvio HTTP 400 con el texto exacto, sin escrituras.
  Requests invalidos por destinatario/tipo, cantidades, oficina, stock editable
  y UUID falsificado devolvieron 422; duplicado SKU 409, referencias inexistentes
  404. Conteos SQL intactos tras rechazos y API usable tras el duplicado.
- Diez repeticiones de dos salidas de una unidad contra saldo uno: una 201 y
  una 400 en cada carrera, una sola salida persistida y saldo final cero.
  Una pausa breve tras `FOR UPDATE` favorecio solapamiento.
- Nuevas conexiones conservaron los datos confirmados, saldos iniciales del
  seed y un articulo ficticio del Hito 4, sin fusionar contratos.

**Fase de correccion:** no necesaria para los requisitos comprobados.
Solo se actualizaron este plan, README API y progreso; no modelos, router,
schemas, dependencias, UI, esquema ni seed.

**Limitaciones:** no se ejecuto el runner pytest; la imagen no incluye pytest
segun el intento anterior registrado y el entorno virtual local esta restringido.
No se instalaron paquetes. El usuario puede ejecutar el comando de la fase 1
para confirmar las pruebas existentes en su entorno Python 3.14. No se repitio
build/typecheck frontend porque esta tarea no modifica frontend. No se comprobo
el despliegue ni se reiniciaron servicios de la demo.

## Fases y seguimiento

### 1. Verificar el contrato existente

**Estado:** contrato contrastado; runner pytest pendiente por restriccion.

- Ejecutar desde `services/api`:

```bash
./.venv/bin/python -m pytest tests/test_inventory_models.py tests/test_inventory_schemas.py tests/test_inventory_api.py tests/test_seed_inventory.py -q
```

- Si el entorno virtual sigue restringido, solicitar ejecucion del usuario;
  no acceder mediante otro mecanismo ni instalar paquetes sin autorizacion.
- Contrastar campos, autenticacion, errores, stock y respuestas con el brief.
- Resultado: matriz de requisitos con evidencia actual, sin alterar datos.

### 2. Validar PostgreSQL y seed en aislamiento

**Estado:** completada con los resultados anteriores.

- Usar PostgreSQL efimero local y datos ficticios, sin secretos, datos ni
  conexion a la demo; cargar las rutas y modelos existentes.
- Ejecutar el seed dos veces con el mismo actor ficticio: comprobar 6 activos,
  4 entradas, 3 salidas, cero inserciones adicionales y saldos
  13, 0, 5, 0, 17, 0 segun el orden de SKU del seed.
- Verificar los seis endpoints, mensaje exacto de stock insuficiente,
  destinatario condicional, UUID de autor, FK y ausencia de escrituras parciales.
- Probar dos salidas simultaneas de una unidad contra saldo uno:
  exactamente una aceptada y otra rechazada con HTTP 400; saldo final cero.
- Confirmar persistencia con conexiones nuevas y coexistencia con tablas
  del Hito 4 y legacy sin fusionar IDs ni saldos.

### 3. Corregir solamente incumplimientos demostrados

**Estado:** no aplicable; ninguno observado en el contrato comprobado.

- Si las verificaciones pasan, no modificar codigo por completar una fase.
- Corregir fallos concretos en productor/validador existente; reutilizar tests
  existentes. No crear tests nuevos sin autorizacion.
- Exponer impacto y pedir confirmacion si hace falta cambiar contratos,
  esquema, dependencias, migraciones o la politica de oficinas.
- Repetir solo las verificaciones afectadas, con un maximo de dos intentos.

### 4. Documentar y entregar el cierre

**Estado:** resultados documentados; confirmacion pytest del usuario pendiente.

- Registrar resultados actuales, comandos y limitaciones en este plan,
  README API y banco de progreso.
- Informar cumplimiento, pendientes reales y cualquier prueba del usuario.
- Cargar seed en la demo requiere una autorizacion separada con destino
  confirmado; no es requisito para probar el dataset local del brief.

## Limites y decisiones

- El brief menciona seis oficinas pero define solo Valencia y Miami.
  Conservar esos dos valores; no inventar oficinas.
- Las rutas de carpetas del brief no coinciden con esta copia: backend en
  `services/api`. Mantener esa ubicacion y entrypoint, no duplicar servicios.
- El brief calcula stock por Asset; los tests existentes permiten ordenes
  de distintas oficinas sobre un mismo activo. No introducir segregacion
  adicional ni reinterpretar esa regla sin una decision explicita.
- El Hito 5 es backend: no recrear las vistas legacy retiradas ni modificar
  el inventario unico del Hito 4 por defecto.
- El seed identifica ordenes incluyendo actor y timestamp; no prometer
  idempotencia entre actores distintos ni usarlo para restaurar datos editados.
- Preservar todos los cambios previos. No ejecutar migraciones, borrados,
  seeds sobre la demo, commit, push ni publicacion como parte de este plan.

## Puerta de autorizacion

El usuario autorizo la ejecucion: "Perfecto, procede a implemtar el hito5".
La autorizacion no incluye carga del seed en la demo ni commit/push/publicacion.
