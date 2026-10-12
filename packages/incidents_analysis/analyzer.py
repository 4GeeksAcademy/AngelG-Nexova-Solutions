from __future__ import annotations

from collections import defaultdict

from .models import AnalysisConfig, AnalysisResult, InvalidRecord
from .validator import validate_row


def _parse_satisfaction(value: str) -> float:
    return float(value.replace(",", "."))


def analyze_records(records: list[dict[str, str]], config: AnalysisConfig) -> AnalysisResult:
    by_category: dict[str, int] = {category: 0 for category in config.valid_categories}
    by_status: dict[str, int] = {status: 0 for status in config.valid_statuses}
    invalid_by_type: dict[str, int] = defaultdict(int)
    satisfaction_distribution: dict[str, int] = {
        str(score): 0 for score in range(int(config.min_satisfaction), int(config.max_satisfaction) + 1)
    }
    invalid_details: list[InvalidRecord] = []

    valid_records = 0
    satisfaction_values: list[float] = []

    for index, row in enumerate(records, start=2):
        row_errors = validate_row(row=row, row_number=index, config=config)
        if row_errors:
            primary_error_type = row_errors[0].error_type
            invalid_details.append(
                InvalidRecord(
                    row_number=index,
                    primary_error_type=primary_error_type,
                    errors=row_errors,
                )
            )
            for error in row_errors:
                invalid_by_type[error.error_type] += 1
            continue

        valid_records += 1

        category = row[config.category_field]
        status = row[config.status_field]
        by_category[category] += 1
        by_status[status] += 1

        if status in config.closed_statuses:
            satisfaction = row.get(config.satisfaction_field, "")
            if satisfaction:
                satisfaction_values.append(_parse_satisfaction(satisfaction))
            satisfaction_distribution[str(int(_parse_satisfaction(satisfaction)))] += 1

    processed_records = len(records)
    invalid_records = processed_records - valid_records
    average_satisfaction = None
    if satisfaction_values:
        average_satisfaction = round(sum(satisfaction_values) / len(satisfaction_values), 2)

    return AnalysisResult(
        processed_records=processed_records,
        valid_records=valid_records,
        invalid_records=invalid_records,
        by_category=by_category,
        by_status=by_status,
        invalid_by_type=dict(sorted(invalid_by_type.items())),
        invalid_details=invalid_details,
        closed_with_satisfaction=len(satisfaction_values),
        closed_valid_records=sum(by_status.get(status, 0) for status in config.closed_statuses),
        average_satisfaction_closed=average_satisfaction,
        satisfaction_distribution=satisfaction_distribution,
    )
