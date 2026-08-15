import { beforeEach, describe, expect, it, vi } from "vitest";

import { analyzeIncidentsFile, downloadIncidentsCsv } from "@/lib/incidents-api";

const originalEnv = process.env;

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
});
