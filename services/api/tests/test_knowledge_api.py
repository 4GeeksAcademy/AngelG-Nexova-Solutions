from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def auth_headers():
    registered = client.post(
        "/users",
        json={"email": "knowledge@example.com", "password": "Password123!"},
    )
    assert registered.status_code in {200, 400}, registered.text
    login = client.post(
        "/auth/login",
        data={"username": "knowledge@example.com", "password": "Password123!"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_knowledge_endpoint_requires_authentication():
    response = client.post("/knowledge/query", json={"question": "¿Tarifas?"})
    assert response.status_code == 401


def test_knowledge_endpoint_returns_answer_and_safe_sources(monkeypatch):
    monkeypatch.setattr(
        "routes.knowledge.query_with_sources",
        lambda question: {
            "answer": f"Respuesta a: {question}",
            "sources": [
                {"document": "pricing-model", "section": "Modelo de precios"}
            ],
        },
    )
    response = client.post(
        "/knowledge/query",
        headers=auth_headers(),
        json={"question": "  ¿Cuál es la tarifa?  "},
    )

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "answer": "Respuesta a: ¿Cuál es la tarifa?",
        "sources": [
            {"document": "pricing-model", "section": "Modelo de precios"}
        ],
    }

    # La API no debe revelar el texto del chunk ni metadatos internos.
    assert "text" not in body
    assert "vector" not in body
    assert "chunk_index" not in body


def test_knowledge_endpoint_rejects_extra_fields():
    response = client.post(
        "/knowledge/query",
        headers=auth_headers(),
        json={"question": "¿Tarifas?", "top_k": 1000},
    )
    assert response.status_code == 422