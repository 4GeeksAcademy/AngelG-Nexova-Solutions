"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  getLatestPipelineRun, getWeeklyReport, triggerPipeline,
  type PipelineRun, type WeeklyReport,
} from "@/lib/reporting-api";
import { inventoryOffices } from "@/types/managed-inventory";

const buttonClass = "rounded-lg border border-cyan-700 px-3 py-2 font-semibold text-cyan-900 disabled:opacity-50";

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "No se pudo consultar el reporte.";
}

export function WeeklyInventoryReport() {
  const { user } = useAuth();
  const [week, setWeek] = useState("");
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    getWeeklyReport(week).then((value) => {
      if (active) { setReport(value); setNotice(""); setError(null); }
    }).catch((cause: unknown) => {
      if (!active) return;
      setReport(null);
      if (cause instanceof ApiRequestError && cause.status === 404) {
        setNotice(cause.message); setError(null);
      } else { setError(errorMessage(cause)); setNotice(""); }
    }).finally(() => { if (active) setLoading(false); });
    getLatestPipelineRun().then((value) => {
      if (active) { setRun(value); setRunError(null); }
    }).catch((cause: unknown) => {
      if (active) {
        setRun(null);
        setRunError(errorMessage(cause));
      }
    });
    return () => { active = false; };
  }, [week, attempt]);

  function reload() { setLoading(true); setAttempt((value) => value + 1); }
  async function execute() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await triggerPipeline(week);
      setRun(result);
      setWeek(result.week_start);
      reload();
    } catch (cause) {
      setError(errorMessage(cause));
      // A failed POST can have persisted a failed run; refresh metadata separately.
      try { setRun(await getLatestPipelineRun()); setRunError(null); }
      catch (metadataError) { setRunError(errorMessage(metadataError)); }
    } finally { pending.current = false; setBusy(false); }
  }
  return <main className="min-h-screen px-4 py-8 md:px-10">
    <section className="mx-auto grid max-w-6xl gap-6 rounded-2xl border border-white/70 bg-white/90 p-5 shadow-lg md:p-8">
      <header className="border-b border-slate-200 pb-5">
        <Link href="/backoffice/inventory" className="font-semibold text-cyan-800">← Volver al inventario</Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">Reporte semanal de oficina y programa</h1>
        <p className="text-sm text-slate-600">Semanas de lunes a domingo UTC. Costos de entradas, salidas y anomalías de material clasificado para telemetría.</p>
      </header>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium">Lunes de la semana (vacío: última calculada)
          <input className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-950" type="date" value={week} disabled={busy} onChange={(event) => { setLoading(true); setWeek(event.target.value); }} />
        </label>
        <button className={buttonClass} onClick={reload} disabled={busy || loading}>Actualizar</button>
        {user && ["admin", "manager"].includes(user.role) && <button className={buttonClass} onClick={() => void execute()} disabled={busy || loading}>{busy ? "Calculando…" : week ? "Calcular esta semana" : "Calcular semana anterior"}</button>}
      </div>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      {runError && <p role="status">Estado del pipeline: {runError}</p>}
      {run && <section className="rounded-xl border bg-slate-50 p-4" aria-label="Última corrida">
        <h2 className="font-bold">Última corrida: {run.status === "succeeded" ? "Completada" : run.status === "failed" ? "Fallida" : "En ejecución"}</h2>
        <p>Semana: {run.week_start} · Inicio: {new Date(run.started_at).toLocaleString("es")} · Filas: {run.rows_written} · Eventos: {run.events_read}</p>
        {run.finished_at && <p>Finalización: {new Date(run.finished_at).toLocaleString("es")}</p>}
        {run.error_code && <p role="alert" className="text-red-800">Error: {run.error_code}. No se publicaron resultados parciales.</p>}
      </section>}
      {loading ? <p role="status">Cargando reporte…</p> : <>
        {notice && <p role="status">{notice}</p>}
        {report && <>
          <h2 className="text-lg font-bold">Semana del {report.week_start}</h2>
          <p className="text-sm text-slate-600">Entregas cuenta eventos de salida, no unidades. EUR y USD no se suman ni convierten. El historial previo a la captura no se incluye.</p>
          {report.entries.length === 0 ? <p>No hay eventos de material para esta semana calculada.</p> : <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Desempeño semanal por oficina y programa</caption>
              <thead className="bg-slate-100 text-slate-700"><tr>{["Oficina", "Programa", "Costo de material", "Entregas", "Escaseces", "Variaciones de costo"].map((label) => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead>
              <tbody>{report.entries.map((entry) => <tr key={`${entry.office}-${entry.programme_id}`} className="border-t hover:bg-cyan-50/50">
                <td className="px-4 py-3">{inventoryOffices[entry.office]}</td><td className="px-4 py-3">{entry.programme_id}</td>
                <td className="px-4 py-3">{entry.total_material_cost.toLocaleString("es", { style: "currency", currency: entry.currency })}</td>
                <td className="px-4 py-3">{entry.kits_delivered_count}</td><td className="px-4 py-3">{entry.shortage_events_count}</td><td className="px-4 py-3">{entry.cost_variance_events_count}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </>}
      </>}
    </section>
  </main>;
}
