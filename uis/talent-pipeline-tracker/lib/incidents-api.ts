import { IncidentAnalysisResult } from "@/types/incidents";
import {
  CreateIncidentPayload,
  Incident,
  IncidentBranch,
  IncidentCategory,
  IncidentOrigin,
  IncidentStatus,
  IncidentSummary,
} from "@/types/incident";

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_INCIDENTS_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("Falta NEXT_PUBLIC_INCIDENTS_API_URL o NEXT_PUBLIC_API_URL en variables de entorno.");
  }
  return baseUrl.replace(/\/$/, "");
}

function buildIncidentsUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (baseUrl.endsWith("/api")) {
    return `${baseUrl}/incidents${normalizedPath}`;
  }

  return `${baseUrl}/api/incidents${normalizedPath}`;
}

function buildCrudIncidentsUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_INCIDENTS_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const normalizedPath = path.startsWith("?")
    ? path
    : path
      ? (path.startsWith("/") ? path : `/${path}`)
      : "";

  // The Next.js rewrite maps /api/* to the backend in the Compose setup.
  if (!baseUrl) {
    return `/api/incidents${normalizedPath}`;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const apiBaseUrl = normalizedBaseUrl.endsWith("/api")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/api`;
  return `${apiBaseUrl}/incidents${normalizedPath}`;
}

function toFieldErrors(fields: unknown): Record<string, string> | undefined {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [
      field,
      Array.isArray(value) ? value.join(", ") : String(value),
    ]),
  );
}

async function parseCrudError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = payload.detail;
      if (detail && typeof detail === "object") {
        const message = "message" in detail && typeof detail.message === "string"
          ? detail.message
          : fallback;
        const error = new Error(message) as Error & { fields?: Record<string, string> };
        if ("fields" in detail) {
          error.fields = toFieldErrors(detail.fields);
        }
        return error;
      }
      if (typeof detail === "string") {
        return new Error(detail);
      }
    }
  } catch {
    // Keep the endpoint-specific fallback when the response is not JSON.
  }

  return new Error(fallback);
}

async function crudRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildCrudIncidentsUrl(path), {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor de incidencias.");
  }

  if (!response.ok) {
    throw await parseCrudError(response, `Error HTTP ${response.status} al procesar incidencias.`);
  }

  return (await response.json()) as T;
}

export interface IncidentFilters {
  status?: IncidentStatus;
  origin?: IncidentOrigin;
  branch?: IncidentBranch;
  category?: IncidentCategory;
}

export async function getIncidents(filters: IncidentFilters = {}): Promise<Incident[]> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return crudRequest<Incident[]>(`${suffix}`);
}

export async function getIncidentById(incidentId: string): Promise<Incident> {
  return crudRequest<Incident>(`/${encodeURIComponent(incidentId)}`);
}

export async function createIncident(payload: CreateIncidentPayload): Promise<Incident> {
  return crudRequest<Incident>("", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateIncidentStatus(
  incidentId: string,
  status: IncidentStatus,
): Promise<Incident> {
  return crudRequest<Incident>(`/${encodeURIComponent(incidentId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getIncidentsSummary(): Promise<IncidentSummary> {
  return crudRequest<IncidentSummary>("/summary");
}

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error?.message
    ) {
      return String(payload.error.message);
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export async function analyzeIncidentsFile(file: File): Promise<IncidentAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(buildIncidentsUrl("/analyze"), {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await parseError(response, "No se pudo analizar el CSV.");
    throw new Error(message);
  }

  return (await response.json()) as IncidentAnalysisResult;
}

export async function downloadIncidentsCsv(): Promise<Blob> {
  const response = await fetch(buildIncidentsUrl("/results/export"), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await parseError(response, "No se pudo descargar el CSV.");
    throw new Error(message);
  }

  return await response.blob();
}
