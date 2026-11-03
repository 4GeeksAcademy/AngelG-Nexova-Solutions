import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserAdministration } from "@/components/UserAdministration";
import {
  createManagedUser,
  deleteManagedUser,
  forceManagedUserPasswordReset,
  getManagedUsers,
} from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  createManagedUser: vi.fn(),
  deleteManagedUser: vi.fn(),
  forceManagedUserPasswordReset: vi.fn(),
  getManagedUsers: vi.fn(),
}));

const managedUser = {
  id: "user-1",
  email: "supervisor@example.com",
  role: "supervisor" as const,
  is_active: true,
  created_at: "2026-11-01T00:00:00Z",
  name: "Supervisor",
};

describe("Administración de usuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(getManagedUsers).mockResolvedValue([managedUser]);
  });

  it("lista usuarios, crea una cuenta con rol seleccionable y muestra el estado del correo", async () => {
    vi.mocked(createManagedUser).mockResolvedValue({
      ...managedUser,
      id: "user-2",
      email: "new@example.com",
      password_setup_email_sent: true,
    });

    render(<UserAdministration />);
    expect(await screen.findByText("supervisor@example.com")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "supervisor" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(createManagedUser).toHaveBeenCalledWith({
      email: "new@example.com",
      role: "supervisor",
      name: null,
    }));
    expect(await screen.findByText(/Se envió un enlace de un solo uso/)).toBeInTheDocument();
  });

  it("requiere confirmación antes del reset y el borrado", async () => {
    vi.mocked(forceManagedUserPasswordReset).mockResolvedValue({ message: "Enlace enviado" });
    vi.mocked(deleteManagedUser).mockResolvedValue({ message: "Usuario eliminado" });
    render(<UserAdministration />);
    await screen.findByText("supervisor@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Forzar cambio de contraseña" }));
    await waitFor(() => expect(forceManagedUserPasswordReset).toHaveBeenCalledWith("user-1"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(deleteManagedUser).toHaveBeenCalledWith("user-1"));
    expect(screen.queryByText("supervisor@example.com")).not.toBeInTheDocument();
  });
});