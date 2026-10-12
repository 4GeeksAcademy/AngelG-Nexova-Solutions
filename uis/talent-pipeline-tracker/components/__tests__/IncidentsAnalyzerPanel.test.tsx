import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentsAnalyzerPanel } from "@/components/IncidentsAnalyzerPanel";
import * as incidentsApi from "@/lib/incidents-api";

const resultFixture = {
  totals: { processed: 10, valid: 6, invalid: 4 },
  by_category: { tecnologia: 2, retail: 3, finanzas: 1 },
  by_status: { abierto: 1, en_progreso: 1, cerrado: 3, descartado: 1 },
  satisfaction: {
    closed_with_score: 2,
    closed_valid_records: 2,
    average_closed: 3.75,
    distribution: { "1": 0, "2": 0, "3": 1, "4": 1, "5": 0 },
  },
  invalid: {
    by_type: {
      EMPTY_REQUIRED_FIELD: 1,
      INVALID_CATEGORY: 1,
      INVALID_STATUS: 1,
      INVALID_SATISFACTION: 1,
    },
    records: [],
  },
  export_rows: [],
};

describe("IncidentsAnalyzerPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra metricas al analizar un CSV", async () => {
    vi.spyOn(incidentsApi, "analyzeIncidentsFile").mockResolvedValue(resultFixture);

    render(<IncidentsAnalyzerPanel />);

    const input = document.getElementById("csv-file") as HTMLInputElement;
    const file = new File(["x,y\n1,2"], "incidents.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Analizar CSV" }));

    await waitFor(() => {
      expect(screen.getByText("Total procesados")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("Registros invalidos")).toBeInTheDocument();
    });
  });

  it("muestra errores de analisis de forma legible", async () => {
    vi.spyOn(incidentsApi, "analyzeIncidentsFile").mockRejectedValue(
      new Error("Faltan columnas obligatorias en CSV"),
    );

    render(<IncidentsAnalyzerPanel />);

    const input = document.getElementById("csv-file") as HTMLInputElement;
    const file = new File(["x,y\n1,2"], "broken.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Analizar CSV" }));

    await waitFor(() => {
      expect(screen.getByText("Faltan columnas obligatorias en CSV")).toBeInTheDocument();
    });
  });

  it("descarga resultados CSV despues de un analisis exitoso", async () => {
    vi.spyOn(incidentsApi, "analyzeIncidentsFile").mockResolvedValue(resultFixture);
    vi.spyOn(incidentsApi, "downloadIncidentsCsv").mockResolvedValue(
      new Blob(["section,metric,value"], { type: "text/csv" }),
    );

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<IncidentsAnalyzerPanel />);

    const input = document.getElementById("csv-file") as HTMLInputElement;
    const file = new File(["x,y\n1,2"], "incidents.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Analizar CSV" }));

    await waitFor(() => {
      expect(screen.getByText("Total procesados")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Descargar resultados CSV" }));

    await waitFor(() => {
      expect(incidentsApi.downloadIncidentsCsv).toHaveBeenCalledTimes(1);
    });

    clickSpy.mockRestore();
  });
});
