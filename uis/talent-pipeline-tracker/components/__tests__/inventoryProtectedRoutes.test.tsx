import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthGroupLayout from "@/app/(auth)/layout";
import InventoryProductsPage from "@/app/(auth)/backoffice/inventory/products/page";
import InboundOrderPage from "@/app/(auth)/backoffice/inventory/orders/inbound/page";
import OutboundOrderPage from "@/app/(auth)/backoffice/inventory/orders/outbound/page";
import OrdersPage from "@/app/(auth)/backoffice/inventory/orders/page";
import {
  getInventoryOrders,
  getInventoryProducts,
} from "@/lib/inventory";

const { authState, replace } = vi.hoisted(() => ({
  authState: { isAuthenticated: true, isReady: true },
  replace: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authState,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/inventory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/inventory")>();
  return {
    ...actual,
    getInventoryOrders: vi.fn(),
    getInventoryProducts: vi.fn(),
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

const routes = [
  {
    url: "/backoffice/inventory/products",
    heading: "Inventario de activos",
    Page: InventoryProductsPage,
  },
  {
    url: "/backoffice/inventory/orders/inbound",
    heading: "Registrar entrada de activos",
    Page: InboundOrderPage,
  },
  {
    url: "/backoffice/inventory/orders/outbound",
    heading: "Registrar salida de activos",
    Page: OutboundOrderPage,
  },
  {
    url: "/backoffice/inventory/orders",
    heading: "Historial de órdenes",
    Page: OrdersPage,
  },
] as const;

const mockedGetInventoryOrders = vi.mocked(getInventoryOrders);
const mockedGetInventoryProducts = vi.mocked(getInventoryProducts);

describe("protección de rutas de inventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.isReady = true;
    mockedGetInventoryOrders.mockResolvedValue([]);
    mockedGetInventoryProducts.mockResolvedValue([]);
  });

  it.each(routes)("permite acceder a $url con sesión válida", async ({ Page, heading }) => {
    render(
      <AuthGroupLayout>
        <Page />
      </AuthGroupLayout>,
    );

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(routes)("oculta $url y redirige sin sesión válida", async ({ Page, heading }) => {
    authState.isAuthenticated = false;

    render(
      <AuthGroupLayout>
        <Page />
      </AuthGroupLayout>,
    );

    expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
