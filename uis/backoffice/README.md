This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Inventario unico de los Hitos 4 y 5

La ruta autenticada `/backoffice/inventory` es la única interfaz de inventario.
Usa el diseño de tabla del inventario legacy con el contrato canónico: artículos
por oficina/categoría, unidad, punto de reorden, stock derivado, control de lotes,
alta/edición, lotes y movimientos con historial. Las alertas dependen del punto
de reorden del artículo, no de umbrales fijos.
Incluye SKU editable/buscable y categorias de ambos hitos. Los movimientos
permiten oficina, proveedor de entrada y finalidad de salida (consumo o
asignacion con destinatario); el historial muestra tambien autor y metadatos
importados. Los valores historicos desconocidos se muestran como no registrados.
No se recalculan ni convierten cantidades del historial.

El listado muestra 10 artículos por página con navegación numerada; los filtros
reinician la página. El detalle abre `/backoffice/inventory/[id]`, no un panel
debajo de la tabla. El detalle es de solo lectura inicialmente; «Editar artículo»
abre el formulario y «Cancelar edición» lo cierra. Oficina, unidad y control de
lotes son editables incluso con historial. Son correcciones de la ficha, no
transferencias ni conversiones: las cantidades y movimientos se conservan.
La oficina actual clasifica todo el saldo del artículo. El control de lotes
solo exige lote para movimientos nuevos; no asigna el stock anterior a lotes.

El Analizador de incidencias no aparece en el navbar; su enlace «Analizar CSV»
está en el gestor de incidencias. La ruta autenticada del analizador se conserva.

### Opciones accesibles desde su seccion

| Boton de origen | Ruta | Operaciones |
| --- | --- | --- |
| Inventario → Proveedores | `/backoffice/suppliers` | Buscar/filtrar, paginas de 10, alta `/new`, detalle `/[id]`, cambiar tarifa/estado y eliminar con confirmacion |

Todas estas paginas estan dentro del layout autenticado y permiten volver
a la seccion de origen; no se agregaron destinos al navbar. Las altas y
detalles son paginas independientes. Un directorio de proveedores vacio
es valido: no se cargo seed; se puede crear un proveedor desde su pantalla.
Reiniciar la API para registrar el router de proveedores.
En el listado, «Eliminar proveedores» activa los botones de borrado por fila,
con los mismos colores, hover, sombras y variantes oscuras del inventario.
Cada borrado exige confirmacion, usa DELETE persistente y retira la fila solo
cuando la API confirma exito. Cancelar o un error conserva el proveedor.

Si en este entorno la navegacion queda en «Rendering» con Turbopack,
iniciar el frontend con el modo de desarrollo webpack soportado por Next.js:

```bash
API_INTERNAL_URL=http://127.0.0.1:8000 npm run dev -- --webpack
```

Comprobacion local: Turbopack no respondio a Proveedores en 60 segundos;
webpack devolvio 200 en 16 segundos en la primera compilacion y 0,07 segundos
en la siguiente. Alta de proveedor e Inventario tambien respondieron 200;
el proxy de proveedores respondio 401 sin sesion, como corresponde.
Esto no modifica dependencias ni el build de produccion. El script `dev`
no se cambio: hacerlo requiere confirmacion explicita.

Las pantallas adicionales de Usuarios e Incidencias por categoria se
retiraron a peticion del usuario. Se mantienen Perfil, el gestor de
incidencias habitual y su boton Analizar CSV, sin nuevos accesos.

Ambos listados incluyen buscador y modo de eliminación, como el pipeline.
Inventario busca por nombre, SKU, ID, oficina, categoría o unidad sobre todos los
artículos. Incidencias busca por título, descripción, cliente, responsable o ID
en la API antes de paginar; se aplica con «Buscar» o Enter. Buscar reinicia la
primera página y combina los filtros existentes.

«Eliminar artículos/incidencias» habilita los botones «Eliminar definitivamente».
Estos controles usan los colores, transiciones hover, sombras y variantes
claro/oscuro del modo de eliminación del pipeline.
Cada borrado requiere confirmación e informa que no se puede deshacer. La API
borra físicamente el artículo con sus lotes/movimientos, o la incidencia con su
auditoría, en una transacción; el resultado persiste tras nuevas conexiones o
reiniciar el proyecto. El archivado del detalle de incidencias sigue disponible
si se quiere conservar el historial. No volver a ejecutar el seed para
restaurar un registro borrado: puede reinsertarlo o abortar por datos modificados.

Las altas abren páginas independientes:

- Artículos: `/backoffice/inventory/new`.
- Lotes: `/backoffice/inventory/[id]/lots/new`.
- Entradas, salidas y ajustes: `/backoffice/inventory/[id]/movements/new`.
- Candidaturas: `/candidates/new` (ya no se crean dentro del pipeline).
- Incidencias: `/incidents/new`.

El detalle enlaza las operaciones del artículo; al registrarlas se vuelve al
detalle. Inventario aparece junto a Gestión de incidencias en la navegación.
Las cuatro URLs legacy de inventario se retiraron; usar el listado unico
y las operaciones anteriores. Las APIs del Hito 5 son adaptadores a la
misma persistencia, no un segundo inventario.
Se retiro `/account/change-password`; el formulario sigue en Perfil.

Antes de reiniciar la API se requiere la
[migracion de inventario](../../services/api/README.es.md#migracion-obligatoria-de-la-demo):
preserva los IDs canonicos y copia activos/ordenes del Hito 5 con procedencia.
La aplicacion de ese SQL sobre la demo sigue pendiente de confirmacion del
usuario; despues del SQL deben verse los productos del seed en esta pantalla.

Incidencias también solicita páginas de 10 registros. El detalle permite
archivar con confirmación y conservar el historial, bloqueando acciones durante
las solicitudes. Editar sin tocar el SLA conserva el instante original, incluidos
segundos y zona horaria. Editar un artículo no modifica sus lotes ni movimientos
anteriores; se mantienen las validaciones de stock y caducidad por lote.

Para usar una API local, inicia el backoffice con
`API_INTERNAL_URL=http://127.0.0.1:8000 npm run dev`. La API principal requiere
PostgreSQL aislado de desarrollo para el dominio canónico; un `/health` correcto
sin PostgreSQL no valida el inventario. Consulta el [seed del Hito 4](../../services/api/README.es.md#seed-de-desarrollo-del-hito-4)
solo después de confirmar el destino y el esquema. No ejecutes seeds en producción.

El usuario confirmó el funcionamiento de las pantallas anteriores (2026-11-01).
Comprobaciones de accesibilidad detallada y de las nuevas acciones pendientes:

- Iniciar sesión y abrir `/backoffice/inventory`; filtrar Valencia/Miami,
  categorías y alertas, sin mezclar el stock entre artículos/oficinas.
- Crear un artículo y comprobar stock inicial cero; registrar entrada, salida
  y ajuste con motivo, y verificar el historial y el stock resultante.
- Crear un lote caducado; comprobar que se identifica y no puede seleccionarse
  para una salida. La API debe rechazar asimismo una salida con stock insuficiente.
- Recorrer formularios y botones con teclado; comprobar mensajes de carga,
  error/reintento y listas vacías. Probar estos flujos también en móvil.
- Con los 12 registros del seed, comprobar 10 en la primera página y 2 en la
  segunda, en ambos gestores. Cambiar filtros desde la segunda página.
- Abrir y volver del detalle de un artículo; despues de la migracion buscar
  `NXV-IT-001`, comprobar stock 13 e historial importado con proveedor/destinatario.
- Editar una incidencia SLA sin cambiar la fecha y verificar que el instante
  se conserva. Archivar una incidencia de prueba, confirmar que desaparece del
  listado y conserva historial. No ejecutar seeds de nuevo para restaurarla.
- Buscar un registro de la segunda página en ambos listados; combinar búsqueda
  y filtros. Activar eliminación, cancelar la confirmación y comprobar que no
  se borra nada. Si se confirma sobre un registro ficticio prescindible, verificar
  que desaparece tras recargar y reiniciar. Sus datos dependientes también se borran.

Durante esta implementación se consultaron las guías públicas oficiales de
[Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
y [Link](https://nextjs.org/docs/app/api-reference/components/link), con autorización
del usuario como alternativa a la documentación local restringida. No se accedió
a la carpeta excluida ni se cambió la política de acceso.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
> Hito 6: Inventario → Reporte semanal abre
> `/backoffice/inventory/reporting`. Permite consultar semanas y ejecutar
> el cálculo como admin/manager. Artículos admiten programa/categoría formativa
> y nuevas entradas admiten proveedor registrado/costo unitario.
> Requiere la [migración 003](../../services/api/migrations/003_hito6.sql).
> Migración/seed y cifras del reporte semanal confirmados por el usuario.
> Inventario → Telemetría técnica incorpora el reporte agregado de eventos
> para admin/manager; requiere la API actualizada, sin nuevas migraciones.
> Pasaron typegen, tsc, lint focalizado y 4 tests existentes de inventario.
