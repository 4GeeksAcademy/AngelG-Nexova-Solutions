"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { INCIDENT_SEVERITY_CLASSES, INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_TRANSITIONS, MANAGED_INCIDENT_STATUS_LABELS, ManagedIncidentListItem, ManagedIncidentStatus, MANAGED_INCIDENT_TYPE_LABELS, RESPONSIBLE_AREA_LABELS } from "@/types/managed-incident";

export function IncidentCard({ incident, isUpdating, onChangeStatus, onDelete }: { incident: ManagedIncidentListItem; isUpdating: boolean; onChangeStatus: (status: ManagedIncidentStatus) => void; onDelete?: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setNow(Date.now()), 0); return () => window.clearTimeout(timer); }, []);
  const deadline = incident.sla_deadline ? new Date(incident.sla_deadline).getTime() : null;
  const isOpen = !["resolved", "closed"].includes(incident.status);
  const overdue = now !== null && incident.type === "sla_breach" && deadline !== null && deadline < now && isOpen;
  const dueSoon = now !== null && incident.type === "sla_breach" && deadline !== null && deadline >= now && deadline - now <= 24 * 60 * 60 * 1000 && isOpen;
  const nextStatuses = INCIDENT_STATUS_TRANSITIONS[incident.status];
  return <article className={`rounded-2xl border bg-white p-4 shadow-sm ${overdue ? "border-red-400" : "border-slate-200"}`}>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="text-lg font-semibold text-slate-900"><Link href={`/incidents/${encodeURIComponent(incident.id)}`} className="hover:text-cyan-800">{incident.title}</Link></h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{incident.description}</p></div>
      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${INCIDENT_SEVERITY_CLASSES[incident.severity]}`}>Severidad {INCIDENT_SEVERITY_LABELS[incident.severity]}</span>
    </div>
    <div className="mb-4 flex flex-wrap gap-2 text-sm text-slate-700">
      <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Estado: {MANAGED_INCIDENT_STATUS_LABELS[incident.status]}</span>
      <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Tipo: {MANAGED_INCIDENT_TYPE_LABELS[incident.type]}</span>
      <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Área: {RESPONSIBLE_AREA_LABELS[incident.responsible_area]}</span>
      {incident.assigned_to ? <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Asignada a: {incident.assigned_to}</span> : null}
      {incident.client_name ? <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Cliente: {incident.client_name}</span> : null}
    </div>
    {incident.type === "sla_breach" && incident.sla_deadline ? <p className={`mb-4 rounded-lg px-3 py-2 text-sm font-semibold ${overdue ? "bg-red-50 text-red-900" : dueSoon ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700"}`} role={overdue ? "alert" : "status"}>{overdue ? "⚠ SLA vencido" : dueSoon ? "◷ SLA próximo a vencer" : "Fecha límite SLA"}: {new Date(incident.sla_deadline).toLocaleString()}</p> : null}
    <div className="flex flex-wrap gap-2" role="group" aria-label={`Cambiar estado de ${incident.title}`}>
      {nextStatuses.map((status) => <button key={status} type="button" disabled={isUpdating} onClick={() => onChangeStatus(status)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">{isUpdating ? "Actualizando…" : `Mover a ${MANAGED_INCIDENT_STATUS_LABELS[status]}`}</button>)}
      <Link href={`/incidents/${encodeURIComponent(incident.id)}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">Ver detalle e historial</Link>
      {onDelete && <button type="button" disabled={isUpdating} onClick={onDelete} aria-label={`Eliminar ${incident.title}`} className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-300 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300">Eliminar definitivamente</button>}
    </div>
  </article>;
}
