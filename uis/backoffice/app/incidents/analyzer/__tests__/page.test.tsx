import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import IncidentsAnalyzerPage from "@/app/incidents/analyzer/page";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const authState = vi.hoisted(() => ({ isAuthenticated: false, isReady: true }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authState,
}));

describe("IncidentsAnalyzerPage", () => {
  it("no renderiza el analizador sin sesión y redirige al login", async () => {
    authState.isAuthenticated = false;
    authState.isReady = true;
    replace.mockReset();

    render(<IncidentsAnalyzerPage />);

    expect(screen.queryByRole("heading", { name: "Analizador de Incidencias" })).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("renderiza el analizador de CSV para una sesión autenticada", () => {
    authState.isAuthenticated = true;
    authState.isReady = true;
    replace.mockReset();

    render(<IncidentsAnalyzerPage />);

    expect(screen.getByRole("heading", { name: "Analizador de Incidencias" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analizar CSV" })).toBeInTheDocument();
  });
});
