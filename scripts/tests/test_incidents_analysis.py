import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from packages.incidents_analysis.analyzer import analyze_records
from packages.incidents_analysis.config import load_config
from packages.incidents_analysis.models import AnalysisInputError
from packages.incidents_analysis.parser import parse_csv_file, parse_csv_text
from packages.incidents_analysis.validator import validate_required_columns


class IncidentsAnalysisTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = load_config("scripts/incidents_config.json")

    def test_parse_valid_csv(self) -> None:
        headers, records = parse_csv_text(
            "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\n"
            "NXV-000001,2026-08-01,Acme,TECHNICAL,Issue with login,AGT-07,CLOSED,user@example.com,4\n"
        )

        self.assertIn("ticket_id", headers)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["category"], "TECHNICAL")

    def test_parse_empty_csv_raises(self) -> None:
        with self.assertRaises(AnalysisInputError) as context:
            parse_csv_text("   \n")

        self.assertEqual(context.exception.code, "EMPTY_CSV")

    def test_parse_nonexistent_file_raises(self) -> None:
        with self.assertRaises(AnalysisInputError) as context:
            parse_csv_file("scripts/no-existe.csv")

        self.assertEqual(context.exception.code, "FILE_NOT_FOUND")

    def test_parse_malformed_csv_raises(self) -> None:
        with self.assertRaises(AnalysisInputError) as context:
            parse_csv_text(
                "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\n"
                "\"NXV-000001,2026-08-01,Acme,TECHNICAL,Issue with login,AGT-07,CLOSED,user@example.com,4\n"
            )

        self.assertEqual(context.exception.code, "MALFORMED_CSV")

    def test_parse_file_supports_bare_filename_from_scripts_dir(self) -> None:
        headers, records = parse_csv_file("incidents-COMPANY.csv")
        self.assertIn("ticket_id", headers)
        self.assertEqual(len(records), 100)

    def test_missing_required_columns_raises(self) -> None:
        headers, records = parse_csv_text(
            "ticket_id,date,client_company,category\n"
            "NXV-000001,2026-08-01,Acme,TECHNICAL\n"
        )
        self.assertEqual(len(records), 1)

        with self.assertRaises(AnalysisInputError) as context:
            validate_required_columns(headers, self.config)

        self.assertEqual(context.exception.code, "MISSING_REQUIRED_COLUMNS")

    def test_validation_and_metrics_exclude_invalid_records(self) -> None:
        headers, records = parse_csv_text(
            "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\n"
            "NXV-000001,2026-08-01,Acme,TECHNICAL,Issue with login,AGT-07,CLOSED,user1@example.com,4\n"
            "NXV-000002,2026-08-01,Beta,BILLING,Need invoice copy,AGT-08,OPEN,user2@example.com,\n"
            "NXV-000003,2026-08-01,,ACCESS,User cannot access portal,AGT-09,OPEN,user3@example.com,\n"
            "NXV-000004,2026-08-01,Gamma,UNKNOWN,Routing issue,AGT-10,OPEN,user4@example.com,\n"
            "NXV-000005,2026-08-01,Delta,HR_QUERY,Policy question,AGT-11,OPEN,invalid_email,\n"
            "NXV-000006,2026-08-01,Eta,COMPLAINT,Service quality complaint,AGT-12,CLOSED,user6@example.com,\n"
        )

        validate_required_columns(headers, self.config)
        result = analyze_records(records, self.config)

        self.assertEqual(result.processed_records, 6)
        self.assertEqual(result.valid_records, 2)
        self.assertEqual(result.invalid_records, 4)
        self.assertEqual(result.by_category["TECHNICAL"], 1)
        self.assertEqual(result.by_category["BILLING"], 1)
        self.assertEqual(result.by_status["CLOSED"], 1)
        self.assertEqual(result.by_status["OPEN"], 1)
        self.assertEqual(result.closed_valid_records, 1)
        self.assertEqual(result.average_satisfaction_closed, 4.0)
        self.assertEqual(result.satisfaction_distribution["4"], 1)

        self.assertEqual(result.invalid_by_type["MISSING_CLIENT_COMPANY"], 1)
        self.assertEqual(result.invalid_by_type["INVALID_OR_MISSING_CATEGORY"], 1)
        self.assertEqual(result.invalid_by_type["INVALID_OR_MISSING_EMAIL"], 1)
        self.assertEqual(result.invalid_by_type["CLOSED_WITHOUT_SATISFACTION"], 1)

    def test_sample_dataset_matches_expected_context_values(self) -> None:
        headers, records = parse_csv_file("incidents-COMPANY.csv")
        validate_required_columns(headers, self.config)
        result = analyze_records(records, self.config)

        self.assertEqual(result.processed_records, 100)
        self.assertEqual(result.valid_records, 96)
        self.assertEqual(result.invalid_records, 4)

        self.assertEqual(result.by_category["TECHNICAL"], 28)
        self.assertEqual(result.by_category["BILLING"], 18)
        self.assertEqual(result.by_category["ACCESS"], 21)
        self.assertEqual(result.by_category["HR_QUERY"], 17)
        self.assertEqual(result.by_category["COMPLAINT"], 12)

        self.assertEqual(result.by_status["OPEN"], 27)
        self.assertEqual(result.by_status["CLOSED"], 56)
        self.assertEqual(result.by_status["DISCARDED"], 13)

        self.assertEqual(result.closed_with_satisfaction, 56)
        self.assertEqual(result.closed_valid_records, 56)
        self.assertEqual(result.average_satisfaction_closed, 3.84)
        self.assertEqual(result.satisfaction_distribution["1"], 2)
        self.assertEqual(result.satisfaction_distribution["2"], 5)
        self.assertEqual(result.satisfaction_distribution["3"], 10)
        self.assertEqual(result.satisfaction_distribution["4"], 22)
        self.assertEqual(result.satisfaction_distribution["5"], 17)

        self.assertEqual(result.invalid_by_type["MISSING_CLIENT_COMPANY"], 1)
        self.assertEqual(result.invalid_by_type["INVALID_OR_MISSING_CATEGORY"], 1)
        self.assertEqual(result.invalid_by_type["INVALID_OR_MISSING_EMAIL"], 1)
        self.assertEqual(result.invalid_by_type["CLOSED_WITHOUT_SATISFACTION"], 1)


if __name__ == "__main__":
    unittest.main()
