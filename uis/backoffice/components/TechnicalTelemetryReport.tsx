"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authRequest } from "@/lib/api-client";

interface TechnicalReport {
  generated_at: string;
  total_events: number;
  event_counts: { event_type: string; count: number }[];
  unknown_event_count: number;
  first_event_at: string | null;
  last_event_at: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  inbound_order_created: "Entrada de inventario registrada",
  outbound_order_created: "Salida de inventario registrada",
  stock_threshold_triggered: "Umbral mínimo de existencias alcanzado",
  direct_stock_edit_rejected: "Edición directa de existencias rechazada",
  kit_cost_variance_detected: "Variación del coste del kit detectada",
};

export function TechnicalTelemetryReport() {
  const [report, setReport] = useState<TechnicalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    authRequest<TechnicalReport>("/telemetry/report")
      .then((value) => { if (active) setReport(value); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo consultar la telemetría.");
      });
    return () => { active = false; };
  }, [attempt]);
  return <main className="min-h-screen px-4 py-8 md:px-10">
    <section className="inventory-page-card mx-auto grid max-w-5xl gap-6 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-lg sm:p-6 md:p-8">
      <header>
        <Link href="/backoffice/inventory" className="font-semibold text-cyan-800">← Volver al inventario</Link>
        <h1 className="mt-3 text-2xl font-bold">Reporte técnico de telemetría</h1>
        <p>Conteos históricos por tipo de evento. Sin datos personales ni eventos crudos. Acceso admin/manager.</p>
      </header>
      <button className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-700 px-4 py-2.5 font-semibold text-cyan-900 shadow-sm transition duration-200 hover:border-cyan-600 hover:bg-cyan-50 hover:shadow-md active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none sm:w-fit" onClick={() => { setReport(null); setError(null); setAttempt((value) => value + 1); }}>Actualizar</button>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      {!report && !error && <p role="status">Cargando telemetría…</p>}
      {report && <>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="inventory-surface-card rounded-2xl border border-slate-200 bg-white/60 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total de eventos</dt><dd className="mt-1 text-2xl font-bold">{report.total_events}</dd></div><div className="inventory-surface-card rounded-2xl border border-slate-200 bg-white/60 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tipos desconocidos</dt><dd className="mt-1 text-2xl font-bold">{report.unknown_event_count}</dd></div><div className="inventory-surface-card rounded-2xl border border-slate-200 bg-white/60 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Primer evento</dt><dd className="mt-1 text-sm font-semibold">{report.first_event_at ? new Date(report.first_event_at).toLocaleString("es") : "Sin eventos"}</dd></div><div className="inventory-surface-card rounded-2xl border border-slate-200 bg-white/60 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Último evento</dt><dd className="mt-1 text-sm font-semibold">{report.last_event_at ? new Date(report.last_event_at).toLocaleString("es") : "Sin eventos"}</dd></div></dl>
        <p className="text-sm text-slate-600">Calculado: {new Date(report.generated_at).toLocaleString("es")}</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">Conteos de eventos de inventario</caption>
          <thead><tr><th scope="col" className="p-3">Evento</th><th scope="col" className="p-3">Cantidad</th></tr></thead>
          <tbody>{report.event_counts.map((entry) => <tr key={entry.event_type} className="border-t"><td className="p-3">{EVENT_LABELS[entry.event_type] ?? `Otro evento (${entry.event_type})`}</td><td className="p-3">{entry.count}</td></tr>)}</tbody>
        </table></div>
      </>}
    </section>
  </main>;
}
