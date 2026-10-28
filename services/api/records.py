import hashlib
import logging
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict

from auth import get_current_user
from services import (
    create_note,
    create_record,
    delete_record,
    delete_note,
    get_notes_by_record,
    get_record_by_id,
    get_records,
    set_record_notes_count,
    update_record
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/records",
    tags=["records"]
)


class CandidateStatus(str, Enum):
    received = "received"
    in_progress = "in_progress"
    selected = "selected"
    discarded = "discarded"


class CandidateStage(str, Enum):
    pending = "pending"
    review = "review"
    personal_interview = "personal_interview"
    technical_interview = "technical_interview"
    offer_presented = "offer_presented"


class RecordCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str
    email: str
    phone: str
    position: str
    linkedin_url: Optional[str] = None
    cv_url: Optional[str] = None
    experience_years: int


class PublicRecordCreate(RecordCreate):
    website: str = ""


class RecordUpdate(RecordCreate):
    pass


class RecordPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[CandidateStatus] = None
    stage: Optional[CandidateStage] = None


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str


class CandidateResponse(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    position: str
    linkedin_url: str | None = None
    cv_url: str | None = None
    status: CandidateStatus
    stage: CandidateStage
    experience_years: int
    notes_count: int
    applied_at: str
    updated_at: str


class CandidateListResponse(BaseModel):
    total: int
    page: int
    limit: int
    data: list[CandidateResponse]


class PublicRecordAcceptedResponse(BaseModel):
    message: str


class NoteResponse(BaseModel):
    id: str
    record_id: str
    content: str
    created_at: str


class NotesMetaResponse(BaseModel):
    total: int


class NotesListResponse(BaseModel):
    data: list[NoteResponse]
    meta: NotesMetaResponse


_PUBLIC_RATE_WINDOW_SECONDS = 15 * 60
_PUBLIC_RATE_MAX_REQUESTS = 5
_public_request_times: dict[str, deque[float]] = defaultdict(deque)
_public_rate_lock = threading.Lock()


def _public_rate_limited(client_key: str) -> bool:
    now = time.monotonic()
    with _public_rate_lock:
        timestamps = _public_request_times[client_key]
        while timestamps and now - timestamps[0] >= _PUBLIC_RATE_WINDOW_SECONDS:
            timestamps.popleft()
        if len(timestamps) >= _PUBLIC_RATE_MAX_REQUESTS:
            return True
        timestamps.append(now)
        return False


def _new_candidate(data: RecordCreate) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid4()),
        "full_name": data.full_name,
        "email": data.email,
        "phone": data.phone,
        "position": data.position,
        "linkedin_url": data.linkedin_url,
        "cv_url": data.cv_url,
        "status": CandidateStatus.received.value,
        "stage": CandidateStage.pending.value,
        "experience_years": data.experience_years,
        "notes_count": 0,
        "applied_at": now,
        "updated_at": now,
    }


def get_record_or_404(record_id: str):
    record = get_record_by_id(record_id)

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Candidatura no encontrada"
        )

    return record


@router.get("", response_model=CandidateListResponse)
def list_records(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    all_records = get_records()
    start = (page - 1) * limit
    end = start + limit

    return {
        "total": len(all_records),
        "page": page,
        "limit": limit,
        "data": all_records[start:end]
    }


@router.get("/{record_id}", response_model=CandidateResponse)
def get_record(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    return get_record_or_404(record_id)


@router.post("", response_model=CandidateResponse)
def create_candidate(
    data: RecordCreate,
    current_user: dict = Depends(get_current_user)
):
    record = _new_candidate(data)

    try:
        create_record(record)
    except Exception:
        logger.exception(
            "Error al crear candidatura para usuario %s", current_user["id"]
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "RECORD_CREATE_FAILED",
                "message": "No se pudo crear la candidatura.",
            }
        )

    return record


@router.post("/public", response_model=PublicRecordAcceptedResponse, status_code=201)
def create_public_candidate(data: PublicRecordCreate):
    """Accept a candidate application without exposing internal record access."""
    if data.website.strip():
        return {"message": "Solicitud recibida correctamente."}

    client_key = hashlib.sha256(data.email.strip().lower().encode()).hexdigest()
    if _public_rate_limited(client_key):
        raise HTTPException(
            status_code=429,
            detail="Demasiadas solicitudes. Inténtalo de nuevo más tarde.",
            headers={"Retry-After": str(_PUBLIC_RATE_WINDOW_SECONDS)},
        )

    record = _new_candidate(data)
    try:
        create_record(record)
    except Exception:
        logger.exception("Error al crear candidatura pública")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "RECORD_CREATE_FAILED",
                "message": "No se pudo crear la candidatura.",
            },
        )

    # Keep the acknowledgement indistinguishable from the honeypot path and
    # never return the applicant's personal data to an unauthenticated caller.
    return {"message": "Solicitud recibida correctamente."}


@router.put("/{record_id}", response_model=CandidateResponse)
def replace_candidate(
    record_id: str,
    data: RecordUpdate,
    current_user: dict = Depends(get_current_user)
):
    get_record_or_404(record_id)

    changes = data.model_dump()
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        return update_record(record_id, changes)
    except Exception:
        logger.exception(
            "Error al reemplazar candidatura %s para usuario %s", record_id, current_user["id"]
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "RECORD_UPDATE_FAILED",
                "message": "No se pudo actualizar la candidatura.",
            }
        )


@router.patch("/{record_id}", response_model=CandidateResponse)
def patch_candidate(
    record_id: str,
    data: RecordPatch,
    current_user: dict = Depends(get_current_user)
):
    get_record_or_404(record_id)

    changes = data.model_dump(exclude_none=True)

    if "status" in changes:
        changes["status"] = changes["status"].value

    if "stage" in changes:
        changes["stage"] = changes["stage"].value

    changes["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        return update_record(record_id, changes)
    except Exception:
        logger.exception(
            "Error al modificar candidatura %s para usuario %s", record_id, current_user["id"]
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "RECORD_UPDATE_FAILED",
                "message": "No se pudo modificar la candidatura.",
            }
        )


@router.delete("/{record_id}", response_model=None)
def remove_candidate(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        deleted = delete_record(record_id)
    except Exception:
        logger.exception(
            "Error al eliminar candidatura %s para usuario %s",
            record_id,
            current_user["id"],
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "RECORD_DELETE_FAILED",
                "message": "No se pudo eliminar la candidatura.",
            }
        )

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Candidatura no encontrada"
        )

    return Response(status_code=204)


@router.get("/{record_id}/notes", response_model=NotesListResponse)
def list_notes(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    get_record_or_404(record_id)

    notes = get_notes_by_record(record_id)

    return {
        "data": notes,
        "meta": {"total": len(notes)}
    }


@router.post("/{record_id}/notes", response_model=NoteResponse)
def add_note(
    record_id: str,
    data: NoteCreate,
    current_user: dict = Depends(get_current_user)
):
    get_record_or_404(record_id)

    note = {
        "id": str(uuid4()),
        "record_id": record_id,
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        create_note(note)
    except Exception:
        logger.exception(
            "Error al crear nota para candidatura %s", record_id
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "NOTE_CREATE_FAILED",
                "message": "No se pudo agregar la nota.",
            }
        )

    try:
        set_record_notes_count(record_id, len(get_notes_by_record(record_id)))
    except Exception:
        logger.exception(
            "Error al actualizar contador de notas para candidatura %s", record_id
        )

    return note


@router.delete("/{record_id}/notes/{note_id}", response_model=None)
def remove_note(
    record_id: str,
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    get_record_or_404(record_id)

    try:
        delete_note(record_id, note_id)
    except Exception:
        logger.exception(
            "Error al eliminar nota %s de candidatura %s", note_id, record_id
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "NOTE_DELETE_FAILED",
                "message": "No se pudo eliminar la nota.",
            }
        )

    try:
        set_record_notes_count(record_id, len(get_notes_by_record(record_id)))
    except Exception:
        logger.exception(
            "Error al actualizar contador de notas tras eliminar en candidatura %s", record_id
        )

    return Response(status_code=204)
