import { IncidentAnalysisResult } from "@/types/incidents";

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
