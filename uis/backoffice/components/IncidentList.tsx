"use client";
import { useEffect, useRef, useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { IncidentCard } from "@/components/IncidentCard";
import { IncidentFilters, ManagedIncidentFilterValues } from "@/components/IncidentFilters";
import { Loading } from "@/components/Loading";
import { NumberedPagination } from "@/components/NumberedPagination";
import { deleteManagedIncident, getManagedIncidents, transitionManagedIncident } from "@/lib/managed-incidents-api";
import { ManagedIncidentListItem, ManagedIncidentStatus } from "@/types/managed-incident";

const emptyFilters: ManagedIncidentFilterValues = { severity: "all", type: "all", status: "all", responsible_area: "all" };
export function IncidentList({ onChanged }: { onChanged?: () => void }) {
  const [incidents, setIncidents] = useState<ManagedIncidentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const pendingAction = useRef(false);
  useEffect(() => {
    let active = true;
    void getManagedIncidents({
      ...(filters.status !== "all" ? { status: filters.status } : {}),
      ...(filters.severity !== "all" ? { severity: filters.severity } : {}),
      ...(filters.type !== "all" ? { type: filters.type } : {}),
      ...(filters.responsible_area !== "all" ? { responsible_area: filters.responsible_area } : {}),
      ...(search ? { search } : {}),
      limit: 10, offset: (page - 1) * 10,
    }).then((result) => {
      if (!active) return;
      if (page > 1 && (page - 1) * 10 >= result.total) {
        setPage(Math.max(1, Math.ceil(result.total / 10)));
        return;
      }
      setIncidents(result.items); setTotal(result.total); setError(null);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las incidencias.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page, attempt, search]);

  function reload() {
    setLoading(true); setError(null); setAttempt((value) => value + 1);
  }

  async function changeStatus(incident: ManagedIncidentListItem, status: ManagedIncidentStatus) {
    if (pendingAction.current) return;
    pendingAction.current = true;
    setUpdatingId(incident.id); setActionError(null);
    try {
      await transitionManagedIncident(incident.id, status);
      onChanged?.();
      reload();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "No se pudo actualizar el estado."); }
    finally { pendingAction.current = false; setUpdatingId(null); }
  }
  async function remove(incident: ManagedIncidentListItem) {
    if (pendingAction.current) return;
    if (!window.confirm(`¿Eliminar definitivamente "${incident.title}" y toda su auditoría? Esta acción no se puede deshacer.`)) return;
    pendingAction.current = true;
    setUpdatingId(incident.id); setActionError(null);
    try {
      await deleteManagedIncident(incident.id);
      onChanged?.();
      reload();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "No se pudo eliminar la incidencia."); }
    finally { pendingAction.current = false; setUpdatingId(null); }
  }
  if (loading) return <Loading />;
  if (error) return <div className="space-y-3"><ErrorMessage title="No se pudieron cargar las incidencias" message={error} /><button type="button" onClick={reload} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Reintentar</button></div>;
  return <section className="space-y-5">
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setSearch(searchDraft.trim()); setPage(1); reload(); }}>
      <label className="grid flex-1 gap-2 text-sm font-medium">Buscar incidencias
        <input type="search" maxLength={200} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Título, descripción, cliente, responsable o ID" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900" />
      </label>
      <button type="submit" className="rounded-lg border border-cyan-700 px-3 py-2 font-semibold text-cyan-800">Buscar</button>
      <button type="button" aria-pressed={deleteMode} disabled={updatingId !== null} onClick={() => setDeleteMode((value) => !value)} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        deleteMode
          ? "border-red-500 bg-red-600 text-white shadow-sm hover:bg-red-700 dark:border-red-400 dark:bg-red-500 dark:text-red-950 dark:hover:bg-red-400"
          : "border-red-400 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-400 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900"
      }`}>{deleteMode ? "Cancelar eliminación" : "Eliminar incidencias"}</button>
    </form>
    <IncidentFilters values={filters} onChange={(values) => { setFilters(values); setPage(1); setLoading(true); }} />
    <p role="status">{total} incidencias · Página {page}</p>
    {actionError ? <ErrorMessage title="No se pudo completar la acción" message={actionError} /> : null}
    {incidents.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No hay incidencias que coincidan con los filtros seleccionados.</p> : <div className="grid gap-4">{incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} isUpdating={updatingId !== null} onChangeStatus={(status) => void changeStatus(incident, status)} onDelete={deleteMode ? () => void remove(incident) : undefined} />)}</div>}
    <NumberedPagination page={page} total={total} onChange={(value) => { setPage(value); setLoading(true); }} />
  </section>;
}
