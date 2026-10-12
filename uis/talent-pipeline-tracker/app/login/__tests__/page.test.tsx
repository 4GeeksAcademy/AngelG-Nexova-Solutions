import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    login: vi.fn(),
    isAuthenticated: false,
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
  });

  it('muestra el enlace "¿Olvidaste tu contraseña?"', () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("link", { name: /¿olvidaste tu contraseña\?/i }),
    ).toBeInTheDocument();
  });

  it("el enlace apunta a /forgot-password", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("link", { name: /¿olvidaste tu contraseña\?/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });
});
