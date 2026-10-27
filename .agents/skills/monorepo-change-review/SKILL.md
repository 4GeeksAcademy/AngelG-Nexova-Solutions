---
name: monorepo-change-review
description: Revisa cambios del monorepo Nexova antes de un commit, contrastando alcance, contexto, arquitectura, riesgos y verificaciones sin modificar archivos ni crear commits.
---

# Monorepo Change Review

## 1. Nombre y objetivo

**Nombre:** `monorepo-change-review`.

**Objetivo único:** realizar una revisión reproducible, de solo lectura, de un conjunto de cambios del monorepo Nexova antes de que una persona decida si autoriza un commit. La skill identifica desvíos de alcance, incoherencias con el negocio o la arquitectura, efectos secundarios, riesgos de seguridad y vacíos de verificación; entrega evidencias para que el equipo pueda corregirlos en una fase separada.

No implementa correcciones, no aprueba automáticamente el cambio y no realiza el commit.

## 2. Cuándo utilizarla

Invócala antes de preparar o autorizar un commit cuando haya cambios staged, unstaged o archivos nuevos que se pretendan incluir. También puede usarse en una revisión intermedia de un cambio, declarando que el diff es parcial.

Esta revisión no sustituye:

- una revisión de arquitectura o seguridad especializada cuando el cambio modifica decisiones de alto impacto;
- la ejecución de CI, despliegues o integración con servicios reales;
- la validación funcional manual que requiera navegador, credenciales o datos no disponibles;
- la autorización del usuario para corregir archivos, crear commits, hacer push o abrir una PR.

Si el usuario pide corregir hallazgos, termina primero el informe de revisión y solicita que la corrección se trate como una fase/tarea autorizada aparte. No cambies de modo silenciosamente.

## 3. Inputs

Recoge o confirma los siguientes datos antes de concluir:

| Entrada | Uso |
|---|---|
| Objetivo de la tarea | Determinar intención, límites y comportamiento esperado. |
| Archivos modificados y archivos que se proponen incluir | Definir cobertura; obtenerlos del usuario y contrastarlos con Git. |
| Diff disponible | Revisar cambios staged/unstaged y comparar con la base indicada. |
| Rama y estado de Git | Entender upstream/base, cambios previos y archivos no rastreados. |
| Contexto empresarial y técnico | Revisar `CONTEXT.md`, briefs pertinentes, `memory-bank/projectbrief.md`, `techContext.md` y `progress.md`. |
| Criterios de aceptación | Evaluar cada condición como cumplida, pendiente, fallida o no aplicable, con evidencia. |
| Resultados de pruebas disponibles | Distinguir ejecución actual, resultados históricos, resultados aportados y verificaciones no ejecutadas. |

**Si falta una entrada:**

1. Busca evidencia no destructiva en el repositorio y en el estado Git actual; no inventes ni asumas datos.
2. Si el objetivo, el alcance autorizado, la base del diff o un requisito de negocio esencial siguen ausentes/ambiguos, pausa y pregunta. No emitas una recomendación de aceptación definitiva.
3. Si una entrada no está disponible pero no impide una revisión parcial, anótala como **no disponible**, indica cómo limita las conclusiones y entrega el informe como parcial o bloqueado.
4. No solicites secretos ni valores de credenciales. Si hacen falta para una validación, marca esa validación como no ejecutada y explica el motivo.

## 4. Procedimiento

Sigue los pasos en este orden y deja evidencia de cada uno.

### Paso 1 — Leer contexto y reglas

- Lee `AGENTS.md`, `.agents/rules/nexova-monorepo-development.md`, esta skill, `memory-bank/projectbrief.md`, `memory-bank/techContext.md`, `memory-bank/progress.md` y `CONTEXT.md`.
- Lee los briefs empresariales pertinentes que estén disponibles y los README de la aplicación/carpeta afectada, incluido cualquier README relacionado.
- Lee instrucciones locales `AGENTS.md`/`CLAUDE.md` u otras reglas aplicables. Para `uis/backoffice/`, respeta su `AGENTS.md` y la instrucción de consultar la documentación local de Next.js antes de cambios Next.js; esta skill revisa, no autoriza a modificar.
- Si una fuente requerida está ausente/eliminada, indícalo y no la describas como leída. Contrasta documentación con entrypoints, código, manifests y configuración; distingue requisito documentado de implementación comprobada.

### Paso 2 — Revisar Git y el diff

- Registra rama y estado con `git status --short --branch`; identifica staged, unstaged, untracked, conflictos y upstream/base disponible.
- Inspecciona tanto `git diff` como `git diff --cached`. Revisa también archivos nuevos no rastreados cuyo contenido se proponga incluir: Git diff no los muestra por defecto.
- Si la base de comparación fue especificada, contrasta contra ella. No infieras una base o alcance de commit solamente porque sea la rama activa.
- Revisa todos los archivos que el usuario declara dentro del alcance. Contrasta esa lista con Git y reporta cualquier archivo fuera de ella, omitido, binario no inspeccionable o ausente.
- No incluyas cambios previos ajenos como si fueran parte de esta tarea. Si no se puede atribuir el origen de un cambio, marca la atribución como incierta; nunca lo descartes ni lo limpies.

### Paso 3 — Comparar con el alcance

Para cada archivo/cambio, vincula el diff a un objetivo o criterio de aceptación. Señala cambios innecesarios, archivos no esperados, cambios de comportamiento implícitos y criterios que no tienen cobertura. Comprueba compatibilidad hacia atrás cuando afecte contratos o datos.

### Paso 4 — Identificar duplicación, incompatibilidades y riesgos

- Busca implementación y consumidores existentes antes de juzgar duplicación; en Nexova revisa, según corresponda, `packages/shared/`, `shared/`, `services/api/main.py`, las rutas/UI existentes y el entrypoint realmente usado.
- Contrasta cambios con la arquitectura real: el monorepo no tiene un runner raíz común comprobado; el backend distingue TinyDB y SQLModel/PostgreSQL y cuenta con entrypoints diferentes; el tracker Next.js tiene instrucciones locales/versionadas. No infieras integración de una ruta solo por la existencia de su archivo.
- Revisa posibles efectos secundarios en dependencias/manifests, lockfiles, API, esquema/persistencia, variables de entorno, configuración Docker, seguridad, privacidad, datos y consumidores.
- Busca secretos o datos sensibles añadidos (tokens, passwords, claves, URLs con credenciales, datos personales reales). Informa la ubicación con el mínimo detalle necesario; no copies el valor secreto en el informe.
- Distingue hallazgos nuevos de problemas preexistentes comparando la base disponible con el estado del cambio. Si no hay base verificable, clasifica el origen como **indeterminado**, no como nuevo ni preexistente.

### Paso 5 — Ejecutar verificaciones aplicables

- Determina comandos existentes en el README, manifest, lockfile e instrucciones de la aplicación afectada; no presupongas scripts ni un runner común.
- Ejecuta solo comprobaciones seguras y de solo lectura respecto al repositorio y entorno. No instales dependencias, no cambies configuración, no alteres bases de datos, no despliegues, no escribas en servicios externos y no ejecutes comandos destructivos.
- Una prueba que cree/actualice archivos, haga migraciones, use una base compartida o realice llamadas externas no se ejecuta sin entorno aislado y autorización explícita. Documenta motivo y comando omitido.
- Para cada comando ejecutado, registra comando, directorio/base relevante, resultado y alcance. No basta con citar un resultado histórico o que un test esté escrito.
- Si una comprobación falla, informa el fallo sin intentar repararlo; deja claro si impide una conclusión de aceptación.

### Paso 6 — Clasificar hallazgos

Usa estas severidades y aporta evidencia reproducible para cada hallazgo:

- **Bloqueante:** riesgo crítico de seguridad/datos, cambio destructivo no autorizado, conflicto de requisitos que impide evaluar o fallo que invalida el objetivo principal.
- **Alta:** incumplimiento importante de requisito, regresión probable, contrato incompatible o riesgo sustancial no mitigado.
- **Media:** defecto localizado, cobertura relevante ausente, inconsistencia arquitectónica o efecto secundario que debe resolverse o aceptarse expresamente.
- **Baja:** mejora menor, claridad/documentación o riesgo acotado que no impide continuar.
- **Informativo:** observación sin acción requerida para aceptación.

La evidencia debe identificar archivo y línea/rango cuando sea posible, condición reproducible o comando y resultado. Separa **hallazgo** (problema demostrado) de **riesgo/pregunta** (posibilidad pendiente de validación).

### Paso 7 — Emitir el informe

Usa el formato de salida siguiente. Evalúa aceptación como conjunto de criterios explícitos; no emitas recomendación positiva si faltan entradas esenciales, queda un Bloqueante/Alta sin resolver o una verificación obligatoria no se pudo completar.

## 5. Output esperado

Entrega un informe con estas secciones:

1. **Recomendación:** una de `Listo para revisión`, `Requiere correcciones` o `Bloqueado`. “Listo para revisión” no equivale a aprobado, probado en producción ni autorizado para commit.
2. **Resumen de cambios:** intención evaluada y cambios observados, indicando si la revisión fue completa o parcial.
3. **Archivos revisados:** rutas inspeccionadas y rutas anunciadas que faltaron/no pudieron revisarse; indica binarios o archivos grandes no inspeccionables.
4. **Hallazgos:** lista por severidad; cada elemento contiene título, estado (nuevo/preexistente/indeterminado), evidencia (ruta/línea, diff o comando), impacto y criterio afectado. Escribe “ninguno observado” solo para el alcance realmente revisado.
5. **Pruebas ejecutadas:** comandos, ubicación, resultado y alcance.
6. **Verificaciones no ejecutadas:** comando/tipo y motivo; incluye limitaciones por dependencias, entorno, seguridad o inputs ausentes.
7. **Criterios de aceptación:** tabla con cada criterio y estado `Cumplido`, `Pendiente`, `Fallido` o `No aplicable`, más evidencia.
8. **Siguiente acción sugerida:** inspección adicional, pregunta o fase separada de corrección. No apliques correcciones desde esta skill.

## 6. Criterios de aceptación verificables

La skill solo considera completa la revisión cuando se puede comprobar que:

- se identificó el alcance de los cambios usando el objetivo y Git;
- se revisaron todos los archivos del diff disponible y los archivos nuevos propuestos; toda excepción está enumerada;
- se comprobó coherencia con `AGENTS.md`, reglas aplicables, contexto empresarial/técnico y convenciones pertinentes de Nexova;
- se inspeccionaron efectos secundarios razonables, duplicación, incompatibilidades y riesgos de secretos/datos sensibles;
- se ejecutaron las comprobaciones aplicables que sean seguras, o se documentó cada omisión y su motivo;
- cada hallazgo tiene severidad y evidencia reproducible; riesgos y preguntas están separados de defectos demostrados;
- no se atribuyeron errores al cambio sin comparación con una base; los casos sin baseline constan como indeterminados;
- no se informó éxito de pruebas, builds o linters que no se ejecutaron realmente;
- los criterios se marcan individualmente como cumplidos, pendientes, fallidos o no aplicables;
- la skill no modificó archivos, no descartó cambios, no instaló dependencias, no realizó acciones destructivas y no creó commits.

Si alguno no se cumple, informa revisión **parcial/bloqueada** según corresponda y explica qué falta.

## 7. Límites de seguridad

Esta skill es **solo de revisión**. Está prohibido:

- editar, crear, borrar, renombrar, formatear o sobrescribir archivos;
- instalar/actualizar dependencias, cambiar configuración o tocar variables de entorno;
- hacer checkout/reset/restore/clean, staging, commit, push, merge, rebase, cherry-pick, deploy o abrir PR;
- descartar, ocultar, incluir en staging o alterar cambios del usuario;
- ejecutar pruebas destructivas, migraciones, seeds, escrituras a bases de datos, llamadas con efectos a servicios externos o comandos que puedan eliminar/sobrescribir datos;
- imprimir o copiar secretos encontrados; limitar el informe a ruta y tipo de exposición.

Si detecta problemas, repórtalos y solicita autorización para una **fase de corrección separada**. La recomendación nunca ejecuta esa corrección ni autoriza el commit.

## Compatibilidad e invocación

El archivo sigue la estructura `SKILL.md` usada como convención de skills en el repositorio y declara `name` y `description` en YAML frontmatter, compatibles con herramientas que implementan el formato Agent Skills. Se ubica bajo `.agents/skills/`, separado de la carpeta de producto/contenido `skills/`.

En la herramienta usada, invócala de forma explícita con una petición como: **“Usa la skill `monorepo-change-review` en `.agents/skills/monorepo-change-review/SKILL.md` para revisar los cambios de esta tarea antes del commit; no los modifiques.”** También puede proporcionarse como contexto del agente al iniciar la revisión.

El repositorio no contiene un manifiesto/cargador de skills ni configuración de activación automática de herramientas detectada durante esta tarea. El frontmatter mejora identificación en loaders compatibles, pero por sí solo no garantiza descubrimiento, carga o activación automática en una herramienta concreta. La skill debe invocarse explícitamente salvo que el entorno del agente proporcione y configure ese soporte.
