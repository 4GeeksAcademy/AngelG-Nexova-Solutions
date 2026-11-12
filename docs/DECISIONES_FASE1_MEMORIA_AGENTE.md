# Decisiones de Fase 1 — memoria del agente

## Identidad y alcance

- La autenticación actual expone un usuario (`id`, email, rol); el token se crea con el identificador de usuario y `POST /agent/query` pasa ese usuario como `owner_id`.
- No se encontró una empresa cliente/tenant autenticada ni un claim confiable para resolverla. La API también se usa como agente interno, mientras el briefing de harness habla de clientes externos; no se presupone que sean el mismo contrato de despliegue.
- Decisión aprobada por el usuario: el agente objetivo es el actual SDR/ventas. Como no hay tenant confiable, solo se permite guardar preferencias generales de forma/estilo de respuesta de la persona autenticada. No se aceptan preferencias atribuibles a clientes/prospectos, candidatos u oportunidades.
- No se deriva tenant del texto, RAG/MCP ni de campos del request. `tenant_id` permanece nulo en las entradas permitidas.

## Almacenamiento y esquema

- Se definieron tres tablas SQLModel nuevas con prefijo/namespace `agent_memory_`: propuestas pendientes, entradas aprobadas y auditoría minimizada.
- El esquema no usa tablas o colecciones RAG/Qdrant ni contiene campos vectoriales. Se registra en el metadata de SQLModel de la API y se crean tablas ausentes siguiendo el patrón actual de arranque.
- El despliegue tiene PostgreSQL opcional (`DATABASE_URL`); sin él `database.engine` es `None`. No se añadió fallback a TinyDB. La integración de persistencia deberá fallar cerrada para escrituras si la base no está disponible.
- La aplicación usa `SQLModel.metadata.create_all`, que no versiona ni migra columnas existentes. La Fase 1 solo añade tablas; cambios posteriores incompatibles requerirán migración explícita antes de despliegue.

## Contrato y políticas

- Categoría allowlist única: `response_preference` (preferencia general del usuario para formato/estilo de respuestas).
- Prohibiciones: datos o preferencias de prospectos/clientes, hechos y políticas comerciales, datos personales de candidatos, salarios de negociaciones activas, tickets/casos específicos y secretos/credenciales.
- Una propuesta no implica consentimiento. Decisiones posibles: approve/reject/edit/unclear; la decisión lleva `proposal_id` y confianza acotada. Cualquier política de aprobación con umbral y flujo de edición se implementará en fases posteriores.
- Una propuesta pendiente por thread se protege con índice único parcial. La entrada persistida solo está representada en el esquema; no se crea ninguna desde esta fase.
- La auditoría conserva identificadores, estado/tipo de evento, timestamp y `reason_code`, nunca el texto candidato ni prompts. No se fijó TTL de auditoría porque el briefing no da plazo y requiere decisión empresarial.
- Retención y límites técnicos definidos en el repository: 90 días para entradas aprobadas, 30 días para propuestas pendientes, máximo 100 entradas por owner y 10 por recuperación. Son límites técnicos iniciales; la retención de auditoría sigue sin decisión empresarial ni tarea de purga.
- El contrato y repository permiten únicamente `response_preference` de alcance user. La categoría enum SQL persiste valores string y debe coincidir con la migración de tablas aisladas.

## Pruebas

- `services/api/tests/test_agent_memory_phase1.py`: SQLite aislado, contrato estructurado, validación de alcance fail-closed, tablas separadas, unicidad de propuesta pendiente, restricciones client/tenant y auditoría metadata-only.
- Regresión del endpoint del agente ejecutada separadamente: el contrato del agente no se modificó en Fase 1.
