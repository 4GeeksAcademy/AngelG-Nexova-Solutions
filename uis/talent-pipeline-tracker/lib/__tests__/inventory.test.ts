import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearOnUnauthorized, setOnUnauthorized } from "@/lib/api-client";
import {
  createInboundOrder,
  createOutboundOrder,
  getInventoryOrders,
  getInventoryProducts,
  InventoryApiError,
} from "@/lib/inventory";

const asset = {
  id: 4,
  name: "Portátil 14\" Business",
  sku: "NXV-IT-001",
  category: "hardware" as const,
  office: "Valencia" as const,
  current_stock: 5,
};

const order = {
  id: 8,
  order_type: "inbound" as const,
  asset_id: asset.id,
  quantity: 2,
  office: "Valencia" as const,
  created_at: "2026-09-30T12:00:00Z",
  user_uuid: "user-uuid",
  supplier: "TechDistrib Valencia S.L.",
  asset: {
    id: asset.id,
    name: asset.name,
    sku: asset.sku,
    category: asset.category,
    office: asset.office,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("lib/inventory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    clearOnUnauthorized();
  });

  it("obtiene productos a través del cliente HTTP existente y envía el token", async () => {
    localStorage.setItem("token", "inventory-token");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse([asset]));

    await expect(getInventoryProducts()).resolves.toEqual([asset]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/inventory/products",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer inventory-token",
        }),
      }),
    );
  });

  it("envía los cuerpos exactos de entrada y salida", async () => {
    localStorage.setItem("token", "inventory-token");
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ id: 1 }))
      .mockResolvedValueOnce(jsonResponse({ id: 2 }));
    const inbound = {
      asset_id: asset.id,
      quantity: 2,
      supplier: "TechDistrib Valencia S.L.",
      office: "Valencia" as const,
    };
    const outbound = {
      asset_id: asset.id,
      quantity: 1,
      exit_type: "allocation" as const,
      assigned_to: "Empleado Nexova",
      office: "Valencia" as const,
    };

    await createInboundOrder(inbound);
    await createOutboundOrder(outbound);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/inventory/orders/inbound");
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: "POST",
      body: JSON.stringify(inbound),
      headers: expect.objectContaining({
        Authorization: "Bearer inventory-token",
      }),
    }));
    expect(fetchMock.mock.calls[1][0]).toBe("/api/inventory/orders/outbound");
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({
      method: "POST",
      body: JSON.stringify(outbound),
    }));
  });

  it("obtiene el historial usando el contrato order_type y asset anidado", async () => {
    localStorage.setItem("token", "orders-token");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse([order]));

    await expect(getInventoryOrders()).resolves.toEqual([order]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/inventory/orders",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({ Authorization: "Bearer orders-token" }),
      }),
    );
  });

  it.each([
    [400, "No hay stock disponible."],
    [403, "No tenés permiso para realizar esta operación."],
    [404, "No se encontró el recurso solicitado."],
    [409, "El registro ya existe."],
    [422, "La solicitud contiene campos inválidos."],
    [500, "El servidor está temporalmente indisponible."],
    [502, "El servidor no pudo completar la solicitud."],
  ])("expone un mensaje legible y el estado HTTP %i", async (status, message) => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({
      detail: { message },
    }, status));

    await expect(getInventoryProducts()).rejects.toMatchObject({
      name: "InventoryApiError",
      status,
      message,
    });
  });

  it("extrae el mensaje de errores FastAPI en array y conserva detail string", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({
        detail: [{ msg: "Error de prueba" }, { msg: "Otro error" }],
      }, 422))
      .mockResolvedValueOnce(jsonResponse({ detail: "Error de prueba" }, 400));

    await expect(getInventoryProducts()).rejects.toMatchObject({
      status: 422,
      message: "Error de prueba; Otro error",
    });
    await expect(getInventoryProducts()).rejects.toMatchObject({
      status: 400,
      message: "Error de prueba",
    });
  });

  it("reutiliza el callback global para 401 y expone error legible", async () => {
    localStorage.setItem("token", "expired-token");
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({
      detail: { message: "Token inválido o expirado" },
    }, 401));

    await expect(getInventoryProducts()).rejects.toMatchObject({
      name: "InventoryApiError",
      status: 401,
      message: "Sesión expirada. Redirigiendo al inicio de sesión…",
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("no filtra objetos ni JSON crudo si el body de error no tiene mensaje", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ unexpected: true }, 418));

    const result = getInventoryProducts();
    await expect(result).rejects.toBeInstanceOf(InventoryApiError);
    await expect(result).rejects.toThrow(
      "La solicitud no pudo completarse. Revisá los datos e intentá nuevamente.",
    );
    await expect(result).rejects.not.toThrow("[object Object]");
  });
});
