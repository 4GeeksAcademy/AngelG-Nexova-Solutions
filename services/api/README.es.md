# incidents-api

Servicio backend para integrar el analizador de incidencias.

## Endpoints

- `POST /api/incidents/analyze`
- `GET /api/incidents/results/export`

## Ejecucion local

```bash
pip install -r services/api/requirements.txt
uvicorn services.api.app.main:app --reload
```

## Tests

```bash
python -m unittest services/api/tests/test_incidents_api.py
```

## Seed de desarrollo del Hito 4

`seed_hito4.py` carga el conjunto canónico de inventario e incidencias en las
tablas nuevas de desarrollo/pruebas. Es insert-only, idempotente y reutiliza un
usuario ya existente en TinyDB como autor de auditoría; no crea usuarios, no
envía notificaciones, no crea tablas ni modifica los dominios legacy.

Antes de ejecutarlo, confirma que `DATABASE_URL` apunta a una base aislada de
desarrollo o pruebas y que el esquema ya fue creado por la API. No lo ejecutes
contra producción.

```bash
uv run --directory services/api python seed_hito4.py \
  --confirm-development-database
```

El comando informa los registros insertados/existentes y el stock calculado por
artículo y oficina. Si detecta un registro seed con valores distintos, aborta la
transacción en vez de sobrescribir datos.

## Migracion de incidencias existentes

El entrypoint principal es `main:app`. Su `create_all()` crea tablas ausentes,
pero no actualiza tablas existentes. Si PostgreSQL informa que
`managed_incident.resolved_at` no existe, el esquema requiere migracion; el seed
no corrige este problema.

La migracion [001_managed_incident_lifecycle.sql](migrations/001_managed_incident_lifecycle.sql)
se ejecuta manualmente, nunca durante el startup. Anade `resolved_at` y
`closed_at` como timestamps con zona horaria opcionales (`TIMESTAMPTZ`),
compatibles con el modelo y el esquema de produccion inspeccionado, y
conserva los registros y fechas existentes. Las nuevas fechas quedan en NULL:
no se inventan fechas historicas. Valida nombres y tipos de todas las columnas
consultadas por el modelo y aborta la transaccion ante otra incompatibilidad.
Solo contempla la tabla en el esquema `public`; no convierte tipos existentes.

Antes de aplicarla:

1. Confirmar el entorno y el esquema de destino, obtener autorizacion explicita
   para ejecutar la migracion. Se recomienda disponer de un respaldo recuperable;
   sin el, el rollback transaccional no sustituye la recuperacion ante incidentes
   externos o cambios posteriores.
2. Inspeccionar las columnas sin leer datos de usuarios:

   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'managed_incident'
   ORDER BY ordinal_position;
   ```

3. Probar primero en una copia aislada. La migracion bloquea brevemente la tabla;
   coordinar una ventana sin operaciones concurrentes. El timeout de bloqueo
   es 5 segundos y el de cada sentencia es 30 segundos.
4. Solo tras autorizacion, desde `services/api/`, ejecutar con `psql` conectado
   mediante la configuracion segura habitual (`PGSERVICE`, por ejemplo), sin
   poner credenciales en comandos, logs ni Git:

   ```bash
   psql -X --set=ON_ERROR_STOP=1 \
     --file=migrations/001_managed_incident_lifecycle.sql
   ```

   `psql` no carga automaticamente `DATABASE_URL` ni archivos `.env`; confirmar
   que su conexion apunta a la misma base y esquema que la API.

5. Repetir la inspeccion de columnas, verificar que los registros se conservan
   y comprobar con una sesion autenticada `GET /v2/incidents` y
   `GET /v2/incidents/summary`. Ambos deben devolver 200. No ejecutar un seed
   como parte de esta migracion.

La migracion puede repetirse; no borra ni renombra columnas. Si falla, no
ignorar el error ni aplicar cambios destructivos: revisar el esquema informado.

## Protecciones del Hito 4

Los cambios de estado, edicion y archivo de incidencias bloquean la fila con
`SELECT FOR UPDATE` en PostgreSQL antes de validar y guardar cambios/auditoria
en la transaccion. SQLite no verifica ese bloqueo; la concurrencia debe
comprobarse en PostgreSQL aislado.

Los articulos permiten corregir oficina, unidad y control de lotes incluso con
movimientos. PATCH conserva cantidades, lotes e historial: no representa una
transferencia ni una conversion de unidades. La oficina actual clasifica todo
el saldo del articulo. El control de lotes se aplica a movimientos nuevos;
activarlo no asigna stock previo a lotes. Se conservan las validaciones de
saldo por articulo/lote y caducidad, y el bloqueo de fila durante la edicion.
El inventario de los Hitos 4 y 5 comparte ahora Item/Lot/Movement. Las APIs
del Hito 5 son adaptadores; no mantienen tablas ni saldos independientes.

## Busqueda y eliminacion definitiva

`GET /v2/incidents?search=texto&limit=10&offset=0` busca sin distinguir
mayusculas en ID, titulo, descripcion, cliente y responsable. Combina filtros
y calcula el total antes de paginar; `%` y `_` se tratan como texto literal.

Se conservan `DELETE /v2/incidents/{id}` (archivado con auditoria) y
`DELETE /inventory/items/{id}` (borrado de articulo sin historial). Las acciones
separadas `DELETE /v2/incidents/{id}/permanent` y
`DELETE /inventory/items/{id}/permanent` borran fisicamente el registro y sus
dependientes: auditoria, o movimientos y lotes, respectivamente. Requieren
autenticacion, bloquean la fila y confirman una unica transaccion. No afectan
a otros registros. El borrado de un articulo desaparece tambien de las APIs
del Hito 5. Es irreversible; el cliente exige confirmacion explicita.

Al crear una incidencia se hace `flush` del padre antes de insertar auditoria,
sin separar la transaccion. Los tests SQLite ahora activan claves foraneas
para detectar errores de orden que antes podian pasar inadvertidos.

Validacion PostgreSQL 16 aislada (2026-11-01): rutas actuales montadas en
solo lectura en la imagen API existente, PostgreSQL efimero sin red externa
ni volumen compartido, TinyDB vacio en tmpfs y actor ficticio. Se probaron
10 repeticiones de cada caso concurrente: dos salidas contra un saldo de uno,
dos transiciones iguales, dos asignaciones con auditoria encadenada,
archivo frente a transicion, borrado frente a movimiento y borrado frente
a alta de lote. Los 60 casos pasaron. Busqueda global paginada y borrado
confirmado con conexiones nuevas tambien pasaron; datos ajenos conservados.
El primer intento descubrio el fallo de FK de creacion/auditoria, corregido
antes de repetir con exito. No se accedio al entorno virtual restringido.

La imagen no incluye pytest; no se instalaron dependencias. Para ejecutar
las aserciones ampliadas del runner del proyecto, desde `services/api`:

```bash
./.venv/bin/python -m pytest tests/test_inventory_v2_api.py tests/test_managed_incidents_api.py -q
```

## Inventario unico: Hitos 4 y 5

`inventory_models.py` es la unica persistencia: `inventory_item`,
`inventory_lot` e `inventory_movement`. Se retiro `models.py`.
`schemas.py` y `routers/inventory.py` conservan los seis endpoints del
Hito 5 sobre esas mismas filas. Todos los productos estan disponibles en
`/inventory/items` y en la UI `/backoffice/inventory`, incluidos los del seed.

SKU unico (automatico para nuevos articulos sin SKU), proveedor, oficina del
movimiento, asignacion/consumo, destinatario y actor se conservan en el
inventario canonico. La UI permite editar SKU y registrar estos metadatos;
el actor procede de la sesion, nunca del payload. Los metadatos historicos
desconocidos permanecen nulos: no se inventan proveedores o usuarios.
El catalogo de lectura es la union de las categorias de ambos hitos, sin
reclasificar articulos. POST `/products` conserva el catalogo de cuatro
categorias del Hito 5.

El stock no se almacena: entradas menos salidas mas ajustes firmados. Cada orden
incluye `user_uuid` obtenido del usuario autenticado de TinyDB; no hay tabla
de usuarios SQL. Una salida excesiva devuelve HTTP 400 con el mensaje del
brief. Asignacion exige `assigned_to`; consumo exige valor nulo. Las oficinas
del catalogo son `Valencia` y `Miami`.
Las cantidades de escritura del Hito 5 siguen siendo enteras. Su lectura
admite decimales exactos (serializados como strings cuando son fraccionarios),
las categorias canonicas y ajustes, para no truncar ni ocultar datos del Hito 4.
`/orders` incluye todo el historial; oficina/actor/proveedor/finalidad pueden
ser nulos en movimientos antiguos del Hito 4. El saldo sigue siendo global
por articulo, aunque los movimientos indiquen oficinas distintas.

### Migracion obligatoria de la demo

**Pendiente de ejecutar por el usuario; no se modifico la base de demo.**
Antes de reiniciar la API o cargar seeds, detener el backend y ejecutar
completo [002_unify_inventory.sql](migrations/002_unify_inventory.sql) en
el editor SQL de la base academica confirmada. No ejecutar sobre produccion.

La transaccion bloquea las tablas, agrega campos, copia cada Asset con su
SKU y todas sus ordenes, verifica conteos/campos/saldos y solo entonces
elimina `assetexit`, `assetentry` y `asset`, sin CASCADE. Ante conflicto
de SKU, esquema parcial, campos invalidos o dependencias desconocidas,
aborta sin fusion parcial. Los timestamps legacy sin zona se interpretan
como UTC, conforme al contrato original. Los IDs del Hito 4 se conservan;
los del Hito 5 cambian a IDs canonicos, con `source_asset_id` y
`source_order_id` como procedencia (este ultimo junto al tipo de movimiento).
No se deduplica por nombre: con ambos seeds originales se esperan 18
articulos y 43 movimientos. La repeticion de la migracion es idempotente.

El inicio de API y ambos CLI de seed rechazan explicitamente un esquema
pendiente; `create_all` no migra ni recrea tablas legacy.
Despues de aplicar el SQL, reiniciar backend/frontend y abrir Inventario.
No volver a sembrar para realizar esta fusion.

### Auditoria de rutas sin UI

Se eliminaron las cuatro paginas redirect legacy de inventario y el cliente
frontend sin consumidores; tambien el redirect de cambio de contrasena
(el formulario y su cobertura permanecen en Perfil).
Se mantienen rutas/modulos con justificacion documental:

| Superficie | Motivo para conservar |
| --- | --- |
| `/inventory/products`, `/inventory/orders` | Contrato evaluable del Hito 5; adaptadores, no otro inventario |
| CRUD antiguo de incidencias | [Brief de gestor centralizado](../../Contexto-Nexova/centralized-incident-manager/nexova-BRIEFING.es.md); sin UI adicional |
| Administracion de usuarios | [Brief de roles/permisos](../../Contexto-Nexova/roles-permissions/nexova-BRIEFING.es.md); sin UI administrativa, RBAC departamental futuro |
| Proveedores | [Directorio de proveedores](../../Contexto-Nexova/supplier-directory/nexova-BRIEFING.es.md), Hito 09; router ahora registrado y UI `/backoffice/suppliers` desde Inventario |
| Analizador CSV y exportacion | Acceso desde gestor y proxies actuales; navbar no necesario |
| Candidatura publica, autenticacion, health/docs | Flujos del Hito 1 o soporte tecnico; no requieren enlace en navbar |

### Secciones de backoffice conectadas

Proveedores utiliza la tabla TinyDB `suppliers` de la API principal, no
PostgreSQL ni una segunda base. Se corrigieron los imports del router
preexistente y se reconstruyo su schema ausente desde el brief Hito 09.
Las seis rutas `/suppliers` requieren ahora autenticacion. Se pueden crear,
consultar, filtrar, cambiar tarifa/estado y borrar con confirmacion.
Las fechas se serializan a JSON; pais/moneda, categorias, tarifas positivas
finitas y estados se validan antes de escribir. No se cargo seed automaticamente.
La eliminacion no altera movimientos de inventario: el proveedor de un
movimiento es texto historico, no una FK al directorio.

Por peticion del usuario se retiraron las pantallas adicionales de Usuarios
e Incidencias por categoria y se restauro el cliente anterior de incidencias.
Sus endpoints existentes se conservan sin cambios. Perfil, el gestor por
severidad y el analizador mantienen sus interfaces anteriores.
No se anadieron enlaces tecnicos al navbar ni pantallas duplicadas para los
adaptadores del inventario, ya accesibles desde la interfaz unica.

### Verificaciones

Antes de la fusion, el usuario ejecuto los cuatro archivos del Hito 5:
28 passed, una advertencia de Starlette. Tambien confirmo el seed ya
existente (6 productos, 4 entradas y 3 salidas; cero inserciones nuevas).

Validacion anterior (2026-11-01): la API principal y los modulos de inventario
actuales se ejercitaron con PostgreSQL 16 efimero local, sin red externa,
datos de demo ni secretos reales. Seed con actor ficticio dos veces:
6 activos/4 entradas/3 salidas nuevos, luego cero inserciones adicionales.
Saldos `NXV-IT-001=13`, `NXV-IT-002=0`, `NXV-PER-001=5`,
`NXV-PER-002=0`, `NXV-OFF-001=17`, `NXV-TRN-001=0`.
Pasaron las seis rutas, autenticacion JWT/TinyDB, respuestas, validaciones,
FK/SKU, rollback y diez carreras de dos salidas contra saldo uno:
una 201 y una 400 en cada caso. Nuevas conexiones conservaron datos
confirmados, saldos del seed y el articulo ficticio del Hito 4.
No se encontraron incumplimientos en el contrato anterior.

Validacion de la fusion: PostgreSQL 16 aislado, Python 3.12 de la imagen
existente y HTTP real con uvicorn/JWT/TinyDB ficticios. Pasaron conservacion
exacta de los datos Hito 4, copia 6/4/3, 18 articulos/43 movimientos,
rollback completo ante FK desconocida, SQL repetido sin duplicados, seed
idempotente despues de importar, lecturas compartidas, decimales/ajustes,
SKU duplicado 409, concurrencia entre ambos contratos y borrado persistente
visible desde ambos. Una incompatibilidad de respuesta con los campos de
procedencia fue detectada y corregida antes del run exitoso.
Se ejecutaron directamente las tres funciones existentes de tests de
modelos/seed: pasaron, sin usar ni simular pytest.

Pytest no esta instalado en la imagen y TestClient requiere httpx2 ausente;
no se instalaron dependencias ni se accedio al entorno virtual restringido.
Para confirmar el runner del proyecto desde `services/api`:

```bash
./.venv/bin/python -m pytest tests/test_inventory_models.py tests/test_inventory_schemas.py tests/test_inventory_api.py tests/test_seed_inventory.py tests/test_inventory_v2_api.py tests/test_seed_hito4.py -q
```

Consultar el [plan y resultados del Hito 5](../../Contexto-Nexova/05-backend-development/PLAN_IMPLEMENTACION_HITO5.md).
La ejecucion futura de `seed_inventory.py` requiere confirmar destino y
autorizacion separada: su CLI usa `DATABASE_URL` y no exige bandera de entorno.
No ejecutarlo sobre la demo para restaurar datos; su identidad de orden incluye
el actor, por lo que no garantiza idempotencia entre actores distintos.
### Seed de proveedores

Desde `services/api/`, ejecutar `./.venv/bin/python -B seed.py`.
Valida los 15 proveedores contra el contrato actual antes de insertar;
usa la misma TinyDB que el directorio de la app. Omite nombres existentes
sin modificar sus datos y muestra insertados/omitidos. No requiere IDs,
PostgreSQL ni migraciones. Actualizar Inventario → Proveedores después.

> Hito 6: captura transaccional de inventario y reporte semanal incorporados.
> Ver [telemetría](../telemetry/README.md) y [reporting](../reporting/README.md).
> Antes del arranque con PostgreSQL, aplicar manualmente
> [003_hito6.sql](migrations/003_hito6.sql) en la base autorizada.
> No se ejecutó sobre datos del usuario. Nuevos ajustes se rechazan;
> el historial se conserva. Validación adicional UTC/eventos tardíos aprobada
> en PostgreSQL aislado. El usuario confirmó migración en SQL Editor,
> seed 6/12/12 y reporte visual de 6 filas/36 eventos.
> Reporte técnico: GET `/telemetry/report`, admin/manager, filtros start/end
> con zona horaria y conteos sin payloads. Dockerfile incluye módulos hermanos.
> Seis tests de reportes y cuatro tests existentes de inventario pasaron en
> la fase de cierre; build Docker completo y deploy no ejecutados.
