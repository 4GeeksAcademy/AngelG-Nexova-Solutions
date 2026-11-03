# Terminal 1, desde la raíz; usa una base de desarrollo aislada si configuras DATABASE_URL
services/api/.venv/bin/python -B -m uvicorn main:app \
  --app-dir services/api --env-file services/api/.env \
  --host 127.0.0.1 --port 8000 --reload

# Terminal 2
cd /workspaces/AngelG-Nexova-Solutions/uis/backoffice
API_INTERNAL_URL=http://127.0.0.1:8000 npm run dev -- --webpack


Iniciar SCHEDULER:
./.venv/bin/python -B reporting_job.py --schedule

Iniciarlo desde Compose:
docker compose --env-file infra/production.env -f infra/compose.production.yml up -d reporting-scheduler