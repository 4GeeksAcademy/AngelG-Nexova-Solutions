import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChangePasswordPage from "@/app/(auth)/account/change-password/page";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { changePasswordRequest } from "@/lib/api-client";

const logoutMock = vi.fn();
const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ logout: logoutMock }),
}));

vi.mock("@/lib/api-client", () => ({
  changePasswordRequest: vi.fn(),
}));

const changePasswordRequestMock = vi.mocked(changePasswordRequest);

describe("Cambio de contraseña", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    changePasswordRequestMock.mockReset();
    logoutMock.mockReset();
  });

  it("redirige la ruta anterior al perfil", () => {
    ChangePasswordPage();

    expect(redirectMock).toHaveBeenCalledWith("/account/profile");
  });

  it("renderiza los tres campos del formulario dentro del perfil", () => {
    render(<ChangePasswordForm />);

    expect(screen.getByLabelText("Contraseña actual")).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva contraseña")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Confirmar nueva contraseña"),
    ).toBeInTheDocument();
  });

  it("valida coincidencia de contraseñas y no llama a la API si no coinciden", () => {
    render(<ChangePasswordForm />);

    fireEvent.change(screen.getByLabelText("Contraseña actual"), {
      target: { value: "OldPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "Different123!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /actualizar contraseña/i }),
    );

    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(changePasswordRequestMock).not.toHaveBeenCalled();
  });

  it("cierra sesión después de actualizar la contraseña", async () => {
    changePasswordRequestMock.mockResolvedValue({ message: "ok" });

    render(<ChangePasswordForm />);

    fireEvent.change(screen.getByLabelText("Contraseña actual"), {
      target: { value: "OldPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /actualizar contraseña/i }),
    );

    await waitFor(() => {
      expect(changePasswordRequestMock).toHaveBeenCalledWith(
        "OldPassword123!",
        "NewPassword123!",
      );
    });

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledOnce();
    });
  });

  it("muestra el error del backend cuando la contraseña actual es incorrecta", async () => {
    changePasswordRequestMock.mockRejectedValue(
      new Error("La contraseña actual es incorrecta"),
    );

    render(<ChangePasswordForm />);

    fireEvent.change(screen.getByLabelText("Contraseña actual"), {
      target: { value: "WrongPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /actualizar contraseña/i }),
    );

    expect(
      await screen.findByText("La contraseña actual es incorrecta"),
    ).toBeInTheDocument();
  });
});
