from __future__ import annotations

import json
from pathlib import Path

from .models import AnalysisConfig, AnalysisInputError


def load_config(config_path: str) -> AnalysisConfig:
    path = Path(config_path)
    if not path.exists():
        raise AnalysisInputError(
            code="CONFIG_NOT_FOUND",
            message=f"No se encontro el archivo de configuracion: {config_path}",
        )

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise AnalysisInputError(
            code="INVALID_CONFIG",
            message=f"Configuracion JSON invalida: {error}",
        ) from error

    required_keys = [
        "required_columns",
        "valid_categories",
        "valid_statuses",
        "closed_statuses",
        "satisfaction_field",
    ]

    for key in required_keys:
        if key not in payload:
            raise AnalysisInputError(
                code="INVALID_CONFIG",
                message=f"Falta la clave obligatoria en configuracion: {key}",
            )

    return AnalysisConfig(
        required_columns=list(payload["required_columns"]),
        valid_categories=list(payload["valid_categories"]),
        valid_statuses=list(payload["valid_statuses"]),
        closed_statuses=list(payload["closed_statuses"]),
        satisfaction_field=str(payload["satisfaction_field"]),
        category_field=str(payload.get("category_field", "category")),
        status_field=str(payload.get("status_field", "status")),
        ticket_id_field=str(payload.get("ticket_id_field", "ticket_id")),
        date_field=str(payload.get("date_field", "date")),
        client_company_field=str(
            payload.get("client_company_field", "client_company")
        ),
        description_field=str(payload.get("description_field", "description")),
        agent_id_field=str(payload.get("agent_id_field", "agent_id")),
        customer_email_field=str(
            payload.get("customer_email_field", "customer_email")
        ),
        ticket_id_pattern=str(payload.get("ticket_id_pattern", r"^NXV-\\d{6}$")),
        agent_id_pattern=str(payload.get("agent_id_pattern", r"^AGT-\\d{2}$")),
        min_satisfaction=float(payload.get("min_satisfaction", 1.0)),
        max_satisfaction=float(payload.get("max_satisfaction", 5.0)),
    )
