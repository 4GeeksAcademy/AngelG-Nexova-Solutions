# Plan de implementación — Hito 8, Parte 1: memoria y auto-mejora del agente

## Objetivo y límite

Extender el agente LangGraph actual **SDR/ventas** para recordar únicamente preferencias generales de presentación/respuesta asociadas al usuario autenticado (por ejemplo, brevedad o uso de viñetas). No memorizar datos de prospectos/clientes ni sus preferencias, patrones, hechos, precios, condiciones o políticas comerciales. Mantener RAG como fuente de hechos y el MCP/herramientas operativas aislados. No se implementa otro agente.

Estado actualizado: el usuario confirmó que el objetivo es el agente SDR/ventas y aceptó explícitamente el alcance reducido ligado al usuario por no existir tenant confiable. La recuperación aprobada está integrada en ruta RAG. Se integró la salida estructurada opcional de propuesta y el manejo de decisión explícita en turno posterior, atado a owner/thread/proposal; solo una aprobación clara crea una entrada. Ambigüedad se rechaza por defecto y editar requiere confirmación nueva. El usuario aplicó `004_agent_memory.sql`; desde el workspace se verificaron conexión, tres tablas, columnas, restricciones e índices. Una prueba de persistencia sintética ejercitó propuesta, aprobación, lectura posterior y limpieza; detectó y permitió corregir el orden de inserción respecto de la FK de auditoría.

## Fuentes de requisitos y restricciones

Leídos antes de redactar el plan:

- `Contexto-Nexova/08-agent-engineering/memory/nexova-BRIEFING.es.md` y su versión inglesa: define exactamente qué puede recordarse, qué se prohíbe y ejemplos de autoevaluación.
- `Contexto-Nexova/00-general-contexts/nexova-BRIEFING.es.md` y su versión inglesa: Nexova opera selección, outsourcing de soporte y formación; hay información sensible de selección y varias líneas de negocio.
- `Contexto-Nexova/08-agent-engineering/harnessing/nexova-BRIEFING.es.md`: contexto del hito posterior; confirma la identidad de agente de soporte de primera línea, multi-cliente, y riesgos de separación de datos. Sus guardrails serán compatibles, pero el trabajo de harness de Parte 2 queda fuera de este plan.

### Único dato memorizable en el alcance aprobado

- Preferencias generales de formato/estilo de respuesta de la persona usuaria autenticada, no relativas a una empresa ni a una oportunidad (p. ej., respuestas breves, listas con viñetas, explicar siglas).

### Exclusiones no negociables

- Nunca guardar CVs, calificaciones, notas de entrevista ni otros datos personales de candidatos de selección; pertenecen al ATS/RAG de candidatos.
- Nunca guardar hechos o datos de prospectos/clientes, preferencias atribuibles a empresas, oportunidades, pipeline, CRM o conversaciones comerciales.
- Nunca guardar hechos/políticas comerciales: tarifas, descuentos, comisiones, SLAs, garantías, contratos, plazos o condiciones.
- Nunca guardar información salarial de negociaciones activas de headhunting.
- No guardar correcciones puntuales ligadas a un único ticket sin patrón repetible.
- Rechazar la propuesta si contiene información prohibida, aunque el usuario pida explícitamente recordarla. No copiar el texto prohibido en el almacén persistente; definir con auditoría una representación de rechazo minimizada y sin dato sensible.
- La memoria no contendrá credenciales/tokens, ni hechos de otro cliente accesibles por error. Las recomendaciones de memoria deben quedar acotadas por empresa cliente/tenant autenticado.

## Decisiones de diseño propuestas

### Backend: PostgreSQL dedicado a memoria episódica/semántica acotada

Propuesta: tablas nuevas en la base PostgreSQL de la API para propuestas/auditoría y memorias aprobadas, bajo namespace/tablas explícitamente `agent_memory_*`; consultas de recuperación inicialmente por tenant, categoría y texto normalizado, con límites pequeños. El almacén de memoria será separado lógicamente del índice/colecciones RAG. **No escribir en ninguna colección `*_knowledge` ni en el Qdrant de conocimiento empresarial.**

Justificación: el caso es recordar pocas correcciones operativas y preferencias auditables, con confirmación y ciclo de vida transaccional, no buscar similitud sobre un corpus grande. PostgreSQL está ya presente opcionalmente en `services/api/database.py` y el grafo ya tiene checkpoint PostgreSQL configurable. Un almacén relacional facilita unicidad/deduplicación, ownership por tenant, expiración, trazabilidad y límites. Empezar con retrieval exacto/filtrado evita añadir una VectorDB y sus riesgos/costes sin necesidad demostrada. No usar knowledge graph: las relaciones explícitas complejas no son el requisito. No usar fine-tuning: impide olvido selectivo y actualización rápida. Redis/KV sería viable, pero ofrece menos comodidad para historial de decisiones, consultas de limpieza y auditoría relacional en esta aplicación.

La disponibilidad de PostgreSQL debe verificarse antes de implementar. No hacer que una instalación sin PostgreSQL falle de forma opaca ni redirigir a TinyDB/RAG como fallback de escritura. La política será fail-closed para escrituras y respuesta degradada/controlada para lectura si el store no está disponible.

### Separación y alcance por usuario

El endpoint pasa `owner_id` autenticado pero no tenant. Se aprobó almacenar solo preferencias de presentación del propio usuario, con `tenant_id=NULL`; nunca inferir identidad de cliente del texto, RAG, MCP o request.

### Una sola llamada de generación

Extender el paso SDR para producir respuesta + propuesta opcional estructurada de `response_preference`. La propuesta es solo candidata, no autorización. Validar allowlist y política; ante duda descartar. Si se emite propuesta, pedir consentimiento explícito sin inferirlo. Hasta completar ese trabajo, el generador actual de texto plano no puede crear propuestas y no se extraen preferencias implícitamente de mensajes sobre prospectos.

### Propuesta pendiente y decisión explícita

- Máximo una propuesta abierta por conversación/hilo autenticado.
- El primer paso del siguiente turno comprueba esa propuesta antes de procesar la solicitud nueva. Clasificador estructurado de intención (`approve`, `reject`, `edit`, `unclear`) ligado expresamente al `proposal_id` y al mensaje actual; no usar coincidencia ingenua de “sí/no”.
- Una edición solo se considera aprobada después de presentar la versión editada y obtener confirmación explícita para esa versión, salvo que el mensaje sea inequívoco y el criterio de clasificación lo autorice; ante confianza insuficiente, descartar.
- Cambio de tema, silencio, ambigüedad, expiración o fallo del clasificador = rechazo por defecto y cierre auditable; nunca aprobación inferida.
- Resolver decisión y luego continuar la pregunta nueva en el mismo turno. No descartar la pregunta nueva aunque se haya cerrado la propuesta.
- Registrar propuesta, resultado, timestamps UTC, origen de turno/mensaje, usuario/actor autenticado, tenant confiable si aplica y cambios de versión. No registrar tokens ni volcar contenido prohibido al log.

## Fases de implementación (sujetas a confirmación)

### Fase 1 — Contrato de identidad, modelo de datos y políticas

- Inspeccionar la autenticación y modelo multi-tenant para comprobar si se puede obtener el cliente autenticado de forma confiable; documentar decisión/bloqueo antes de tocar el comportamiento.
- Definir esquema Pydantic para respuesta estructurada, propuesta, clasificación de decisión y entradas aprobadas.
- Diseñar tablas SQLModel/SQLAlchemy nuevas `agent_memory_proposals`, `agent_memory_entries` y, si se requiere separar auditoría inmutable, `agent_memory_audit`; estados y restricciones para no más de una propuesta pendiente por thread.
- Acordar retención de auditoría minimizada, claves de deduplicación, límites por tenant/alcance y política ante datos prohibidos.
- Incorporar tablas sin alterar tablas/colecciones RAG y preparar pruebas SQLite aisladas. Revisar la estrategia de migración: el arranque actual usa `SQLModel.metadata.create_all`, que crea tablas ausentes pero no migra tablas existentes; no introducir una migración implícita incompatible.

**Aceptación:** contrato revisado frente al briefing; ownership confiable definido; los tests demuestran separación de tablas/namespace respecto a RAG.

### Fase 2 — Interfaz de memoria y recuperación acotada

- Añadir módulo/repository con operaciones explícitas `retrieve_memory`, `create_proposal`, `resolve_proposal`, `consolidate_memory`; dependencias inyectables para tests.
- Filtrar siempre por tenant autenticado y alcance/categoría permitidos; nunca cargar datos de otros clientes.
- Inyectar recuerdos recuperados como contexto etiquetado/no confiable y separado de instrucciones del sistema, con procedencia/fecha; no concatenar historial entero al system prompt.
- Aplicar límite de cantidad/tamaño por consulta y evitar recuperación de recuerdos vencidos/revocados.

**Aceptación:** pruebas demuestran aislamiento de tenant, topes de lectura y que la interfaz nunca accede a Qdrant/colecciones `*_knowledge`.

### Fase 3 — Autoevaluación y solicitud de consentimiento

- Actualizar la salida de generación para incluir campo estructurado de propuesta opcional sin añadir una llamada LLM adicional.
- Implementar criterio de relevancia y allowlist basado exactamente en el briefing: procedimiento repetible corregido, preferencia recurrente de cliente de outsourcing o patrón helpdesk.
- Bloquear siempre información de candidatos, salarios de negociación activa y correcciones específicas de un ticket; no ofrecerla como recuerdo.
- Incluir ejemplos negativos documentados y pruebas para al menos tres casos: consulta de tickets actual, agradecimiento y resumen de un ticket para reporte. Añadir casos positivos análogos al briefing.
- Presentar propuesta y pregunta de confirmación en español; verificar idioma/configuración del agente para bilingüismo antes de extenderlo. El briefing pide funcionamiento en el idioma base elegido, no asumir traducción automática si el agente hoy no es bilingüe.

**Aceptación:** cada respuesta normal conserva contrato actual; propuesta no escribe memoria; casos positivos/negativos validados.

### Fase 4 — Clasificación, resolución y continuidad de conversación

- Añadir nodo/etapa inicial para clasificar decisión contra la propuesta pendiente, preferiblemente structured output con etiqueta, propuesta referida, versión editada y confianza.
- Aplicar umbral explícito; `unclear`, error, cambio de tema o propuesta vencida se resuelve como `rejected_default`.
- Serializar turnos concurrentes por hilo o usar transacción/constraint optimista para evitar dos propuestas pendientes y doble aprobación.
- Tras decidir, persistir auditoría en todos los resultados. Solo `approved` crea/actualiza entrada persistente; `rejected`/`rejected_default` cierra la propuesta sin cambiar memorias.
- Continuar procesando la pregunta restante del usuario en el mismo turno.

**Aceptación:** pruebas aprobación/rechazo/edición/ambigüedad/cambio de tema, concurrencia, y pregunta posterior en mismo mensaje.

### Fase 5 — Consolidación, expiración y defensas contra envenenamiento

- Definir límites duros por tenant y por categoría (cantidad y tamaño) con deduplicación/upsert y reemplazo versionado de hechos equivalentes.
- Política propuesta: caducidad configurable para hechos episódicos; revisión/TTL más largo para procedimientos generales confirmados repetidamente. Proponer inicialmente 90 días para patrones/preferencias operativas con `last_confirmed_at` renovable, y 30 días para propuestas sin respuesta; las propuestas sin decisión se cierran automáticamente como rechazo. La auditoría conservará metadatos minimizados por el periodo acordado, sujeto a política empresarial.
- Consolidación explícita y determinista (no autoedición del modelo): limpieza de expirados, deduplicación, conteo de corroboraciones y revocación/versionado por nueva aprobación.
- Mitigación de poisoning: tenant confiable, consentimiento, validación de alcance, procedencia y autor, no tratar instrucciones RAG/MCP como instrucciones, límites de entrada, categorías cerradas, no elevar propuesta del usuario a política global. Para afirmar patrones compartidos exigir confirmación autorizada y corroboración según política; por defecto, memorias de preferencia quedan scoped a cliente.

**Aceptación:** tests de TTL, límites, deduplicación, revocación y contaminación cruzada; consolidación repetible sin crecer indefinidamente.

### Fase 6 — Evidencia, regresión y documentación

- Probar agente existente con RAG y MCP, memoria no disponible, propuestas y API actual.
- Documentar arquitectura y decisiones frente a episódica/vectorial/grafo/fine-tuning, lista de nunca-memorizar y mínimo tres ejemplos no memorables.
- Entregar dos recorridos completos reproducibles: aprobación que se recupera en turno futuro; rechazo que deja intacta la memoria. Incluir evidencia de auditoría y timestamps (fixture determinista, sin datos reales de clientes).
- Ejecutar tests dirigidos, suite de API pertinente, type/lint y diff review. No tocar cambios locales ajenos; no instalar paquetes salvo que se apruebe el plan y usar exclusivamente `uv add` si hiciera falta una dependencia.
- No incluir datos reales, credenciales ni PII en fixtures/documentación.

**Aceptación:** dos ciclos de evidencia, pruebas relevantes verdes o limitaciones claramente registradas, sin escrituras a RAG y sin cambio de identidad del agente.

## Riesgos y preguntas que se resolverán antes de implementar

1. ¿La identidad actual contiene un tenant/empresa cliente confiable? El handler visto pasa `owner_id`, pero no tenant. Decidir si el alcance inicial es memoria compartida de procedimientos generales o si se debe ampliar auth/contrato en un cambio separado.
2. ¿El despliegue usa PostgreSQL de forma garantizada para el agente? `DATABASE_URL` es opcional y `TinyDB` existe para otros datos; no se debe degradar la auditoría a almacenamiento no transaccional sin aprobación.
3. ¿Qué retención exige la empresa para auditoría de propuestas rechazadas? El briefing requiere que quede rastro, pero no fija plazo ni minimización.
4. ¿El agente está realmente bilingüe? El briefing de memoria pide flujo en idioma base elegido; confirmar español como idioma base o ampliar mensajes de confirmación.
5. El código abierto actualmente (`services/api/agent/graph.py`, `routes/agent.py`, `database.py`) es el agente interno autenticado por usuario. El briefing de Parte 2 describe agente de soporte expuesto a clientes. Antes de ampliar acceso o memoria por cliente, verificar qué despliegue/identidad es el objetivo sin cambiar identidad del agente.

## Fuera de alcance

- Sustituir o escribir en la base RAG empresarial/Qdrant; crear knowledge graph, fine-tuning, segundo agente o flujo de auto-aprobación.
- Guardar estado completo de conversación como memoria permanente.
- Cambiar MCP, contratos de incidentes/inventario, UI, autenticación pública o sistema ATS.
- Commit, push, despliegue o modificación de datos reales sin autorización independiente.

## Estado y aprobaciones

| Fase | Estado | Autorización |
| --- | --- | --- |
| 1. Contrato, identidad y políticas | Categoría única `response_preference`; tenant de cliente no existe y queda fuera del alcance | Confirmada por usuario |
| 2. Interfaz y recuperación | Repository admite únicamente preferencias generales del owner; el grafo las recupera solo para ruta SDR/RAG y las entrega aparte como contexto no confiable | Autorizada por usuario |
| 3. Autoevaluación y propuesta | El pipeline SDR puede devolver propuesta estructurada opcional; el grafo valida allowlist/scope/política y solicita confirmación solo tras persistir | Integrada; propuesta no equivale a consentimiento |
| 4. Decisión auditable | El grafo consulta propuesta por owner/thread en turnos posteriores; clasifica y resuelve mediante repository. Ambigüedad rechazada por defecto; edición vuelve a pending. Preguntas independientes junto a aprobación/rechazo se procesan aparte | Integrada, cubierta por tests locales y probada con persistencia sintética en PostgreSQL |
| 5. Consolidación y anti-poisoning | TTL, deduplicación, corroboración, límite por owner, tripwires, revocación, protección concurrente por índice único y lock de resolución; auditoría metadata-only con TTL de 365 días y purga en consolidación | Implementado; la invocación periódica de consolidación corresponde a una tarea externa aún por calendarizar |
| 6. Evidencia y regresión | 31 tests focalizados pasan; migración, esquema PostgreSQL y ciclo sintético verificados. Suite completa API: 296 pasadas, 6 xfailed | Validación de código completa; validar proveedor/modelo de generación y programar consolidación antes de operación sostenida |

### Estado ejecutado en la continuación autorizada

- Se añadieron operaciones de resolución y consolidación al repository. La memoria solo se crea ante `approve` del owner autenticado con confianza mínima; `edit` versiona la propuesta y conserva estado pending para solicitar una segunda confirmación.
- Se añadieron expiración (90 días para entradas, 30 para propuestas), rechazo minimizado/redactado, deduplicación con incremento de corroboración solo al aprobar de nuevo, límite máximo de entradas, y revocación explícita con evento de auditoría.
- Se agregó `services/api/migrations/004_agent_memory.sql` como migración manual. El usuario confirmó su aplicación. Desde el workspace se comprobó conexión a `postgres`/`public`, las tres tablas, columnas compatibles con SQLModel, restricciones CHECK e índices.
- Se cambió el contrato y el repository al único tipo `response_preference`, con barreras heurísticas contra datos de clientes/prospectos y términos comerciales.
- El grafo recupera preferencias aprobadas solo en ruta RAG, nunca en herramientas operativas/fallback; se presentan al pipeline separadamente de evidencia como datos no confiables y no autoritativos.
- `POST /agent/query` acepta `thread_id` opcional. El pipeline estructurado puede proponer preferencias de estilo; el grafo ata propuesta/decisión a owner y thread, aplica el repository y solo escribe tras aprobación clara. Editar requiere una segunda confirmación; un almacén no disponible no se presenta como propuesta persistida.
- Verificación focalizada de esta continuación: 35 tests pasan en `test_agent_memory_phase1.py`, `test_agent_memory_repository.py` y `test_agent_graph_memory.py`. También pasó la prueba contra PostgreSQL con IDs sintéticos: propuesta pendiente, aprobación, lectura de la entrada y eliminación/verificación de las filas. La suite API completa había reportado errores `psycopg_pool.PoolClosed` al reutilizar el pool entre lifespans; requiere volver a ejecutarse y diagnosticar ese ciclo de vida.
- Suite completa API reejecutada después de retirar el cierre del pool global por lifespan: `296 passed, 6 xfailed`. El cierre por TestClient cerraba un recurso de proceso compartido y causaba cascadas `PoolClosed`.
- Los tripwires de contenido son defensas heurísticas, no detección garantizada de PII o secretos. No debe considerarse una garantía de cumplimiento ni habilitar uso sin evaluación adicional.
- Aún falta validar compatibilidad de `beta.chat.completions.parse` con el modelo/configuración del proveedor y cubrir comportamiento real mediante contrato o sandbox del proveedor.
- La migración y las operaciones sintéticas se ejecutaron en la única base de desarrollo del proyecto, sin clientes ni usuarios reales según confirmó el usuario.
- La purga de auditoría y consolidación requiere calendarizar una tarea externa y definir su recorrido para owners activos; no se añade scheduler ligado al ciclo de vida HTTP.
- El entorno API no tiene Ruff instalado; `compileall`, análisis del editor y las suites focalizada/completa se usaron para validar Python. Los cambios se limitaron a archivos de esta tarea; se preservaron cambios ajenos preexistentes del worktree.
