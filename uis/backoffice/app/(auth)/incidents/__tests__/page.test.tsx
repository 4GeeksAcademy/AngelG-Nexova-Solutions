import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import IncidentsPage from "@/app/(auth)/incidents/page";
import { IncidentDetail } from "@/components/IncidentDetail";
import { IncidentForm } from "@/components/IncidentForm";
import { archiveManagedIncident, getManagedIncident, getManagedIncidentHistory } from "@/lib/managed-incidents-api";
import type { ManagedIncident } from "@/types/managed-incident";

const { getManagedIncidentsMock, getManagedIncidentsSummaryMock } = vi.hoisted(() => ({
  getManagedIncidentsMock: vi.fn(),
  getManagedIncidentsSummaryMock: vi.fn(),
}));

vi.mock("@/lib/managed-incidents-api", () => ({
  getManagedIncidents: getManagedIncidentsMock,
  getManagedIncidentsSummary: getManagedIncidentsSummaryMock,
  transitionManagedIncident: vi.fn(),
  getManagedIncident: vi.fn(),
  getManagedIncidentHistory: vi.fn(),
  updateManagedIncident: vi.fn(),
  archiveManagedIncident: vi.fn(),
}));

const incident: ManagedIncident = {
  id: "fixture", client_name: null, channel: "email", type: "sla_breach", severity: "high",
  responsible_area: "technology", title: "Incidencia de prueba", description: "Descripción de prueba",
  assigned_to: null, status: "open", sla_deadline: "2026-11-01T12:00:37+02:00",
  resolved_at: null, closed_at: null, created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z", is_archived: false,
};

describe("IncidentsPage", () => {
  beforeEach(() => {
    getManagedIncidentsMock.mockReset();
    getManagedIncidentsSummaryMock.mockReset();
  });

  it("renderiza gestión de incidencias con enlaces a alta y analizador", () => {
    getManagedIncidentsMock.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });
    getManagedIncidentsSummaryMock.mockResolvedValue({ total: 0, by_status: {}, by_severity: {}, overdue_sla: 0 });

    render(<IncidentsPage />);

    expect(screen.getByRole("heading", { name: "Incidencias" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nueva incidencia" })).toHaveAttribute("href", "/incidents/new");
    expect(screen.getByRole("link", { name: "Analizar CSV" })).toHaveAttribute("href", "/incidents/analyzer");
  });
  it("conserva el instante y segundos del SLA al guardar sin editar la fecha", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<IncidentForm initialIncident={incident} onSubmit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear incidencia" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      sla_deadline: incident.sla_deadline,
    })));
  });
  it("archiva con confirmación, conserva el historial y oculta las mutaciones", async () => {
    vi.mocked(getManagedIncident).mockResolvedValue(incident);
    vi.mocked(getManagedIncidentHistory).mockResolvedValue([]);
    vi.mocked(archiveManagedIncident).mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<IncidentDetail incidentId="fixture" />);
    fireEvent.click(await screen.findByRole("button", { name: "Archivar incidencia" }));
    expect(await screen.findByText("Incidencia archivada. Se conservaron sus datos y el historial.")).toBeInTheDocument();
    expect(archiveManagedIncident).toHaveBeenCalledWith("fixture");
    expect(screen.getByText("Historial de auditoría")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar datos" })).not.toBeInTheDocument();
    confirm.mockRestore();
  });
});
