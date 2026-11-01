import json
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.engine import Connection
from sqlmodel import Session

from auth import get_current_user
from database import get_db
from reporting.models import PipelineRun, WeeklyPerformance
from reporting.pipeline import PipelineBusy, PipelineFailure, previous_week, run_pipeline, validate_week

router = APIRouter(prefix="/reporting", tags=["reporting"], dependencies=[Depends(get_current_user)])


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    week_start: date | None = None


class RunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    week_start: date
    status: str
    started_at: datetime
    finished_at: datetime | None
    source_cutoff: datetime | None
    events_read: int
    rows_written: int
    error_code: str | None


@router.get("/pipeline-runs/latest", response_model=RunResponse)
def latest_run(session: Session = Depends(get_db)):
    run = session.scalar(select(PipelineRun).order_by(PipelineRun.started_at.desc()).limit(1))
    if run is None:
        raise HTTPException(status_code=404, detail="Todavía no hay corridas del pipeline.")
    return run


@router.post("/pipeline-runs", response_model=RunResponse, status_code=201)
def trigger_run(
    payload: RunRequest,
    session: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if user.get("role") not in {"admin", "manager"}:
        raise HTTPException(status_code=403, detail="Solo admin o manager pueden ejecutar el reporte.")
    week = payload.week_start or previous_week()
    try:
        # Reuse the configured engine, not the request transaction/connection.
        bind = session.get_bind()
        return run_pipeline(bind.engine if isinstance(bind, Connection) else bind, week)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    except PipelineBusy as error:
        raise HTTPException(status_code=409, detail=str(error)) from None
    except PipelineFailure as error:
        raise HTTPException(status_code=500, detail=str(error)) from None


@router.get("/weekly-office-program-performance")
def weekly_report(week_start: date | None = None, session: Session = Depends(get_db)):
    if week_start is None:
        week_start = session.scalar(
            select(PipelineRun.week_start).where(PipelineRun.status == "succeeded")
            .order_by(PipelineRun.week_start.desc()).limit(1)
        )
        if week_start is None:
            raise HTTPException(status_code=404, detail="Todavía no hay semanas calculadas.")
    try:
        validate_week(week_start)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    completed = session.scalar(select(PipelineRun.id).where(
        PipelineRun.week_start == week_start, PipelineRun.status == "succeeded"
    ).limit(1))
    if completed is None:
        raise HTTPException(status_code=404, detail="La semana solicitada no está calculada.")
    rows = session.scalars(select(WeeklyPerformance).where(
        WeeklyPerformance.week_start == week_start
    ).order_by(WeeklyPerformance.office, WeeklyPerformance.programme_id)).all()
    encoded = []
    for row in rows:
        values = {key: getattr(row, key) for key in (
            "office", "programme_id", "kits_delivered_count", "shortage_events_count",
            "cost_variance_events_count", "currency",
        )}
        # Emit an exact JSON number without converting monetary Decimal to float.
        encoded.append(json.dumps(values)[:-1] + ',"total_material_cost":' + format(row.total_material_cost, "f") + "}")
    body = '{"week_start":' + json.dumps(week_start.isoformat()) + ',"entries":[' + ",".join(encoded) + "]}"
    return Response(body, media_type="application/json")
