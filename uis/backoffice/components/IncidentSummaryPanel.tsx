"use client";
import { useEffect, useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Loading } from "@/components/Loading";
import { getManagedIncidentsSummary } from "@/lib/managed-incidents-api";
import { INCIDENT_SEVERITIES, INCIDENT_SEVERITY_CLASSES, INCIDENT_SEVERITY_LABELS, ManagedIncidentSummary } from "@/types/managed-incident";

export function IncidentSummaryPanel() {
  const [summary, setSummary] = useState<ManagedIncidentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  function load() {
    setLoading(true); setError(null);
    void getManagedIncidentsSummary().then(setSummary).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el resumen.")).finally(() => setLoading(false));
  }
  useEffect(() => { void getManagedIncidentsSummary().then(setSummary).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el resumen.")).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading />;
  if (error) return <div className="space-y-3"><ErrorMessage title="No se pudo cargar el resumen" message={error} /><button type="button" onClick={load} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Reintentar</button></div>;
  if (!summary) return null;
  return <section aria-label="Resumen de incidencias" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Total</p><p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p></div>
    {INCIDENT_SEVERITIES.map((severity) => <div key={severity} className={`rounded-xl border p-4 ${INCIDENT_SEVERITY_CLASSES[severity]}`}><p className="text-sm font-medium">Severidad {INCIDENT_SEVERITY_LABELS[severity]}</p><p className="mt-1 text-2xl font-bold">{summary.by_severity[severity] ?? 0}</p></div>)}
    <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950"><p className="text-sm font-semibold">SLA vencidos</p><p className="mt-1 text-2xl font-bold">{summary.overdue_sla}</p></div>
  </section>;
}
