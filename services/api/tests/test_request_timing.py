import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from main import RequestTimingMiddleware


def _timing_records(caplog):
    return [record for record in caplog.records if record.name == "api.request_timing"]


def test_timing_logs_route_template_and_response_metadata(caplog):
    app = FastAPI()
    app.add_middleware(RequestTimingMiddleware)

    @app.get("/items/{item_id}")
    def get_item(item_id: str):
        return {"id": item_id}

    with caplog.at_level(logging.INFO, logger="api.request_timing"):
        response = TestClient(app).get("/items/private-id?access_token=do-not-log")

    assert response.status_code == 200
    records = _timing_records(caplog)
    assert len(records) == 1
    record = records[0]
    assert record.http_method == "GET"
    assert record.route == "/items/{item_id}"
    assert record.status_code == 200
    assert record.duration_ms >= 0
    assert "private-id" not in caplog.text
    assert "do-not-log" not in caplog.text


def test_timing_logs_server_error_even_when_endpoint_raises(caplog):
    app = FastAPI()
    app.add_middleware(RequestTimingMiddleware)

    @app.get("/failure/{resource_id}")
    def fail(resource_id: str):
        raise RuntimeError(f"private failure for {resource_id}")

    with caplog.at_level(logging.INFO, logger="api.request_timing"):
        response = TestClient(app, raise_server_exceptions=False).get(
            "/failure/private-id?token=do-not-log"
        )

    assert response.status_code == 500
    records = _timing_records(caplog)
    assert len(records) == 1
    record = records[0]
    assert record.http_method == "GET"
    assert record.route == "/failure/{resource_id}"
    assert record.status_code == 500
    assert record.duration_ms >= 0
    assert "private-id" not in caplog.text
    assert "do-not-log" not in caplog.text
    assert "private failure" not in caplog.text