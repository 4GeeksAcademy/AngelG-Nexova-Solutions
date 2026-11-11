import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "@/app/(auth)/account/profile/page";
import { getMe } from "@/lib/api-client";

const authState = { user: { role: "user" }, isAuthenticated: true, isReady: true };

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ ...authState, updateProfileName: vi.fn() }) }));
vi.mock("@/lib/api-client", () => ({
  getMe: vi.fn(),
  getManagedUsers: vi.fn().mockResolvedValue([]),
  updateMyProfile: vi.fn(),
}));

describe("Perfil con secciones bajo demanda", () => {
  beforeEach(() => {
    authState.user.role = "user";
    vi.mocked(getMe).mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      role: authState.user.role,
      profile: { name: "Person", phone: null, address: null },
    } as Awaited<ReturnType<typeof getMe>>);
  });

  it("carga la sección de contraseña al seleccionarla y no muestra administración a usuarios", async () => {
    render(<ProfilePage />);

    expect(await screen.findByText("Editar perfil")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña actual")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Administrar usuarios" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(await screen.findByLabelText("Contraseña actual")).toBeInTheDocument();
  });

  it("mantiene la administración diferida disponible solo para administradores", async () => {
    authState.user.role = "admin";
    vi.mocked(getMe).mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
      profile: { name: "Admin", phone: null, address: null },
    } as Awaited<ReturnType<typeof getMe>>);

    render(<ProfilePage />);
    expect(await screen.findByText("Editar perfil")).toBeInTheDocument();
    expect(screen.queryByText("Administración de usuarios")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Administrar usuarios" }));
    expect(await screen.findByText("Administración de usuarios")).toBeInTheDocument();
  });
});