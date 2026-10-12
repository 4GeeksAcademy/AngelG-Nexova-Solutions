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
  const baseUrl = process.env.NEXT_PUBLIC_RECORDS_API_URL?.trim();

  if (!baseUrl) {
    if (typeof window !== "undefined") {
      return "/api";
    }
    const port = process.env.PORT ?? "3000";
    return `http://127.0.0.1:${port}/api`;
  }

  if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
    return baseUrl.replace(/\/$/, "");
  }

  if (baseUrl.startsWith("/")) {
    if (typeof window !== "undefined") {
      return baseUrl.replace(/\/$/, "");
    }
    const port = process.env.PORT ?? "3000";
    return `http://127.0.0.1:${port}${baseUrl.replace(/\/$/, "")}`;
  }

  return baseUrl.replace(/\/$/, "");
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Error HTTP ${response.status}`);
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
