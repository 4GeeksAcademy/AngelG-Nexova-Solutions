import { authRequest } from "@/lib/api-client";
import type {
  InventoryItem,
  InventoryItemPayload,
  InventoryLot,
  InventoryLotPayload,
  InventoryMovement,
  InventoryMovementPayload,
} from "@/types/managed-inventory";

export function getInventoryItems(): Promise<InventoryItem[]> {
  return authRequest<InventoryItem[]>("/inventory/items");
}

export function getInventoryItem(id: number): Promise<InventoryItem> {
  return authRequest<InventoryItem>(`/inventory/items/${id}`);
}

export function saveInventoryItem(
  payload: InventoryItemPayload,
  id?: number,
): Promise<InventoryItem> {
  return authRequest<InventoryItem>(
    id === undefined ? "/inventory/items" : `/inventory/items/${id}`,
    { method: id === undefined ? "POST" : "PATCH", body: JSON.stringify(payload) },
  );
}

export function deleteInventoryItem(id: number): Promise<void> {
  return authRequest<void>(`/inventory/items/${id}`, { method: "DELETE" });
}

export function deleteInventoryItemPermanently(id: number): Promise<void> {
  return authRequest<void>(`/inventory/items/${id}/permanent`, { method: "DELETE" });
}

export function getInventoryLots(itemId: number): Promise<InventoryLot[]> {
  return authRequest<InventoryLot[]>(`/inventory/lots?item_id=${itemId}`);
}

export function createInventoryLot(payload: InventoryLotPayload): Promise<InventoryLot> {
  return authRequest<InventoryLot>("/inventory/lots", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function getInventoryMovements(itemId: number): Promise<InventoryMovement[]> {
  return authRequest<InventoryMovement[]>(`/inventory/movements?item_id=${itemId}`);
}

export function createInventoryMovement(
  payload: InventoryMovementPayload,
): Promise<InventoryMovement> {
  return authRequest<InventoryMovement>("/inventory/movements", {
    method: "POST", body: JSON.stringify(payload),
  });
}
