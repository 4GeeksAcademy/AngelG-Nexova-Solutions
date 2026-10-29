# Estado y progreso del proyecto

> Actualizado durante la preparación del banco de memoria en `feature/agent-memory-bank`. Este archivo refleja inspección y pruebas ejecutadas, no los resultados históricos como si fueran actuales.

## Infraestructura de agentes — actualización documental

- El usuario confirmó que `CONTEXT.md` es el briefing empresarial al que se refiere `Tarea.md` como `BRIEFING.md`, y pidió complementarlo con `company-choice.md`. No existe `BRIEFING.md`; no se creó uno duplicado.
- Se actualizó `memory-bank/projectbrief.md` para reflejar Nexova y la iniciativa priorizada de soporte/monitoreo interno para Atención al Cliente y Tecnología e Infraestructura. El código de inventario se mantiene como dominio previo existente, no como prioridad empresarial inferida.
- Se documentaron las ubicaciones de producto en `memory-bank/techContext.md` y `AGENTS.md`: `uis/website/`, `uis/backoffice/` y `services/`.
- `AGENTS.md` ahora enumera categorías de archivos/datos que requieren confirmación explícita antes de modificarse.
- `git diff --check` terminó correctamente. No se ejecutaron pruebas de producto porque los cambios son documentales. No se ha hecho commit, push ni PR.

## Estado actual

- Monorepo Nexova con frontend estático, tracker Next.js, API FastAPI con varios dominios e inventario SQLModel, utilidades de análisis de incidencias y carpetas de agentes/skills.
- Se añadieron dos UIs estáticas independientes: sitio público en `uis/website/` y portal interno de referencia en `uis/backoffice/`. El portal interno enlaza módulos existentes del tracker y declara que sus cifras son contexto, no telemetría.
- La rama de trabajo es `feature/agent-memory-bank`, configurada para seguir `origin/feature/agent-memory-bank`.
- El banco de memoria era inexistente al comenzar esta tarea; este documento y `projectbrief.md`/`techContext.md` son la primera versión.
- El usuario confirmó como intencionales estas cuatro eliminaciones locales: `CONTEXT-nexova.es.md`, `captura-interfaz-analizador-cargado.png`, `captura-script-consola-100-filas.png` y `container.png`. No restaurarlas.
- El usuario confirmó el 12-10-2026 que todas las eliminaciones locales, incluida `CONTEXT-company.md`, son permanentes. No restaurarlas.

## Funcionalidades implementadas — evidencia de código, no garantía de suite verde

### Inventario backend (alcance del contexto disponible)

- Modelos y schemas para activos y órdenes de entrada/salida (`services/api/models.py`, `services/api/schemas.py`).
- Router `/inventory` y endpoints de productos/órdenes (`services/api/routers/inventory.py`), incluido desde `services/api/main.py`.
- Cálculo de stock neto y rechazo de salidas que superen stock disponible.
- Validación de ubicaciones, tipo de salida y destinatario, autorización para crear producto/órdenes e identidad de usuario en órdenes, según implementación y tests.
- Seeder idempotente con seis activos, cuatro entradas y tres salidas (`services/api/seed_inventory.py`); depende de PostgreSQL y usuario TinyDB preexistente.
- Pruebas de inventario en `services/api/tests/test_inventory_api.py`, `test_inventory_models.py`, `test_inventory_schemas.py` y `test_seed_inventory.py`.

### Otras áreas observadas

- API principal registra usuarios, perfiles, auth, records, incidencias e inventario (`services/api/main.py`).
- Hay módulo REST de proveedores y pruebas, pero `routes/suppliers.py` no se registra desde el entrypoint principal. Integración efectiva pendiente.
- Existe UI estática de proveedores en `uis/application/app/suppliers/index.html` y el backoffice Next.js en `uis/backoffice/` (antes `uis/talent-pipeline-tracker/`), más páginas estáticas de raíz.
- Proyecto compuesto Docker y volúmenes definidos en `docker-compose.yml`; ejecución no probada en esta tarea.

## Pruebas y verificaciones de esta sesión

| Verificación | Resultado observado | Alcance |
|---|---|---|
| Rama, upstream y estado | `feature/agent-memory-bank` sigue a `origin/feature/agent-memory-bank`; se conservaron cuatro eliminaciones intencionales | Git solamente |
| Inspección de archivos | Código, manifests, routers, documentación, configuración y estructura revisados | Inspección estática |
| `pytest -q` desde la raíz | **Bloqueado antes de cargar tests**: `SyntaxError: unterminated triple-quoted string literal` en `services/api/tests/conftest.py`, línea 81, durante import de conftest | Ningún test se ejecutó |
| Disponibilidad herramientas | Node `v24.21.0`, npm `11.19.0`, pytest en PATH; `uv` no disponible en PATH; `uis/backoffice/node_modules` presente tras renombrar el directorio local | Entorno de esta sesión; no garantiza otros entornos |
| Suites frontend / build / lint / Docker | No ejecutados | Sin resultado actual |

En el estado de Git del 12-10-2026, `CONTEXT-company.md` y cuatro archivos adicionales aparecen eliminados. El usuario confirmó que todas las eliminaciones son permanentes. `CONTEXT-company.md` fue leído antes de desaparecer y sirvió como fuente del brief de inventario.

`TESTING.md` registra resultados previos (backend 73 passed/6 xfailed y frontend 54 passed en 12 archivos), pero son antecedentes documentales; no se reprodujeron aquí y la carga actual del backend falla antes de ejecutar tests.

## Problemas conocidos

1. Sintaxis rota en `services/api/tests/conftest.py` bloquea toda la suite Python compartida. No se corrigió porque el alcance solicitado prohíbe modificar servicios.
2. Router de proveedores no incluido en `services/api/main.py`, pese a su UI, tests y endpoints definidos.
3. Compose healthcheck consulta `/`, mientras el entrypoint principal declara `/health`.
4. Metadatos Python raíz, backend y `requirements.txt` no están alineados; confirmar fuente antes de instalar/actualizar.
5. README de raíz y `docs/ARCHITECTURE_PROPOSAL.md` contienen afirmaciones que no coinciden con el repositorio actual.
6. El contexto de hito leído al inicio describe inventario; el interés en soporte/telemetría y el contexto histórico de proveedores son otros alcances. `CONTEXT-nexova.es.md` y `CONTEXT-company.md` están eliminados intencionalmente según confirmación del usuario.
7. El brief declara seis oficinas en la empresa pero solo especifica Valencia y Miami para el modelo de inventario.

## Próximos pasos por prioridad

1. **Bloqueante de validación:** corregir `conftest.py` en una tarea autorizada de backend y volver a ejecutar pytest; conservar los casos de regresión documentados.
2. **Aclaración de integración:** decidir si proveedores debe ser una ruta del entrypoint activo o un servicio separado y alinear Docker/consumidor/pruebas.
3. **Aclaración operativa:** confirmar healthcheck correcto y validar `docker compose up --build` en entorno con Docker disponible.
4. **Aclaración de dependencias:** declarar un único método/manifiesto Python soportado, respetando lockfile y versiones.
5. **Aclaración de negocio:** decidir si inventario admite oficinas distintas a Valencia/Miami y confirmar que Hito 5 sigue siendo el alcance técnico vigente.
6. Cuando haya entorno/dependencias instalados, ejecutar frontend `npm ci`, `npm test`, `npm run lint`, `npm run build` y typecheck desde el tracker, además de pytest/cobertura backend; registrar resultados reales.

## Decisiones pendientes / bloqueos

- No se pidió autorización en este prompt para modificar aplicación/servicios, resolver sintaxis, integrar proveedores ni ajustar Docker; no hacerlo dentro de esta tarea documental.
- No usar `CONTEXT-nexova.es.md` ni `CONTEXT-company.md` como si existieran en el árbol actual ni restaurarlos; el usuario confirmó que ambas eliminaciones son permanentes.
- Requiere respuesta del equipo de negocio/arquitectura lo relativo a seis oficinas, alcance del hito y destino de proveedores.

## Mantenimiento del progreso

Tras cada cambio significativo, actualizar este documento en el mismo conjunto de cambios: mover tareas a completadas solo después de verificar evidencia, registrar comando exacto y resultado, fecha/contexto cuando sea útil, y borrar o marcar obsoletos los bloqueos resueltos. Distinguir **implementado (evidencia de código)** de **validado (prueba ejecutada)**. Los resultados históricos deben seguir identificados como históricos; no convertirlos en estado actual.

## Entrega de sitio y backoffice — 2026-10-12

- Verificaciones actuales: `node --check` pasó para ambos scripts; `npm run typecheck` pasó en raíz; revisión de IDs/anclas y enlaces locales pasó; `git diff --check` y revisión de espacios de archivos nuevos pasaron.
- Smoke HTTP con `python3 -m http.server`: sitio en `127.0.0.1:8761` y backoffice en `127.0.0.1:8762`; HTML, CSS y JavaScript de cada interfaz respondieron HTTP 200. Los servidores temporales se detuvieron tras la comprobación.
- No hay scripts de lint/test/build para estas UIs estáticas. El tracker no tiene `node_modules`; `pytest` no está disponible en los intérpretes comprobados, así que esas suites no se ejecutaron.
- El usuario confirmó que todas las eliminaciones locales, incluida `CONTEXT-company.md`, son permanentes. No restaurarlas.
- Se añadieron `WebSide.png` y `BackOffice.png`. El usuario pidió adjuntar ambas imágenes al PR tal como están. La captura de backoffice corresponde visualmente a `uis/backoffice/`; `WebSide.png` muestra controles y mensajes ausentes de `uis/website/index.html`, por lo que se adjuntará como imagen proporcionada, no como validación visual de esa fuente.
- Se creó el commit local `a7b5e47` (`feat: add Nexova website and backoffice`). La cuenta GitHub autenticada es `Angel-G7`, pero `gh repo fork --remote --remote-name fork --clone=false` falló con HTTP 403 (`Resource not accessible by integration`); no hay fork remoto, push ni PR. Se necesita crear el fork con una cuenta/autorización que tenga ese permiso antes de publicar la rama.

## Arranque local comprobado — 2026-10-14

- Se reparó `services/api/database.py`: apertura de la cadena de documentación e inicialización de TinyDB en su ruta existente. No se cambiaron modelos, manifests, lockfiles ni configuración de producción.
- Las dependencias ya estaban instaladas al iniciar esta continuación: `services/api/.venv/bin/python -m pip check` pasó. Se conservaron los cambios previos en ejecutables del entorno virtual; no hubo instalaciones nuevas en esta continuación.
- Comprobación AST de `database.py` e importación de `main` con el entorno virtual: ambas pasaron. El editor no informó errores en el archivo reparado.
- API iniciada con `services/api/.venv/bin/python -B -m uvicorn main:app --app-dir services/api --host 127.0.0.1 --port 8000`: startup completo; `/health` respondió HTTP 200 con `{"status":"ok"}` y `/docs` respondió HTTP 200.
- Website y backoffice servidos por `python3 -B audit/before/serve.py --port 8001`: HTML, CSS y JavaScript de `/uis/website/` y `/uis/backoffice/` respondieron HTTP 200, con marcadores de contenido comprobados mediante `urllib.request`.
- Ambos servidores están restringidos a loopback; reenviar 8000 y 8001 de forma privada para abrirlos desde el equipo anfitrión. El sitio corporativo y el backoffice comparten 8001; el tracker Next.js no se inició.
- Estas comprobaciones son de arranque y entrega HTTP, no validación visual, pruebas completas de API, integración PostgreSQL ni mediciones Lighthouse. No se ejecutó la suite completa y no se crearon commits ni publicaciones.

## Alineación inicial del sitio web — 2026-10-29

- En `uis/website/components/LandingContent.tsx` se eliminó la etiqueta visual `AI-POWERED`, no respaldada como capacidad disponible, y se sustituyó la antigüedad desfasada de doce años por una descripción neutral de experiencia en español e inglés.
- En `SiteHeader.tsx` se renombró la navegación “IA/AI” a “Por qué Nexova/Why Nexova” y se actualizó el ancla correspondiente. El contenido presenta experiencia, sectores y presencia; no se modificó como promesa de funcionalidades de IA.
- Verificación actual desde `uis/website/`: `npm run typecheck`, `npm run lint` y `npm run build` finalizaron correctamente; `git diff --check` pasó. El `npm run typecheck` ejecutado previamente desde la raíz también pasó, pero verifica solo `src/**/*.ts` y no sustituye al del website.
- Este es un primer ajuste seguro, no la implementación completa del briefing web. Se dejaron sin tocar el formulario y contrato API, persistencia/consentimiento y datos de contacto/redes porque el formulario actual sirve candidaturas a la API y existen discrepancias entre contactos del briefing y del sitio que requieren decisión explícita. No se hicieron commits ni publicaciones.

## Sitio público — fase 1 de implementación — 2026-10-29

- Alineados los enlaces de las tarjetas de servicios para dirigir a contacto comercial, no al formulario de candidaturas; la invitación a empresas usa el email indicado en el briefing web (`contacto@nexova.com`).
- La navegación ES/EN identifica la sección como Talento/Talent, en línea con la estructura del briefing.
- El pie de página refleja los contactos, teléfonos y perfiles sociales incluidos en el briefing web. Se consideran datos de contexto para esta implementación, no una verificación externa de que estén operativos.
- No se cambió el formulario, su contrato API, persistencia ni Schema.org; quedan para fases posteriores.
- Verificaciones ejecutadas desde `uis/website/`: `npm run typecheck`, `npm run lint` y `npm run build`; finalizaron correctamente. `git diff --check` pasó. `npm run lint` desde la raíz no aplica porque no existe ese script.
- El estado Git conserva los cambios previos en `LandingContent.tsx`, `SiteHeader.tsx` y `memory-bank/progress.md`; también se modificó `SiteFooter.tsx` en esta fase. Sin commit, push o PR.

## Sitio público — fase 2 SEO y Schema.org — 2026-10-29

- Se amplió metadata de Next.js con `metadataBase` (`https://nexova.com`), directivas de indexación, Open Graph y Twitter Card; la landing ahora declara título, descripción, canonical y Open Graph propios.
- Se completó el JSON-LD `Organization` requerido en la landing, incluyendo URL, fecha de fundación, direcciones, punto de contacto e idiomas disponibles, y perfiles sociales oficiales según el briefing web.
- Verificaciones desde `uis/website/`: `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`; todas finalizaron correctamente.
- No se modificó el formulario ni la API. Sin commit, push o PR.

## Sitio público — fase 3 formulario de talento — 2026-10-29

- Releído el brief web en español. El registro ahora se presenta en tres pasos: contacto, perfil profesional y revisión/consentimiento; con labels bilingües ES/EN, validaciones, opciones de país/sector/inglés/disponibilidad, LinkedIn opcional, comentarios con límite/contador y aviso visible para empresas con el email oficial.
- Se conserva el campo de puesto/perfil profesional porque lo exige el endpoint actual; está separado del sector de interés.
- Límite deliberado de alcance: el proxy y la API no se han ampliado en esta fase. El backend solo almacena nombre, email, teléfono, puesto, experiencia y URLs opcionales; país, sector, inglés, disponibilidad, comentarios y aceptación de consentimiento todavía no se persisten. Requiere siguiente fase de contrato y almacenamiento antes de considerar completa la captura end-to-end.
- Verificaciones desde `uis/website/`: `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`; todas finalizaron correctamente.

## Sitio público — fase 4 persistencia de candidaturas — 2026-10-29

- El formulario envía todos los campos visibles a través del proxy allowlisted: datos de contacto, país, puesto, experiencia, sector, inglés, disponibilidad, LinkedIn opcional, comentarios y aceptación del tratamiento de datos. El honeypot sigue siendo filtrado en el servidor; `cv_url` continúa en `null` porque el formulario no ofrece carga de CV.
- El proxy reenvía los nuevos campos a `/records/public`. El esquema público valida campos de perfil y exige consentimiento explícito; la API guarda los datos en TinyDB y genera timestamp UTC en servidor para el consentimiento. Las rutas autenticadas y la UI de backoffice no se modificaron; la respuesta anónima sigue siendo un acuse genérico sin datos personales.
- Se añadieron pruebas de almacenamiento real en tabla temporal y de rechazo de consentimiento falso. README del website actualizado para reflejar el contrato.
- Verificaciones ejecutadas: desde `uis/website/`, `npm run typecheck`, `npm run lint` y `npm run build` pasaron; desde `services/api/`, `python -m pytest -q tests/test_records_api.py` con el ejecutable `.venv` pasó (`12 passed`, una advertencia deprecada de Starlette/httpx). No se ejecutó suite backend completa. `git diff --check` queda pendiente de la revisión final.
- Sin commit, push o PR. No se modificó `uis/backoffice/`.

## Auditoría final del sitio público — 2026-10-29

- Contraste de `uis/website/` contra `Contexto-Nexova/00-general-contexts/` y `01-web-fundamentals/`. Se corrigió la copia de los tres servicios en ES/EN para ajustarse al briefing y quitar detalles comerciales no respaldados; se completaron las cuatro credenciales requeridas (12 años, España/EE. UU., +500 procesos y sectores) y el titular inglés quedó alineado literalmente.
- Añadido enlace de salto accesible al formulario; el enlace de salto existente en landing ahora es el primer elemento enfocable. Fijado el copyright 2025 según el brief. README ES/EN corregidos para describir persistencia de todos los campos, consentimiento y ausencia de carga de CV.
- Verificaciones actuales: desde `uis/website/`, `npm run typecheck`, `npm run lint`, `npm run build` pasaron; desde `services/api/`, `.venv/bin/python -m pytest -q tests/test_records_api.py` pasó (`12 passed`, una advertencia deprecada Starlette/httpx); `git diff --check` pasó.
- Smoke test local: FastAPI `127.0.0.1:8000/health` y `/docs` HTTP 200; Website `127.0.0.1:3001/` y `/application` HTTP 200. Proxy honeypot respondió 200 sin escribir candidatura. API y website permanecen iniciados en terminales locales.
- Pipeline de contenido asistido por IA y dashboard de métricas de marketing del contexto general no son parte del Hito 1 de sitio público y no están implementados en este sitio; quedan fuera de esta entrega web. No se ha hecho commit ni push y no se modificó backoffice.

## Hito 2 — endurecimiento inicial de utilidades — 2026-10-29

- Se reforzó `src/utils/validations.ts`: valida objetos y listas antes de recorrerlos, rechaza números no finitos y endurece la comprobación básica de email (un solo `@`, sin espacios).
- En `src/utils/transformations.ts`, el conteo de habilidades requeridas/preferidas ya normaliza y deduplica; `findTopSkills` cuenta una habilidad como máximo una vez por candidato, normaliza diferencias de mayúsculas y conserva la primera etiqueta legible; `calculateAverageSalary` redondea solo el promedio final.
- Se creó y amplió `tests/hito2.test.cjs`, usando `node:test` y `node:assert` sin introducir dependencias ni cambiar manifests. Los 19 casos cubren validaciones, filtros, ordenamientos (incluida no mutación), búsquedas lineal/binaria, score y sus límites, ranking, agrupaciones, conteos, estadísticas salariales, habilidades, fill rate y reporte.
- Decisión confirmada por el usuario: las reglas de skills pueden sumar hasta 60 puntos (40 por requeridas más hasta 20 por preferidas); `calculateCandidateScore` mantiene el tope global de 100. La prueba cubre explícitamente ambas reglas.
- Verificaciones actuales ejecutadas: `npm run typecheck` pasó; compilación temporal con `node_modules/.bin/tsc --project tsconfig.json --outDir <tmp> --noEmit false` pasó; `NEXOVA_HITO2_BUILD_DIR=<tmp> node --test tests/hito2.test.cjs` pasó (`19/19`); `git diff --check` pasó. El primer test ampliado detectó expectativas erróneas en dos puntuaciones; se corrigieron las expectativas y la suite final pasó.
- Se mantuvieron sin cambios `src/utils/collections.ts` y `src/utils/search.ts`: la cobertura verifica el contrato tipado existente. No se añaden defensas para entradas fuera de tipo fuera de las validaciones.
- Sin commit, push ni instalación de dependencias. Se preservan los cambios preexistentes en website/API y las modificaciones previas del banco de memoria.

## Talent Pipeline Tracker — mejoras de frontend — 2026-10-29

- En `uis/backoffice/lib/api.ts`, `getRecords()` solicita páginas de 100 registros y combina todas las páginas según el total del API; se evita limitar silenciosamente el pipeline a la primera página. La prueba de API cubre 101 candidaturas.
- En `uis/backoffice/types/candidate.ts`, status y etapas internas se muestran con etiquetas legibles en español, incluido el status seleccionado. Se verificó que cards/listado no expongan valores crudos de status/etapa.
- Se añadieron nombres accesibles a los campos del formulario y `components/__tests__/CandidateForm.test.tsx` verifica el payload completo y enlaces opcionales vacíos como `null`. Se amplió la cobertura de card/lista y paginación.
- El test de layout de autenticación dependía de un mock incompleto de `next/navigation`; se incluyó `usePathname`, requerido por `AuthenticatedNavigation`.
- Verificación final desde `uis/backoffice/`: `npm test` pasó (`27` archivos, `123` tests); `npx tsc --noEmit` pasó; ESLint focalizado sobre los archivos modificados pasó; `git diff --check` pasó. ESLint global sigue reportando cinco errores y dos warnings en componentes/contexto preexistentes (perfil, navegación, detalle de candidatura, resumen de incidencias y auth context); no se modificaron para no ampliar el alcance. Vitest emite además un aviso de que `vite-tsconfig-paths` puede sustituirse por resolución nativa, sin fallo de tests.
- La suite no valida la experiencia visual manual ni la integración contra un API en vivo. Sin commit, push ni PR; se preservan todos los cambios preexistentes en website, API, utilidades, tests raíz y memoria.

## Talent Pipeline Tracker — auditoría contra brief del Hito 3 — 2026-10-29

- Releídos ambos briefings (`Contexto-Nexova/03-frontend-development/nexova-BRIEFING.es.md` y `.en.md`). Se cotejaron los cinco flujos pedidos (listado, filtros/búsqueda sin recarga, detalle y cambio de estado/etapa, notas internas con borrado, alta/corrección de candidaturas) y los tres criterios específicos (etiquetas, notas solo en detalle y campos de alta).
- Auditoría confirmada: listado, búsqueda por nombre/email y filtros por estado/etapa operan localmente; tarjetas enseñan nombre, puesto, estado y etapa; las páginas de detalle cargan el registro y notas, permiten cambiar status/etapa, alta y borrado de notas, edición del registro; el alta incluye los seis campos requeridos por `RecordCreate` (`full_name`, `email`, `phone`, `position`, `experience_years`, enlaces LinkedIn/CV opcionales); `getRecords()` combina páginas de 100.
- Se corrigió la etiqueta de `selected` a «Seleccionada», exactamente como pide la tabla española del brief; el formulario fuerza años de experiencia enteros (`step=1`) según el schema real del backend (`experience_years: int`), con cobertura de regresión.
- Se corrigió la carga del detalle para no ejecutar la carga async directamente en el cuerpo del efecto, evitar actualizaciones después de desmontar y descartar respuestas de candidaturas anteriores; el reintento usa contador de intento. Se armonizaron algunas tildes faltantes en textos de candidaturas.
- Verificaciones finales desde `uis/backoffice/`: `npm test` pasó (`27` archivos, `123` tests); `npx tsc --noEmit` pasó; `npm run lint -- --no-warn-ignored` sobre los archivos de esta auditoría pasó; `git diff --check` pasó. El lint global del repo no se usó como criterio porque sigue señalando errores preexistentes en otras áreas/componentes.
- Queda sin verificar visualmente mediante navegador y contra API central en vivo; no se afirma esa validación. Sin commit, push ni PR; los demás cambios preexistentes en el árbol quedan preservados.
