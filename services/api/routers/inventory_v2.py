"""Canonical, additive inventory endpoints. Legacy /inventory/products remains intact."""

from datetime import date, datetime, timezone
from decimal import Decimal
import json
import logging
from uuid import uuid4

from sqlalchemy import delete
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from auth import get_current_user
from database import db, get_db
from inventory_models import Item, Lot, Movement
from inventory_schemas import (
    Category,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
    LotCreate,
    LotResponse,
    MovementCreate,
    MovementResponse,
    MovementType,
    Office,
)
from telemetry.capture import CURRENCIES, capture_movement, capture_rejection


logger = logging.getLogger(__name__)


async def reject_direct_stock_edit(
    request: Request,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> None:
    if request.method not in {"POST", "PATCH", "PUT"}:
        return
    _require_user(current_user)
    try:
        body = await request.json()
    except json.JSONDecodeError:
        return  # FastAPI returns its normal malformed JSON validation error.
    if not isinstance(body, dict):
        return
    if not ({"stock", "current_stock"} & body.keys()) and body.get("movement_type") != "adjustment":
        return
    raw_id = request.path_params.get("item_id", request.path_params.get("id", body.get("item_id", body.get("asset_id"))))
    if isinstance(raw_id, str) and raw_id.isdigit():
        raw_id = int(raw_id)
    item = session.get(Item, raw_id) if isinstance(raw_id, int) and not isinstance(raw_id, bool) else None
    if item is not None:
        capture_rejection(session, item, current_user["id"])
    else:
        logger.warning("Direct stock edit rejected without an identifiable inventory item")
    raise HTTPException(status_code=422, detail="El stock solo cambia mediante entradas y salidas.")


router = APIRouter(
    prefix="/inventory", tags=["inventory-v2"],
    dependencies=[Depends(reject_direct_stock_edit)],
)


def _require_user(current_user: dict) -> None:
    if not isinstance(current_user.get("id"), str) or not current_user["id"]:
        raise HTTPException(status_code=401, detail="Usuario autenticado inválido.")


def _item_stock(session: Session, item_id: int) -> Decimal:
    movements = session.exec(
        select(Movement).where(Movement.item_id == item_id)
    ).all()
    stock = Decimal("0")
    for movement in movements:
        if movement.movement_type == "inbound":
            stock += movement.quantity
        elif movement.movement_type == "outbound":
            stock -= movement.quantity
        else:
            stock += movement.quantity
    return stock


def _lot_stock(session: Session, item_id: int, lot_id: int) -> Decimal:
    movements = session.exec(
        select(Movement).where(
            Movement.item_id == item_id,
            Movement.lot_id == lot_id,
        )
    ).all()
    stock = Decimal("0")
    for movement in movements:
        stock += (
            movement.quantity
            if movement.movement_type in {"inbound", "adjustment"}
            else -movement.quantity
        )
    return stock


def _item_response(session: Session, item: Item) -> ItemResponse:
    stock = _item_stock(session, item.id)
    return ItemResponse.model_validate(
        {
            **item.model_dump(),
            "current_stock": stock,
            "reorder_alert": stock <= item.reorder_point,
        }
    )


def _movement_response(movement: Movement) -> MovementResponse:
    return MovementResponse.model_validate(movement)


def _commit(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Conflicto de integridad: revise duplicados y referencias.",
        ) from None


@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_user(current_user)
    item = Item(**payload.model_dump())
    if item.sku is None:
        item.sku = f"NXV-ITEM-{uuid4()}"
    session.add(item)
    _commit(session)
    session.refresh(item)
    return _item_response(session, item)


@router.get("/items", response_model=list[ItemResponse])
def list_items(
    office: Office | None = None,
    category: Category | None = None,
    reorder_only: bool = False,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_user(current_user)
    statement = select(Item).order_by(Item.id)
    if office is not None:
        statement = statement.where(Item.office == office)
    if category is not None:
        statement = statement.where(Item.category == category)
    items = session.exec(statement).all()
    responses = [_item_response(session, item) for item in items]
    return [item for item in responses if item.reorder_alert] if reorder_only else responses


@router.get("/items/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: int,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_user(current_user)
    item = session.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Artículo no encontrado.")
    return _item_response(session, item)


@router.patch("/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_user(current_user)
    item = session.exec(
        select(Item).where(Item.id == item_id).with_for_update()
    ).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Artículo no encontrado.")
    updates = payload.model_dump(exclude_unset=True)
    category = updates.get("telemetry_category", item.telemetry_category)
    programme = updates.get("programme_id", item.programme_id)
    if (category is None) != (programme is None):
        raise HTTPException(status_code=422, detail="Indique categoría formativa y programa conjuntamente.")
    for field, value in updates.items():
        setattr(item, field, value)
    item.updated_at = datetime.now(timezone.utc)
    session.add(item)
    _commit(session)
    session.refresh(item)
    return _item_response(session, item)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete only an unused item; preserve any item with lots or movements."""
    _require_user(current_user)
    item = session.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Artículo no encontrado.")
    has_lots = session.exec(select(Lot.id).where(Lot.item_id == item_id)).first()
    has_movements = session.exec(
        select(Movement.id).where(Movement.item_id == item_id)
    ).first()
    if has_lots is not None or has_movements is not None:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar un artículo con lotes o movimientos.",
        )
    session.delete(item)
    _commit(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
def create_lot(
    payload: LotCreate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_user(current_user)
    if session.exec(select(Item).where(Item.id == payload.item_id).with_for_update()).first() is None:
        raise HTTPException(status_code=404, detail="Artículo no encontrado.")
    lot = Lot(**payload.model_dump())
    session.add(lot)
    _commit(session)
    session.refresh(lot)
    return LotResponse.model_validate(lot)


@router.delete("/items/{item_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def delete_item_permanently(
    item_id: int,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_user(current_user)
    item = session.exec(select(Item).where(Item.id == item_id).with_for_update()).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Artículo no encontrado.")
    session.execute(delete(Movement).where(Movement.item_id == item_id))
    session.execute(delete(Lot).where(Lot.item_id == item_id))
    session.delete(item)
    _commit(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/lots", response_model=list[LotResponse])
def list_lots(
    item_id: int | None = Query(default=None, gt=0),
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_user(current_user)
    statement = select(Lot).order_by(Lot.id)
    if item_id is not None:
        statement = statement.where(Lot.item_id == item_id)
    return [LotResponse.model_validate(lot) for lot in session.exec(statement).all()]


@router.post(
    "/movements", response_model=MovementResponse, status_code=status.HTTP_201_CREATED
)
def create_movement(
    payload: MovementCreate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_user(current_user)
    item = session.exec(
        select(Item).where(Item.id == payload.item_id).with_for_update()
    ).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Artículo no encontrado.")

    lot = None
    if payload.lot_id is not None:
        lot = session.get(Lot, payload.lot_id)
        if lot is None:
            raise HTTPException(status_code=404, detail="Lote no encontrado.")
        if lot.item_id != item.id:
            raise HTTPException(status_code=422, detail="El lote no pertenece al artículo.")
    if item.lot_tracked and lot is None:
        raise HTTPException(
            status_code=422, detail="Este artículo requiere un lote en cada movimiento."
        )
    stock_before = _item_stock(session, item.id)
    office = payload.office or item.office
    currency = CURRENCIES[office]
    if payload.currency is not None and payload.currency != currency:
        raise HTTPException(status_code=422, detail="La moneda debe corresponder a la oficina del movimiento.")
    if item.telemetry_category is not None and payload.movement_type == "inbound":
        if payload.unit_cost is None or payload.supplier_id is None:
            raise HTTPException(status_code=422, detail="Material del Hito 6 requiere costo unitario e ID de proveedor en cada entrada.")
    supplier = payload.supplier
    if payload.supplier_id is not None:
        record = db.table("suppliers").get(doc_id=payload.supplier_id)
        if record is None:
            raise HTTPException(status_code=422, detail="Proveedor no encontrado.")
        supplier = record["name"]
    if payload.movement_type == "outbound":
        if lot is not None and lot.expiry_date is not None and lot.expiry_date < date.today():
            raise HTTPException(status_code=409, detail="No se puede emitir desde un lote caducado.")
        stock = stock_before
        if payload.quantity > stock:
            raise HTTPException(
                status_code=409,
                detail=f"Stock insuficiente: disponible {stock}, solicitado {payload.quantity}.",
            )
        if lot is not None:
            lot_stock = _lot_stock(session, item.id, lot.id)
            if payload.quantity > lot_stock:
                raise HTTPException(
                    status_code=409,
                    detail=f"Stock insuficiente en el lote: disponible {lot_stock}.",
                )
    values = payload.model_dump()
    values.update(office=office, currency=currency, supplier=supplier)
    movement = Movement(**values, user_uuid=current_user["id"])
    session.add(movement)
    session.flush()
    capture_movement(session, item, movement, stock_before)
    _commit(session)
    session.refresh(movement)
    return _movement_response(movement)


@router.get("/movements", response_model=list[MovementResponse])
def list_movements(
    item_id: int | None = Query(default=None, gt=0),
    movement_type: MovementType | None = None,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_user(current_user)
    statement = select(Movement).order_by(Movement.created_at.desc(), Movement.id.desc())
    if item_id is not None:
        statement = statement.where(Movement.item_id == item_id)
    if movement_type is not None:
        statement = statement.where(Movement.movement_type == movement_type)
    movements = session.exec(statement).all()
    return [_movement_response(movement) for movement in movements]
