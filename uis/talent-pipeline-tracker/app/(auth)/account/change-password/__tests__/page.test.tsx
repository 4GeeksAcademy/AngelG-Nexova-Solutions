import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChangePasswordPage from "@/app/(auth)/account/change-password/page";
import { changePasswordRequest } from "@/lib/api-client";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const logoutMock = vi.fn();
let isAuthenticatedValue = true;
let isReadyValue = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: isAuthenticatedValue,
    isReady: isReadyValue,
    logout: logoutMock,
  }),
}));

vi.mock("@/lib/api-client", () => ({
  changePasswordRequest: vi.fn(),
}));

const changePasswordRequestMock = vi.mocked(changePasswordRequest);

describe("ChangePasswordPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    changePasswordRequestMock.mockReset();
    logoutMock.mockReset();
    isAuthenticatedValue = true;
    isReadyValue = true;
  });

  it("renderiza los tres campos del formulario cuando el usuario está autenticado", () => {
    render(<ChangePasswordPage />);

    expect(screen.getByLabelText("Contraseña actual")).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva contraseña")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Confirmar nueva contraseña"),
    ).toBeInTheDocument();
  });

  it("redirige a /login si el usuario no está autenticado (protección de ruta existente)", async () => {
    isAuthenticatedValue = false;

    render(<ChangePasswordPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
    expect(
      screen.queryByLabelText("Contraseña actual"),
    ).not.toBeInTheDocument();
  });

  it("valida coincidencia de contraseñas y no llama a la API si no coinciden", () => {
    render(<ChangePasswordPage />);

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

    render(<ChangePasswordPage />);

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

    render(<ChangePasswordPage />);

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
