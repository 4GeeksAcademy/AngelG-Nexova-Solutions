# Informe de mejoras de rendimiento

## Estado actual

La linea base se documento en [`AUDIT.md`](AUDIT.md) y los seis informes iniciales estan en [`audit/before/`](audit/before/). Los seis informes Lighthouse completos y sus capturas posteriores estan guardados en [`audit/after/`](audit/after/). Las puntuaciones posteriores de la tabla se transcriben de las capturas; las metricas detalladas y auditorias se extraen de los informes HTML de Lighthouse 13.5.0, Chrome 156 y `runWarnings` vacio.

| Vista | Performance inicial | Performance posterior | Diferencia |
| --- | ---: | ---: | ---: |
| Sitio, inicio, escritorio | 75 | 100 | +25 |
| Sitio, inicio, movil | 86 | 100 | +14 |
| Backoffice, inicio, escritorio | 99 | 99 | 0 |
| Backoffice, inicio, movil | 99 | 99 | 0 |
| Backoffice, incidencias, escritorio | 100 | 100 | 0 |
| Backoffice, incidencias, movil | 98 | 98 | 0 |

## Correcciones aplicadas

- El sitio configura las fuentes con `display: "optional"` para evitar cambios tardios de tipografia. Los informes posteriores registran CLS 0 en inicio de escritorio y movil, frente a 1.000 y 0.198 en la linea base.
- Los informes posteriores detectaron `label-content-name-mismatch` para el enlace de marca. Despues de esas mediciones se retiro su `aria-label` redundante para que el nombre accesible se derive del texto visible; el lint del componente y la build pasan. No se repitio Lighthouse, segun la indicacion del usuario.
- Se extrajo `SectionTitle` y se integro en cinco encabezados de seccion, preservando la estructura visual.
- El backoffice ya no descarga Geist Mono globalmente; `font-mono` conserva una pila monospace del sistema. Los informes posteriores muestran una solicitud WOFF2 por vista, frente a dos en la linea base; se conserva Geist Sans.
- Se mantuvo `x-robots-tag: noindex, nofollow`; la directiva proviene del tunel de Codespaces y es apropiada para el backoffice. El SEO del sitio publico requiere validacion en el dominio de produccion.

## Impacto medido

| Vista | CLS inicial -> posterior | LCP inicial -> posterior |
| --- | ---: | ---: |
| Sitio, escritorio | 1.000 -> 0.000 | 612 -> 596 ms |
| Sitio, movil | 0.198 -> 0.000 | 2,097 -> 2,013 ms |
| Backoffice, inicio, escritorio | 0.000 -> 0.000 | 646 -> 585 ms |
| Backoffice, inicio, movil | 0.000 -> 0.000 | 2,196 -> 1,982 ms |
| Backoffice, incidencias, escritorio | 0.030 -> 0.030 | 641 -> 619 ms |
| Backoffice, incidencias, movil | 0.000 -> 0.000 | 2,322 -> 2,292 ms |

Accessibility y Best Practices permanecen en 100, SEO en 60 en las seis vistas. El TBT baja de 112 a 87 ms en sitio movil, de 25 a 15 ms en backoffice movil y de 82 a 42 ms en incidencias movil; los otros tres valores siguen en 0 ms. INP no se puede inferir de estas ejecuciones de navegacion; TBT no es un sustituto de INP. Los informes son una pasada por vista, no medianas.

Hay una discrepancia entre las evidencias del sitio publico: las dos capturas muestran Performance 100, mientras sus informes HTML registran 99. Siguiendo la indicacion del usuario, la tabla adopta las puntuaciones de las capturas; CLS, LCP, TBT, TTFB y hallazgos se toman de los informes HTML. No se puede demostrar que cada captura pertenezca a la misma ejecucion que su informe.

## Validacion

En esta continuacion pasaron `npm run lint` y `npm run typecheck` del sitio, y `npx tsc --noEmit` del backoffice. La build de produccion del sitio tambien paso tras retirar el `aria-label`; la build del backoffice habia pasado en la validacion anterior. No se repitio Lighthouse para ese cambio, por indicacion del usuario; las capturas y los informes existentes se conservan y la diferencia de puntuacion queda explicita. No se repitio la suite del backoffice: su ultima ejecucion conocida fallo en `RootLayoutAuthProvider.test.tsx` porque el mock de `next/navigation` no define `usePathname`. El lint completo del backoffice reporto cinco errores y dos advertencias en cuatro archivos preexistentes; no se modificaron esos tests ni archivos ajenos.
