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

export function IncidentCard({ incident, isUpdating, onChangeStatus }: IncidentCardProps) {
  const nextStatuses = INCIDENT_STATUS_TRANSITIONS[incident.status];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{incident.title}</h3>
          <p className="text-sm text-slate-600">{incident.description}</p>
        </div>
        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800">
          {INCIDENT_STATUS_LABELS[incident.status]}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Categoría:</span> {INCIDENT_CATEGORY_LABELS[incident.category]}
        </p>
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Origen:</span> {INCIDENT_ORIGIN_LABELS[incident.origin]}
        </p>
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Sede:</span> {INCIDENT_BRANCH_LABELS[incident.branch]}
        </p>
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Creada:</span>{" "}
          {new Date(incident.created_at).toLocaleDateString()}
        </p>
      </div>

      {nextStatuses.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={`Cambiar estado de ${incident.title}`}
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
