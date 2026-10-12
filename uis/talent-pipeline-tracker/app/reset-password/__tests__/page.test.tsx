import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResetPasswordPage from "@/app/reset-password/page";
import { resetPasswordRequest } from "@/lib/api-client";

const pushMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock("@/lib/api-client", () => ({
  resetPasswordRequest: vi.fn(),
}));

const resetPasswordRequestMock = vi.mocked(resetPasswordRequest);

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    resetPasswordRequestMock.mockReset();
    searchParamsValue = new URLSearchParams();
  });

  it("obtiene el token desde el query string y renderiza el formulario", () => {
    searchParamsValue = new URLSearchParams("token=abc123");

    render(<ResetPasswordPage />);

    expect(screen.getByLabelText("Nueva contraseña")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Confirmar nueva contraseña"),
    ).toBeInTheDocument();
  });

  it("no envía la petición ni renderiza el formulario si no hay token", () => {
    searchParamsValue = new URLSearchParams();

    render(<ResetPasswordPage />);

    expect(
      screen.queryByLabelText("Nueva contraseña"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/enlace de restablecimiento no es válido/i),
    ).toBeInTheDocument();
    expect(resetPasswordRequestMock).not.toHaveBeenCalled();
  });

  it("proporciona un enlace de vuelta a /forgot-password cuando no hay token", () => {
    searchParamsValue = new URLSearchParams();

    render(<ResetPasswordPage />);

    expect(
      screen.getByRole("link", { name: /solicitar un nuevo enlace/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("no envía la petición si las contraseñas no coinciden", () => {
    searchParamsValue = new URLSearchParams("token=abc123");

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "Different123!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /restablecer contraseña/i }),
    );

    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(resetPasswordRequestMock).not.toHaveBeenCalled();
  });

  it("llama a /auth/reset-password y ante éxito redirige a /login mostrando feedback", async () => {
    searchParamsValue = new URLSearchParams("token=abc123");
    resetPasswordRequestMock.mockResolvedValue({ message: "ok" });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /restablecer contraseña/i }),
    );

    await waitFor(() => {
      expect(resetPasswordRequestMock).toHaveBeenCalledWith(
        "abc123",
        "Password123!",
      );
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/login");
    });

    expect(
      screen.getByText(/tu contraseña ha sido restablecida correctamente/i),
    ).toBeInTheDocument();
  });

  it("ante token inválido o expirado muestra un mensaje claro", async () => {
    searchParamsValue = new URLSearchParams("token=abc123");
    resetPasswordRequestMock.mockRejectedValue(new Error("Token inválido"));

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /restablecer contraseña/i }),
    );

    expect(
      await screen.findByText(/enlace de restablecimiento no es válido/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /solicitar un nuevo enlace/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });
});
