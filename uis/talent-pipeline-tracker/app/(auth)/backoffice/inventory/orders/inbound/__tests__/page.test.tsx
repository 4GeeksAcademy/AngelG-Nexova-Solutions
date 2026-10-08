import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InboundOrderPage from "../page";
import { createInboundOrder, getInventoryProducts } from "@/lib/inventory";

const { replace, guardRender } = vi.hoisted(() => ({
  replace: vi.fn(),
  guardRender: vi.fn(),
}));

vi.mock("@/components/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => {
    guardRender();
    return <>{children}</>;
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isReady: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/inventory", () => ({
  getInventoryProducts: vi.fn(),
  createInboundOrder: vi.fn(),
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

const products = [
  {
    id: 12,
    name: 'Portátil 14" Business',
    sku: "NXV-IT-001",
    category: "hardware" as const,
    office: "Valencia" as const,
    current_stock: 8,
  },
  {
    id: 27,
    name: "Hub USB-C",
    sku: "NXV-PER-002",
    category: "peripherals" as const,
    office: "Miami" as const,
    current_stock: 5,
  },
];

const mockedGetProducts = vi.mocked(getInventoryProducts);
const mockedCreateOrder = vi.mocked(createInboundOrder);

async function fillAndSubmitForm() {
  fireEvent.change(await screen.findByLabelText("Activo recibido"), {
    target: { value: "12" },
  });
  fireEvent.change(screen.getByLabelText("Cantidad recibida"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Proveedor o vendedor"), {
    target: { value: " TechDistrib Valencia S.L. " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }));
}

describe("InboundOrderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/backoffice/inventory/orders/inbound");
    mockedGetProducts.mockResolvedValue(products);
    mockedCreateOrder.mockResolvedValue({
      id: 44,
      asset_id: 12,
      quantity: 3,
      supplier: "TechDistrib Valencia S.L.",
      office: "Valencia",
      created_at: "2026-09-30T12:00:00Z",
      user_uuid: "operator-uuid",
    });
  });

  it("carga activos y permite elegirlos por nombre sin pedir ID al usuario", async () => {
    render(<InboundOrderPage />);

    const selector = await screen.findByLabelText("Activo recibido");
    expect(mockedGetProducts).toHaveBeenCalledOnce();
    expect(screen.getByRole("option", { name: /Portátil 14.*NXV-IT-001.*Valencia/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Hub USB-C.*NXV-PER-002.*Miami/ })).toBeInTheDocument();
    expect(selector).toHaveValue("");
    expect(screen.queryByLabelText(/identificador|uuid/i)).not.toBeInTheDocument();
    expect(guardRender).toHaveBeenCalledOnce();
  });

  it("precarga el producto cuando recibe el query param de la página de activos", async () => {
    window.history.replaceState({}, "", "/backoffice/inventory/orders/inbound?productId=27");

    render(<InboundOrderPage />);

    expect(await screen.findByLabelText("Activo recibido")).toHaveValue("27");
    expect(screen.getByText("Miami", { selector: "div" })).toBeInTheDocument();
  });

  it("envía el contrato de entrada correcto y muestra confirmación limpiando el formulario", async () => {
    render(<InboundOrderPage />);
    await fillAndSubmitForm();

    await waitFor(() => {
      expect(mockedCreateOrder).toHaveBeenCalledWith({
        asset_id: 12,
        quantity: 3,
        supplier: "TechDistrib Valencia S.L.",
        office: "Valencia",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Entrada registrada correctamente");
    expect(screen.getByLabelText("Activo recibido")).toHaveValue("");
    expect(screen.getByLabelText("Cantidad recibida")).toHaveValue(null);
    expect(screen.getByLabelText("Proveedor o vendedor")).toHaveValue("");
  });

  it("bloquea el envío duplicado y da feedback mientras la petición sigue pendiente", async () => {
    let resolveOrder: ((value: Awaited<ReturnType<typeof createInboundOrder>>) => void) | undefined;
    mockedCreateOrder.mockReturnValue(
      new Promise((resolve) => {
        resolveOrder = resolve;
      }),
    );

    render(<InboundOrderPage />);
    await fillAndSubmitForm();

    expect(mockedCreateOrder).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Registrando entrada…" })).toBeDisabled();
    expect(screen.getByText("Procesando la entrada. No cierres esta página.")).toBeInTheDocument();

    resolveOrder?.({
      id: 44,
      asset_id: 12,
      quantity: 3,
      supplier: "TechDistrib Valencia S.L.",
      office: "Valencia",
      created_at: "2026-09-30T12:00:00Z",
      user_uuid: "operator-uuid",
    });
    await screen.findByText(/Entrada registrada: 3 unidades/);
  });

  it.each([
    [400, "La cantidad no es válida."],
    [500, "El servidor no pudo registrar la entrada."],
  ])("muestra un error legible del servidor con estado %i", async (_status, message) => {
    mockedCreateOrder.mockRejectedValue(new Error(message));

    render(<InboundOrderPage />);
    await fillAndSubmitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Cantidad recibida")).toHaveValue(3);
  });

});
