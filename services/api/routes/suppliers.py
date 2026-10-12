"""
routes/suppliers.py — REST endpoints for the Nexova Supplier Directory.

Endpoints:
    POST   /suppliers          — Create a supplier
    GET    /suppliers          — List suppliers (with optional filters)
    GET    /suppliers/{id}     — Get supplier detail
    PATCH  /suppliers/{id}/rate   — Update monthly rate
    PATCH  /suppliers/{id}/status — Update status
    DELETE /suppliers/{id}     — Delete a supplier
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from tinydb import where

from ..database import get_db
from ..models import (
    SupplierCreate,
    SupplierDict,
    SupplierResponse,
    RateUpdate,
    StatusUpdate,
)

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

SUPPLIERS_TABLE = "suppliers"


# ── Helpers ────────────────────────────────────────────────────────────────

def _table():
    return get_db().table(SUPPLIERS_TABLE)


def _doc_to_response(doc) -> SupplierResponse:
    """Convert a TinyDB document to a SupplierResponse."""
    return SupplierResponse(
        id=doc.doc_id,
        name=doc["name"],
        country=doc["country"],
        categories=doc["categories"],
        monthly_rate=doc["monthly_rate"],
        currency=doc["currency"],
        updated_at=doc["updated_at"],
        status=doc["status"],
        contract_renewal_date=doc.get("contract_renewal_date"),
        contact_email=doc.get("contact_email"),
        notes=doc.get("notes"),
    )


def _get_supplier_or_404(supplier_id: int):
    """Fetch a supplier by ID or raise 404."""
    doc = _table().get(doc_id=supplier_id)
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Proveedor con id {supplier_id} no encontrado.",
        )
    return doc


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("", response_model=SupplierResponse, status_code=201)
def create_supplier(payload: SupplierCreate):
    """Register a new supplier."""
    data = payload.model_dump()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc_id = _table().insert(data)
    doc = _table().get(doc_id=doc_id)
    return _doc_to_response(doc)


@router.get("", response_model=list[SupplierResponse])
def list_suppliers(
    country: Optional[str] = Query(None, description="Filtrar por país"),
    category: Optional[str] = Query(None, alias="category", description="Filtrar por categoría"),
):
    """List suppliers with optional filters by country and/or category."""
    query_conditions = []
    if country is not None:
        query_conditions.append(where("country") == country)
    if category is not None:
        query_conditions.append(where("categories").any([category]))

    # Build the final query
    if len(query_conditions) == 0:
        docs = _table().all()
    elif len(query_conditions) == 1:
        docs = _table().search(query_conditions[0])
    else:
        # Combine conditions with AND
        combined = query_conditions[0]
        for cond in query_conditions[1:]:
            combined = combined & cond
        docs = _table().search(combined)

    return [_doc_to_response(d) for d in docs]


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: int):
    """Get a single supplier by ID."""
    doc = _get_supplier_or_404(supplier_id)
    return _doc_to_response(doc)


@router.patch("/{supplier_id}/rate", response_model=SupplierResponse)
def update_supplier_rate(supplier_id: int, payload: RateUpdate):
    """Update the monthly rate of a supplier.

    Rules from context:
    - The new rate must be > 0.
    - The new rate must differ from the current rate.
    - updated_at is automatically set server-side.
    """
    doc = _get_supplier_or_404(supplier_id)

    current_rate = doc["monthly_rate"]
    new_rate = payload.monthly_rate

    if new_rate <= 0:
        raise HTTPException(
            status_code=422,
            detail="La tarifa mensual debe ser mayor que 0.",
        )

    if new_rate == current_rate:
        raise HTTPException(
            status_code=422,
            detail="La nueva tarifa debe ser diferente a la actual.",
        )

    now = datetime.now(timezone.utc).isoformat()
    _table().update(
        {"monthly_rate": new_rate, "updated_at": now},
        doc_ids=[supplier_id],
    )

    updated = _table().get(doc_id=supplier_id)
    return _doc_to_response(updated)


@router.patch("/{supplier_id}/status", response_model=SupplierResponse)
def update_supplier_status(supplier_id: int, payload: StatusUpdate):
    """Activate or suspend a supplier.

    Accepts only the two valid statuses defined in the context.
    updated_at is automatically updated on change.
    """
    _get_supplier_or_404(supplier_id)

    now = datetime.now(timezone.utc).isoformat()
    _table().update(
        {"status": payload.status, "updated_at": now},
        doc_ids=[supplier_id],
    )

    updated = _table().get(doc_id=supplier_id)
    return _doc_to_response(updated)


@router.delete("/{supplier_id}", status_code=204)
def delete_supplier(supplier_id: int):
    """Delete a supplier by ID. Returns 404 if not found."""
    _get_supplier_or_404(supplier_id)
    _table().remove(doc_ids=[supplier_id])
    return None