import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "@/app/forgot-password/page";
import { forgotPasswordRequest } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  forgotPasswordRequest: vi.fn(),
}));

const forgotPasswordRequestMock = vi.mocked(forgotPasswordRequest);

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    forgotPasswordRequestMock.mockReset();
  });

  it("renderiza el formulario con el campo de email", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar enlace/i }),
    ).toBeInTheDocument();
  });

  it("permite introducir el email y realiza POST /auth/forgot-password", async () => {
    forgotPasswordRequestMock.mockResolvedValue({ message: "ok" });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await waitFor(() => {
      expect(forgotPasswordRequestMock).toHaveBeenCalledWith(
        "user@example.com",
      );
    });
  });

  it("muestra el mensaje de confirmación genérico tras el envío, exista o no el email", async () => {
    forgotPasswordRequestMock.mockResolvedValue({ message: "ok" });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "cualquiera@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent(
      "Si esa dirección está registrada, recibirás un enlace para restablecer tu contraseña.",
    );
  });

  it("no muestra mensajes que revelen si el email existe o no", async () => {
    forgotPasswordRequestMock.mockResolvedValue({ message: "ok" });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await screen.findByRole("status");

    expect(screen.queryByText(/no existe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no encontrado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no hay una cuenta/i)).not.toBeInTheDocument();
  });

  it("evita múltiples envíos mientras la petición está pendiente", async () => {
    let resolveRequest: (value: { message: string }) => void = () => {};
    forgotPasswordRequestMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });

    const button = screen.getByRole("button", { name: /enviar/i });
    fireEvent.click(button);
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(forgotPasswordRequestMock).toHaveBeenCalledTimes(1);

    resolveRequest({ message: "ok" });
  });
});
