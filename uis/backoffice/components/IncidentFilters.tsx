"use client";
import { INCIDENT_SEVERITIES, INCIDENT_SEVERITY_LABELS, MANAGED_INCIDENT_STATUSES, MANAGED_INCIDENT_STATUS_LABELS, MANAGED_INCIDENT_TYPES, MANAGED_INCIDENT_TYPE_LABELS, RESPONSIBLE_AREAS, RESPONSIBLE_AREA_LABELS, IncidentSeverity, ManagedIncidentStatus, ManagedIncidentType, ResponsibleArea } from "@/types/managed-incident";

export interface ManagedIncidentFilterValues {
  severity: IncidentSeverity | "all";
  type: ManagedIncidentType | "all";
  status: ManagedIncidentStatus | "all";
  responsible_area: ResponsibleArea | "all";
}
export function IncidentFilters({ values, onChange }: { values: ManagedIncidentFilterValues; onChange: (values: ManagedIncidentFilterValues) => void }) {
  const selectClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
  return <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros de incidencias">
    <Filter label="Severidad" value={values.severity} className={selectClass} options={[["all", "Todas las severidades"], ...INCIDENT_SEVERITIES.map((v) => [v, INCIDENT_SEVERITY_LABELS[v]] as [string, string])]} onChange={(v) => onChange({ ...values, severity: v as ManagedIncidentFilterValues["severity"] })} />
    <Filter label="Área" value={values.responsible_area} className={selectClass} options={[["all", "Todas las áreas"], ...RESPONSIBLE_AREAS.map((v) => [v, RESPONSIBLE_AREA_LABELS[v]] as [string, string])]} onChange={(v) => onChange({ ...values, responsible_area: v as ManagedIncidentFilterValues["responsible_area"] })} />
    <Filter label="Tipo" value={values.type} className={selectClass} options={[["all", "Todos los tipos"], ...MANAGED_INCIDENT_TYPES.map((v) => [v, MANAGED_INCIDENT_TYPE_LABELS[v]] as [string, string])]} onChange={(v) => onChange({ ...values, type: v as ManagedIncidentFilterValues["type"] })} />
    <Filter label="Estado" value={values.status} className={selectClass} options={[["all", "Todos los estados"], ...MANAGED_INCIDENT_STATUSES.map((v) => [v, MANAGED_INCIDENT_STATUS_LABELS[v]] as [string, string])]} onChange={(v) => onChange({ ...values, status: v as ManagedIncidentFilterValues["status"] })} />
  </div>;
}
function Filter({ label, value, options, onChange, className }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; className: string }) {
  const id = `incident-filter-${label.toLowerCase()}`;
  return <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}<select id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
