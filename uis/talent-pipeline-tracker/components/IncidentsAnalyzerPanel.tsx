"use client";

import { useMemo, useState } from "react";

import { analyzeIncidentsFile, downloadIncidentsCsv } from "@/lib/incidents-api";
import { IncidentAnalysisResult } from "@/types/incidents";

function formatAverage(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(2);
}

export function IncidentsAnalyzerPanel() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IncidentAnalysisResult | null>(null);

  const invalidTotal = useMemo(() => {
    if (!result) {
      return 0;
    }
    return Object.values(result.invalid.by_type).reduce((acc, value) => acc + value, 0);
  }, [result]);

  function onFileSelected(file: File | null) {
    setError(null);
    setSelectedFile(file);
  }

  async function onAnalyze() {
    if (!selectedFile) {
      setError("Selecciona un CSV antes de analizar.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const payload = await analyzeIncidentsFile(selectedFile);
      setResult(payload);
    } catch (analysisError) {
      setResult(null);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "No se pudo analizar el archivo.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function onDownload() {
    setIsDownloading(true);
    setError(null);
    try {
      const blob = await downloadIncidentsCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "results.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo descargar el resultado.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <header className="mb-6 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Nexova · Atencion al Cliente
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Analizador de Incidencias
          </h1>
          <p className="max-w-3xl text-sm text-slate-600 md:text-base">
            Sube un CSV para validar registros, clasificar incidencias invalidas y
            calcular metricas operativas.
          </p>
        </header>

        <div className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <label
            htmlFor="csv-file"
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center ${
              isDragging ? "border-cyan-500 bg-cyan-100" : "border-cyan-300 bg-white"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              onFileSelected(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <span className="text-sm font-medium text-slate-900">
              Arrastra tu CSV aqui o haz click para seleccionarlo
            </span>
            <span className="text-xs text-slate-600">
              El archivo se procesa internamente y no se envia a servicios externos.
            </span>
            {selectedFile ? (
              <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800">
                {selectedFile.name}
              </span>
            ) : null}
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isLoading}
              className="rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Analizando..." : "Analizar CSV"}
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={!result || isDownloading}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDownloading ? "Descargando..." : "Descargar resultados CSV"}
            </button>
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        {result ? (
          <div className="space-y-4">
            <section className="grid gap-3 md:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-600">Total procesados</h2>
                <p className="text-2xl font-bold text-slate-900">{result.totals.processed}</p>
              </article>
              <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h2 className="text-sm font-semibold text-emerald-700">Validos</h2>
                <p className="text-2xl font-bold text-emerald-900">{result.totals.valid}</p>
              </article>
              <article className="rounded-xl border border-red-200 bg-red-50 p-4">
                <h2 className="text-sm font-semibold text-red-700">Invalidos</h2>
                <p className="text-2xl font-bold text-red-900">{result.totals.invalid}</p>
              </article>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-2 text-base font-semibold text-slate-900">Por categoria</h3>
                <ul className="space-y-1 text-sm text-slate-700">
                  {Object.entries(result.by_category).map(([category, total]) => (
                    <li key={category} className="flex items-center justify-between">
                      <span>{category}</span>
                      <span className="font-semibold">{total}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-2 text-base font-semibold text-slate-900">Por estado</h3>
                <ul className="space-y-1 text-sm text-slate-700">
                  {Object.entries(result.by_status).map(([status, total]) => (
                    <li key={status} className="flex items-center justify-between">
                      <span>{status}</span>
                      <span className="font-semibold">{total}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <h3 className="mb-2 text-base font-semibold text-slate-900">Satisfaccion</h3>
              <p>
                Media en incidencias cerradas con puntuacion: <strong>{formatAverage(result.satisfaction.average_closed)}</strong>
              </p>
              <p>
                Incidencias cerradas validas: <strong>{result.satisfaction.closed_valid_records}</strong>
              </p>
              <p>
                Cerradas con puntuacion: <strong>{result.satisfaction.closed_with_score}</strong>
              </p>
              <ul className="mt-2 space-y-1">
                {Object.entries(result.satisfaction.distribution).map(([score, total]) => (
                  <li key={score} className="flex items-center justify-between">
                    <span>Puntaje {score}</span>
                    <span className="font-semibold">{total}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-base font-semibold text-slate-900">Registros invalidos</h3>
              <p className="mb-2 text-sm text-slate-700">
                Total de problemas de validacion: <strong>{invalidTotal}</strong>
              </p>
              <ul className="space-y-1 text-sm text-slate-700">
                {Object.entries(result.invalid.by_type).map(([errorType, total]) => (
                  <li key={errorType} className="flex items-center justify-between">
                    <span>{errorType}</span>
                    <span className="font-semibold">{total}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
