import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  analyzeIncidentsFile,
  createIncident,
  downloadIncidentsCsv,
  getIncidentById,
  getIncidents,
  getIncidentsSummary,
  updateIncidentStatus,
} from "@/lib/incidents-api";
import { CreateIncidentPayload, Incident } from "@/types/incident";

const originalEnv = process.env;

const incidentFixture: Incident = {
  id: "inc-123",
  title: "Problema con acceso",
  description: "No se puede acceder al portal.",
  category: "technical_failure",
  status: "open",
  origin: "customer",
  branch: "central",
  created_at: "2026-05-01T10:00:00+00:00",
  updated_at: "2026-05-01T10:00:00+00:00",
};

const createPayload: CreateIncidentPayload = {
  title: incidentFixture.title,
  description: incidentFixture.description,
  category: incidentFixture.category,
  status: incidentFixture.status,
  origin: incidentFixture.origin,
  branch: incidentFixture.branch,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe("lib/incidents-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_INCIDENTS_API_URL: "https://api.nexova.local",
    };
  });

  it("envia CSV al endpoint de analisis", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        totals: { processed: 1, valid: 1, invalid: 0 },
        by_category: { tecnologia: 1 },
        by_status: { cerrado: 1 },
        satisfaction: {
          closed_with_score: 1,
          closed_valid_records: 1,
          average_closed: 4.0,
          distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 0 },
        },
        invalid: { by_type: {}, records: [] },
        export_rows: [],
      }),
    } as Response);

    const file = new File(["incidencia_id,categoria,estado,cliente\n1,tecnologia,cerrado,A"], "incidents.csv");
    const result = await analyzeIncidentsFile(file);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/api/incidents/analyze",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    expect(result.totals.valid).toBe(1);
  });

  it("descarga CSV de exportacion", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["section,metric,value"], { type: "text/csv" }),
    } as Response);

    const blob = await downloadIncidentsCsv();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/api/incidents/results/export",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(blob.type).toBe("text/csv");
  });

  it("no duplica /api cuando NEXT_PUBLIC_INCIDENTS_API_URL ya termina en /api", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_INCIDENTS_API_URL: "https://api.nexova.local/api",
    };

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        totals: { processed: 1, valid: 1, invalid: 0 },
        by_category: { TECHNICAL: 1 },
        by_status: { CLOSED: 1 },
        satisfaction: {
          closed_with_score: 1,
          closed_valid_records: 1,
          average_closed: 4.0,
          distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 0 },
        },
        invalid: { by_type: {}, records: [] },
        export_rows: [],
      }),
    } as Response);

    const file = new File(["x"], "incidents.csv", { type: "text/csv" });
    await analyzeIncidentsFile(file);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/api/incidents/analyze",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
  });

  it("propaga el error del backend al obtener incidencias", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: { message: "No se pudieron obtener las incidencias" } }),
    } as Response);

    await expect(getIncidents()).rejects.toThrow(
      "No se pudieron obtener las incidencias",
    );
  });

  it("obtiene el listado con filtros y cache desactivada", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse([incidentFixture]));

    await expect(getIncidents({ status: "open", branch: "central" })).resolves.toEqual([incidentFixture]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/api/incidents?status=open&branch=central",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("obtiene detalle y resumen desde las rutas CRUD respaldadas", async () => {
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse(incidentFixture))
      .mockResolvedValueOnce(jsonResponse({
        total: 1,
        by_status: { open: 1, in_progress: 0, resolved: 0, discarded: 0 },
        by_category: { technical_failure: 1 },
        by_origin: { customer: 1 },
        by_branch: { central: 1 },
      }));

    await expect(getIncidentById("inc 123")).resolves.toEqual(incidentFixture);
    await expect(getIncidentsSummary()).resolves.toMatchObject({ total: 1 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.nexova.local/api/incidents/inc%20123",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.nexova.local/api/incidents/summary",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("crea incidencia y envía el contrato JSON del backend", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse(incidentFixture, 201));

    await expect(createIncident(createPayload)).resolves.toEqual(incidentFixture);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/api/incidents",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
        cache: "no-store",
      }),
    );
  });

  it("actualiza estado por PATCH y expone errores de validación del backend", async () => {
    const updated = { ...incidentFixture, status: "in_progress" as const };
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(jsonResponse(updated))
      .mockResolvedValueOnce(jsonResponse({
        detail: {
          code: "INVALID_STATUS_TRANSITION",
          message: "No se puede cambiar el estado.",
          fields: { status: ["resolved"] },
        },
      }, 400));

    await expect(updateIncidentStatus("inc-123", "in_progress")).resolves.toEqual(updated);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.nexova.local/api/incidents/inc-123/status",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "in_progress" }) }),
    );

    await expect(updateIncidentStatus("inc-123", "resolved")).rejects.toMatchObject({
      message: "No se puede cambiar el estado.",
      fields: { status: "resolved" },
    });
  });

  it("usa la reescritura relativa /api en entorno Compose sin URL explícita", async () => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_INCIDENTS_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse([]));

    await getIncidents();

    expect(fetchMock).toHaveBeenCalledWith("/api/incidents", expect.any(Object));
  });
});
