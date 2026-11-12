# Matriz de cobertura — Hito 8, Parte 2 (Harness y Guardrails)

Alcance: agente SDR/comercial LangGraph existente (`services/api/agent/graph.py`). No se crea ni se afirma la existencia de un agente externo de soporte.

| Requisito del briefing | Evidencia automatizada | Estado / límite |
| --- | --- | --- |
| Bloquear jailbreak explícito antes del grafo | `test_jailbreak_is_blocked_before_memory_or_graph`, `test_override_variants_are_rejected_before_execution` | Variantes ES/EN pasan por `run_agent()` y no acceden a memoria/grafo/RAG/tools; las regex no garantizan detectar toda reformulación. |
| Rechazar tareas personales/fuera de dominio | `test_personal_university_task_is_blocked`, `test_personal_task_is_rejected_at_entrypoint_without_memory_or_graph`, `test_other_personal_tasks_are_blocked_at_entrypoint` | Tareas universitarias, poema/código para producto personal y consejo personal se bloquean antes de memoria/grafo. Cobertura representativa, no exhaustiva. |
| Rechazar solicitud de datos de otro cliente/prospecto | `test_cross_account_sla_request_is_blocked_without_echoing`, `test_other_prospect_commercial_data_request_is_blocked`, `test_cross_account_request_is_rejected_at_public_entrypoint` | Se demuestra bloqueo antes del grafo para casos representativos. No demuestra aislamiento multi-tenant. |
| Inyección indirecta en documento RAG | `test_untrusted_rag_system_instruction_is_removed_but_factual_line_survives`, `test_rag_prompt_injection_is_removed_before_generation`, `test_legacy_generation_separates_system_rules_from_user_content`, `test_structured_generation_uses_separate_rules_and_validates_payload` | Pruebas unitarias capturan con clientes mock los mensajes enviados en rutas legacy/estructurada, la separación system/user, el tratamiento de evidencia/preferencia como contenido no confiable y el rechazo de payload estructurado vacío. No evalúan proveedor/modelo ni índice RAG en vivo. |
| Tratar salida de herramientas como no confiable y filtrar secretos | `test_evidence_credentials_are_removed`, `test_output_validator_rejects_credentials_and_accepts_safe_answer`, `test_hostile_tool_output_is_quarantined`, `test_hostile_incident_tool_output_is_quarantined`; sanitización en `_render_incidents`, `_render_inventory` y `operational_tools` | Inyección de inventario e incidencias se prueba con resultados simulados. No es detección general de secretos/PII; incidencias siguen bloqueadas en el entrypoint público por falta de ámbito confiable. |
| Small talk breve con redirección al propósito SDR | `test_small_talk_answers_briefly_and_redirects_without_graph` | Respuestas fijas para saludos/cortesías ES/EN antes de memoria/RAG/herramientas. |
| Pregunta general segura con redirección | `test_general_question_is_safe_and_redirects_before_memory` | Consultas de hora en Tokio reconocidas de forma acotada: no se inventa la hora, se declara falta de acceso en tiempo real y se redirige. No hay navegador/reloj externo. |
| Logs y resumen agregado de guardrails | `test_sanitizing_untrusted_content_logs_only_low_cardinality_reason`, `test_blocked_entrypoint_logs_redacted_category_and_increments_summary`, `test_guardrail_event_summary_counts_by_category_and_can_reset`, `test_unscoped_followup_after_consent_emits_security_event` | Emisor registra categoría y reason de baja cardinalidad, sin payload; incluye el seguimiento tras consentimiento que se bloquea por acceso sin ámbito. Contadores son de proceso y pytest imprime resumen agregado al finalizar. No se exponen por endpoint. |
| No habilitar acceso comercial sin autorización verificable | `test_rag_route_fails_closed_before_memory_or_retrieval`, `test_incident_route_fails_closed_before_tools` | RAG comercial e incidencias permanecen bloqueados en `run_agent()` hasta disponer de identidad confiable y filtros por ámbito. |

## Limitaciones conocidas y criterio para habilitar datos

- La API identifica un usuario, pero no aporta identidad comercial de tenant ni filtros demostrados de tenant para RAG/incidencias. El fail-closed actual es una mitigación de disponibilidad, no una solución de autorización multiempresa.
- El inventario es una ruta interna separada y no constituye prueba de aislamiento de clientes.
- Las regex, saneamiento por líneas y validador de salida son defensas en profundidad, no una garantía semántica contra jailbreak, exfiltración, PII o secretos.
- La prueba de inyección RAG usa retrieval y generación simulados. Para cerrar validación operacional del stack se necesita una prueba en entorno de desarrollo con el índice/modelo configurados y datos sintéticos/no sensibles. No se debe usar información real de clientes.
- No hay invocación MCP demostrada desde este grafo; el alcance de la prueba de herramientas es sobre las funciones internas existentes.

## Pruebas dirigidas

Desde `services/api/`:

```bash
DATABASE_URL='' PYTHONPATH="$PWD:$PWD/services/api" UV_PROJECT_ENVIRONMENT=/tmp/nexova-api-uv uv run pytest -q \
  tests/test_agent_guardrails.py tests/test_agent_graph_memory.py \
  ../../tests/pipelines/test_langgraph_agent.py \
  ../../tests/pipelines/test_agent_operational_tools_eval.py \
  tests/test_agent_api.py
```

Los resultados de ejecuciones deben registrarse como evidencia fechada aparte; este documento describe cobertura y límites, no afirma resultados de una ejecución específica. La captura de mensajes de generación en `tests/test_rag_pipeline.py` usa clientes mock y no contacta servicios externos.
