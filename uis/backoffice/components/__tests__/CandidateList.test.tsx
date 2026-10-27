import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateList } from "@/components/CandidateList";
import { getRecords } from "@/lib/api";
import type { Candidate } from "@/types/candidate";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api", () => ({
  createRecord: vi.fn(),
  getRecords: vi.fn(),
}));

const candidate: Candidate = {
  id: "candidate-1",
  full_name: "Elena Ruiz",
  email: "elena@example.com",
  phone: "+34 600 111 222",
  position: "Executive Assistant",
  linkedin_url: null,
  cv_url: null,
  status: "in_progress",
  stage: "review",
  experience_years: 6,
  notes_count: 0,
  applied_at: "2026-07-01T10:00:00Z",
  updated_at: "2026-07-02T10:00:00Z",
};

describe("CandidateList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reintenta la carga y muestra los datos cuando el reintento tiene éxito", async () => {
    vi.mocked(getRecords)
      .mockRejectedValueOnce(new Error("Error temporal del servidor"))
      .mockResolvedValueOnce([candidate]);

    render(
      <CandidateList
        isCreateFormOpen={false}
        onToggleCreateForm={vi.fn()}
        isDeleteMode={false}
      />,
    );

    expect(await screen.findByText("Error temporal del servidor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(getRecords).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Elena Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Error temporal del servidor")).not.toBeInTheDocument();
  });

  it("mantiene visible un error HTTP claro si el reintento también falla", async () => {
    vi.mocked(getRecords)
      .mockRejectedValueOnce(new Error("Error temporal del servidor"))
      .mockRejectedValueOnce(new Error("Error HTTP 503: servicio no disponible"));

    render(
      <CandidateList
        isCreateFormOpen={false}
        onToggleCreateForm={vi.fn()}
        isDeleteMode={false}
      />,
    );

    expect(await screen.findByText("Error temporal del servidor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByText("Error HTTP 503: servicio no disponible"),
    ).toBeInTheDocument();
    expect(getRecords).toHaveBeenCalledTimes(2);
  });
});