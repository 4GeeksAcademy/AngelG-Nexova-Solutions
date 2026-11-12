from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _auth_headers():
    registered = client.post(
        "/users",
        json={"email": "langgraph-agent@example.com", "password": "Password123!"},
    )
    assert registered.status_code in {200, 400}, registered.text
    login = client.post(
        "/auth/login",
        data={"username": "langgraph-agent@example.com", "password": "Password123!"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_agent_endpoint_requires_authentication():
    response = client.post("/agent/query", json={"question": "¿Cuál es la tarifa?"})
    assert response.status_code == 401


def test_agent_endpoint_returns_answer_and_trace(monkeypatch):
    monkeypatch.setattr(
        "routes.agent.run_agent",
        lambda question, *, owner_id, thread_id=None: {
            "answer": f"Respuesta a: {question}",
            "sources": [{"document": "pricing-model", "section": "Tarifas"}],
            "status": "answered",
            "trace": ["receive", "retrieve", "generate"],
            "thread_id": "trace-123",
        },
    )
    response = client.post(
        "/agent/query",
        headers=_auth_headers(),
        json={"question": "¿Cuál es la tarifa?", "thread_id": "thread-stable"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "answer": "Respuesta a: ¿Cuál es la tarifa?",
        "sources": [{"document": "pricing-model", "section": "Tarifas"}],
        "status": "answered",
        "trace": ["receive", "retrieve", "generate"],
        "thread_id": "trace-123",
    }


def test_agent_endpoint_passes_optional_thread_for_continuation(monkeypatch):
    calls = {}

    def fake_run(question, *, owner_id, thread_id=None):
        calls.update(question=question, owner_id=owner_id, thread_id=thread_id)
        return {
            "answer": "Respuesta",
            "sources": [],
            "status": "answered",
            "trace": ["receive"],
            "thread_id": thread_id or "generated-thread",
        }

    monkeypatch.setattr("routes.agent.run_agent", fake_run)
    response = client.post(
        "/agent/query",
        headers=_auth_headers(),
        json={"question": "Continúa", "thread_id": "consent-thread"},
    )
    assert response.status_code == 200
    assert calls["thread_id"] == "consent-thread"
    assert calls["owner_id"]


def test_agent_endpoint_rejects_extra_fields():
    response = client.post(
        "/agent/query",
        headers=_auth_headers(),
        json={"question": "¿Tarifas?", "top_k": 1000},
    )
    assert response.status_code == 422


def test_agent_endpoint_does_not_expose_internal_errors(monkeypatch):
    monkeypatch.setattr(
        "routes.agent.run_agent",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("internal secret")),
    )
    response = client.post(
        "/agent/query",
        headers=_auth_headers(),
        json={"question": "¿Tarifas?"},
    )
    assert response.status_code == 500
    assert "internal secret" not in response.text
    assert "Traceback" not in response.text


def test_agent_trace_endpoint_returns_safe_trace_for_owner(monkeypatch):
    monkeypatch.setattr(
        "agent.graph.get_checkpoint",
        lambda thread_id, *, owner_id: {
            "thread_id": thread_id,
            "status": "answered",
            "trace": ["receive", "retrieve", "generate"],
        },
    )
    headers = _auth_headers()
    response = client.get("/agent/traces/thread-123", headers=headers)
    assert response.status_code == 200
    assert response.json() == {
        "thread_id": "thread-123",
        "status": "answered",
        "trace": ["receive", "retrieve", "generate"],
    }
    assert "question" not in response.text
    assert "evidence" not in response.text


def test_agent_trace_endpoint_hides_other_users_threads(monkeypatch):
    monkeypatch.setattr("agent.graph.get_checkpoint", lambda *_args, **_kwargs: None)
    response = client.get("/agent/traces/private-thread", headers=_auth_headers())
    assert response.status_code == 404