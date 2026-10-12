import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


REPO_ROOT = Path(__file__).resolve().parents[3]

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from services.api.app.main import app
from services.api.app.incidents_service import clear_last_result
from packages.incidents_analysis.cli import analyze_file


class IncidentsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.sample_csv_path = REPO_ROOT / "scripts" / "incidents-COMPANY.csv"
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
                    "incidencia_id,categoria,estado,cliente\n\"INC-1,tecnologia,cerrado,Cliente A\n",
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
        clear_last_result()
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
