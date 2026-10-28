import sys
import unittest
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app as main_app
from services.api.app.incidents_service import clear_last_result
from packages.incidents_analysis.cli import analyze_file


@pytest.fixture
def main_client():
    with TestClient(main_app, raise_server_exceptions=False) as test_client:
        yield test_client


def incident_payload(**overrides):
    payload = {
        "title": "No funciona el ATS",
        "description": "El equipo no puede iniciar sesión en el ATS.",
        "category": "technical_failure",
        "status": "open",
        "origin": "internal",
        "branch": "valencia_operations",
    }
    payload.update(overrides)
    return payload


def create_incident(client, **overrides):
    response = client.post("/incidents", json=incident_payload(**overrides))
    assert response.status_code == 201
    return response.json()


def test_list_incidents_applies_multiple_filters(main_client):
    create_incident(main_client, category="technical_failure", origin="internal", branch="remote")
    create_incident(main_client, category="technical_failure", origin="customer", branch="remote")
    create_incident(main_client, category="client_complaint", origin="customer", branch="central")

    response = main_client.get(
        "/incidents",
        params={"category": "technical_failure", "branch": "remote"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 2
    assert {item["origin"] for item in response.json()} == {"internal", "customer"}


def test_invalid_filter_returns_400(main_client):
    response = main_client.get("/incidents", params={"status": "invalid"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "INVALID_FILTER"
    assert response.json()["detail"]["fields"] == {"status": ["invalid"]}


def test_get_incident_by_id_and_missing_id(main_client):
    incident = create_incident(main_client)

    found = main_client.get(f"/incidents/{incident['id']}")
    assert found.status_code == 200
    assert found.json()["id"] == incident["id"]
    assert found.json()["title"] == incident["title"]
    missing = main_client.get("/incidents/not-found")
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "INCIDENT_NOT_FOUND"


def test_patch_status_allows_valid_transitions_and_updates_timestamp(main_client):
    incident = create_incident(main_client)
    response = main_client.patch(
        f"/incidents/{incident['id']}/status",
        json={"status": "in_progress"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"
    assert response.json()["updated_at"] >= incident["updated_at"]


def test_patch_status_rejects_invalid_transition_and_final_states(main_client):
    incident = create_incident(main_client)
    invalid = main_client.patch(
        f"/incidents/{incident['id']}/status",
        json={"status": "resolved"},
    )
    assert invalid.status_code == 400

    main_client.patch(f"/incidents/{incident['id']}/status", json={"status": "in_progress"})
    main_client.patch(f"/incidents/{incident['id']}/status", json={"status": "resolved"})
    final = main_client.patch(f"/incidents/{incident['id']}/status", json={"status": "open"})
    assert final.status_code == 400


def test_patch_status_reports_missing_incident_and_service_failure(main_client, monkeypatch):
    missing = main_client.patch(
        "/incidents/not-found/status",
        json={"status": "in_progress"},
    )
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "INCIDENT_NOT_FOUND"

    incident = create_incident(main_client)

    def fail(*args, **kwargs):
        raise RuntimeError("status update failed")

    monkeypatch.setattr("incidents.update_incident_status", fail)
    failed = main_client.patch(
        f"/incidents/{incident['id']}/status",
        json={"status": "in_progress"},
    )

    assert failed.status_code == 500
    assert failed.json()["detail"]["code"] == "STATUS_UPDATE_FAILED"


def test_summary_works_with_zero_and_nonzero_records(main_client):
    empty = main_client.get("/incidents/summary").json()
    assert empty["total"] == 0
    assert empty["by_status"]["open"] == 0

    create_incident(main_client)
    populated = main_client.get("/incidents/summary").json()
    assert populated["total"] == 1
    assert populated["by_status"]["open"] == 1
    assert populated["by_category"]["technical_failure"] == 1
    assert populated["by_origin"]["internal"] == 1
    assert populated["by_branch"]["valencia_operations"] == 1


def test_unexpected_service_errors_return_json_500(main_client, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("internal test failure")

    monkeypatch.setattr("incidents.get_incidents", fail)
    response = main_client.get("/incidents")

    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "INTERNAL_ERROR"
    assert "internal test failure" not in response.text


REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from services.api.app.main import app as analysis_app


class IncidentsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        clear_last_result()
        self.client = TestClient(analysis_app)
        self.sample_csv_path = REPO_ROOT / "scripts" / "incidents-nexova.csv"
        self.config_path = REPO_ROOT / "scripts" / "incidents_config.json"

    def test_post_without_file_returns_400(self) -> None:
        response = self.client.post("/api/incidents/analyze")
        payload = response.json()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["error"]["code"], "MISSING_FILE")

    def test_post_empty_file_returns_400(self) -> None:
        response = self.client.post(
            "/api/incidents/analyze",
            files={"file": ("incidents.csv", "", "text/csv")},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["error"]["code"], "EMPTY_FILE")

    def test_post_invalid_file_type_returns_400(self) -> None:
        response = self.client.post(
            "/api/incidents/analyze",
            files={"file": ("incidents.txt", "x", "text/plain")},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["error"]["code"], "INVALID_FILE_TYPE")

    def test_post_missing_required_columns_returns_400(self) -> None:
        response = self.client.post(
            "/api/incidents/analyze",
            files={
                "file": (
                    "incidents.csv",
                    "incidencia_id,categoria,estado\nINC-1,tecnologia,cerrado\n",
                    "text/csv",
                )
            },
        )
        payload = response.json()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["error"]["code"], "MISSING_REQUIRED_COLUMNS")

    def test_post_malformed_csv_returns_400(self) -> None:
        response = self.client.post(
            "/api/incidents/analyze",
            files={
                "file": (
                    "incidents.csv",
                    'incidencia_id,categoria,estado,cliente\n"INC-1,tecnologia,cerrado,Cliente A\n',
                    "text/csv",
                )
            },
        )
        payload = response.json()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["error"]["code"], "MALFORMED_CSV")

    def test_post_csv_with_invalid_records_returns_200_and_counts_invalids(self) -> None:
        content = self.sample_csv_path.read_text(encoding="utf-8")
        response = self.client.post(
            "/api/incidents/analyze",
            files={"file": ("incidents.csv", content, "text/csv")},
        )

        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["totals"]["processed"], 100)
        self.assertEqual(payload["totals"]["valid"], 96)
        self.assertEqual(payload["totals"]["invalid"], 4)
        self.assertIn("INVALID_OR_MISSING_EMAIL", payload["invalid"]["by_type"])

    def test_post_json_shape_is_stable(self) -> None:
        content = self.sample_csv_path.read_text(encoding="utf-8")
        response = self.client.post(
            "/api/incidents/analyze",
            files={"file": ("incidents.csv", content, "text/csv")},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertIn("totals", payload)
        self.assertIn("by_category", payload)
        self.assertIn("by_status", payload)
        self.assertIn("satisfaction", payload)
        self.assertIn("invalid", payload)
        self.assertIn("export_rows", payload)

    def test_get_export_without_previous_analysis_returns_404(self) -> None:
        response = self.client.get("/api/incidents/results/export")
        payload = response.json()

        self.assertEqual(response.status_code, 404)
        self.assertEqual(payload["error"]["code"], "NO_RESULTS")

    def test_get_export_after_analysis_returns_csv(self) -> None:
        content = self.sample_csv_path.read_text(encoding="utf-8")
        post_response = self.client.post(
            "/api/incidents/analyze",
            files={"file": ("incidents.csv", content, "text/csv")},
        )
        self.assertEqual(post_response.status_code, 200)

        response = self.client.get("/api/incidents/results/export")
        text = response.text

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response.headers["content-type"])
        self.assertIn("section,metric,value", text)
        self.assertIn("records,total_processed,100", text)

    def test_api_result_matches_script_result(self) -> None:
        content = self.sample_csv_path.read_text(encoding="utf-8")
        api_response = self.client.post(
            "/api/incidents/analyze",
            files={"file": ("incidents.csv", content, "text/csv")},
        )
        self.assertEqual(api_response.status_code, 200)
        api_payload = api_response.json()

        script_result = analyze_file(
            csv_path=str(self.sample_csv_path),
            config_path=str(self.config_path),
        )
        script_payload = script_result.to_dict()

        self.assertEqual(api_payload["totals"], script_payload["totals"])
        self.assertEqual(api_payload["by_category"], script_payload["by_category"])
        self.assertEqual(api_payload["by_status"], script_payload["by_status"])
        self.assertEqual(api_payload["satisfaction"], script_payload["satisfaction"])
        self.assertEqual(api_payload["invalid"]["by_type"], script_payload["invalid"]["by_type"])


if __name__ == "__main__":
    unittest.main()
