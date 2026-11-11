import { authRequest } from "@/lib/api-client";
import {
  CreateManagedIncidentPayload,
  IncidentAuditEvent,
  ManagedIncident,
  ManagedIncidentFilters,
  ManagedIncidentListResponse,
  ManagedIncidentSummary,
  ManagedIncidentStatus,
  UpdateManagedIncidentPayload,
} from "@/types/managed-incident";

function queryString(filters: ManagedIncidentFilters = {}): string {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.size ? `?${query.toString()}` : "";
}

export async function getManagedIncidents(filters: ManagedIncidentFilters = {}): Promise<ManagedIncidentListResponse> {
  return authRequest<ManagedIncidentListResponse>(`/v2/incidents${queryString(filters)}`);
}

export async function getManagedIncident(id: string): Promise<ManagedIncident> {
  return authRequest<ManagedIncident>(`/v2/incidents/${encodeURIComponent(id)}`);
}

export async function createManagedIncident(payload: CreateManagedIncidentPayload): Promise<ManagedIncident> {
  return authRequest<ManagedIncident>("/v2/incidents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateManagedIncident(id: string, payload: UpdateManagedIncidentPayload): Promise<ManagedIncident> {
  return authRequest<ManagedIncident>(`/v2/incidents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function transitionManagedIncident(id: string, status: ManagedIncidentStatus): Promise<ManagedIncident> {
  return authRequest<ManagedIncident>(`/v2/incidents/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getManagedIncidentHistory(id: string): Promise<IncidentAuditEvent[]> {
  return authRequest<IncidentAuditEvent[]>(`/v2/incidents/${encodeURIComponent(id)}/history`);
}

export async function getManagedIncidentsSummary(): Promise<ManagedIncidentSummary> {
  return authRequest<ManagedIncidentSummary>("/v2/incidents/summary");
}

export function archiveManagedIncident(id: string): Promise<void> {
  return authRequest<void>(`/v2/incidents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function deleteManagedIncident(id: string): Promise<void> {
  return authRequest<void>(`/v2/incidents/${encodeURIComponent(id)}/permanent`, { method: "DELETE" });
}
