# Fase de auditoría — tools operativas del agente interno

**Fecha:** 2026-11-11  
**Alcance:** cotejo estático y pruebas offline de los criterios del agente interno LangGraph para incidencias y, como extra, inventario. La auditoría inicial y su seguimiento de implementación se registran separadamente; las modificaciones no exponen tools al sitio público.

## Resumen ejecutivo

**Resultado del seguimiento:** se añadieron una capa de consultas compartida para el router de incidencias y su tool del agente, límites de conexión/pool PostgreSQL y manejo comprobable de respuestas tipadas de timeout. La suite focalizada del agente, inventario y API pasó **43 tests**. Esto verifica delegación, contrato existente y fallback simulado; no demuestra aplicación live de timeouts PostgreSQL. El acceso es en proceso sobre SQLModel, no HTTP. Los límites temporales no son un plazo máximo integral de toda la operación Python y no se garantiza su equivalencia en otros dialectos.

Las evaluaciones offline pertinentes se ejecutaron en esta fase y pasaron: **34 passed**. No se usó PostgreSQL, Qdrant, proveedores de modelos ni datos persistentes. Los tests de clasificación y flujo prueban comportamiento del router en escenarios simulados, no calidad semántica para lenguaje arbitrario ni disponibilidad del servicio desplegado.

## Matriz de criterios

| # | Criterio | Estado | Evidencia y observación |
|---|---|---|---|
| 1 | Contrato de entrada/salida tipado; tickets leídos desde el gestor real por HTTP o servicio en proceso; auth cuando aplique. | **Implementación añadida; verificación pendiente** | `services/api/agent/tools.py` conserva contrato Pydantic tipado y delega la búsqueda a `managed_incident_service.search_managed_incidents()`. El endpoint autenticado `managed_incidents.list_incidents()` delega sus filtros/paginación en `managed_incident_service.list_managed_incidents()`, dejando consultas del mismo dominio en una capa en proceso común. No es llamada HTTP ni se propaga un token a SQL; `/agent` mantiene autenticación en `services/api/routes/agent.py`. No se añadió una política de autorización por fila/cliente/rol porque su alcance empresarial no está definido. |
| 2 | Tools solo lectura: no crean, actualizan ni borran. | **Cumple** | Ambas funciones (`search_incidents_tool`, `search_inventory_tool`) construyen `select()` y ejecutan `session.exec(statement).all()`; no contienen `add`, `commit`, `delete` ni `update` de dominio. La sesión se abre/cierra dentro de la llamada. Las pruebas de aceptación crean fixtures antes de invocar tools y verifican resultados, no cambios en filas; la garantía principal observada es estática. |
| 3 | Timeout explícito y numérico en llamada a tool. | **Implementación verificada offline; PostgreSQL live pendiente** | `AGENT_TOOL_STATEMENT_TIMEOUT_MS = 3_000` conserva el límite de sentencia PostgreSQL. `database.py` configura `connect_timeout=3` y `pool_timeout=3` para el engine PostgreSQL compartido. SQLAlchemy pool `TimeoutError`, SQLSTATE `57014` y errores DBAPI `OperationalError` con mensaje de timeout de conexión se clasifican como `timeout`; los demás errores de conexión siguen como `unavailable`. Pruebas unitarias cubren esta clasificación y se verificó la construcción del engine con psycopg2 sin abrir conexión. No constituye un deadline integral portátil de Python ni configura timeout en dialectos no PostgreSQL; la aplicación de `statement_timeout`/conexión en un PostgreSQL live queda pendiente. |
| 4 | Fallback verificable ante error/recurso inexistente, sin inventar respuestas. | **Cumple** | Falta de DB y excepciones se convierten en resultados tipados `unavailable` o `timeout`, con `items=[]` y mensaje fijo. Consulta válida sin coincidencias devuelve lista vacía y mensaje explícito. `operational_tools()` marca `fallback` si el estado no es `ok`; no llama a RAG en esa ruta. `test_operational_tools_fail_closed_without_database` y `test_operational_tool_error_does_not_fall_through_to_rag` comprueban fallback/ausencia de datos y que RAG no se invoque. |
| 5 | Routing entre RAG y tools según pregunta, sin instrucción explícita. | **Cumple** | `graph.py::_classify_question()` clasifica por términos de incidencias/inventario; preguntas de ambos dominios generan ruta `operational`; `route_question()` decide retrieval o tools. `test_question_classifier_routes_operational_and_rag_queries`, las pruebas de tool por dominio y `test_combined_operational_query_calls_both_tools_without_rag` verifican clasificación y selección. La clasificación es determinista por palabras clave; sinónimos fuera de las listas no están cubiertos y pueden caer en RAG. |
| 6 | Una responsabilidad por tool; no combinar tickets e inventario en una misma tool. | **Cumple** | Funciones y contratos separados: `search_incidents_tool` opera sobre `ManagedIncident`; `search_inventory_tool` opera sobre `Item`/`Movement`. La combinación se decide en el nodo orquestador `operational_tools()` y conserva llamadas diferenciadas; `test_combined_operational_query_calls_both_tools_without_rag` prueba dos invocaciones separadas. |
| 7 | Trace distingue fuentes usadas y su orden. | **Cumple** | `operational_tools()` añade `incidents_tool` y/o `inventory_tool` al trace en el orden de invocación y añade fuentes `incidents-tool`/`inventory-tool`. La ruta combinada se prueba contra el orden `receive`, `incidents_tool`, `inventory_tool` y el arreglo de fuentes correspondiente. RAG conserva nodos `retrieve`/`generate` y fuentes documentales. El endpoint de trazas autenticado devuelve solo estado y trace del propietario (`routes/agent.py`, `graph.py::get_checkpoint`). |
| 8 | Al menos dos evals nuevos verifican routing correcto entre RAG y tool. | **Cumple** | La suite incluye `test_question_classifier_routes_operational_and_rag_queries` (parametrizada con casos RAG e inventario/incidencias), `test_incident_query_uses_operational_tool_and_safe_trace`, `test_inventory_query_uses_operational_tool`, y `test_combined_operational_query_calls_both_tools_without_rag`. Son evaluaciones offline del enrutamiento, no pruebas live de un endpoint con datos reales. |
| 9 | Extra: inventario sigue reglas de contrato, timeout y fallback. | **Implementación verificada offline; PostgreSQL live pendiente** | Contrato Pydantic, cálculo desde `Item`/`Movement` y fallback cerrado se mantienen. Reutiliza el mismo engine PostgreSQL con límite de sentencia, conexión y espera de pool descrito en criterio 3. Las pruebas offline verifican derivación de stock, límite de resultados y fallback ante timeout de statement/conexión simulados. No se afirma validación del límite PostgreSQL live ni timeout universal para toda operación. |

## Seguridad y límites de alcance

- `services/api/main.py` registra `agent_router`; el router `/agent` declara `Depends(get_current_user)` a nivel router y por endpoint. Las tools no tienen endpoint público independiente y reciben llamadas del grafo autenticado.
- El control de acceso demostrado es a nivel de la solicitud/agente; no se observó autorización adicional por incidente en la consulta ORM. Confirmar con responsables si el acceso esperado debe filtrarse por usuario/rol/cliente antes de considerar esta dimensión cerrada.
- No se afirma que el servicio esté desplegado, que PostgreSQL haya aplicado el timeout en vivo ni que todo texto equivalente sea clasificado correctamente.
- La herramienta operativa no recurre al modelo RAG tras error; evita rellenar resultados de negocio con generación. Para cero coincidencias entrega un mensaje explícito.

## Verificación ejecutada en la auditoría inicial

Desde la raíz del monorepo:

```bash
DATABASE_URL='' PYTHONPATH="$PWD:$PWD/services/api" \
UV_PROJECT_ENVIRONMENT=/tmp/nexova-api-uv \
uv run --directory services/api pytest -q \
  ../../tests/pipelines/test_langgraph_agent.py \
  ../../tests/pipelines/test_agent_operational_tools_eval.py
```

**Resultado de auditoría inicial:** `34 passed in 3.33s`. Los tests usaron mocks y/o SQLite en memoria; no consultaron la base persistente, PostgreSQL, Qdrant ni servicios de modelos.

La verificación ejecutada no es suite completa del API, prueba HTTP de extremo a extremo ni validación live del timeout de PostgreSQL. La cobertura de solo lectura se respaldó además mediante inspección de las funciones SQL.

## Seguimiento de implementación

- `managed_incident_service.py` contiene las consultas en proceso compartidas: listado con filtros/paginación del endpoint y búsqueda acotada usada por la tool. El router existente y la tool delegan a esta capa.
- Para engines PostgreSQL el factory de `database.py` configura conexión de 3 s y espera de pool de 3 s; ambas tools conservan `statement_timeout` de 3 s.
- La suite focalizada se ejecutó después de implementar: `test_langgraph_agent.py`, `test_agent_operational_tools_eval.py` y `services/api/tests/test_managed_incidents_api.py`; resultado **43 passed**. Cubre la delegación compartida, contrato del router, matching de inventario y fallbacks offline.
- Se construyó un engine PostgreSQL en memoria con el dialecto psycopg2 y sus opciones de conexión/pool sin abrir conexión. La clasificación de timeout de conexión se probó mediante `DBAPIError` simulado; no sustituye una prueba live del driver ni la aplicación de `statement_timeout` en PostgreSQL.
- Los criterios 1, 3 y 9 avanzan a **verificado offline / PostgreSQL live pendiente**. El ámbito de autorización más fino por usuario/cliente/rol sigue pendiente de definición. No cambiar configuración, migraciones ni desplegar como parte de esta fase.

## Acciones de cierre sugeridas

1. Confirmar si el criterio 1 requiere validación adicional más allá de la capa de consultas compartida ya implementada y probada.
2. Decidir si el límite de 3 s debe cubrir también conexiones/dialects distintos de PostgreSQL; añadir mecanismo y prueba de integración aislada con PostgreSQL únicamente si se prioriza ese alcance.
3. Confirmar si la autorización del agente debe restringir resultados por cliente/área/rol; actualmente no se añade ese filtro.
4. Ampliar futuras evals con sinónimos/paráfrasis y rutas HTTP integradas si se requiere medir más que la clasificación por keywords.

La auditoría inicial no cambió código, contrato, persistencia, dependencias ni infraestructura. Los cambios del seguimiento se describen arriba; no implican migraciones ni escrituras en una base persistente.
