import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRecord, getNotes, getRecordById, getRecords } from "@/lib/api";
import { Candidate } from "@/types/candidate";
import { Note } from "@/types/note";

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

const originalEnv = { ...process.env };

describe("lib/api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_RECORDS_API_URL;
  });

  it("obtiene la primera página de candidaturas y devuelve data", async () => {
    localStorage.setItem("token", "test-access-token");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        page: 1,
        limit: 100,
        data: [candidateFixture],
      }),
    } as Response);

    const records = await getRecords();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/records?page=1&limit=100",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );
    expect(records).toHaveLength(1);
    expect(records[0].full_name).toBe("Elena Ruiz");
  });

  it("combina todas las páginas para mostrar más de cien candidaturas", async () => {
    const firstPageRecords = Array.from({ length: 100 }, (_, index) => ({
      ...candidateFixture,
      id: `candidate-${index + 1}`,
    }));
    const secondPageRecords = [
      { ...candidateFixture, id: "candidate-101", full_name: "Candidata 101" },
    ];
    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 101,
          page: 1,
          limit: 100,
          data: firstPageRecords,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 101,
          page: 2,
          limit: 100,
          data: secondPageRecords,
        }),
      } as Response);

    const records = await getRecords();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/records?page=1&limit=100",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/records?page=2&limit=100",
      expect.any(Object),
    );
    expect(records).toHaveLength(101);
    expect(records.at(-1)?.id).toBe("candidate-101");
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
      "/api/records",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          full_name: "Elena Ruiz",
          email: "elena@example.com",
          phone: "+34 600 111 222",
          position: "Executive Assistant",
          experience_years: 6,
          linkedin_url: null,
          cv_url: null,
        }),
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

  it("expone errores HTTP del backend en la respuesta", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: { message: "Error del servidor" } }),
    } as Response);

    await expect(getRecords()).rejects.toThrow("Error del servidor");
  });

  it("limpia el token y rechaza la carga cuando el backend responde 401", async () => {
    localStorage.setItem("token", "expired-test-token");
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: "No autorizado" }),
    } as Response);

    await expect(getRecords()).rejects.toThrow("Sesión expirada");
    expect(localStorage.getItem("token")).toBeNull();
  });

});
