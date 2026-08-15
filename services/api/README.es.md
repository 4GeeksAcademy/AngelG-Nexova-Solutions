# incidents-api

Servicio backend para integrar el analizador de incidencias.

## Endpoints

- `POST /api/incidents/analyze`
- `GET /api/incidents/results/export`

## Ejecucion local

```bash
pip install -r services/api/requirements.txt
uvicorn services.api.app.main:app --reload
```

## Tests

```bash
python -m unittest services/api/tests/test_incidents_api.py
```
