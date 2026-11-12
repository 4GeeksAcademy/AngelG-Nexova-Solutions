# Decisiones de Fase 2 — interfaz y recuperación

## Alcance ejecutado

- Se agregó `services/api/agent/memory_repository.py`, con consultas SQLModel a las tablas aisladas `agent_memory_*`; no importa RAG, Qdrant ni MCP.
- La recuperación filtra estrictamente por `owner_id`, `scope=user`, `tenant_id IS NULL`, única categoría `response_preference`, `revoked_at IS NULL` y `expires_at IS NULL OR expires_at > now`.
- El límite máximo es 10 resultados. Para una consulta textual se aplica ranking léxico normalizado (diacríticos removidos) sobre hasta 100 memorias activas de ese usuario; sin coincidencias no se recupera memoria.
- Contexto de `render_memory_context` se delimita como dato no confiable. El grafo SDR lo recupera solo en la ruta RAG, nunca para herramientas operativas ni fallback; el pipeline lo recibe separado de evidencia y solo puede aplicarlo a presentación, no a hechos/políticas ni citas.
- Propuesta pendiente solo crea una fila `pending`; nunca crea una entrada aprobada. `resolve_proposal` permite aprobar explícitamente, rechazar (con redacción del contenido), rechazar por defecto ante baja confianza, expirar o editar (que vuelve a pending y requiere una aprobación posterior). La aprobación crea/upsertea una entrada con TTL; las decisiones generan auditoría minimizada. Si PostgreSQL no existe, la lectura opcional devuelve lista vacía, mientras una escritura falla cerrada (`MemoryStoreUnavailable`). Un error de lectura SQL se informa como store no disponible al llamador; no hay fallback a TinyDB/RAG.
- `consolidate_memory` cierra propuestas vencidas, elimina entradas expiradas/duplicadas/excedidas del límite y purga auditoría metadata-only tras 365 días; cuenta corroboración cuando el owner aprueba independientemente un duplicado. `revoke_memory` permite al owner retirar memoria y deja evento auditable. La consolidación/purga queda como operación que debe invocar un proceso programado externo; no se introduce scheduler dentro de la API web.

## Restricciones de identidad/seguridad

- No hay tenant confiable; por decisión explícita del usuario se limitó el alcance a preferencias generales del usuario, sin datos de clientes/prospectos.
- El prompt y grafo SDR siguen separados de los datos RAG: la memoria no forma parte de evidencia ni citas y no puede cambiar precios, condiciones, hechos o política comercial.
- `POST /agent/query` acepta `thread_id` para continuidad. Aún no existe clasificador conectado ni resolución del consentimiento pendiente en el grafo.
- La generación puede devolver una propuesta estructurada opcional; el grafo la valida con contrato/repository y solicita consentimiento solo cuando la propuesta se guardó correctamente.
- El turno siguiente se trata como consentimiento únicamente si hay propuesta pendiente bajo el mismo owner y thread. Se clasifica `approve/reject/edit/unclear`; confianza baja/ambigüedad termina en rechazo por defecto. Editar presenta el nuevo texto y deja la propuesta pendiente para segunda confirmación. Una pregunta separada en el mismo turno se procesa solo si el clasificador devuelve una decisión inequívoca de sí/no y aísla explícitamente la pregunta adicional.

## Pruebas

- `tests/test_agent_memory_repository.py`: aislamiento entre usuarios, expiración y revocación, scope cliente excluido, categorías bloqueadas, tope de recuperación, relevancia léxica, escritura pending, aprobación/rechazo/edición, consolidación, corroboración, errores DB, fail-closed sin PostgreSQL y serialización como contexto no confiable.
- Recorridos de prueba deterministas del repository verifican aprobación recuperable en una lectura posterior y que rechazo conserva intacta memoria existente. No constituyen recorridos integrados del grafo.
- Suite focalizada del grafo/repository: 31 pasaron tras añadir regresión para decisión + pregunta, unicidad de propuesta y purga de auditoría. Suite API completa: 296 pasaron, 6 xfailed.

## Límites no resueltos

- Pendiente validar el soporte de `beta.chat.completions.parse` en el modelo/proveedor de generación configurado. La migración SQL ya fue aplicada manualmente y el flujo de persistencia PostgreSQL fue probado con identidad sintética.
- El usuario aplicó `services/api/migrations/004_agent_memory.sql` manualmente. La conexión desde el workspace confirmó la base `postgres`, esquema `public`, las tres tablas y sus columnas, restricciones CHECK e índices esperados (incluido `uq_agent_memory_one_pending_per_thread`); las columnas coinciden con los modelos SQLModel. El camino de lectura funcionó con owner sintético. La prueba posterior de persistencia encontró y permitió corregir un orden de inserción que violaba la FK de auditoría en PostgreSQL: ahora se hace `flush()` de la propuesta antes de añadir su auditoría. La repetición completó creación de propuesta, aprobación explícita, lectura posterior de la entrada y eliminación verificada de las filas sintéticas.
- Reglas de exclusión léxicas son defensas mínimas, no detector completo de PII, credenciales o contexto no memorizable.
- La auditoría metadata-only se retiene 365 días y se elimina desde `consolidate_memory`; una tarea externa debe ejecutar periódicamente esta consolidación (y, por owner, cubrir el conjunto de owners a mantener). El cierre del pool global al salir de un lifespan fue eliminado; la suite completa pasa con esa corrección.
