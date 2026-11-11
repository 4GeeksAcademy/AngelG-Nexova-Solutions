# Diseño del asistente RAG de Nexova

## Propósito y alcance

El asistente ayuda a los SDRs a responder preguntas comerciales usando únicamente
la documentación aprobada. La colección vectorial es `nexova_knowledge` y contiene
las cuatro fuentes completas copiadas a `docs/company-knowledge-base/`.

## Flujo

1. `data.process.rag_index.setup()` fragmenta e indexa documentos en Qdrant con
   embeddings configurados por `EMBEDDING_MODEL_ID`.
2. `data.pipelines.rag.retrieve()` embebe la pregunta, busca los cinco primeros
   puntos mediante cosine y devuelve solo payloads cuyo score es al menos `0.35`.
3. `generate_answer()` envía la pregunta y los fragmentos filtrados al modelo
   configurado por `GENERATION_MODEL_ID`. El ID debe ser distinto al de embeddings.
4. `query()` compone ambas operaciones. FastAPI expone el resultado en
   `POST /knowledge/query`, protegido con la autenticación existente.
5. Backoffice consume la ruta con `authRequest`; solo muestra el campo `answer`,
   nunca puntos, vectores o resultados crudos de Qdrant.

## Umbral y ausencia de contexto

Se inicia con umbral cosine `0.35`: al ser una primera configuración sin corpus
embebido/evaluado con el proveedor seleccionado, es un filtro conservador pero
permisivo que evita responder con candidatos muy débiles. Debe calibrarse con el
Recall@3 de `data/eval/test-queries.json` al conectar el modelo real. Si ningún
fragmento lo supera, el generador recibe contexto explícitamente vacío y debe
decir que no hay información suficiente y escalar la confirmación a un account
manager. No se usa conocimiento general para rellenar vacíos.

## Seguridad comercial y de datos

- No ofrecer descuentos sobre la tarifa estándar del 22%; cualquier excepción
  requiere aprobación humana.
- Los plazos se presentan como promedios, no como garantías; la garantía
  contractual de reemplazo de seis meses es la excepción descrita en las fuentes.
- Mantener transparencia al comparar con competidores y no inventar condiciones.
- La API requiere token autenticado, limita preguntas a 2.000 caracteres y
  rechaza campos adicionales. La respuesta pública del endpoint es solo `{answer}`.
- No se fijan identificadores de modelos ni se guardan credenciales: el briefing
  no determina IDs verificables de 4Geeks. Deben configurarse por entorno y
  validarse contra el gateway autorizado.

## Configuración

Requeridos: `OPENAI_API_KEY`, `EMBEDDING_MODEL_ID`, `GENERATION_MODEL_ID` y
`QDRANT_URL`. `OPENAI_BASE_URL` permite usar el gateway OpenAI-compatible y
`QDRANT_API_KEY` es opcional. Para desarrollo local, Qdrant puede estar en
`http://localhost:6333`; Compose utiliza `http://qdrant:6333`.

El backend Docker ahora usa el contexto raíz para incluir `data/` y el corpus de
`docs/`; mantiene los directorios de API, telemetry y reporting. Se conservan los
volúmenes persistentes existentes.

## Evaluación

`data/eval/test-queries.json` contiene diez preguntas sobre los cuatro documentos,
incluidas objeciones sobre precio, competencia, descuento y terna. Ejecutar
`uv run python -m data.eval.evaluate_retrieval` con Qdrant indexado y credenciales
válidas. El evaluador informa Recall@3 por presencia de un documento relevante;
el objetivo mínimo del briefing es 80 %. Esta métrica no se ha medido aún sin un
gateway/modelo de embeddings configurado.

## Pruebas locales

Las pruebas usan stubs para Qdrant y el SDK de generación; no requieren servicios
externos. Ejecutar `uv run pytest tests/test_rag_pipeline.py` desde la raíz y
`uv run --project services/api pytest` para la API.