# Instrucciones para agentes de código — Nexova

Estas instrucciones se aplican a agentes que trabajen en cualquier parte de este monorepo. Las instrucciones locales pueden añadir detalle para una carpeta, pero no pueden relajar estas salvaguardas. Si hay una contradicción, no adivines: detente, informa las fuentes en conflicto y solicita una decisión.

## Inicio obligatorio de cada sesión

Antes de proponer o modificar archivos:

1. Lee este `AGENTS.md`.
2. Lee `memory-bank/projectbrief.md`, `memory-bank/techContext.md` y `memory-bank/progress.md` para conocer alcance, arquitectura y estado registrado.
3. Lee `CONTEXT.md` y los documentos empresariales pertinentes a la tarea, como `company-choice.md` o los briefs específicos que estén presentes. Distingue requisitos documentados de funcionalidades realmente implementadas.
4. Lee el `README.md` o `README.es.md` de la carpeta en la que trabajarás y los README relacionados (por ejemplo, `services/api/`, `uis/` o un paquete compartido).
5. Si cualquiera de esos archivos no existe, está eliminado o no es accesible, indícalo explícitamente; no afirmes haberlo leído ni reconstruyas su contenido como si fuera fuente actual. Usa únicamente evidencia disponible y pide aclaración cuando la ausencia afecte al alcance.
6. Inspecciona Git antes de modificar: rama, estado (`git status --short --branch`), diferencias relevantes y archivos nuevos. Separa los cambios previos del usuario de los tuyos; no los descartes, restaures, sobreescribas ni incluyas en un commit sin autorización.

No presupongas que los README de plantilla reflejan la implementación actual. Contrasta la documentación con entrypoints, código, manifests, tests y configuración aplicables, y conserva explícitas las discrepancias.

## Flujo obligatorio antes de cada commit

Sigue estos seis pasos en orden para todo cambio que se pretenda confirmar:

1. **Comprender:** revisar contexto empresarial y técnico, objetivo, alcance y criterios de aceptación de la tarea.
2. **Inspeccionar:** revisar Git y el trabajo previo; examinar archivos afectados, dependencias, entrypoints y convenciones locales relevantes.
3. **Planificar:** definir el cambio mínimo, archivos previstos, riesgos, dependencias y verificaciones que demostrarán aceptación. Consultar antes de decisiones arquitectónicas irreversibles o ambiguas.
4. **Implementar:** modificar solo lo necesario para el alcance autorizado; mantener separado cualquier cambio preexistente.
5. **Verificar:** ejecutar pruebas, linters, typechecks, compilaciones o comprobaciones aplicables al cambio. Informar exactamente qué se ejecutó y el resultado. Si una verificación no aplica o no puede ejecutarse, explicar por qué; nunca presentarla como exitosa.
6. **Revisar y documentar:** inspeccionar el diff completo (incluidos archivos no rastreados que se vayan a añadir), revisar secretos, datos personales, cambios ajenos, contratos y configuración; actualizar el banco de memoria solo cuando cambie contexto duradero o progreso relevante; resumir resultados y limitaciones.

El commit solo está permitido después de completar el flujo, pasar las comprobaciones aplicables y revisar el diff. Si una comprobación aplicable falla, hay conflictos, cambios inesperados o falta información necesaria, detente, explica el bloqueo y no ocultes ni enmascares el problema. No crees commits automáticamente: requiere autorización explícita del usuario para cada acción de commit. Estas instrucciones no conceden autorización para push.

## Restricciones de modificación

- Respeta estrictamente el alcance pedido y la autorización disponible; evita refactorizaciones, formato masivo o limpieza no relacionados.
- Reutiliza módulos y contratos existentes, en particular `packages/shared/` y las implementaciones actuales; busca usos antes de crear otra API, modelo, tipo, cliente, UI o lógica equivalente.
- No cambies contratos API, dependencias/lockfiles, manifests, configuración de infraestructura, esquema de datos ni nombres o valores de variables de entorno sin necesidad justificada, evidencia y autorización apropiada. Expón impacto y compatibilidad.
- No borres, restaures, renombres ni sobrescribas trabajo previo, archivos modificados por el usuario o contexto eliminado sin permiso explícito. Si el estado de Git cambia de forma inesperada, detente y pregunta.
- No introduzcas secretos, credenciales, tokens, datos personales reales ni dumps de producción en el repositorio, logs, tests o memoria. Usa ejemplos ficticios y variables sin valores.
- No declares pruebas, lint, build, deploy, cobertura o integración como exitosos si no se ejecutaron realmente; distingue código presente de comportamiento validado y resultados actuales de históricos.
- Pregunta antes de decisiones arquitectónicas irreversibles o ambiguas, cambios a archivos protegidos, eliminación de información o resolución de requisitos empresariales contradictorios.
- No instales dependencias ni cambies el entorno para evitar una falla sin autorización y evaluación del impacto.

## Instrucciones locales y herramientas

Lee y aplica también [la regla de desarrollo del monorepo](.agents/rules/nexova-monorepo-development.md) en cada tarea. Busca instrucciones adicionales aplicables en el árbol de carpetas afectado antes de editar. Actualmente `uis/talent-pipeline-tracker/AGENTS.md` requiere consultar la documentación local de Next.js en `node_modules/next/dist/docs/` antes de escribir código Next.js; `uis/talent-pipeline-tracker/CLAUDE.md` la referencia. Cumple ambas instrucciones junto con este protocolo. La ausencia de una configuración de Cursor, Windsurf o Copilot no debe suplirse afirmando que estas reglas se cargan automáticamente.

## Entrega, diff y Git

Al finalizar una tarea, comunica en español salvo que se solicite otro idioma:

- Archivos modificados/creados y resumen acotado de cada cambio.
- Verificaciones realmente ejecutadas, comandos y resultados; fallos, limitaciones y verificaciones omitidas.
- Estado de Git relevante, distinguiendo los cambios de la tarea de cambios preexistentes.
- Dudas, supuestos y decisiones que requieren al usuario.
- Si procede preparar una PR, informa rama base/candidata, alcance y pruebas conocidas, pero di que está **preparada para crear** solamente si ese es el caso. No afirmes que una PR fue creada, revisada o fusionada sin confirmación observable de la operación.

No hagas commit, push, publicación ni creación de PR sin autorización explícita para esa operación. Antes de presentar una tarea como terminada, confirma que los archivos y resultados anunciados existen realmente.
