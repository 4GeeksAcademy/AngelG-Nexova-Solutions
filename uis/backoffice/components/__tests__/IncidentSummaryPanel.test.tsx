import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentSummaryPanel } from "@/components/IncidentSummaryPanel";
import { getManagedIncidentsSummary } from "@/lib/managed-incidents-api";
import { ManagedIncidentSummary } from "@/types/managed-incident";

vi.mock("@/lib/managed-incidents-api", () => ({ getManagedIncidentsSummary: vi.fn() }));
const mockedGetSummary = vi.mocked(getManagedIncidentsSummary);
const summary: ManagedIncidentSummary = {
  total: 4,
  by_status: { open: 2, assigned: 1, in_progress: 1 },
  by_severity: { critical: 1, high: 1, medium: 1, low: 1 },
  overdue_sla: 2,
};

describe("IncidentSummaryPanel", () => {
  beforeEach(() => vi.clearAllMocks());
  it("muestra carga mientras obtiene el resumen", () => {
    mockedGetSummary.mockReturnValue(new Promise(() => {}));
    render(<IncidentSummaryPanel />);
    expect(screen.getByText(/Cargando/)).toBeInTheDocument();
  });
  it("muestra total, distribución de severidad y SLA vencidos", async () => {
    mockedGetSummary.mockResolvedValue(summary);
    render(<IncidentSummaryPanel />);
    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());
    expect(screen.getByText(/Severidad Crítica/)).toBeInTheDocument();
    expect(screen.getByText("SLA vencidos")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
  it("expone error y permite reintentar", async () => {
    mockedGetSummary.mockRejectedValueOnce(new Error("Fallo de red"));
    render(<IncidentSummaryPanel />);
    expect(await screen.findByText("Fallo de red")).toBeInTheDocument();
    mockedGetSummary.mockRejectedValueOnce(new Error("No hay incidencias"));
    screen.getByRole("button", { name: "Reintentar" }).click();
    await waitFor(() => expect(mockedGetSummary).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No hay incidencias")).toBeInTheDocument();
  });
});
