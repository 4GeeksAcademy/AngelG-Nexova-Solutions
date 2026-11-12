# Evidencia focalizada — repository de memoria del agente

Esta evidencia usa SQLite efímero y contenido sintético. Prueba el repository,
no el grafo conversacional ni un despliegue real.

## Aprobación y recuperación en una lectura posterior

1. Crear una propuesta de preferencia general del usuario queda en estado `pending`
   y no crea una fila en `agent_memory_entries`.
2. Resolver la propuesta con `approve`, actor igual al owner y confianza `0.99`
   crea una entrada con expiración de 90 días y auditoría
   `explicit_owner_consent`.
3. Una recuperación posterior, por mismo owner y coincidencia léxica de términos
   de presentación como «respuestas breves», devuelve esa entrada.

Cubierto por `test_approved_proposal_is_retrievable_in_a_later_read` y
`test_approval_is_owner_bound_and_creates_expiring_memory`.

## Rechazo preserva memoria preexistente

1. Preparar una entrada aprobada preexistente.
2. Crear y rechazar una propuesta distinta con confianza alta.
3. La propuesta queda redactada, no se agrega ni modifica ninguna entrada y la
   recuperación sigue devolviendo exactamente la memoria preexistente.

Cubierto por `test_rejected_proposal_leaves_existing_memory_unchanged` y
`test_rejection_redacts_payload_and_low_confidence_defaults_to_reject`.

## Revocación

El owner puede revocar su entrada; la entrada deja de aparecer en recuperación y
se agrega un evento `revoked` con `explicit_owner_revocation`. Otro actor es
rechazado. Cubierto por `test_owner_can_revoke_memory_and_revocation_is_audited`.

## Verificación más reciente

Desde `services/api`:

```sh
uv run pytest -q tests/test_agent_memory_phase1.py tests/test_agent_memory_repository.py tests/test_agent_api.py
```

Resultado registrado: `42 passed`, incluyendo `test_agent_graph_memory.py`, que verifica la separación entre memoria y evidencia RAG, que herramientas operativas no consultan memoria, que la propuesta requiere aprobación posterior y que una decisión ambigua no crea memoria. `git diff --check` también pasó antes de los últimos cambios de integración; debe repetirse en la validación final.

## Límite

El grafo recupera preferencias aprobadas y el pipeline SDR las recibe separadas
de la evidencia. La ruta integrada crea una propuesta pendiente validada y pide
confirmación; en un turno posterior clasifica la respuesta enlazada al mismo
owner/thread, con edición sujeta a una segunda confirmación. La evidencia local
usa SQLite y mocks de clasificador/generador; no valida el endpoint LLM real ni
PostgreSQL de despliegue. El usuario aplicó `004_agent_memory.sql`; luego se
conectó desde el workspace en modo de solo lectura y se verificaron en `public`
las tres tablas, sus columnas (coinciden con SQLModel), restricciones CHECK e
índices. La primera prueba de escritura reveló que PostgreSQL podía insertar la
fila de auditoría antes que su propuesta referenciada; `create_proposal` ahora
hace flush de la propuesta antes de añadir la auditoría. La repetición verificó
propuesta pendiente, aprobación, lectura posterior de la entrada y limpieza
confirmada de todas las filas sintéticas. No quedan filas de prueba.