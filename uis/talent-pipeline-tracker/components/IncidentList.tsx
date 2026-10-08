"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorMessage } from "@/components/ErrorMessage";
import { IncidentCard } from "@/components/IncidentCard";
import { IncidentFilters } from "@/components/IncidentFilters";
import { Loading } from "@/components/Loading";
import { getIncidents, updateIncidentStatus } from "@/lib/incidents-api";
import {
  Incident,
  IncidentBranch,
  IncidentCategory,
  IncidentOrigin,
  IncidentStatus,
} from "@/types/incident";

async function fetchIncidents(
  onSuccess: (data: Incident[]) => void,
  onError: (message: string) => void,
  onSettle: () => void,
) {
  try {
    const data = await getIncidents();
    onSuccess(data);
  } catch (error) {
    onError(error instanceof Error ? error.message : "Error inesperado al consultar incidencias.");
  } finally {
    onSettle();
  }
}

export function IncidentList() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "all">("all");
  const [originFilter, setOriginFilter] = useState<IncidentOrigin | "all">("all");
  const [branchFilter, setBranchFilter] = useState<IncidentBranch | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidents(
      (data) => {
        setIncidents(data);
        setLoadError(null);
      },
      setLoadError,
      () => setIsLoading(false),
    );
  }, []);

  function handleRetry() {
    setIsLoading(true);
    setLoadError(null);
    fetchIncidents(
      (data) => {
        setIncidents(data);
        setLoadError(null);
      },
      setLoadError,
      () => setIsLoading(false),
    );
  }

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
      const matchesOrigin = originFilter === "all" || incident.origin === originFilter;
      const matchesBranch = branchFilter === "all" || incident.branch === branchFilter;
      const matchesCategory = categoryFilter === "all" || incident.category === categoryFilter;
      return matchesStatus && matchesOrigin && matchesBranch && matchesCategory;
    });
  }, [incidents, statusFilter, originFilter, branchFilter, categoryFilter]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    originFilter !== "all" ||
    branchFilter !== "all" ||
    categoryFilter !== "all";

  async function handleChangeStatus(incident: Incident, nextStatus: IncidentStatus) {
    const previousIncidents = incidents;
    setStatusError(null);
    setUpdatingId(incident.id);
    setIncidents((current) =>
      current.map((item) => (item.id === incident.id ? { ...item, status: nextStatus } : item)),
    );

    try {
      const updated = await updateIncidentStatus(incident.id, nextStatus);
      setIncidents((current) => current.map((item) => (item.id === incident.id ? updated : item)));
    } catch (error) {
      setIncidents(previousIncidents);
      setStatusError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado de la incidencia.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) {
    return <Loading />;
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <ErrorMessage title="No se pudieron cargar las incidencias" message={loadError} />
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <IncidentFilters
        status={statusFilter}
        origin={originFilter}
        branch={branchFilter}
        category={categoryFilter}
        onStatusChange={setStatusFilter}
        onOriginChange={setOriginFilter}
        onBranchChange={setBranchFilter}
        onCategoryChange={setCategoryFilter}
      />

      {statusError ? (
        <ErrorMessage title="No se pudo actualizar el estado" message={statusError} />
      ) : null}

      {incidents.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Todavía no hay incidencias registradas.
        </p>
      ) : filteredIncidents.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {hasActiveFilters
            ? "No hay incidencias que coincidan con los filtros seleccionados."
            : "No hay incidencias para mostrar."}
        </p>
      ) : (
        <div className="grid gap-4">
          {filteredIncidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              isUpdating={updatingId === incident.id}
              onChangeStatus={(nextStatus) => handleChangeStatus(incident, nextStatus)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
