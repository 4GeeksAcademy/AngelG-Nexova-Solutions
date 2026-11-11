export const inventoryOffices = { valencia: "Valencia", miami: "Miami" };
export const inventoryCategories = {
  it_equipment: "Equipamiento TI",
  office_supplies: "Material de oficina",
  training_materials: "Material formativo",
  branded_merchandise: "Artículos de marca",
  hardware: "Hardware",
  peripherals: "Periféricos",
};
export const inventoryUnits = { unit: "Unidad", box: "Caja" };
export const inventoryMovementTypes = {
  inbound: "Entrada",
  outbound: "Salida",
  adjustment: "Ajuste",
};
export const writableMovementTypes = { inbound: "Entrada", outbound: "Salida" };
export const telemetryCategories = {
  training_kit: "Kit formativo",
  certification: "Certificación",
  onboarding_equipment: "Equipamiento de incorporación",
};

export interface InventoryItemPayload {
  office: keyof typeof inventoryOffices;
  name: string;
  sku?: string;
  category: keyof typeof inventoryCategories;
  unit_of_measure: keyof typeof inventoryUnits;
  reorder_point: string;
  lot_tracked: boolean;
  telemetry_category?: keyof typeof telemetryCategories | null;
  programme_id?: string | null;
}

export interface InventoryItem extends InventoryItemPayload {
  id: number;
  source_asset_id?: number | null;
  created_at: string;
  updated_at: string;
  current_stock: string;
  reorder_alert: boolean;
}

export interface InventoryLotPayload {
  item_id: number;
  lot_code: string;
  expiry_date: string | null;
}

export interface InventoryLot extends InventoryLotPayload {
  id: number;
  received_at: string;
}

export interface InventoryMovementPayload {
  item_id: number;
  lot_id: number | null;
  movement_type: keyof typeof inventoryMovementTypes;
  quantity: string;
  reason: string | null;
  supplier?: string | null;
  exit_type?: "allocation" | "consumption" | null;
  assigned_to?: string | null;
  office?: keyof typeof inventoryOffices | null;
  supplier_id?: number | null;
  unit_cost?: string | null;
  currency?: "EUR" | "USD" | null;
}

export interface InventoryMovement extends InventoryMovementPayload {
  id: number;
  created_at: string;
  user_uuid?: string | null;
  source_order_id?: number | null;
}
