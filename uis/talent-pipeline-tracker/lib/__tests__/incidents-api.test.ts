import { beforeEach, describe, expect, it, vi } from "vitest";

import { getIncidents, updateIncidentStatus } from "@/lib/incidents-api";
import { Incident } from "@/types/incident";

const incidentFixture: Incident = {
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

describe("lib/incidents-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("obtiene incidencias desde /incidents sin filtros", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [incidentFixture],
    } as Response);

    const incidents = await getIncidents();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/incidents",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(incidents).toHaveLength(1);
  });

  it("aplica filtros como query params, ignorando 'all'", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [incidentFixture],
    } as Response);

    await getIncidents({ status: "open", origin: "all", branch: "central" });

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain("/api/incidents?");
    expect(calledUrl).toContain("status=open");
    expect(calledUrl).toContain("branch=central");
    expect(calledUrl).not.toContain("origin=");
  });

  it("actualiza el estado con PATCH /incidents/:id/status", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...incidentFixture, status: "in_progress" }),
    } as Response);

    const updated = await updateIncidentStatus("inc-1", "in_progress");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/incidents/inc-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" }),
      }),
    );
    expect(updated.status).toBe("in_progress");
  });

  it("propaga el error con el campo cuando el backend rechaza la transición", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          detail: {
            code: "INVALID_STATUS_TRANSITION",
            message: "No se puede cambiar de resolved a open.",
            fields: { status: ["open"] },
          },
        }),
    } as Response);

    await expect(updateIncidentStatus("inc-1", "open")).rejects.toThrow(
      "No se puede cambiar de resolved a open.",
    );
  });

  it("propaga el error del backend al obtener incidencias", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: "No se pudieron obtener las incidencias" }),
    } as Response);

    await expect(getIncidents()).rejects.toThrow(
      "No se pudieron obtener las incidencias",
    );
  });
});
