# Terminal 1, desde la raíz; usa una base de desarrollo aislada si configuras DATABASE_URL
services/api/.venv/bin/python -B -m uvicorn main:app \
  --app-dir services/api --env-file services/api/.env \
  --host 127.0.0.1 --port 8000 --reload

# Terminal 2
cd /workspaces/AngelG-Nexova-Solutions/uis/backoffice
API_INTERNAL_URL=http://127.0.0.1:8000 npm run dev -- --webpack


# Iniciar SCHEDULER:
cd services/api
./.venv/bin/python -B reporting_job.py --schedule

# Iniciarlo desde Compose:
docker compose --env-file infra/production.env -f infra/compose.production.yml up -d reporting-scheduler


# Qdrant
Para desarrollo local, basta con iniciar el servicio incluido en Compose:
docker compose up -d qdrant

docker compose up -d qdrant
PYTHONPATH="$PWD" uv run --project services/api python -m data.process.rag_index &&
PYTHONPATH="$PWD" uv run --project services/api python -m data.eval.evaluate_retrieval



set -a
source .env
set +a

if [[ -z "${GENERATION_MODEL_ID:-}" ]]; then
  echo "Falta GENERATION_MODEL_ID en el entorno"
else
  echo "GENERATION_MODEL_ID está configurado"
  RUN_LIVE_RAG_GENERATION_EVAL=1 DATABASE_URL='' \
  PYTHONPATH="$PWD:$PWD/services/api" \
  UV_PROJECT_ENVIRONMENT=/tmp/nexova-api-uv \
  uv run --directory services/api pytest -q \
    ../../tests/pipelines/test_generation_live_eval.py
fi