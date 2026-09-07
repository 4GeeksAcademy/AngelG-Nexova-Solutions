import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentList } from "@/components/IncidentList";
import { getIncidents, updateIncidentStatus } from "@/lib/incidents-api";
import { Incident } from "@/types/incident";

vi.mock("@/lib/incidents-api", () => ({
  getIncidents: vi.fn(),
  updateIncidentStatus: vi.fn(),
}));

const mockedGetIncidents = vi.mocked(getIncidents);
const mockedUpdateIncidentStatus = vi.mocked(updateIncidentStatus);

const openIncident: Incident = {
  id: "inc-1",
  title: "No funciona el acceso al ATS",
  description: "El equipo no puede iniciar sesión.",
  category: "technical_failure",
  status: "open",
  origin: "internal",
  branch: "valencia_operations",
  created_at: "2026-07-01T08:00:00Z",
  updated_at: "2026-07-01T08:00:00Z",
};

const resolvedIncident: Incident = {
  id: "inc-2",
  title: "Queja de cliente por retraso en soporte",
  description: "El SLA de 24h no se cumplió.",
  category: "client_complaint",
  status: "resolved",
  origin: "customer",
  branch: "central",
  created_at: "2026-07-02T08:00:00Z",
  updated_at: "2026-07-03T08:00:00Z",
};

describe("IncidentList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el indicador de carga mientras se obtienen los datos", async () => {
    mockedGetIncidents.mockReturnValue(new Promise(() => {}));

    render(<IncidentList />);

    expect(screen.getByText(/Cargando datos del pipeline/)).toBeInTheDocument();
  });

  it("muestra error comprensible y permite reintentar", async () => {
    mockedGetIncidents.mockRejectedValueOnce(new Error("Fallo de red"));

    render(<IncidentList />);

    await waitFor(() => {
      expect(screen.getByText("Fallo de red")).toBeInTheDocument();
    });

    mockedGetIncidents.mockResolvedValueOnce([openIncident]);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByText(openIncident.title)).toBeInTheDocument();
    });
    expect(mockedGetIncidents).toHaveBeenCalledTimes(2);
  });

  it("muestra mensaje informativo cuando no hay incidencias", async () => {
    mockedGetIncidents.mockResolvedValueOnce([]);

    render(<IncidentList />);

    await waitFor(() => {
      expect(screen.getByText("Todavía no hay incidencias registradas.")).toBeInTheDocument();
    });
  });

  it("renderiza las incidencias obtenidas", async () => {
    mockedGetIncidents.mockResolvedValueOnce([openIncident, resolvedIncident]);

    render(<IncidentList />);

    await waitFor(() => {
      expect(screen.getByText(openIncident.title)).toBeInTheDocument();
    });
    expect(screen.getByText(resolvedIncident.title)).toBeInTheDocument();
  });

  it("muestra mensaje de sin resultados cuando los filtros no coinciden con nada", async () => {
    mockedGetIncidents.mockResolvedValueOnce([openIncident]);

    render(<IncidentList />);

    await waitFor(() => {
      expect(screen.getByText(openIncident.title)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: "client_complaint" },
    });

    expect(
      screen.getByText("No hay incidencias que coincidan con los filtros seleccionados."),
    ).toBeInTheDocument();
    expect(screen.queryByText(openIncident.title)).not.toBeInTheDocument();
  });

  it("actualiza el estado tras confirmar la transición en el backend", async () => {
    mockedGetIncidents.mockResolvedValueOnce([openIncident]);
    mockedUpdateIncidentStatus.mockResolvedValueOnce({
      ...openIncident,
      status: "in_progress",
    });

    render(<IncidentList />);

    await waitFor(() => {
      expect(screen.getByText(openIncident.title)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Mover a in_progress/ }));

    await waitFor(() => {
      expect(mockedUpdateIncidentStatus).toHaveBeenCalledWith("inc-1", "in_progress");
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Mover a resolved/ })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Mover a discarded/ })).toBeInTheDocument();
  });

  it("restaura el estado anterior y muestra error si el PATCH falla", async () => {
    mockedGetIncidents.mockResolvedValueOnce([openIncident]);
    mockedUpdateIncidentStatus.mockRejectedValueOnce(new Error("No se pudo actualizar"));

    render(<IncidentList />);

    await waitFor(() => {
      expect(screen.getByText(openIncident.title)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Mover a in_progress/ }));

    await waitFor(() => {
      expect(screen.getByText("No se pudo actualizar")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Mover a in_progress/ })).toBeInTheDocument();
  });
});
