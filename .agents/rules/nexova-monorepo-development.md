# Regla de desarrollo del monorepo Nexova

## Objetivo

Mantener cambios de código y documentación coherentes con el monorepo real de Nexova, reducir duplicación entre sus aplicaciones y servicios, y evitar daños al trabajo previo o afirmaciones de validación sin evidencia.

## Alcance de aplicación

Aplica a agentes y tareas que lean, creen o modifiquen cualquier contenido del repositorio, incluidos:

- `services/` y sus proyectos Python/FastAPI;
- `uis/`, incluidos Next.js, interfaces estáticas y otras UIs;
- `packages/`, `shared/`, `scripts/`, `agents/`, `skills/`, `mcps/`, `workflows/`, `data/`, `infra/`, `internal/` y `docs/`;
- archivos de raíz que afecten a varias áreas: manifests, lockfiles, Compose, documentación, contextos empresariales y memoria.

Se aplica al inicio de la tarea y durante inspección, implementación, prueba y revisión; no solo cuando se prepara un commit. Si una tarea cae en una carpeta con `AGENTS.md`, sigue también sus reglas locales y consulta cualquier conflicto en lugar de escoger silenciosamente una.

## Formato y activación

Este archivo es documentación Markdown bajo `.agents/rules/`, convención del repositorio. La inspección encontró `agents/` (documentación de agentes), pero no una configuración `.agents/`, `.cursor/`, `.windsurf/`, instrucciones de Copilot ni metadatos de reglas automáticas existentes. Por tanto, **no se afirma que esta regla se active automáticamente** en Cursor, Windsurf, Claude Code o GitHub Copilot. Su cumplimiento se exige mediante la referencia explícita desde el `AGENTS.md` raíz y por agentes que reciban o lean las instrucciones del repositorio. Si se incorpora integración automática en el futuro, confirmar el formato vigente de esa herramienta y añadir solo metadatos/configuración compatibles, sin duplicar esta regla.

## Convenciones específicas de Nexova

1. **Monorepo, no proyecto único:** existen páginas HTML en raíz, UI estática de proveedores, tracker Next.js en `uis/talent-pipeline-tracker/`, API principal en `services/api/main.py`, un módulo alternativo del analizador en `services/api/app/main.py`, scripts Python y paquetes compartidos. Identifica el entrypoint real antes de tocar o describir un dominio.
2. **Next.js:** antes de modificar el tracker, sigue `uis/talent-pipeline-tracker/AGENTS.md` y consulta la documentación local de la versión instalada en `node_modules/next/dist/docs/`. No apliques una API recordada de otra versión; si los docs locales no están disponibles, detente antes de cambios no triviales y explica el bloqueo.
3. **Python y persistencia:** distingue la API principal de módulos alternativos. La API mezcla TinyDB para ciertos dominios con SQLModel/PostgreSQL para inventario cuando existe `DATABASE_URL`; no des por hecho que un router está registrado solo porque su archivo existe. Confirma `services/api/main.py`, dependencias y tests antes de cambiar endpoints o persistencia.
4. **Compartición:** revisa `packages/shared/`, `shared/` y los contratos que ya consumen los clientes antes de añadir modelos, tipos, validadores, clientes o lógica duplicados. Mantén cada cambio en la capa responsable y añade/modifica tests del dominio correspondiente.
5. **Manifests y ejecución:** raíz, backend y tracker tienen configuraciones distintas; no hay runner común de workspace comprobado. Usa el manifest, lockfile, README e instrucciones de la aplicación afectada; no cambies dependencias o infraestructura por conveniencia local.
6. **Fuentes y madurez:** README genéricos pueden ser históricos y los contextos pueden corresponder a hitos distintos. Contrasta documentación con código/configuración. Conserva requisitos, decisiones, hipótesis y tareas futuras como categorías separadas; resultados de `TESTING.md` son históricos hasta reproducirse.
7. **Memoria:** para alcance empresarial/técnico/progreso duradero, actualiza los archivos pertinentes en `memory-bank/` según `AGENTS.md`. No copies allí secretos ni vuelvas a crear contenido de contextos que el usuario eliminó.

## Comportamientos obligatorios

- Leer primero el `AGENTS.md` raíz, los tres documentos requeridos de `memory-bank/`, `CONTEXT.md` y briefs pertinentes, además de README de las carpetas implicadas. Señalar los archivos ausentes; no fingir su lectura.
- Inspeccionar `git status --short --branch` y el diff antes de editar; preservar cambios locales y separar los propios.
- Acordar criterios de aceptación y alcance; elegir el cambio mínimo y declarar riesgos o incertidumbres relevantes.
- Inspeccionar usos, pruebas, dependencias y configuración de la aplicación afectada antes de modificar contratos.
- Ejecutar las verificaciones aplicables y registrar resultados reales; no convertir fallos, suites no ejecutadas o resultados históricos en éxitos actuales.
- Revisar el diff —incluidos archivos nuevos— para cambios fuera de alcance, secretos, datos personales, borrados y coherencia documental antes de entregar.
- Solicitar autorización explícita antes de decisiones de arquitectura irreversibles, cambios protegidos, commits, pushes o publicación de PR.

## Comportamientos prohibidos

- No borrar/restaurar archivos, descartar cambios ajenos, reescribir contexto empresarial ni hacer commits automáticos.
- No duplicar dominios existentes en otra API/UI, ni introducir dependencias, alteraciones de contratos, migraciones o cambios de infraestructura no solicitados y no justificados.
- No incluir credenciales, tokens o datos personales reales; no registrar valores de secretos en `memory-bank/`.
- No decir que una prueba, build, despliegue o PR pasó/ocurrió sin resultado verificable.
- No ignorar o silenciar un fallo de tests, conflicto de instrucciones, estado Git inesperado o discrepancia empresarial que afecte la implementación.

## Procedimiento ante conflictos o incertidumbre

1. Detén la modificación de los archivos en conflicto; preserva todo el estado existente.
2. Identifica instrucciones/fuentes exactas en conflicto (incluidos sus paths) y explica el impacto.
3. Usa evidencia de código/configuración solo para describir comportamiento actual; no la conviertas automáticamente en decisión empresarial.
4. Formula la pregunta mínima necesaria al usuario/responsable. No elijas silenciosamente una alternativa destructiva o irreversible.
5. Continúa solo cuando el alcance o la precedencia queden claros. Si no hay respuesta, entrega el diagnóstico y deja el cambio bloqueado.

## Criterios verificables de cumplimiento

Antes de dar por concluida una tarea de desarrollo, debe poder comprobarse que:

- se leyó o se marcó explícitamente como ausente cada documento de inicio pertinente;
- el estado Git previo fue inspeccionado y ningún cambio ajeno fue perdido o mezclado inadvertidamente;
- el diff contiene únicamente archivos necesarios y no introduce secretos ni duplicación obvia;
- contratos, entrypoints y dependencias usados corresponden a la aplicación objetivo;
- las pruebas/linters/build aplicables están identificados con sus comandos y resultados veraces, y los fallos quedan visibles;
- el banco de memoria se actualizó solo si cambió contexto duradero/progreso y el usuario puede ver preguntas pendientes;
- no hubo commit, push ni PR sin autorización y sin comprobación de que la operación se realizó.

El protocolo general de seis fases y la autorización Git se definen en [`/AGENTS.md`](../../AGENTS.md); este documento concreta su aplicación a Nexova y no los sustituye.
