import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CandidateCard } from "@/components/CandidateCard";
import { Candidate } from "@/types/candidate";

const candidateFixture: Candidate = {
  id: "cand-1",
  full_name: "Lucia Martinez",
  email: "lucia@example.com",
  phone: "+34 600 123 456",
  position: "Executive Assistant",
  linkedin_url: null,
  cv_url: null,
  status: "received",
  stage: "pending",
  experience_years: 4,
  notes_count: 0,
  applied_at: "2026-07-01T08:00:00Z",
  updated_at: "2026-07-01T09:00:00Z",
};

describe("CandidateCard", () => {
  it("renderiza datos clave con etiquetas visibles legibles", () => {
    render(<CandidateCard candidate={candidateFixture} />);

    expect(screen.getByText("Lucia Martinez")).toBeInTheDocument();
    expect(screen.getByText("Executive Assistant")).toBeInTheDocument();
    expect(screen.getByText(/Estado:/)).toBeInTheDocument();
    expect(screen.getByText(/Received/)).toBeInTheDocument();
    expect(screen.getByText(/Etapa:/)).toBeInTheDocument();
    expect(screen.getByText(/Pending review/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver detalle" })).toBeInTheDocument();
  });
});
