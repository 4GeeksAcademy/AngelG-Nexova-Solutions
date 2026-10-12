# Estado y progreso del proyecto

> Actualizado durante la preparación del banco de memoria en `feature/agent-memory-bank`. Este archivo refleja inspección y pruebas ejecutadas, no los resultados históricos como si fueran actuales.

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
- Existe UI estática de proveedores en `uis/application/app/suppliers/index.html` y el tracker Next.js en `uis/talent-pipeline-tracker/`, más páginas estáticas de raíz.
- Proyecto compuesto Docker y volúmenes definidos en `docker-compose.yml`; ejecución no probada en esta tarea.

## Pruebas y verificaciones de esta sesión

| Verificación | Resultado observado | Alcance |
|---|---|---|
| Rama, upstream y estado | `feature/agent-memory-bank` sigue a `origin/feature/agent-memory-bank`; se conservaron cuatro eliminaciones intencionales | Git solamente |
| Inspección de archivos | Código, manifests, routers, documentación, configuración y estructura revisados | Inspección estática |
| `pytest -q` desde la raíz | **Bloqueado antes de cargar tests**: `SyntaxError: unterminated triple-quoted string literal` en `services/api/tests/conftest.py`, línea 81, durante import de conftest | Ningún test se ejecutó |
| Disponibilidad herramientas | Node `v24.21.0`, npm `11.19.0`, pytest en PATH; `uv` no disponible en PATH; `uis/talent-pipeline-tracker/node_modules` ausente | Entorno de esta sesión; no garantiza otros entornos |
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