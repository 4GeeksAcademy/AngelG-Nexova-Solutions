import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/components/ProtectedRoute";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isReady: false,
  authState: { status: "initializing" as string, user: null as null, message: "" },
  retryAuthentication: vi.fn(),
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
    authState.authState = { status: "anonymous", user: null, message: "" };
    authState.retryAuthentication.mockReset();
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

  it.each([
    ["initializing", { status: "initializing", user: null }],
    ["error", { status: "error", user: null, message: "offline" }],
  ] as const)("mantiene protegido el contenido durante %s y ofrece retry solo en error", (status, state) => {
    authState.isReady = status === "error";
    authState.authState = { ...state, message: "message" };
    render(<ProtectedRoute><p>Contenido protegido</p></ProtectedRoute>);
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
    if (status === "error") {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(authState.retryAuthentication).toHaveBeenCalledOnce();
      expect(replace).not.toHaveBeenCalled();
    } else {
      expect(replace).not.toHaveBeenCalled();
    }
  });
});
