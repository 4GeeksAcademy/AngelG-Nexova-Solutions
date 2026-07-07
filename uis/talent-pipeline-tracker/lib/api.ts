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
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error("Falta NEXT_PUBLIC_API_URL en variables de entorno.");
  }

  return baseUrl;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
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
