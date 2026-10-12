import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InventoryProductsPage from "../page";
import { getInventoryProducts } from "@/lib/inventory";

vi.mock("@/lib/inventory", () => ({
  getInventoryProducts: vi.fn(),
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
    id: 1,
    name: 'Portátil 14" Business',
    sku: "NXV-IT-001",
    category: "hardware" as const,
    office: "Valencia" as const,
    current_stock: 0,
  },
  {
    id: 2,
    name: "Ratón ergonómico",
    sku: "NXV-PER-001",
    category: "peripherals" as const,
    office: "Miami" as const,
    current_stock: 4,
  },
  {
    id: 3,
    name: "Resma de papel A4",
    sku: "NXV-OFF-001",
    category: "office_supplies" as const,
    office: "Valencia" as const,
    current_stock: 16,
  },
  {
    id: 4,
    name: "Hub USB-C",
    sku: "NXV-PER-002",
    category: "peripherals" as const,
    office: "Miami" as const,
    current_stock: 10,
  },
];

const mockedGetProducts = vi.mocked(getInventoryProducts);

describe("InventoryProductsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga activos reales y muestra sus campos, stock y acciones con activo preseleccionado", async () => {
    mockedGetProducts.mockResolvedValue(products);

    render(<InventoryProductsPage />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText('Portátil 14" Business')).toBeInTheDocument();
    expect(screen.getByText("NXV-PER-001")).toBeInTheDocument();
    expect(screen.getByText("hardware")).toBeInTheDocument();
    expect(screen.getAllByText("Miami")).toHaveLength(2);
    expect(screen.getByLabelText("0 unidades, Sin stock")).toBeInTheDocument();
    expect(screen.getByLabelText("4 unidades, Stock bajo")).toBeInTheDocument();
    expect(screen.getByLabelText("10 unidades, Revisar stock")).toBeInTheDocument();
    expect(screen.getByLabelText("16 unidades, Stock saludable")).toBeInTheDocument();

    const inboundLink = screen.getByRole("link", {
      name: "Registrar entrada para Portátil 14\" Business",
    });
    const outboundLink = screen.getByRole("link", {
      name: "Registrar salida para Portátil 14\" Business",
    });
    expect(inboundLink).toHaveAttribute(
      "href",
      "/backoffice/inventory/orders/inbound?productId=1",
    );
    expect(outboundLink).toHaveAttribute(
      "href",
      "/backoffice/inventory/orders/outbound?productId=1",
    );
    expect(mockedGetProducts).toHaveBeenCalledOnce();
  });

  it("muestra el error legible devuelto por el servicio", async () => {
    mockedGetProducts.mockRejectedValue(new Error("No se encontró el recurso solicitado."));

    render(<InventoryProductsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se encontró el recurso solicitado.",
    );
  });

  it("muestra un estado vacío cuando la API no devuelve activos", async () => {
    mockedGetProducts.mockResolvedValue([]);

    render(<InventoryProductsPage />);

    expect(await screen.findByText("No hay activos registrados")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("deja de actualizar el estado si se desmonta mientras carga", async () => {
    let resolveProducts: ((value: typeof products) => void) | undefined;
    mockedGetProducts.mockReturnValue(
      new Promise((resolve) => {
        resolveProducts = resolve;
      }),
    );

    const { unmount } = render(<InventoryProductsPage />);
    unmount();

    resolveProducts?.(products);
    await waitFor(() => expect(mockedGetProducts).toHaveBeenCalledOnce());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
