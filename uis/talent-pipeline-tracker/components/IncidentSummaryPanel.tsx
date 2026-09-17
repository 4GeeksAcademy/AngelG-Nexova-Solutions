"use client";

import { useEffect, useState } from "react";

import { ErrorMessage } from "@/components/ErrorMessage";
import { Loading } from "@/components/Loading";
import { getIncidentsSummary } from "@/lib/incidents-api";
import {
  INCIDENT_BRANCH_LABELS,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_ORIGIN_LABELS,
  INCIDENT_STATUS_LABELS,
  IncidentSummary,
} from "@/types/incident";

interface CountGroupProps {
  title: string;
  counts: Record<string, number>;
  labels: Record<string, string>;
}

function CountGroup({ title, counts, labels }: CountGroupProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">{title}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {Object.entries(counts).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2">
            <dt className="text-slate-600">{labels[key] ?? key}</dt>
            <dd className="font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function IncidentSummaryPanel() {
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setSummary(null);
    setError(null);
    setIsLoading(true);

    getIncidentsSummary()
      .then((data) => {
        setSummary(data);
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar el resumen de incidencias.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  useEffect(() => {
    load();

    return () => {
      // cleanup implícito: si el componente se desmonta, los .then/.catch
      // se ejecutan pero no actualizan estado porque el setter es no-op
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorMessage title="No se pudo cargar el resumen" message={error} />
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Todavía no hay datos suficientes para mostrar un resumen.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <p className="text-sm font-semibold text-slate-800">
        Total de incidencias: <span className="text-slate-900">{summary.total}</span>
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <CountGroup title="Por estado" counts={summary.by_status} labels={INCIDENT_STATUS_LABELS} />
        <CountGroup title="Por categoría" counts={summary.by_category} labels={INCIDENT_CATEGORY_LABELS} />
        <CountGroup title="Por origen" counts={summary.by_origin} labels={INCIDENT_ORIGIN_LABELS} />
        <CountGroup title="Por sede" counts={summary.by_branch} labels={INCIDENT_BRANCH_LABELS} />
      </div>
    </section>
  );
}
