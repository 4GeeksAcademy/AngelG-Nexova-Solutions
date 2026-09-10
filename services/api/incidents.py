from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field


logger = logging.getLogger(__name__)

API_DIR = Path(__file__).resolve().parent
REPO_ROOT = API_DIR.parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.shared.incidents import (  # noqa: E402
    IncidentBranch,
    IncidentCategory,
    IncidentOrigin,
    IncidentStatus,
    IncidentValidationError,
    build_incident,
    transition_is_valid,
    utc_now_iso,
)
from services import (  # noqa: E402
    create_incident,
    get_incident_by_id,
    get_incidents,
    update_incident_status,
)


router = APIRouter(prefix="/incidents", tags=["incidents"])


class IncidentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1)
    category: IncidentCategory
    status: IncidentStatus = IncidentStatus.OPEN
    origin: IncidentOrigin
    branch: IncidentBranch


class IncidentStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: IncidentStatus


def _validation_error(error: IncidentValidationError) -> HTTPException:
    return HTTPException(
        status_code=400,
        detail={
            "code": "VALIDATION_ERROR",
            "message": "La incidencia contiene campos inválidos.",
            "fields": {"incident": error.errors},
        },
    )


def _parse_filter(name: str, value: str | None, enum_type):
    if value is None:
        return None
    try:
        return enum_type(value).value
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_FILTER",
                "message": f"El filtro {name} no es válido.",
                "fields": {name: [value]},
            },
        ) from error


@router.post("", status_code=201)
def create(data: IncidentCreate):
    now = utc_now_iso()
    try:
        incident = build_incident(
            incident_id=str(uuid4()),
            title=data.title,
            description=data.description,
            category=data.category,
            status=data.status,
            origin=data.origin,
            branch=data.branch,
            created_at=now,
            updated_at=now,
        )
    except (IncidentValidationError, ValueError) as error:
        raise _validation_error(
            error if isinstance(error, IncidentValidationError)
            else IncidentValidationError([str(error)])
        ) from error

    created = create_incident(incident.to_record())
    if created is None:
        raise HTTPException(status_code=500, detail={
            "code": "ID_COLLISION",
            "message": "No se pudo generar un identificador único.",
        })
    return created


@router.get("")
def list_all(
    status: Annotated[str | None, Query()] = None,
    origin: Annotated[str | None, Query()] = None,
    branch: Annotated[str | None, Query()] = None,
    category: Annotated[str | None, Query()] = None,
):
    filters = {
        "status": _parse_filter("status", status, IncidentStatus),
        "origin": _parse_filter("origin", origin, IncidentOrigin),
        "branch": _parse_filter("branch", branch, IncidentBranch),
        "category": _parse_filter("category", category, IncidentCategory),
    }
    return [record for record in get_incidents({key: value for key, value in filters.items() if value is not None})]


@router.patch("/{incident_id}/status")
def update_status(incident_id: str, data: IncidentStatusUpdate):
    incident = get_incident_by_id(incident_id)
    if incident is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "INCIDENT_NOT_FOUND",
                "message": "La incidencia no existe.",
            },
        )

    try:
        valid = transition_is_valid(incident["status"], data.status)
    except ValueError as error:
        raise _validation_error(IncidentValidationError([str(error)])) from error
    if not valid:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_STATUS_TRANSITION",
                "message": f"No se puede cambiar de {incident['status']} a {data.status.value}.",
                "fields": {"status": [data.status.value]},
            },
        )

    try:
        return update_incident_status(incident_id, data.status.value, utc_now_iso())
    except Exception:
        logger.exception(
            "Error al actualizar estado de incidencia %s", incident_id
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "STATUS_UPDATE_FAILED",
                "message": "No se pudo actualizar el estado de la incidencia.",
            }
        )


@router.get("/summary")
def summary():
    records = get_incidents()
    return {
        "total": len(records),
        "by_status": {status.value: sum(record["status"] == status.value for record in records) for status in IncidentStatus},
        "by_category": {category.value: sum(record["category"] == category.value for record in records) for category in IncidentCategory},
        "by_origin": {origin.value: sum(record["origin"] == origin.value for record in records) for origin in IncidentOrigin},
        "by_branch": {branch.value: sum(record["branch"] == branch.value for record in records) for branch in IncidentBranch},
    }


@router.get("/{incident_id}")
def get_one(incident_id: str):
    incident = get_incident_by_id(incident_id)
    if incident is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "INCIDENT_NOT_FOUND",
                "message": "La incidencia no existe.",
            },
        )
    return incident