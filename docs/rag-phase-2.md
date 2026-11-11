# Nexova RAG — Fase 2: preparación e indexación

## Implementado

- Segmentación por secciones Markdown y párrafos; bloques largos se dividen en límites de línea.
- Metadatos por fragmento: `company`, `source_document`, `section`, `language`, `chunk_index`, `text`.
- Cliente de embeddings separado: `embed(text)` usa `EMBEDDING_MODEL_ID` a través de un endpoint OpenAI-compatible.
- Colección Qdrant `nexova_knowledge`, vectores cosine y upsert con IDs deterministas para poder repetir la indexación sin duplicar puntos.
- Servicio Qdrant persistente en Docker Compose.

## Configuración

No se fija un identificador de modelo del proveedor porque el briefing no indica uno verificable. Antes de indexar, configura en el entorno:

- `EMBEDDING_MODEL_ID`: ID del modelo de embeddings habilitado en el proveedor.
- `OPENAI_API_KEY`: clave del proveedor compatible; se lee del entorno y no se guarda en el repositorio.
- `OPENAI_BASE_URL`: URL base opcional del gateway compatible.
- `QDRANT_URL`: `http://localhost:6333` al ejecutar localmente; Compose la configura como `http://qdrant:6333` para backend.
- `QDRANT_API_KEY`: opcional para instancias protegidas.
- `GENERATION_MODEL_ID`: reservado para una fase posterior; no se utiliza al indexar.

El archivo `.env.example` está excluido de las ediciones automatizadas del entorno. Define estas variables en el entorno local o en un archivo `.env` ignorado por Git.

## Ejecución

Con las variables anteriores configuradas y Qdrant disponible:

```sh
uv run python -m data.process.rag_index
```

También puede iniciarse Qdrant con `docker compose up -d qdrant`. La carga real del índice requiere credenciales y un ID de embedding válidos.
