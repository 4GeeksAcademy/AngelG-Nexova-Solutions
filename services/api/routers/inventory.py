"""Hito 5 adapters over the single Item/Lot/Movement inventory."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlmodel import Session, select

from auth import get_current_user
from database import get_db
from inventory_models import Item, Movement
from inventory_schemas import ItemCreate, MovementCreate
from routers.inventory_v2 import create_item, create_movement, _item_stock, reject_direct_stock_edit
from schemas import (
    AssetCreate, AssetResponse, AssetOrderProduct, AssetEntryCreate,
    AssetEntryResponse, AssetExitCreate, AssetExitResponse, InventoryOrderResponse,
)


router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(reject_direct_stock_edit)])


def _asset_data(item: Item) -> dict:
    return {
        "id": item.id, "name": item.name, "sku": item.sku,
        "category": item.category,
        "office": item.office.capitalize(),
        "telemetry_category": item.telemetry_category, "programme_id": item.programme_id,
    }


def _asset_response(item: Item, stock: Decimal) -> AssetResponse:
    return AssetResponse.model_validate({
        **_asset_data(item),
        "current_stock": int(stock) if stock == stock.to_integral_value() else stock,
    })


def _order_data(movement: Movement) -> dict:
    return {
        "id": movement.id, "asset_id": movement.item_id,
        "quantity": int(movement.quantity) if movement.quantity == movement.quantity.to_integral_value() else movement.quantity,
        "office": movement.office.capitalize() if movement.office else None,
        "created_at": movement.created_at, "user_uuid": movement.user_uuid,
    }


@router.get("/products", response_model=list[AssetResponse])
def list_products(session: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    del current_user
    totals = select(
        Movement.item_id,
        func.sum(
            func.coalesce(
                case(
                    (Movement.movement_type == "outbound", -Movement.quantity),
                    else_=Movement.quantity,
                ), 0,
            )
        ).label("stock"),
    ).group_by(Movement.item_id).subquery()
    rows = session.exec(
        select(Item, func.coalesce(totals.c.stock, 0))
        .outerjoin(totals, totals.c.item_id == Item.id).order_by(Item.id)
    ).all()
    return [_asset_response(item, Decimal(stock)) for item, stock in rows]


@router.post("/products", response_model=AssetResponse, status_code=201)
def create_product(payload: AssetCreate, session: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    result = create_item(ItemCreate(
        **{**payload.model_dump(), "office": payload.office.lower()},
        unit_of_measure="unit", reorder_point=0,
    ), session, current_user)
    item = session.get(Item, result.id)
    return _asset_response(item, result.current_stock)


@router.get("/products/{id}", response_model=AssetResponse)
def get_product(id: int, session: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    del current_user
    item = session.get(Item, id)
    if item is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return _asset_response(item, _item_stock(session, id))


@router.post("/orders/inbound", response_model=AssetEntryResponse, status_code=201)
def create_inbound_order(payload: AssetEntryCreate, session: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    movement = create_movement(MovementCreate(
        item_id=payload.asset_id, quantity=payload.quantity, movement_type="inbound",
        supplier=payload.supplier, office=payload.office.lower(),
        supplier_id=payload.supplier_id, unit_cost=payload.unit_cost, currency=payload.currency,
    ), session, current_user)
    return AssetEntryResponse.model_validate({
        **_order_data(movement), "supplier": movement.supplier,
    })


@router.post("/orders/outbound", response_model=AssetExitResponse, status_code=201)
def create_outbound_order(payload: AssetExitCreate, session: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    item = session.exec(select(Item).where(Item.id == payload.asset_id).with_for_update()).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    available = _item_stock(session, item.id)
    if payload.quantity > available:
        shown = int(available) if available == available.to_integral_value() else available
        raise HTTPException(status_code=400, detail=(
            f"Insufficient stock for asset '{item.name}'. Available: {shown}, requested: {payload.quantity}."
        ))
    movement = create_movement(MovementCreate(
        item_id=payload.asset_id, quantity=payload.quantity, movement_type="outbound",
        exit_type=payload.exit_type, assigned_to=payload.assigned_to,
        office=payload.office.lower(),
    ), session, current_user)
    return AssetExitResponse.model_validate({
        **_order_data(movement), "exit_type": movement.exit_type,
        "assigned_to": movement.assigned_to,
    })


@router.get("/orders", response_model=list[InventoryOrderResponse])
def list_orders(session: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    del current_user
    rows = session.exec(
        select(Movement, Item).join(Item, Movement.item_id == Item.id)
        .order_by(Movement.created_at.desc(), Movement.id.desc())
    ).all()
    return [InventoryOrderResponse.model_validate({
        **_order_data(movement), "order_type": movement.movement_type,
        "supplier": movement.supplier, "exit_type": movement.exit_type,
        "assigned_to": movement.assigned_to,
        "reason": movement.reason, "lot_id": movement.lot_id,
        "asset": AssetOrderProduct.model_validate(_asset_data(item)),
    }) for movement, item in rows]
