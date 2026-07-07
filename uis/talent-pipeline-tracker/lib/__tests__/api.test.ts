import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRecord, getNotes, getRecordById, getRecords } from "@/lib/api";
import { Candidate } from "@/types/candidate";
import { Note } from "@/types/note";

const originalEnv = process.env;

const candidateFixture: Candidate = {
  id: "abc-1",
  full_name: "Elena Ruiz",
  email: "elena@example.com",
  phone: "+34 600 111 222",
  position: "Executive Assistant",
  linkedin_url: "https://linkedin.com/in/elena",
  cv_url: "https://files.example.com/cv.pdf",
  status: "in_progress",
  stage: "review",
  experience_years: 6,
  notes_count: 1,
  applied_at: "2026-07-01T10:00:00Z",
  updated_at: "2026-07-02T10:00:00Z",
};

const noteFixture: Note = {
  id: "note-1",
  record_id: "abc-1",
  content: "Buen fit para soporte ejecutivo.",
  created_at: "2026-07-02T11:00:00Z",
};

describe("lib/api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_API_URL: "https://api.nexova.local",
    };
  });

  it("obtiene candidaturas desde /records y devuelve data", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        page: 1,
        limit: 20,
        data: [candidateFixture],
      }),
    } as Response);

    const records = await getRecords();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/records",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(records).toHaveLength(1);
    expect(records[0].full_name).toBe("Elena Ruiz");
  });

  it("obtiene detalle por id", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => candidateFixture,
    } as Response);

    const record = await getRecordById("abc-1");

    expect(record.id).toBe("abc-1");
    expect(record.position).toBe("Executive Assistant");
  });

  it("crea candidatura con POST /records", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => candidateFixture,
    } as Response);

    await createRecord({
      full_name: "Elena Ruiz",
      email: "elena@example.com",
      phone: "+34 600 111 222",
      position: "Executive Assistant",
      experience_years: 6,
      linkedin_url: null,
      cv_url: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/records",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("obtiene notas y devuelve arreglo de data", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [noteFixture], meta: { total: 1 } }),
    } as Response);

    const notes = await getNotes("abc-1");

    expect(notes).toHaveLength(1);
    expect(notes[0].content).toContain("Buen fit");
  });

  it("lanza error si no existe NEXT_PUBLIC_API_URL", async () => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_API_URL;

    await expect(getRecords()).rejects.toThrow(
      "Falta NEXT_PUBLIC_API_URL en variables de entorno.",
    );
  });
});
