import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/components/ProtectedRoute";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isReady: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authState,
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAuthenticated = false;
    authState.isReady = true;
  });

  it("mantiene oculto el contenido sin sesión y redirige al login cuando auth queda listo", async () => {
    render(
      <ProtectedRoute>
        <p>Contenido protegido</p>
      </ProtectedRoute>,
    );

    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });
});
