# incidents-api

Backend API service for incident analysis integration.

## Endpoints

- `POST /api/incidents/analyze`
- `GET /api/incidents/results/export`

## Run locally

```bash
pip install -r services/api/requirements.txt
uvicorn services.api.app.main:app --reload
```

## Tests

```bash
python -m unittest services/api/tests/test_incidents_api.py
```
