# Contexto técnico — Monorepo Nexova

> Referencia operativa basada en archivos presentes del repositorio. Los README genéricos pueden estar desactualizados; prevalece la implementación comprobada, documentando sus inconsistencias.

## Ubicación de aplicaciones y servicios

Respetar el mapeo de la plantilla y no crear árboles de aplicación paralelos: el sitio público de Nexova vive en `uis/website/`, la aplicación interna en `uis/backoffice/`, y las APIs/servicios backend en `services/`. Leer `uis/README.md`, el README del proyecto de UI correspondiente, `services/README.md` y el README del servicio afectado antes de añadir o mover código. Estas rutas indican el destino del código futuro; no implican que se deban crear o modificar aplicaciones sin alcance autorizado.

## Arquitectura observada

Monorepo sin runner/workspace común comprobado. Contiene frontend estático, dos proyectos web bajo `uis/`, backend Python en `services/api/`, utilidades Python en `packages/incidents_analysis` y tipos/recursos compartidos en `packages/shared/`. La ejecución contenerizada se define en `docker-compose.yml` con servicios `interfaces` y `backend`.

### Aplicaciones e interfaces

- **Sitio/formulario estáticos:** `index.html`, `application.html`, `i18n.js`, `validation.js`; README raíz propone `npx serve .` para validarlos.
- **Directorio de proveedores estático:** `uis/application/app/suppliers/index.html`. Usa Tailwind CDN y llama `/suppliers` y subrutas; no forma parte del volumen de la UI definida en Compose.
- **Backoffice (antes Talent Pipeline Tracker):** `uis/backoffice/`; Next.js App Router, TypeScript, React y Tailwind. Tiene interfaces de candidaturas, usuarios/autenticación, incidencias y API routes para records/incidents.
- `docker-compose.yml` monta `uis/backoffice` en el contenedor `interfaces`; `uis/Dockerfile` usa `node:22-alpine`, instala el lockfile con `npm ci` y `uis/start.sh` lanza Next en puerto 3000.
- Existe `uis/backoffice/AGENTS.md` con instrucción específica: consultar documentación local de Next.js en `node_modules/next/dist/docs/` antes de modificar código por posibles cambios de versión. `CLAUDE.md` lo referencia. No hay `AGENTS.md` raíz verificado.

### Backend y datos

- **API principal:** `services/api/main.py` crea FastAPI, registra routers de usuarios, perfiles, autenticación, records, incidencias e inventario; declara `/health`.
- **Inventario:** `services/api/routers/inventory.py`; modelos SQLModel en `services/api/models.py`, schemas en `schemas.py`; stock neto se calcula a partir de órdenes y salida con cantidad excesiva es rechazada. El router requiere usuario autenticado en operaciones de creación, según la implementación.
- **Persistencia mixta:** `services/api/database.py` configura TinyDB en `services/api/data/db.json`; PostgreSQL/SQLModel solo se habilita si existe `DATABASE_URL`. `get_db()` lanza error cuando no se configuró PostgreSQL. Los routers de inventario usan esa sesión.
- **Proveedores:** `services/api/routes/suppliers.py`, modelos Pydantic/TinyDB, seed y pruebas están presentes. El router de proveedores no se importa ni se incluye en el `main.py` actual; la UI estática que lo consume puede no encontrar esas rutas en esta instancia de la API. No duplicar el dominio ni declararlo integrado hasta resolver el montaje.
- **Analizador CSV de incidencias:** aplicación separada `services/api/app/main.py`, servicio y endpoints `/api/incidents/...`; `services/api/README.es.md` documenta ese punto de entrada antiguo/alternativo. No confundirlo con `services/api/main.py`.
- **Seeder del inventario:** `services/api/seed_inventory.py`; requiere base PostgreSQL disponible y UUID existente de TinyDB, y evita crear usuarios.
- **Contenerización backend:** `services/Dockerfile` utiliza `python:3.12-slim`, instala `uv`, sincroniza `services/api/uv.lock` y ejecuta Uvicorn `main:app` desde `/workspace/services/api`.

### Carpetas compartidas y de soporte

- `packages/shared/`: `@repo/shared-types` (metadata mínima TS) y módulos `types/index.ts`, `incidents.py`.
- `packages/incidents_analysis/`: analizador, modelos, parser, validador, exportación y CLI; pruebas en `scripts/tests/`.
- `agents/`: documentación y plantilla de agentes; `skills/`: skills `code-review`, `data-analysis`, `research`; no equivale a `.agents/`.
- `scripts/`: analizador y seed de incidencias más tests; `docs/`: documentación; `shared/`: recursos compartidos no empaquetados según README.
- README de raíz/top-level conservan texto de plantilla que dice que no hay apps/backend, contradicho por el código. Tratar esa descripción como histórica.

## Tecnologías/versiones comprobadas

- **Node/npm:** entorno de inspección observó Node `v24.21.0`, npm `11.19.0`. No significa requisito del proyecto.
- **Tracker:** manifest fija Next.js `16.2.10`, React/React DOM `19.2.4`; TypeScript `^5`, Tailwind `^4`, ESLint `^9`, Vitest `^4`, jsdom `^29`, Testing Library. `uis/Dockerfile` usa Node 22 Alpine.
- **Raíz JS:** `package.json` privado, TypeScript `^5.9.2`, único script `typecheck`; `tsconfig.json` solo incluye `src/**/*.ts` (no comprueba automáticamente el tracker).
- **Python backend:** `services/api/pyproject.toml` requiere Python `>=3.12` y declara FastAPI, SQLModel, TinyDB, Uvicorn, dotenv, JWT, etc.; grupo dev incluye pytest, pytest-cov y httpx. `services/api/uv.lock` es lockfile de uv.
- **Configuración Python raíz heredada:** `pyproject.toml` declara proyecto `nexova-suppliers-api`, Python `>=3.10` y pytest sobre `services/api/tests`; difiere del proyecto backend más nuevo. `services/api/requirements.txt` lista versiones antiguas/pin de FastAPI, Uvicorn y multipart. Confirmar la fuente de dependencias antes de cambiar instalación.
- **TypeScript del backoffice:** `uis/backoffice/tsconfig.json` estricto, alias `@/*`, módulo ES/bundler y plugin Next. Vitest usa jsdom y cobertura V8. ESLint se configura mediante `eslint.config.mjs`.
- No inferir que dependencias están instaladas: `node_modules` del tracker no estaba presente en esta sesión; `uv` no estaba en PATH.

## Gestores, comandos y ejecución

### Backoffice (desde `uis/backoffice/`)

- Instalación reproducible indicada por Dockerfile y lockfile: `npm ci`.
- Desarrollo: `npm run dev` (puerto 3000 por defecto).
- Producción: `npm run build` y `npm start`.
- Lint: `npm run lint`.
- Pruebas: `npm test`; cobertura: `npm run test:coverage`; watch: `npm run test:watch`.
- Typecheck: `npx tsc --noEmit` (o npm exec). No se ejecutaron durante esta inspección.

### Python (`services/api/`)

- Instalación/sincronización del proyecto: `uv sync` (el Dockerfile usa `uv sync --locked --no-dev --no-install-project`).
- Tests según `TESTING.md`: `uv run pytest`; cobertura: `uv run pytest --cov`. `uv` no se encontró en PATH en esta sesión.
- README local del analizador propone `pip install -r services/api/requirements.txt` y `uvicorn services.api.app.main:app --reload`, más unittest específico; esa ruta corresponde al módulo de incidencias, no a la API principal.
- Seed de inventario según docstring: `uv run --directory services/api python seed_inventory.py`.
- No se afirma que el seed de proveedores sea aplicable a la API principal, puesto que el router no está incluido allí.

### Raíz / Docker

- Raíz: `npm run typecheck` verifica `src/**/*.ts`, no todas las apps.
- Sitio estático: `npx serve .` está documentado en README raíz.
- Desarrollo compuesto: configuración disponible mediante `docker compose up --build`; no ejecutado ni validado. `docker-compose.yml` define puertos 3000 y 8000, volumen de datos y `API_INTERNAL_URL=http://backend:8000`.
- Posible fallo en healthcheck: Compose solicita `/`, pero la API principal declara `/health`; validar/ajustar antes de depender de condición healthy.

## Variables de entorno (nombres, nunca valores)

Los nombres observados en ejemplos/configuración incluyen `DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES`, `FRONTEND_URL`, `RESEND_API_KEY` y `RESEND_FROM_EMAIL`. No copiar valores al banco de memoria. Compose carga `.env.example` y opcionalmente `.env` y `services/api/.env`; el archivo de ejemplo está excluido de lectura por una política de herramienta, por lo que no se afirma que la lista sea exhaustiva. Mantener credenciales fuera de Git y documentación.

## Decisiones arquitectónicas confirmadas por código

- Monorepo separa interfaces (`uis/`), backend (`services/`) y compartidos (`packages/`).
- El tracker canaliza `/api/:path*` a `API_INTERNAL_URL` desde `next.config.ts` (por defecto `http://backend:8000`).
- La API principal combina FastAPI con TinyDB para ciertos datos y SQLModel/PostgreSQL para inventario cuando se configura la base.
- La suite frontend usa Vitest, no Jest.
- No existe workspace runner raíz: no asumir Nx, Turborepo, pnpm workspaces ni equivalente.

## Restricciones y problemas conocidos

1. `services/api/tests/conftest.py` tiene una cadena triple aparentemente abierta antes de `test_valid_payload_usa`; pytest terminó en SyntaxError de línea 81, por lo que no se ejecutó la suite.
2. El router de proveedores no está incluido en `services/api/main.py` pese a tener endpoints, tests y consumidor estático.
3. El healthcheck Compose consulta `/`; la API principal expone `/health`.
4. Manifiestos Python raíz, `services/api/pyproject.toml` y requirements divergen en versión de Python/dependencias.
5. `TESTING.md` contiene resultados históricos y referencias a `uv` local que no se confirmaron en este entorno. No presentarlos como ejecución actual.
6. Los README raíz y propuesta de arquitectura de `docs/ARCHITECTURE_PROPOSAL.md` incluyen afirmaciones históricas (por ejemplo, backend inexistente) que contradice la estructura actual.
7. El contexto específico antiguo de proveedores fue eliminado intencionalmente en el árbol actual; preservar esa eliminación.
8. El requisito empresarial menciona seis oficinas pero define solo Valencia/Miami.

## Convenciones para cambios futuros

- Antes de modificar Next.js, leer `AGENTS.md` local y documentación instalada para la versión 16; no aplicar patrones recordados sin comprobarlos.
- Seguir la aplicación existente y no crear un segundo frontend/API para el mismo dominio sin decisión expresa.
- Reutilizar modelos compartidos y contratos existentes; revisar `packages/shared/` antes de definir tipos duplicados.
- Mantener lógica Python en `services/api/` y pruebas en su suite correspondiente; no mover código durante un cambio documental.
- Confirmar el punto de entrada realmente ejecutado por Docker y los routers registrados antes de afirmar que un endpoint está disponible.
- No cambiar ni restaurar fuentes de contexto eliminadas por el usuario. No documentar secretos.

## Mantenimiento

Actualizar este archivo junto con cualquier cambio confirmado en arquitectura, manifests, entrypoints, variables, comandos o pruebas. Referenciar paths y distinguir **hecho**, **decisión explícita**, **hipótesis** y **pendiente**. No copiar íntegramente READMEs: registrar solo contexto operativo compartido y divergencias importantes. Comprobar los comandos en el entorno si se anotan como ejecutados; si solo están definidos/documentados, etiquetarlos como tales.