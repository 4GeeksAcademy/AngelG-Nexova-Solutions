import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentList } from "@/components/IncidentList";
import { deleteManagedIncident, getManagedIncidents, transitionManagedIncident } from "@/lib/managed-incidents-api";
import { ManagedIncident } from "@/types/managed-incident";

vi.mock("@/lib/managed-incidents-api", () => ({ getManagedIncidents: vi.fn(), transitionManagedIncident: vi.fn(), deleteManagedIncident: vi.fn() }));
const mockedGet = vi.mocked(getManagedIncidents);
const mockedTransition = vi.mocked(transitionManagedIncident);
const fixture: ManagedIncident = {
  id: "v2-1", client_name: "Cliente Uno", channel: "email", type: "sla_breach", severity: "critical",
  responsible_area: "customer_support", title: "SLA de respuesta vencido", description: "Sin respuesta dentro del plazo.",
  status: "open", assigned_to: null, sla_deadline: "2026-07-01T08:00:00Z", resolved_at: null, closed_at: null,
  created_at: "2026-06-30T08:00:00Z", updated_at: "2026-06-30T08:00:00Z", is_archived: false,
};
const page = (items: ManagedIncident[]) => ({ items, total: items.length, limit: 100, offset: 0 });

describe("IncidentList", () => {
  beforeEach(() => vi.clearAllMocks());
  it("muestra carga mientras consulta", () => {
    mockedGet.mockReturnValue(new Promise(() => {}));
    render(<IncidentList />);
    expect(screen.getByText(/Cargando/)).toBeInTheDocument();
  });
  it("muestra incidencias y acciones permitidas según transición", async () => {
    mockedGet.mockResolvedValue(page([fixture]));
    render(<IncidentList />);
    expect(await screen.findByText(fixture.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover a Asignada" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("SLA vencido");
  });
  it("usa filtros nuevos y vuelve a consultar", async () => {
    mockedGet.mockResolvedValue(page([fixture]));
    render(<IncidentList />);
    await screen.findByText(fixture.title);
    fireEvent.change(screen.getByLabelText("Severidad"), { target: { value: "critical" } });
    await waitFor(() => expect(mockedGet).toHaveBeenLastCalledWith(expect.objectContaining({ severity: "critical", limit: 10, offset: 0 })));
  });
  it("permite reintentar tras error y representa estado vacío", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Fallo de red"));
    render(<IncidentList />);
    expect(await screen.findByText("Fallo de red")).toBeInTheDocument();
    mockedGet.mockResolvedValueOnce(page([]));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("No hay incidencias que coincidan con los filtros seleccionados.")).toBeInTheDocument();
  });
  it("persiste transiciones y refleja respuesta del servidor", async () => {
    mockedGet.mockResolvedValue(page([fixture]));
    mockedTransition.mockResolvedValue({ ...fixture, status: "assigned" });
    render(<IncidentList />);
    await screen.findByText(fixture.title);
    fireEvent.click(screen.getByRole("button", { name: "Mover a Asignada" }));
    await waitFor(() => expect(mockedTransition).toHaveBeenCalledWith("v2-1", "assigned"));
  });
  it("solicita páginas de 10 y reinicia la página al filtrar", async () => {
    mockedGet.mockResolvedValue({ items: [fixture], total: 12, limit: 10, offset: 0 });
    render(<IncidentList />);
    await screen.findByText(fixture.title);
    expect(mockedGet).toHaveBeenLastCalledWith({ limit: 10, offset: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    await waitFor(() => expect(mockedGet).toHaveBeenLastCalledWith({ limit: 10, offset: 10 }));
    fireEvent.change(await screen.findByLabelText("Severidad"), { target: { value: "high" } });
    await waitFor(() => expect(mockedGet).toHaveBeenLastCalledWith({ severity: "high", limit: 10, offset: 0 }));
  });
  it("busca en servidor y reinicia la página, no solo los diez resultados visibles", async () => {
    mockedGet.mockResolvedValue({ items: [fixture], total: 12, limit: 10, offset: 0 });
    render(<IncidentList />);
    await screen.findByText(fixture.title);
    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    const search = await screen.findByLabelText("Buscar incidencias");
    fireEvent.change(search, { target: { value: " Cliente Uno " } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(mockedGet).toHaveBeenLastCalledWith({ search: "Cliente Uno", limit: 10, offset: 0 }));
  });
  it("confirma antes del borrado y mantiene datos al cancelar o fallar", async () => {
    mockedGet.mockResolvedValue(page([fixture]));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const changed = vi.fn();
    render(<IncidentList onChanged={changed} />);
    await screen.findByText(fixture.title);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar incidencias" }));
    fireEvent.click(screen.getByRole("button", { name: `Eliminar ${fixture.title}` }));
    expect(deleteManagedIncident).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("toda su auditoría"));
    confirm.mockReturnValue(true);
    vi.mocked(deleteManagedIncident).mockRejectedValueOnce(new Error("Borrado rechazado"));
    fireEvent.click(screen.getByRole("button", { name: `Eliminar ${fixture.title}` }));
    expect(await screen.findByText("Borrado rechazado")).toBeInTheDocument();
    expect(screen.getByText(fixture.title)).toBeInTheDocument();
    vi.mocked(deleteManagedIncident).mockResolvedValueOnce();
    mockedGet.mockResolvedValueOnce(page([]));
    fireEvent.click(screen.getByRole("button", { name: `Eliminar ${fixture.title}` }));
    await screen.findByText("No hay incidencias que coincidan con los filtros seleccionados.");
    expect(deleteManagedIncident).toHaveBeenLastCalledWith(fixture.id);
    expect(changed).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });
});
