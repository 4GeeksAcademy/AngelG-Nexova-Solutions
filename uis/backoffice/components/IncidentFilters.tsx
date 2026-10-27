"use client";

import {
  INCIDENT_BRANCHES,
  INCIDENT_BRANCH_LABELS,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_ORIGINS,
  INCIDENT_ORIGIN_LABELS,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
  IncidentBranch,
  IncidentCategory,
  IncidentOrigin,
  IncidentStatus,
} from "@/types/incident";

interface IncidentFiltersProps {
  status: IncidentStatus | "all";
  origin: IncidentOrigin | "all";
  branch: IncidentBranch | "all";
  category: IncidentCategory | "all";
  onStatusChange: (value: IncidentStatus | "all") => void;
  onOriginChange: (value: IncidentOrigin | "all") => void;
  onBranchChange: (value: IncidentBranch | "all") => void;
  onCategoryChange: (value: IncidentCategory | "all") => void;
}

const selectClassName =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export function IncidentFilters({
  status,
  origin,
  branch,
  category,
  onStatusChange,
  onOriginChange,
  onBranchChange,
  onCategoryChange,
}: IncidentFiltersProps) {
  return (
    <div className="grid w-full gap-3 md:grid-cols-4">
      <label className="text-sm font-medium text-slate-700">
        Estado
        <select
          className={selectClassName}
          value={status}
          onChange={(event) => onStatusChange(event.target.value as IncidentStatus | "all")}
        >
          <option value="all">Todos los estados</option>
          {INCIDENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {INCIDENT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        Categoría
        <select
          className={selectClassName}
          value={category}
          onChange={(event) => onCategoryChange(event.target.value as IncidentCategory | "all")}
        >
          <option value="all">Todas las categorías</option>
          {INCIDENT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {INCIDENT_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        Origen
        <select
          className={selectClassName}
          value={origin}
          onChange={(event) => onOriginChange(event.target.value as IncidentOrigin | "all")}
        >
          <option value="all">Todos los orígenes</option>
          {INCIDENT_ORIGINS.map((value) => (
            <option key={value} value={value}>
              {INCIDENT_ORIGIN_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        Sede
        <select
          className={selectClassName}
          value={branch}
          onChange={(event) => onBranchChange(event.target.value as IncidentBranch | "all")}
        >
          <option value="all">Todas las sedes</option>
          {INCIDENT_BRANCHES.map((value) => (
            <option key={value} value={value}>
              {INCIDENT_BRANCH_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
