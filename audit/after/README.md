# Medicion posterior

Se guardaron seis informes Lighthouse HTML completos y sus capturas para las mismas vistas y perfiles de `../before/`. Los informes son de Lighthouse 13.5.0, Chrome 156, fecha 2026-10-27, throttling simulado y `runWarnings` vacio. Cada fila es una pasada, no una mediana.

| Vista | Modo | Informe | Captura |
| --- | --- | --- | --- |
| Sitio, inicio | Escritorio | [`Webside`](Webside) | [`Webside.png`](Webside.png) |
| Sitio, inicio | Movil | [`Webside_Mobile`](Webside_Mobile) | [`Webside_Mobile.png`](Webside_Mobile.png) |
| Backoffice, inicio | Escritorio | [`backoffice`](backoffice) | [`backoffice.png`](backoffice.png) |
| Backoffice, inicio | Movil | [`backoffice_Mobile`](backoffice_Mobile) | [`backoffice_Mobile.png`](backoffice_Mobile.png) |
| Incidencias | Escritorio | [`backoffice_Gestor-de-incidencias`](backoffice_Gestor-de-incidencias) | [`backoffice_Gestor-de-incidencias.png`](backoffice_Gestor-de-incidencias.png) |
| Incidencias | Movil | [`backoffice_Gestor-de-incidencias_Mobile`](backoffice_Gestor-de-incidencias_Mobile) | [`backoffice_Gestor-de-incidencias_Mobile.png`](backoffice_Gestor-de-incidencias_Mobile.png) |

Los informes contienen las URLs, perfiles y cuatro puntuaciones. En el sitio publico, ambos informes HTML registran Performance 99, mientras sus capturas muestran 100. Siguiendo la indicacion del usuario, `../../AUDIT.md` y `../../REPORT.md` usan las capturas para las puntuaciones y los informes HTML para las metricas detalladas. No se puede confirmar que esas capturas correspondan a la misma ejecucion.

Despues de generar estos informes se retiro el `aria-label` redundante del enlace de marca del sitio; el lint y la build de produccion pasan. No se repitio Lighthouse para este cambio, segun la indicacion del usuario. No incluir cookies, credenciales ni datos personales.
