"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { IncidentForm } from "@/components/IncidentForm";
import { Loading } from "@/components/Loading";
import { archiveManagedIncident, getManagedIncident, getManagedIncidentHistory, transitionManagedIncident, updateManagedIncident } from "@/lib/managed-incidents-api";
import { CreateManagedIncidentPayload, IncidentAuditEvent, INCIDENT_STATUS_TRANSITIONS, ManagedIncident, ManagedIncidentStatus, MANAGED_INCIDENT_STATUS_LABELS } from "@/types/managed-incident";

const eventLabels: Record<string, string> = { created: "Incidencia creada", status: "Cambio de estado", assigned_to: "Cambio de asignación", responsible_area: "Cambio de área", archived: "Incidencia archivada" };
export function IncidentDetail({ incidentId }: { incidentId: string }) {
  const [incident, setIncident] = useState<ManagedIncident | null>(null);
  const [history, setHistory] = useState<IncidentAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const pendingAction = useRef(false);
  const [archived, setArchived] = useState(false);
  const [attempt, setAttempt] = useState(0);
  function load() { setLoading(true); setError(null); setAttempt((value) => value + 1); }
  useEffect(() => {
    let active = true;
    void Promise.all([getManagedIncident(incidentId), getManagedIncidentHistory(incidentId)])
      .then(([record, events]) => { if (active) { setIncident(record); setHistory(events); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar el detalle."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [incidentId, attempt]);
  async function transition(status: ManagedIncidentStatus) {
    if (pendingAction.current) return;
    pendingAction.current = true; setSaving(true);
    setActionError(null); setSuccess(null);
    try { setIncident(await transitionManagedIncident(incidentId, status)); setHistory(await getManagedIncidentHistory(incidentId)); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "No se pudo actualizar el estado."); }
    finally { pendingAction.current = false; setSaving(false); }
  }
  async function save(payload: CreateManagedIncidentPayload) {
    if (pendingAction.current) return;
    pendingAction.current = true;
    setSaving(true); setActionError(null); setSuccess(null);
    try { setIncident(await updateManagedIncident(incidentId, payload)); setHistory(await getManagedIncidentHistory(incidentId)); setEditing(false); setSuccess("Cambios guardados correctamente."); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "No se pudieron guardar los cambios."); }
    finally { pendingAction.current = false; setSaving(false); }
  }
  async function archive() {
    if (pendingAction.current || !window.confirm("¿Archivar esta incidencia? Se conservará su historial.")) return;
    pendingAction.current = true; setSaving(true); setActionError(null);
    try {
      await archiveManagedIncident(incidentId);
      setArchived(true);
      setHistory(await getManagedIncidentHistory(incidentId));
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "No se pudo completar el archivado."); }
    finally { pendingAction.current = false; setSaving(false); }
  }
  if (loading) return <Loading />;
  if (error || !incident) return <div className="space-y-3"><ErrorMessage title="No se pudo cargar la incidencia" message={error ?? "La incidencia no existe."} /><button type="button" onClick={() => void load()} className="rounded-lg border px-3 py-2 text-sm">Reintentar</button></div>;
  return <fieldset disabled={saving} className="space-y-6">
    {archived && <section className="space-y-4">
      <p role="status">Incidencia archivada. Se conservaron sus datos y el historial.</p>
      <Link href="/incidents" className="underline">Volver a incidencias</Link>
    </section>}
    {actionError ? <ErrorMessage title="No se pudo completar la acción" message={actionError} /> : null}
    {success ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p> : null}
    {!archived && <button type="button" onClick={() => void archive()} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-900">Archivar incidencia</button>}
    <fieldset disabled={archived} hidden={archived} className="space-y-4">
    {editing ? <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Editar incidencia</h2><IncidentForm initialIncident={incident} isSubmitting={saving} error={null} submitLabel="Guardar cambios" onSubmit={save} /><button type="button" onClick={() => setEditing(false)} className="mt-3 rounded-lg border px-3 py-2 text-sm">Cancelar edición</button></section> : <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-slate-900">{incident.title}</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{incident.description}</p></div><button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-900">Editar datos</button></div><dl className="mt-5 grid gap-3 sm:grid-cols-2"><Detail label="Estado" value={MANAGED_INCIDENT_STATUS_LABELS[incident.status]} /><Detail label="Área responsable" value={incident.responsible_area} /><Detail label="Severidad" value={incident.severity} /><Detail label="Tipo" value={incident.type} /><Detail label="Canal" value={incident.channel} /><Detail label="Asignado a" value={incident.assigned_to ?? "Sin asignar"} /><Detail label="Cliente" value={incident.client_name ?? "No especificado"} /><Detail label="Fecha límite SLA" value={incident.sla_deadline ? new Date(incident.sla_deadline).toLocaleString() : "No aplica"} /></dl><div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Transiciones de estado">{INCIDENT_STATUS_TRANSITIONS[incident.status].map((status) => <button key={status} type="button" onClick={() => void transition(status)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Cambiar a {MANAGED_INCIDENT_STATUS_LABELS[status]}</button>)}</div></section>}
    </fieldset>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Historial de auditoría</h2>{history.length === 0 ? <p className="mt-3 text-sm text-slate-600">No hay eventos en el historial.</p> : <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-5">{history.map((event) => <li key={event.id} className="relative"><span aria-hidden="true" className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full bg-cyan-700" /><p className="font-semibold text-slate-900">{eventLabels[event.change_type] ?? event.change_type}</p><p className="text-sm text-slate-700">{event.old_value ? `${event.old_value} → ` : ""}{event.new_value ?? "—"}</p><p className="text-xs text-slate-500">{new Date(event.occurred_at).toLocaleString()} · {event.actor_email ?? event.actor_id}</p></li>)}</ol>}</section>
  </fieldset>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-900">{value}</dd></div>; }
