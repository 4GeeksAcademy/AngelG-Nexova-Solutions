import {
  ApiRequestError,
  authRequest,
  type RequestOptions,
} from "@/lib/api-client";
import type {
  Asset,
  AssetEntryCreate,
  AssetEntryResponse,
  AssetExitCreate,
  AssetExitResponse,
  InventoryOrderResponse,
} from "@/types/inventory";

export class InventoryApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "InventoryApiError";
    this.status = status;
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "La solicitud no es válida. Revisá los datos e intentá nuevamente.",
  401: "La sesión no está autenticada o ha expirado. Iniciá sesión nuevamente.",
  403: "No tenés permiso para realizar esta operación.",
  404: "No se encontró el recurso solicitado.",
  409: "La operación entra en conflicto con los datos existentes.",
  500: "Ocurrió un error interno en el servidor.",
};

function fallbackMessage(status: number): string {
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 400 && status < 500) {
    return "La solicitud no pudo completarse. Revisá los datos e intentá nuevamente.";
  }
  if (status >= 500) {
    return "El servidor no pudo completar la solicitud. Intentá nuevamente más tarde.";
  }
  return `La solicitud falló (HTTP ${status}).`;
}

async function inventoryRequest<T>(
  path: string,
  init?: Omit<RequestOptions, "headers"> & { headers?: HeadersInit },
): Promise<T> {
  try {
    return await authRequest<T>(path, init as RequestOptions | undefined);
  } catch (error: unknown) {
    if (error instanceof ApiRequestError) {
      // api-client ya extrajo el mensaje legible y disparó su callback global
      // de sesión expirada en 401. Evitamos duplicar esa lógica aquí.
      const message = /^Error HTTP \d+$/.test(error.message)
        ? fallbackMessage(error.status)
        : error.message;
      throw new InventoryApiError(error.status, message);
    }

    throw error;
  }
}

export function getInventoryProducts(): Promise<Asset[]> {
  return inventoryRequest<Asset[]>("/inventory/products");
}

export function createInboundOrder(
  body: AssetEntryCreate,
): Promise<AssetEntryResponse> {
  return inventoryRequest<AssetEntryResponse>("/inventory/orders/inbound", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createOutboundOrder(
  body: AssetExitCreate,
): Promise<AssetExitResponse> {
  return inventoryRequest<AssetExitResponse>("/inventory/orders/outbound", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getInventoryOrders(): Promise<InventoryOrderResponse[]> {
  return inventoryRequest<InventoryOrderResponse[]>("/inventory/orders");
}
