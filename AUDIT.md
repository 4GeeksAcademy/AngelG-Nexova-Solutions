# Auditoria de rendimiento frontend

Fecha de las mediciones iniciales: 2026-10-27. Los seis informes exportados indican Lighthouse 13.5.0, Chrome 156 y `runWarnings` vacio. Son ejecuciones individuales, no medianas; deben interpretarse como una linea base observada y no como una medicion estadistica repetida.

## Linea base

| Aplicacion / vista | Modo | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | TTFB (documento raiz) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Sitio, inicio | Escritorio | 75 | 100 | 100 | 60 | 612 ms | 1.000 | 0 ms | 318 ms |
| Sitio, inicio | Movil | 86 | 100 | 100 | 60 | 2,097 ms | 0.198 | 112 ms | 673 ms |
| Backoffice, inicio | Escritorio | 99 | 100 | 100 | 60 | 646 ms | 0.000 | 0 ms | 601 ms |
| Backoffice, inicio | Movil | 99 | 100 | 100 | 60 | 2,196 ms | 0.000 | 25 ms | 185 ms |
| Backoffice, incidencias | Escritorio | 100 | 100 | 100 | 60 | 641 ms | 0.030 | 0 ms | 198 ms |
| Backoffice, incidencias | Movil | 98 | 100 | 100 | 60 | 2,322 ms | 0.000 | 82 ms | 326 ms |

FCP, Speed Index y demas auditorias estan en los informes HTML originales de [`audit/before/`](audit/before/). La navegacion Lighthouse no midio INP; TBT no se presenta como sustituto de INP.

## Medicion posterior y comparacion

Los seis informes HTML de [`audit/after/`](audit/after/) se ejecutaron el 2026-10-27 con Lighthouse 13.5.0, Chrome 156, throttling simulado y `runWarnings` vacio. Son una pasada por vista, no medianas. Las cifras de LCP, CLS y TBT siguientes se extraen de los informes completos; TTFB corresponde a `server-response-time` del documento raiz.

| Aplicacion / vista | Modo | Performance inicial -> posterior | LCP inicial -> posterior (ms) | CLS inicial -> posterior | TBT inicial -> posterior (ms) | TTFB inicial -> posterior (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Sitio, inicio | Escritorio | 75 -> 100 | 612 -> 596 | 1.000 -> 0.000 | 0 -> 0 | 318 -> 417 |
| Sitio, inicio | Movil | 86 -> 100 | 2,097 -> 2,013 | 0.198 -> 0.000 | 112 -> 87 | 673 -> 182 |
| Backoffice, inicio | Escritorio | 99 -> 99 | 646 -> 585 | 0.000 -> 0.000 | 0 -> 0 | 601 -> 596 |
| Backoffice, inicio | Movil | 99 -> 99 | 2,196 -> 1,982 | 0.000 -> 0.000 | 25 -> 15 | 185 -> 357 |
| Backoffice, incidencias | Escritorio | 100 -> 100 | 641 -> 619 | 0.030 -> 0.030 | 0 -> 0 | 198 -> 186 |
| Backoffice, incidencias | Movil | 98 -> 98 | 2,322 -> 2,292 | 0.000 -> 0.000 | 82 -> 42 | 326 -> 315 |

Accessibility y Best Practices se mantienen en 100, y SEO en 60, en las seis vistas. Todos los informes posteriores fallan `is-crawlable` por `x-robots-tag: noindex, nofollow` del dominio reenviado; no se debe eliminar esa proteccion del backoffice. La validacion SEO del sitio publico requiere su dominio de produccion.

## Hallazgos y causas

1. **CLS del sitio publico corregido en los informes posteriores.** La linea base registra CLS 1.000 en escritorio y 0.198 en movil. `layout-shifts` y `cls-culprits-insight` atribuyeron el desplazamiento a las fuentes web; las ejecuciones posteriores registran 0.000 en ambos perfiles tras usar `display: "optional"`. El LCP tambien mejora ligeramente, de 612 a 596 ms en escritorio y de 2,097 a 2,013 ms en movil. La medicion es una pasada por perfil y no una mediana.
2. **Velocidad del sitio en movil.** El informe movil muestra FCP 1,472 ms, LCP 2,097 ms, Speed Index 4,461 ms y TTFB 673 ms. El LCP queda bajo 2.5 s, pero el CLS excede ampliamente 0.1. TTFB depende del host reenviado de Codespaces y no se puede atribuir a codigo cliente con esta medicion. El informe no demuestra que la animacion de revelado sea causa del CLS.
3. **SEO 60 en todas las vistas.** En los seis informes falla `is-crawlable` y su directiva es `x-robots-tag: noindex, nofollow`. Las URLs medidas pertenecen a `app.github.dev`, un dominio reenviado de Codespaces. No se debe eliminar el bloqueo de indexacion del backoffice ni cambiar metadatos de la aplicacion para ocultar la condicion del tunel. SEO del sitio publico debe volver a medirse en su dominio publico real.
4. **Nombre accesible del enlace de marca del sitio.** Los informes posteriores aun marcan `label-content-name-mismatch` para `body > header.site-header > div.nav-wrap > a.brand`, aunque Accessibility redondea a 100. Tras revisar el nodo, se retiro el `aria-label` redundante para derivar el nombre del contenido visible. El lint del componente y la build pasaron, pero esa correccion ocurrio despues de los informes y necesita una nueva medicion Lighthouse para confirmarse.
5. **Backoffice sin regresion visible de layout.** CLS es 0 en inicio desktop/movil y en incidencias movil; incidencias desktop marca 0.030. Performance esta entre 98 y 100. El TTFB del inicio desktop es 601 ms, frente a 185 ms en movil y 198/326 ms en incidencias desktop/movil; la variacion entre ejecuciones y perfiles impide atribuirla a una causa de frontend sin trazas adicionales.

## Refactorizaciones identificadas

1. **Titulos de seccion del sitio, extraidos.** `LandingContent.tsx` repetia el patron de eyebrow y `h2` en cinco secciones. `SectionTitle` centraliza ese marcado y recibe el texto auxiliar, el identificador y el contenido del titulo, evitando variaciones entre secciones sin alterar su layout.
2. **Campos de formularios del backoffice, candidato.** Login, registro, recuperar/restablecer contrasena y perfil repiten etiqueta asociada a input, estilos y estados de validacion. Un `FormField` local a `uis/backoffice/components/` podria recibir `id`, `label`, `children`, `required` y texto de ayuda/error; las pantallas conservarian el control especifico y su estado.

## Cambios implementados

- Sitio: `uis/website/app/layout.tsx` configura DM Sans y Playfair Display con `display: "optional"`, evitando que una fuente tardia reemplace la fuente de reserva y desplace el documento. La traza de Lighthouse identifico ambas fuentes como causa del CLS.
- Sitio: `uis/website/components/SectionTitle.tsx` extrae el patron repetido de eyebrow y `h2`; `LandingContent.tsx` lo integra en cinco secciones sin cambiar el marcado visual.
- Sitio: `SiteHeader.tsx` ya no define un `aria-label` redundante en el enlace de marca; el nombre accesible se deriva del texto visible. Los informes Lighthouse disponibles preceden a este cambio.
- Backoffice: `app/layout.tsx` deja de cargar Geist Mono globalmente. `app/globals.css` usa fuentes monospace del sistema para las pantallas que necesitan `font-mono`. Los informes iniciales confirman que antes se solicitaban dos WOFF2 en todas las rutas; el segundo, Geist Mono, pesaba unos 29 KB.

Los informes posteriores completos y las seis capturas estan en [`audit/after/`](audit/after/). Siguiendo la indicacion del usuario, las puntuaciones comparadas del sitio se toman de las capturas: 100/100 y mejoras de +25/+14; los informes HTML registran 99/99. Las puntuaciones del backoffice no cambian. La discrepancia queda documentada y las metricas detalladas se toman de los informes. No se repitio Lighthouse despues de quitar el `aria-label`; lint y build del sitio pasan. Ver [`REPORT.md`](REPORT.md) para el resumen.

## Evidencia

- Informes Lighthouse completos y capturas iniciales: [`audit/before/`](audit/before/).
- Sitio publico: raiz del puerto reenviado 3001, escritorio y movil.
- Backoffice: raiz del puerto reenviado 3000 y `/incidents`, escritorio y movil.
- Cada informe es una sola pasada. No se instalo una skill externa: el analisis se basa en los diagnósticos Lighthouse y en el codigo de ambos frontends.
