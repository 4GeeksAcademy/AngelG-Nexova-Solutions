"use client";

import {
  INCIDENT_BRANCH_LABELS,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_ORIGIN_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_TRANSITIONS,
  Incident,
  IncidentStatus,
} from "@/types/incident";

interface IncidentCardProps {
  incident: Incident;
  isUpdating: boolean;
  onChangeStatus: (nextStatus: IncidentStatus) => void;
}

const INCIDENT_STATUS_BADGE_CLASSES: Record<IncidentStatus, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-sky-300 dark:text-sky-950",
  in_progress: "bg-gray-100 text-gray-800 dark:bg-gray-300 dark:text-gray-950",
  resolved: "bg-green-100 text-green-800 dark:bg-green-300 dark:text-green-950",
  discarded: "bg-red-100 text-red-800 dark:bg-red-300 dark:text-red-950",
};

export function IncidentCard({ incident, isUpdating, onChangeStatus }: IncidentCardProps) {
  const nextStatuses = incident ? INCIDENT_STATUS_TRANSITIONS[incident.status] : [];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{incident?.title ?? "—"}</h3>
          <p className="text-sm text-slate-600">{incident?.description ?? "—"}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${INCIDENT_STATUS_BADGE_CLASSES[incident.status]}`}
        >
          {incident ? INCIDENT_STATUS_LABELS[incident.status] : "—"}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Categoría:</span> {incident ? INCIDENT_CATEGORY_LABELS[incident.category] : "—"}
        </p>
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Origen:</span> {incident ? INCIDENT_ORIGIN_LABELS[incident.origin] : "—"}
        </p>
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Sede:</span> {incident ? INCIDENT_BRANCH_LABELS[incident.branch] : "—"}
        </p>
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Creada:</span>{" "}
          {incident?.created_at ? new Date(incident.created_at).toLocaleDateString() : "—"}
        </p>
      </div>

      {nextStatuses.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={`Cambiar estado de ${incident?.title ?? "incidencia"}`}
        >
          {nextStatuses.map((nextStatus) => (
            <button
              key={nextStatus}
              type="button"
              disabled={isUpdating}
              onClick={() => onChangeStatus(nextStatus)}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? "Actualizando..." : `Mover a ${INCIDENT_STATUS_LABELS[nextStatus]}`}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Estado final. No admite más cambios.</p>
      )}
    </article>
  );
}
