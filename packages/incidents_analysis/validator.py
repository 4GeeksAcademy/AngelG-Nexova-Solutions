from __future__ import annotations

import re
from datetime import datetime

from .models import AnalysisConfig, AnalysisInputError, RecordError


def validate_required_columns(headers: list[str], config: AnalysisConfig) -> None:
    header_set = set(headers)
    missing_columns = [
        column for column in config.required_columns if column not in header_set
    ]
    if missing_columns:
        missing = ", ".join(missing_columns)
        raise AnalysisInputError(
            code="MISSING_REQUIRED_COLUMNS",
            message=f"Faltan columnas obligatorias en CSV: {missing}",
        )


def _parse_satisfaction(value: str) -> float:
    return float(value.replace(",", "."))


def _is_valid_date(value: str) -> bool:
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return False
    return parsed.strftime("%Y-%m-%d") == value


def validate_row(
    row: dict[str, str],
    row_number: int,
    config: AnalysisConfig,
) -> list[RecordError]:
    errors: list[RecordError] = []

    ticket_id = row.get(config.ticket_id_field, "")
    if ticket_id == "" or not re.fullmatch(config.ticket_id_pattern, ticket_id):
        errors.append(
            RecordError(
                row_number=row_number,
                error_type="INVALID_TICKET_ID",
                field=config.ticket_id_field,
                value=ticket_id,
                message="ticket_id vacio o con formato invalido (NXV-XXXXXX)",
            )
        )

    date_value = row.get(config.date_field, "")
    if date_value == "" or not _is_valid_date(date_value):
        errors.append(
            RecordError(
                row_number=row_number,
                error_type="INVALID_DATE",
                field=config.date_field,
                value=date_value,
                message="date vacia o con formato invalido (YYYY-MM-DD)",
            )
        )

    client_company = row.get(config.client_company_field, "")
    if client_company == "":
        errors.append(
            RecordError(
                row_number=row_number,
                error_type="MISSING_CLIENT_COMPANY",
                field=config.client_company_field,
                value=client_company,
                message="Falta client_company",
            )
        )

    category = row.get(config.category_field, "")
    if category == "" or category not in config.valid_categories:
        errors.append(
            RecordError(
                row_number=row_number,
                error_type="INVALID_OR_MISSING_CATEGORY",
                field=config.category_field,
                value=category,
                message="category faltante o invalida",
            )
        )

    description = row.get(config.description_field, "")
    if description == "" or len(description) < 5:
        errors.append(
            RecordError(
                row_number=row_number,
                error_type="EMPTY_OR_SHORT_DESCRIPTION",
                field=config.description_field,
                value=description,
                message="description vacia o menor a 5 caracteres",
            )
        )

    agent_id = row.get(config.agent_id_field, "")
    if agent_id == "" or not re.fullmatch(config.agent_id_pattern, agent_id):
        errors.append(
            RecordError(
                row_number=row_number,
                error_type="INVALID_OR_MISSING_AGENT_ID",
                field=config.agent_id_field,
                value=agent_id,
                message="agent_id faltante o invalido (AGT-XX)",
            )
        )

    status = row.get(config.status_field, "")
    if status == "" or status not in config.valid_statuses:
        errors.append(
            RecordError(
                row_number=row_number,
                error_type="INVALID_STATUS",
                field=config.status_field,
                value=status,
                message="status faltante o invalido",
            )
        )

    email = row.get(config.customer_email_field, "")
    if email == "" or "@" not in email:
        errors.append(
            RecordError(
                row_number=row_number,
                error_type="INVALID_OR_MISSING_EMAIL",
                field=config.customer_email_field,
                value="[REDACTED]",
                message="customer_email faltante o invalido",
            )
        )

    satisfaction_value = row.get(config.satisfaction_field, "")

    if status in config.closed_statuses and satisfaction_value == "":
        errors.append(
            RecordError(
                row_number=row_number,
                error_type="CLOSED_WITHOUT_SATISFACTION",
                field=config.satisfaction_field,
                value=satisfaction_value,
                message="status CLOSED sin satisfaction_score",
            )
        )

    if satisfaction_value:
        try:
            satisfaction = _parse_satisfaction(satisfaction_value)
        except ValueError:
            errors.append(
                RecordError(
                    row_number=row_number,
                    error_type="INVALID_SATISFACTION",
                    field=config.satisfaction_field,
                    value=satisfaction_value,
                    message="satisfaction_score invalido, debe ser entero entre 1 y 5",
                )
            )
        else:
            if not satisfaction.is_integer():
                errors.append(
                    RecordError(
                        row_number=row_number,
                        error_type="INVALID_SATISFACTION",
                        field=config.satisfaction_field,
                        value=satisfaction_value,
                        message="satisfaction_score invalido, debe ser entero entre 1 y 5",
                    )
                )
            elif satisfaction < config.min_satisfaction or satisfaction > config.max_satisfaction:
                errors.append(
                    RecordError(
                        row_number=row_number,
                        error_type="INVALID_SATISFACTION",
                        field=config.satisfaction_field,
                        value=satisfaction_value,
                        message="satisfaction_score fuera de rango [1, 5]",
                    )
                )

    return errors
