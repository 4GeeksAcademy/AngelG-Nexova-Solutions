import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserAdministration } from "@/components/UserAdministration";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUsers,
  updateManagedUserPassword,
} from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  createManagedUser: vi.fn(),
  deleteManagedUser: vi.fn(),
  getManagedUsers: vi.fn(),
  updateManagedUserPassword: vi.fn(),
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
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "manager" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(createManagedUser).toHaveBeenCalledWith({
      email: "new@example.com",
      role: "manager",
      name: null,
    }));
    expect(await screen.findByText(/Se envió un enlace de un solo uso/)).toBeInTheDocument();
  });

  it("permite asignar una nueva contraseña directamente con confirmación y volver al listado", async () => {
    vi.mocked(updateManagedUserPassword).mockResolvedValue(managedUser);
    vi.mocked(deleteManagedUser).mockResolvedValue({ message: "Usuario eliminado" });
    render(<UserAdministration />);
    await screen.findByText("supervisor@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Forzar cambio de contraseña" }));
    expect(screen.getByText("Establecer contraseña para supervisor@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña actual/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /volver a administración de usuarios/i }));
    fireEvent.click(screen.getByRole("button", { name: "Forzar cambio de contraseña" }));
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "NewPassword123!" } });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: "NewPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    await waitFor(() => expect(updateManagedUserPassword).toHaveBeenCalledWith("user-1", "NewPassword123!"));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("supervisor@example.com"));
    expect(screen.getByRole("status")).toHaveTextContent("Contraseña actualizada");
    expect(screen.queryByText(/no se enviará ningún correo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar contraseña" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Forzar cambio de contraseña" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(deleteManagedUser).toHaveBeenCalledWith("user-1"));
    expect(screen.queryByText("supervisor@example.com")).not.toBeInTheDocument();
  });

  it("no guarda si se cancela la confirmación", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<UserAdministration />);
    await screen.findByText("supervisor@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Forzar cambio de contraseña" }));
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "NewPassword123!" } });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: "NewPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(updateManagedUserPassword).not.toHaveBeenCalled();
  });
});