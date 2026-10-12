from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from auth import get_current_user
from services import (
    create_note,
    create_record,
    delete_note,
    get_notes_by_record,
    get_record_by_id,
    get_records,
    set_record_notes_count,
    update_record
)


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
    full_name: str
    email: str
    phone: str
    position: str
    linkedin_url: Optional[str] = None
    cv_url: Optional[str] = None
    experience_years: int


class RecordUpdate(RecordCreate):
    pass


class RecordPatch(BaseModel):
    status: Optional[CandidateStatus] = None
    stage: Optional[CandidateStage] = None


class NoteCreate(BaseModel):
    content: str


def get_record_or_404(record_id: str):
    record = get_record_by_id(record_id)

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Candidatura no encontrada"
        )

    return record


@router.get("")
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


@router.get("/{record_id}")
def get_record(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    return get_record_or_404(record_id)


@router.post("")
def create_candidate(
    data: RecordCreate,
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc).isoformat()

    record = {
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
        "updated_at": now
    }

    create_record(record)

    return record


@router.put("/{record_id}")
def replace_candidate(
    record_id: str,
    data: RecordUpdate,
    current_user: dict = Depends(get_current_user)
):
    get_record_or_404(record_id)

    changes = data.model_dump()
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()

    return update_record(record_id, changes)


@router.patch("/{record_id}")
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

    return update_record(record_id, changes)


@router.get("/{record_id}/notes")
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


@router.post("/{record_id}/notes")
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

    create_note(note)
    set_record_notes_count(record_id, len(get_notes_by_record(record_id)))

    return note


@router.delete("/{record_id}/notes/{note_id}")
def remove_note(
    record_id: str,
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    get_record_or_404(record_id)

    delete_note(record_id, note_id)
    set_record_notes_count(record_id, len(get_notes_by_record(record_id)))

    return Response(status_code=204)
