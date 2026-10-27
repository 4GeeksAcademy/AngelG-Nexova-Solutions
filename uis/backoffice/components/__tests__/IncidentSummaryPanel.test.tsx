import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentSummaryPanel } from "@/components/IncidentSummaryPanel";
import { getIncidentsSummary } from "@/lib/incidents-api";
import { IncidentSummary } from "@/types/incident";

vi.mock("@/lib/incidents-api", () => ({
  getIncidentsSummary: vi.fn(),
}));

const mockedGetIncidentsSummary = vi.mocked(getIncidentsSummary);

const summaryFixture: IncidentSummary = {
  total: 3,
  by_status: { open: 1, in_progress: 1, resolved: 1, discarded: 0 },
  by_category: {
    technical_failure: 1,
    process_error: 0,
    client_complaint: 1,
    candidate_issue: 0,
    staff_issue: 0,
    sla_breach: 1,
    data_quality: 0,
    other: 0,
  },
  by_origin: { customer: 1, branch: 1, internal: 1 },
  by_branch: { central: 1, valencia_operations: 1, miami_office: 1, remote: 0 },
};

const emptySummaryFixture: IncidentSummary = {
  total: 0,
  by_status: { open: 0, in_progress: 0, resolved: 0, discarded: 0 },
  by_category: {
    technical_failure: 0,
    process_error: 0,
    client_complaint: 0,
    candidate_issue: 0,
    staff_issue: 0,
    sla_breach: 0,
    data_quality: 0,
    other: 0,
  },
  by_origin: { customer: 0, branch: 0, internal: 0 },
  by_branch: { central: 0, valencia_operations: 0, miami_office: 0, remote: 0 },
};

describe("IncidentSummaryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el indicador de carga mientras se obtiene el resumen", () => {
    mockedGetIncidentsSummary.mockReturnValue(new Promise(() => {}));

    render(<IncidentSummaryPanel />);

    expect(screen.getByText(/Cargando datos del pipeline/)).toBeInTheDocument();
  });

  it("muestra el resumen con totales por estado, categoría, origen y sede", async () => {
    mockedGetIncidentsSummary.mockResolvedValueOnce(summaryFixture);

    render(<IncidentSummaryPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Total de incidencias:/)).toBeInTheDocument();
    });
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Por estado")).toBeInTheDocument();
    expect(screen.getByText("Por categoría")).toBeInTheDocument();
    expect(screen.getByText("Por origen")).toBeInTheDocument();
    expect(screen.getByText("Por sede")).toBeInTheDocument();
  });

  it("muestra un mensaje comprensible cuando falla la petición", async () => {
    mockedGetIncidentsSummary.mockRejectedValueOnce(new Error("Fallo de red"));

    render(<IncidentSummaryPanel />);

    await waitFor(() => {
      expect(screen.getByText("Fallo de red")).toBeInTheDocument();
    });
  });

  it("muestra mensaje informativo cuando no hay datos", async () => {
    mockedGetIncidentsSummary.mockResolvedValueOnce(emptySummaryFixture);

    render(<IncidentSummaryPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("Todavía no hay datos suficientes para mostrar un resumen."),
      ).toBeInTheDocument();
    });
  });
});
