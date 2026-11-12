import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewManagedUserPage from "@/app/(auth)/account/users/new/page";
import { createManagedUser } from "@/lib/api-client";

const { auth, push } = vi.hoisted(() => ({
  auth: { authState: { status: "authenticated", user: { role: "admin" } }, isReady: true, user: { role: "admin" } },
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("@/lib/api-client", () => ({ createManagedUser: vi.fn() }));

describe("vista de creación de cuenta administrada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.authState = { status: "authenticated", user: { role: "admin" } };
    auth.user = { role: "admin" };
  });

  it("permite al administrador crear una cuenta y confirma el envío de la configuración de contraseña", async () => {
    vi.mocked(createManagedUser).mockResolvedValue({
      id: "user-2",
      email: "new@example.com",
      role: "manager",
      is_active: true,
      created_at: "2026-11-01T00:00:00Z",
      name: "Nuevo usuario",
      password_setup_email_sent: true,
    });

    render(<NewManagedUserPage />);
    expect(screen.getByRole("heading", { name: "Crear cuenta" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Nuevo usuario" } });
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "manager" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(createManagedUser).toHaveBeenCalledWith({
      email: "new@example.com",
      role: "manager",
      name: "Nuevo usuario",
    }));
    expect(await screen.findByRole("status")).toHaveTextContent(/enlace de un solo uso/);
  });

  it("muestra error de API y permite volver a usuarios", async () => {
    vi.mocked(createManagedUser).mockRejectedValue(new Error("El correo ya existe."));
    render(<NewManagedUserPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "existing@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El correo ya existe.");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(push).toHaveBeenCalledWith("/account/profile?section=users");
  });

  it("no muestra el formulario para usuarios sin rol de administrador", () => {
    auth.authState = { status: "authenticated", user: { role: "user" } };
    auth.user = { role: "user" };

    render(<NewManagedUserPage />);
    expect(screen.getByText("No tienes permisos para crear cuentas.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });
});
