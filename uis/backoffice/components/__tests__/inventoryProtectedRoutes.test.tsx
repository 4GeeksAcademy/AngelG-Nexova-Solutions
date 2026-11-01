import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthGroupLayout from "@/app/(auth)/layout";
import InventoryPage from "@/app/(auth)/backoffice/inventory/page";
import { deleteInventoryItemPermanently, getInventoryItem, getInventoryItems, getInventoryLots, getInventoryMovements, saveInventoryItem } from "@/lib/managed-inventory-api";
import { ManagedInventoryDetail } from "@/components/ManagedInventory";
import type { InventoryItem } from "@/types/managed-inventory";

const { authState, replace } = vi.hoisted(() => ({
  authState: { isAuthenticated: true, isReady: true }, replace: vi.fn(),
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/lib/managed-inventory-api", () => ({
  getInventoryItems: vi.fn(), getInventoryItem: vi.fn(), getInventoryLots: vi.fn(),
  getInventoryMovements: vi.fn(), saveInventoryItem: vi.fn(), createInventoryMovement: vi.fn(),
  createInventoryLot: vi.fn(), deleteInventoryItem: vi.fn(), deleteInventoryItemPermanently: vi.fn(),
}));

const items: InventoryItem[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1, name: `Artículo ${index + 1}`, office: "valencia", category: "it_equipment",
  sku: `NXV-DEMO-${index + 1}`,
  unit_of_measure: "unit", reorder_point: "2.00", current_stock: "3.00",
  lot_tracked: false, reorder_alert: false, created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}));
describe("inventario único protegido y paginado", () => {
  beforeEach(() => {
    vi.clearAllMocks(); authState.isAuthenticated = true;
    vi.mocked(getInventoryItems).mockResolvedValue(items);
    vi.mocked(getInventoryItem).mockResolvedValue(items[0]);
    vi.mocked(getInventoryLots).mockResolvedValue([]);
    vi.mocked(getInventoryMovements).mockResolvedValue([{
      id: 1, item_id: 1, lot_id: null, movement_type: "inbound", quantity: "3.00",
      reason: null, created_at: "2026-01-01T00:00:00Z",
      supplier: "Proveedor ficticio", office: "miami", user_uuid: "autor-demo",
    }]);
  });
  it("muestra 10 artículos y navega a los restantes con detalles propios", async () => {
    render(<AuthGroupLayout><InventoryPage /></AuthGroupLayout>);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByRole("link", { name: "Ver Artículo 1 en Valencia" })).toHaveAttribute("href", "/backoffice/inventory/1");
    expect(screen.getByRole("link", { name: "Nuevo artículo" })).toHaveAttribute("href", "/backoffice/inventory/new");
    expect(screen.queryByText("Artículo 11")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("Artículo 11")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filtrar por oficina"), { target: { value: "miami" } });
    expect(screen.getByText("No hay artículos que coincidan con los filtros.")).toBeInTheDocument();
  });
  it("oculta la interfaz y no consulta artículos sin sesión", async () => {
    authState.isAuthenticated = false;
    render(<AuthGroupLayout><InventoryPage /></AuthGroupLayout>);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(getInventoryItems).not.toHaveBeenCalled();
  });
  it("busca entre todos los artículos y confirma el borrado persistente", async () => {
    render(<InventoryPage />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Buscar artículos"), { target: { value: "NXV-DEMO-12" } });
    expect(screen.getByText("Artículo 12")).toBeInTheDocument();
    expect(screen.queryByText("Artículo 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar artículos" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Artículo 12 en Valencia" }));
    expect(deleteInventoryItemPermanently).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("lotes y movimientos"));
    confirm.mockReturnValue(true);
    vi.mocked(deleteInventoryItemPermanently).mockRejectedValueOnce(new Error("No se pudo borrar"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Artículo 12 en Valencia" }));
    expect(await screen.findByText("No se pudo borrar")).toBeInTheDocument();
    expect(screen.getByText("Artículo 12")).toBeInTheDocument();
    vi.mocked(deleteInventoryItemPermanently).mockResolvedValueOnce();
    vi.mocked(getInventoryItems).mockResolvedValueOnce(items.slice(0, 11));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Artículo 12 en Valencia" }));
    await screen.findByText("No hay artículos que coincidan con los filtros.");
    expect(deleteInventoryItemPermanently).toHaveBeenLastCalledWith(12);
    confirm.mockRestore();
  });
  it("abre detalle propio y permite guardar oficina, unidad y control de lotes con historial", async () => {
    render(<ManagedInventoryDetail itemId={1} />);
    expect(await screen.findByText("Historial de movimientos")).toBeInTheDocument();
    expect(screen.getByText("Proveedor ficticio")).toBeInTheDocument();
    expect(screen.getByText("autor-demo")).toBeInTheDocument();
    expect(screen.getByText("SKU: NXV-DEMO-1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nuevo lote" })).toHaveAttribute("href", "/backoffice/inventory/1/lots/new");
    expect(screen.getByRole("link", { name: "Nuevo movimiento" })).toHaveAttribute("href", "/backoffice/inventory/1/movements/new");
    fireEvent.click(screen.getByRole("button", { name: "Editar artículo" }));
    expect(screen.getByRole("link", { name: "← Volver al inventario" })).toHaveAttribute("href", "/backoffice/inventory");
    expect(screen.getByLabelText("Oficina")).toBeEnabled();
    expect(screen.getByLabelText("Unidad")).toBeEnabled();
    expect(screen.getByLabelText("Control de lotes en cada movimiento")).toBeEnabled();
    expect(screen.getByLabelText("Nombre")).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Oficina"), { target: { value: "miami" } });
    fireEvent.change(screen.getByLabelText("Unidad"), { target: { value: "box" } });
    fireEvent.click(screen.getByLabelText("Control de lotes en cada movimiento"));
    vi.mocked(getInventoryItem).mockResolvedValue({
      ...items[0], office: "miami", unit_of_measure: "box", lot_tracked: true,
      updated_at: "2026-01-02T00:00:00Z",
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar artículo" }));
    await waitFor(() => expect(saveInventoryItem).toHaveBeenCalledWith({
      name: "Artículo 1", office: "miami", category: "it_equipment",
      sku: "NXV-DEMO-1",
      unit_of_measure: "box", reorder_point: "2.00", lot_tracked: true,
      telemetry_category: null, programme_id: null,
    }, 1));
    expect(await screen.findByText("Artículo actualizado.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar artículo" }));
    expect(screen.getByLabelText("Control de lotes en cada movimiento")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Control de lotes en cada movimiento"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar artículo" }));
    await waitFor(() => expect(saveInventoryItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ lot_tracked: false }), 1,
    ));
  });
});
