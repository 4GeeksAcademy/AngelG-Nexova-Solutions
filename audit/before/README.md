# Medicion inicial Lighthouse

## Informes y capturas

Los seis informes completos de Lighthouse 13.5.0 y sus capturas corresponden a ejecuciones de produccion realizadas el 2026-10-27. Los informes indican `runWarnings` vacio y Chrome 156. Las puntuaciones y metricas se resumen en [`../../AUDIT.md`](../../AUDIT.md).

| Vista | Modo | Informe | Captura |
| --- | --- | --- | --- |
| Sitio, inicio | Escritorio | [`Webside`](Webside) | [`Webside.png`](Webside.png) |
| Sitio, inicio | Movil | [`Webside_Mobile`](Webside_Mobile) | [`Webside_Mobile.png`](Webside_Mobile.png) |
| Backoffice, inicio | Escritorio | [`backoffice`](backoffice) | [`backoffice.png`](backoffice.png) |
| Backoffice, inicio | Movil | [`backoffice_Mobile`](backoffice_Mobile) | [`backoffice_Mobile.png`](backoffice_Mobile.png) |
| Incidencias | Escritorio | [`backoffice_Gestor-de-incidencias`](backoffice_Gestor-de-incidencias) | [`backoffice_Gestor-de-incidencias.png`](backoffice_Gestor-de-incidencias.png) |
| Incidencias | Movil | [`backoffice_Gestor-de-incidencias_Mobile`](backoffice_Gestor-de-incidencias_Mobile) | [`backoffice_Gestor-de-incidencias_Mobile.png`](backoffice_Gestor-de-incidencias_Mobile.png) |

Cada fila es una sola pasada, no una mediana. Se uso el dominio reenviado de Codespaces; todos los informes fallan `is-crawlable` por `x-robots-tag: noindex, nofollow`. Consultar `AUDIT.md` antes de interpretar el SEO del sitio publico. La navegacion Lighthouse no midio INP.

## Servidor auxiliar

`serve.py` queda como utilitario de inspeccion local de las interfaces. No fue el servidor de estas mediciones; los informes fueron tomados contra los builds de produccion del sitio y el backoffice.
