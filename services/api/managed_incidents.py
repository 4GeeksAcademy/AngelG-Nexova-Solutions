from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, or_
from sqlmodel import Session, select

from auth import get_current_user
from database import get_db
from incident_models import IncidentAuditEvent, ManagedIncident
from managed_incident_service import list_managed_incidents
from incident_schemas import (
    IncidentAuditResponse,
    IncidentCreate,
    IncidentListResponse,
    IncidentResponse,
    IncidentSeverity,
    IncidentStatus,
    IncidentStatusUpdate,
    IncidentSummaryResponse,
    IncidentType,
    IncidentUpdate,
    ResponsibleArea,
)


router = APIRouter(prefix="/v2/incidents", tags=["managed-incidents"])

ALLOWED_TRANSITIONS = {
    "open": {"assigned"},
    "assigned": {"in_progress"},
    "in_progress": {"resolved"},
    "resolved": {"closed", "reopened"},
    "reopened": {"assigned"},
    "closed": set(),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _actor(current_user: dict) -> tuple[str, str | None]:
    actor_id = current_user.get("id")
    if not isinstance(actor_id, str) or not actor_id:
        raise HTTPException(status_code=401, detail={
            "code": "INVALID_ACTOR",
            "message": "El usuario autenticado no tiene un identificador válido.",
        })
    email = current_user.get("email")
    return actor_id, email if isinstance(email, str) else None


def _raise_not_found() -> None:
    raise HTTPException(status_code=404, detail={
        "code": "INCIDENT_NOT_FOUND",
        "message": "La incidencia no existe.",
    })


def _audit(
    session: Session,
    incident_id: str,
    change_type: str,
    old_value: str | None,
    new_value: str | None,
    actor_id: str,
    actor_email: str | None,
    occurred_at: datetime,
) -> None:
    session.add(IncidentAuditEvent(
        id=str(uuid4()),
        incident_id=incident_id,
        change_type=change_type,
        old_value=old_value,
        new_value=new_value,
        actor_id=actor_id,
        actor_email=actor_email,
        occurred_at=occurred_at,
    ))


def _commit(session: Session) -> None:
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise


def _validate_sla_patch(
    incident_type: str,
    deadline: datetime | None,
) -> None:
    if incident_type == "sla_breach" and deadline is None:
        raise HTTPException(status_code=422, detail={
            "code": "SLA_DEADLINE_REQUIRED",
            "message": "sla_deadline es obligatorio para incidencias sla_breach.",
            "fields": {"sla_deadline": ["required"]},
        })
    if incident_type != "sla_breach" and deadline is not None:
        raise HTTPException(status_code=422, detail={
            "code": "SLA_DEADLINE_NOT_ALLOWED",
            "message": "sla_deadline solo se permite para incidencias sla_breach.",
            "fields": {"sla_deadline": ["must be null"]},
        })


def _aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.post("", response_model=IncidentResponse, status_code=201)
def create_incident(
    data: IncidentCreate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    actor_id, actor_email = _actor(current_user)
    now = _now()
    deadline = _aware_utc(data.sla_deadline) if data.sla_deadline else None
    incident = ManagedIncident(
        id=str(uuid4()),
        client_name=data.client_name,
        channel=data.channel,
        type=data.type,
        severity=data.severity,
        responsible_area=data.responsible_area,
        title=data.title.strip(),
        description=data.description,
        status="open",
        assigned_to=data.assigned_to,
        sla_deadline=deadline,
        created_at=now,
        updated_at=now,
    )
    session.add(incident)
    session.flush()
    _audit(session, incident.id, "created", None, "open", actor_id, actor_email, now)
    if incident.assigned_to is not None:
        _audit(session, incident.id, "assigned_to", None, incident.assigned_to, actor_id, actor_email, now)
    _commit(session)
    session.refresh(incident)
    return incident


@router.get("", response_model=IncidentListResponse)
def list_incidents(
    status: IncidentStatus | None = None,
    severity: IncidentSeverity | None = None,
    type: IncidentType | None = None,
    responsible_area: ResponsibleArea | None = None,
    overdue_sla: bool | None = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    del current_user
    items, total = list_managed_incidents(
        session,
        status=status,
        severity=severity,
        incident_type=type,
        responsible_area=responsible_area,
        overdue_sla=overdue_sla,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/summary", response_model=IncidentSummaryResponse)
def incident_summary(
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    del current_user
    incidents = session.exec(
        select(ManagedIncident).where(ManagedIncident.is_archived.is_(False))
    ).all()
    now = _now()
    return {
        "total": len(incidents),
        "by_status": {value: sum(item.status == value for item in incidents) for value in ALLOWED_TRANSITIONS},
        "by_severity": {
            value: sum(item.severity == value for item in incidents)
            for value in ("critical", "high", "medium", "low")
        },
        "overdue_sla": sum(
            item.type == "sla_breach"
            and item.sla_deadline is not None
            and _aware_utc(item.sla_deadline) < now
            and item.status not in {"resolved", "closed"}
            for item in incidents
        ),
    }


@router.get("/{incident_id}/history", response_model=list[IncidentAuditResponse])
def incident_history(
    incident_id: str,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    del current_user
    incident = session.get(ManagedIncident, incident_id)
    if incident is None:
        _raise_not_found()
    return session.exec(
        select(IncidentAuditEvent)
        .where(IncidentAuditEvent.incident_id == incident_id)
        .order_by(IncidentAuditEvent.occurred_at, IncidentAuditEvent.id)
    ).all()


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: str,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    del current_user
    incident = session.get(ManagedIncident, incident_id)
    if incident is None or incident.is_archived:
        _raise_not_found()
    return incident


@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: str,
    data: IncidentUpdate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    actor_id, actor_email = _actor(current_user)
    incident = session.exec(
        select(ManagedIncident).where(ManagedIncident.id == incident_id).with_for_update()
    ).first()
    if incident is None or incident.is_archived:
        _raise_not_found()
    changes = data.model_dump(exclude_unset=True)
    merged_type = changes.get("type", incident.type)
    merged_deadline = changes.get("sla_deadline", incident.sla_deadline)
    _validate_sla_patch(
        merged_type,
        merged_deadline,
    )
    now = _now()
    for field, value in changes.items():
        if field == "sla_deadline" and value is not None:
            value = _aware_utc(value)
        old_value = getattr(incident, field)
        if old_value == value:
            continue
        if field in {"assigned_to", "responsible_area"}:
            _audit(
                session,
                incident.id,
                field,
                str(old_value) if old_value is not None else None,
                str(value) if value is not None else None,
                actor_id,
                actor_email,
                now,
            )
        setattr(incident, field, value)
    incident.updated_at = now
    try:
        _commit(session)
    except Exception:
        session.refresh(incident)
        raise
    session.refresh(incident)
    return incident


@router.patch("/{incident_id}/status", response_model=IncidentResponse)
def update_incident_status(
    incident_id: str,
    data: IncidentStatusUpdate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    actor_id, actor_email = _actor(current_user)
    incident = session.exec(
        select(ManagedIncident).where(ManagedIncident.id == incident_id).with_for_update()
    ).first()
    if incident is None or incident.is_archived:
        _raise_not_found()
    target = data.status
    if target not in ALLOWED_TRANSITIONS[incident.status]:
        raise HTTPException(status_code=409, detail={
            "code": "INVALID_STATUS_TRANSITION",
            "message": f"No se puede cambiar de {incident.status} a {target}.",
            "fields": {"status": [target]},
        })
    old_status = incident.status
    now = _now()
    incident.status = target
    if target == "resolved":
        incident.resolved_at = now
    elif target == "closed":
        incident.closed_at = now
    incident.updated_at = now
    _audit(session, incident.id, "status", old_status, target, actor_id, actor_email, now)
    _commit(session)
    session.refresh(incident)
    return incident


@router.delete("/{incident_id}", response_model=None, status_code=204)
def archive_incident(
    incident_id: str,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    actor_id, actor_email = _actor(current_user)
    incident = session.exec(
        select(ManagedIncident).where(ManagedIncident.id == incident_id).with_for_update()
    ).first()
    if incident is None or incident.is_archived:
        _raise_not_found()
    now = _now()
    incident.is_archived = True
    incident.updated_at = now
    _audit(session, incident.id, "archived", "false", "true", actor_id, actor_email, now)
    _commit(session)
    return None


@router.delete("/{incident_id}/permanent", response_model=None, status_code=204)
def delete_incident_permanently(
    incident_id: str,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _actor(current_user)
    incident = session.exec(
        select(ManagedIncident).where(ManagedIncident.id == incident_id).with_for_update()
    ).first()
    if incident is None:
        _raise_not_found()
    session.execute(
        delete(IncidentAuditEvent).where(IncidentAuditEvent.incident_id == incident_id)
    )
    session.delete(incident)
    _commit(session)
    return None
