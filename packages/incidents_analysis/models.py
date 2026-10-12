from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class AnalysisConfig:
    required_columns: list[str]
    valid_categories: list[str]
    valid_statuses: list[str]
    closed_statuses: list[str]
    satisfaction_field: str
    category_field: str = "category"
    status_field: str = "status"
    ticket_id_field: str = "ticket_id"
    date_field: str = "date"
    client_company_field: str = "client_company"
    description_field: str = "description"
    agent_id_field: str = "agent_id"
    customer_email_field: str = "customer_email"
    ticket_id_pattern: str = r"^NXV-\d{6}$"
    agent_id_pattern: str = r"^AGT-\d{2}$"
    min_satisfaction: float = 1.0
    max_satisfaction: float = 5.0


@dataclass(frozen=True)
class RecordError:
    row_number: int
    error_type: str
    field: str
    value: str
    message: str


@dataclass(frozen=True)
class InvalidRecord:
    row_number: int
    primary_error_type: str
    errors: list[RecordError]


@dataclass(frozen=True)
class AnalysisResult:
    processed_records: int
    valid_records: int
    invalid_records: int
    by_category: dict[str, int]
    by_status: dict[str, int]
    invalid_by_type: dict[str, int]
    invalid_details: list[InvalidRecord]
    closed_with_satisfaction: int
    closed_valid_records: int
    average_satisfaction_closed: float | None
    satisfaction_distribution: dict[str, int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "totals": {
                "processed": self.processed_records,
                "valid": self.valid_records,
                "invalid": self.invalid_records,
            },
            "by_category": self.by_category,
            "by_status": self.by_status,
            "satisfaction": {
                "closed_with_score": self.closed_with_satisfaction,
                "closed_valid_records": self.closed_valid_records,
                "average_closed": self.average_satisfaction_closed,
                "distribution": self.satisfaction_distribution,
            },
            "invalid": {
                "by_type": self.invalid_by_type,
                "records": [
                    {
                        "row_number": detail.row_number,
                        "primary_error_type": detail.primary_error_type,
                        "errors": [asdict(error) for error in detail.errors],
                    }
                    for detail in self.invalid_details
                ],
            },
        }


class AnalysisInputError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
