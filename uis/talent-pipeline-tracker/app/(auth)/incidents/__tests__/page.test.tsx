import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import IncidentsPage from "@/app/(auth)/incidents/page";

const { getIncidentsMock, getIncidentsSummaryMock } = vi.hoisted(() => ({
  getIncidentsMock: vi.fn(),
  getIncidentsSummaryMock: vi.fn(),
}));

vi.mock("@/lib/incidents-api", () => ({
  getIncidents: getIncidentsMock,
  getIncidentsSummary: getIncidentsSummaryMock,
  updateIncidentStatus: vi.fn(),
}));

describe("IncidentsPage", () => {
  beforeEach(() => {
    getIncidentsMock.mockReset();
    getIncidentsSummaryMock.mockReset();
  });

  it("renderiza gestión de incidencias con enlaces a alta y analizador", () => {
    getIncidentsMock.mockResolvedValue([]);
    getIncidentsSummaryMock.mockResolvedValue({ total: 0, open: 0, in_progress: 0, resolved: 0 });

    render(<IncidentsPage />);

    expect(screen.getByRole("heading", { name: "Incidencias" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nueva incidencia" })).toHaveAttribute("href", "/incidents/new");
    expect(screen.getByRole("link", { name: "Analizar CSV" })).toHaveAttribute("href", "/incidents/analyzer");
  });
});
