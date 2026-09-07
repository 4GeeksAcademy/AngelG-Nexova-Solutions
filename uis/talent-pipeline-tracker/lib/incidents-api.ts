import { authRequest } from "@/lib/api-client";
import { CreateIncidentPayload, Incident, IncidentStatus, IncidentSummary } from "@/types/incident";

export interface IncidentFilters {
  status?: IncidentStatus | "all";
  origin?: string | "all";
  branch?: string | "all";
  category?: string | "all";
}

export async function createIncident(payload: CreateIncidentPayload): Promise<Incident> {
  return authRequest<Incident>("/incidents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getIncidents(filters: IncidentFilters = {}): Promise<Incident[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return authRequest<Incident[]>(`/incidents${query ? `?${query}` : ""}`);
}

export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
): Promise<Incident> {
  return authRequest<Incident>(`/incidents/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getIncidentsSummary(): Promise<IncidentSummary> {
  return authRequest<IncidentSummary>("/incidents/summary");
}