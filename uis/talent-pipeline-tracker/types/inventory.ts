export type AssetCategory =
  | "hardware"
  | "peripherals"
  | "office_supplies"
  | "training_materials";

export type Office = "Valencia" | "Miami";
export type ExitType = "allocation" | "consumption";

export interface Asset {
  id: number;
  name: string;
  sku: string;
  category: AssetCategory;
  office: Office;
  current_stock: number;
}

export interface AssetEntryCreate {
  asset_id: number;
  quantity: number;
  supplier: string;
  office: Office;
}

export interface AssetExitCreate {
  asset_id: number;
  quantity: number;
  exit_type: ExitType;
  assigned_to: string | null;
  office: Office;
}

export interface AssetEntryResponse extends AssetEntryCreate {
  id: number;
  created_at: string;
  user_uuid: string;
}

export interface AssetExitResponse extends AssetExitCreate {
  id: number;
  created_at: string;
  user_uuid: string;
}

export interface AssetOrderAsset {
  id: number;
  name: string;
  sku: string;
  category: AssetCategory;
  office: Office;
}

export interface InventoryOrderResponse {
  id: number;
  order_type: "inbound" | "outbound";
  asset_id: number;
  quantity: number;
  office: Office;
  created_at: string;
  user_uuid: string;
  supplier?: string | null;
  exit_type?: ExitType | null;
  assigned_to?: string | null;
  asset: AssetOrderAsset;
}
