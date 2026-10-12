import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OutboundOrderPage from "../page";
import {
  createOutboundOrder,
  getInventoryProducts,
  InventoryApiError,
} from "@/lib/inventory";

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

vi.mock("@/lib/inventory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/inventory")>();
  return {
    ...actual,
    getInventoryProducts: vi.fn(),
    createOutboundOrder: vi.fn(),
  };
});

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
const mockedCreateOrder = vi.mocked(createOutboundOrder);

function chooseAsset(id = "12") {
  fireEvent.change(screen.getByLabelText("Activo"), { target: { value: id } });
}

function enterQuantity(value: string) {
  fireEvent.change(screen.getByLabelText("Cantidad a retirar"), { target: { value } });
}

function chooseAllocation() {
  fireEvent.change(screen.getByLabelText("Tipo de salida"), {
    target: { value: "allocation" },
  });
  fireEvent.change(screen.getByLabelText("Asignado a"), {
    target: { value: " Ana Pérez " },
  });
}

async function submit() {
  fireEvent.click(await screen.findByRole("button", { name: "Registrar salida" }));
}

describe("OutboundOrderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetProducts.mockResolvedValue(products);
    mockedCreateOrder.mockResolvedValue({
      id: 56,
      asset_id: 12,
      quantity: 2,
      exit_type: "allocation",
      assigned_to: "Ana Pérez",
      office: "Valencia",
      created_at: "2026-09-30T12:00:00Z",
      user_uuid: "operator-uuid",
    });
  });

  it("carga activos con nombre y usa el guard de autenticación", async () => {
    render(<OutboundOrderPage />);

    expect(await screen.findByLabelText("Activo")).toBeInTheDocument();
    expect(mockedGetProducts).toHaveBeenCalledOnce();
    expect(screen.getByRole("option", { name: /Portátil 14.*NXV-IT-001.*Valencia/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Hub USB-C.*NXV-PER-002.*Miami/ })).toBeInTheDocument();
    expect(guardRender).toHaveBeenCalledOnce();
  });

  it("actualiza el stock inmediatamente al cambiar el activo seleccionado", async () => {
    render(<OutboundOrderPage />);
    await screen.findByLabelText("Activo");

    chooseAsset("12");
    expect(screen.getByTestId("available-stock")).toHaveTextContent("Stock disponible: 8");
    chooseAsset("27");
    expect(screen.getByTestId("available-stock")).toHaveTextContent("Stock disponible: 5");
    expect(screen.getByTestId("available-stock")).toHaveTextContent("Miami");
  });

  it("advierte antes de enviar si la cantidad supera el stock", async () => {
    render(<OutboundOrderPage />);
    await screen.findByLabelText("Activo");
    chooseAsset("12");
    enterQuantity("9");

    expect(screen.getByRole("status")).toHaveTextContent(/supera el stock disponible/i);
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("envía el payload de allocation real y refleja la reducción del stock tras éxito", async () => {
    render(<OutboundOrderPage />);
    await screen.findByLabelText("Activo");
    chooseAsset("12");
    enterQuantity("2");
    chooseAllocation();
    await submit();

    await waitFor(() => {
      expect(mockedCreateOrder).toHaveBeenCalledWith({
        asset_id: 12,
        quantity: 2,
        exit_type: "allocation",
        assigned_to: "Ana Pérez",
        office: "Valencia",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Salida registrada correctamente");
    expect(screen.getByTestId("available-stock")).toHaveTextContent("Stock disponible: 6");
    expect(mockedGetProducts).toHaveBeenCalledOnce();
  });

  it("envía assigned_to null para consumption y no muestra el campo de asignación", async () => {
    render(<OutboundOrderPage />);
    await screen.findByLabelText("Activo");
    chooseAsset("27");
    enterQuantity("3");
    fireEvent.change(screen.getByLabelText("Tipo de salida"), {
      target: { value: "consumption" },
    });
    expect(screen.queryByLabelText("Asignado a")).not.toBeInTheDocument();
    await submit();

    expect(mockedCreateOrder).toHaveBeenCalledWith({
      asset_id: 27,
      quantity: 3,
      exit_type: "consumption",
      assigned_to: null,
      office: "Miami",
    });
  });

  it("muestra el error HTTP 400 inline junto a la cantidad y conserva los datos", async () => {
    mockedCreateOrder.mockRejectedValue(
      new InventoryApiError(400, "Insufficient stock for asset 'Portátil'. Available: 8, requested: 9."),
    );
    render(<OutboundOrderPage />);
    await screen.findByLabelText("Activo");
    chooseAsset("12");
    enterQuantity("9");
    chooseAllocation();
    await submit();

    expect(await screen.findByText(/Insufficient stock for asset 'Portátil'/)).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad a retirar")).toHaveValue(9);
    expect(screen.getByLabelText("Asignado a")).toHaveValue(" Ana Pérez ");
    expect(screen.getByLabelText("Cantidad a retirar")).toHaveAttribute("aria-invalid", "true");
  });

  it("bloquea envíos duplicados y muestra estado de procesamiento", async () => {
    let resolveOrder: ((value: Awaited<ReturnType<typeof createOutboundOrder>>) => void) | undefined;
    mockedCreateOrder.mockReturnValue(
      new Promise((resolve) => {
        resolveOrder = resolve;
      }),
    );
    render(<OutboundOrderPage />);
    await screen.findByLabelText("Activo");
    chooseAsset("12");
    enterQuantity("2");
    chooseAllocation();
    await submit();

    expect(mockedCreateOrder).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Registrando salida…" })).toBeDisabled();
    expect(screen.getByText("Procesando la salida. No cierres esta página.")).toBeInTheDocument();

    resolveOrder?.({
      id: 56,
      asset_id: 12,
      quantity: 2,
      exit_type: "allocation",
      assigned_to: "Ana Pérez",
      office: "Valencia",
      created_at: "2026-09-30T12:00:00Z",
      user_uuid: "operator-uuid",
    });
    await screen.findByText(/Salida registrada: 2 unidades/);
  });

  it("presenta los errores no-400 del servidor en un aviso legible", async () => {
    mockedCreateOrder.mockRejectedValue(new InventoryApiError(503, "Servicio temporalmente indisponible."));
    render(<OutboundOrderPage />);
    await screen.findByLabelText("Activo");
    chooseAsset("12");
    enterQuantity("2");
    chooseAllocation();
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Servicio temporalmente indisponible.");
  });
});
