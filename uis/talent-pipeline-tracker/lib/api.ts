import {
  Candidate,
  CreateCandidatePayload,
  PatchCandidatePayload,
  UpdateCandidatePayload,
} from "@/types/candidate";
import { AddNotePayload, Note, NotesResponse } from "@/types/note";

interface RecordsResponse {
  total: number;
  page: number;
  limit: number;
  data: Candidate[];
}

function getApiBaseUrl(): string {
  return "/api";
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // /records requiere sesión iniciada; se adjunta el token igual que en api-client.
  const token = getToken();

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let detail = `Error HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.detail) {
        detail = typeof parsed.detail === "string" ? parsed.detail : (parsed.detail.message ?? detail);
      }
    } catch {
      // Si no es JSON válido, usar mensaje genérico
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getRecords(): Promise<Candidate[]> {
  const payload = await request<RecordsResponse>("/records");
  return payload.data;
}

export async function getRecordById(id: string): Promise<Candidate> {
  return request<Candidate>(`/records/${id}`);
}

export async function patchRecord(
  id: string,
  payload: PatchCandidatePayload,
): Promise<Candidate> {
  return request<Candidate>(`/records/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createRecord(
  payload: CreateCandidatePayload,
): Promise<Candidate> {
  return request<Candidate>("/records", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRecord(
  id: string,
  payload: UpdateCandidatePayload,
): Promise<Candidate> {
  return request<Candidate>(`/records/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getNotes(id: string): Promise<Note[]> {
  const payload = await request<NotesResponse>(`/records/${id}/notes`);
  return payload.data;
}

export async function addNote(
  id: string,
  payload: AddNotePayload,
): Promise<Note> {
  return request<Note>(`/records/${id}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteNote(id: string, noteId: string): Promise<void> {
  await request<void>(`/records/${id}/notes/${noteId}`, {
    method: "DELETE",
  });
}
