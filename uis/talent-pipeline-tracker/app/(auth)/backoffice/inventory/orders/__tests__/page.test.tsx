import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OrdersPage from "../page";
import { getInventoryOrders } from "@/lib/inventory";
import type { InventoryOrderResponse } from "@/types/inventory";

const { guardRender } = vi.hoisted(() => ({ guardRender: vi.fn() }));

vi.mock("@/components/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => {
    guardRender();
    return <>{children}</>;
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isReady: true }),
}));

vi.mock("@/lib/inventory", () => ({
  getInventoryOrders: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const orders: InventoryOrderResponse[] = [
  {
    id: 2,
    order_type: "outbound",
    asset_id: 12,
    quantity: 2,
    office: "Valencia",
    created_at: "2026-09-30T10:15:00Z",
    user_uuid: "operator-out-uuid",
    exit_type: "allocation",
    assigned_to: "Ana Pérez",
    asset: {
      id: 12,
      name: 'Portátil 14" Business',
      sku: "NXV-IT-001",
      category: "hardware",
      office: "Valencia",
    },
  },
  {
    id: 1,
    order_type: "inbound",
    asset_id: 27,
    quantity: 10,
    office: "Miami",
    created_at: "2026-09-29T08:00:00Z",
    user_uuid: "operator-in-uuid",
    supplier: "Office Depot Miami",
    asset: {
      id: 27,
      name: "Hub USB-C",
      sku: "NXV-PER-002",
      category: "peripherals",
      office: "Miami",
    },
  },
];

const mockedGetOrders = vi.mocked(getInventoryOrders);

describe("OrdersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetOrders.mockResolvedValue(orders);
  });

  it("consulta la capa de inventario y muestra los campos reales de entrada y salida", async () => {
    render(<OrdersPage />);

    expect(await screen.findByText('Portátil 14" Business')).toBeInTheDocument();
    expect(screen.getByText("Hub USB-C")).toBeInTheDocument();
    expect(screen.getByText("NXV-IT-001 · Valencia")).toBeInTheDocument();
    expect(screen.getByText("NXV-PER-002 · Miami")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("10", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("Entrada")).toBeInTheDocument();
    expect(screen.getByText("Salida")).toBeInTheDocument();
    expect(screen.getByText("operator-out-uuid")).toBeInTheDocument();
    expect(screen.getByText("operator-in-uuid")).toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-09-30T10:15:00Z"]')).toBeInTheDocument();
    expect(mockedGetOrders).toHaveBeenCalledOnce();
    expect(guardRender).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /editar|eliminar|borrar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("muestra un estado vacío cuando no existen órdenes", async () => {
    mockedGetOrders.mockResolvedValue([]);
    render(<OrdersPage />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Todavía no hay órdenes de inventario para mostrar.",
    );
  });

  it("muestra errores legibles sin exponer JSON", async () => {
    mockedGetOrders.mockRejectedValue(new Error("El historial no está disponible."));
    render(<OrdersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("El historial no está disponible.");
    expect(screen.queryByText(/\[object Object\]|\{"detail"/)).not.toBeInTheDocument();
  });
});
