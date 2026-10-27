import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import Home from "@/app/(auth)/page";
import RootLayout from "@/app/layout";
import { AuthenticatedNavigation } from "@/components/AuthenticatedNavigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const { replace, logout, pathname } = vi.hoisted(() => ({
  replace: vi.fn(),
  logout: vi.fn(),
  pathname: { current: "/" },
}));

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isReady: false,
  user: { name: "Prueba", email: "person@example.com" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname.current,
}));

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans" }),
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth-context", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ ...authState, login: vi.fn(), register: vi.fn(), logout }),
}));

vi.mock("@/components/CandidateList", () => ({
  CandidateList: () => <div>Pipeline candidates</div>,
}));

describe("authenticated navigation", () => {
  it("keeps internal navigation out of the public login and root layout", () => {
    authState.isAuthenticated = false;
    authState.isReady = true;

    const markup = renderToString(
      <RootLayout>
        <LoginPage />
      </RootLayout>,
    );

    expect(markup).toContain("Iniciar sesión");
    expect(markup).not.toContain("Gestión de incidencias");
    expect(markup).not.toContain("Analizador de incidencias");
    expect(markup).not.toContain("Pipeline</a>");
  });

  it("does not render protected navigation while auth is initializing", () => {
    authState.isAuthenticated = false;
    authState.isReady = false;

    render(
      <AuthenticatedNavigation>
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </AuthenticatedNavigation>
    );

    expect(screen.getByText("Cargando datos del pipeline de Nexova...")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText("Pipeline candidates")).not.toBeInTheDocument();
  });

  it("shows each internal destination once for an authenticated user and preserves logout", () => {
    authState.isAuthenticated = true;
    authState.isReady = true;

    const renderNavigation = () => (
      <AuthenticatedNavigation>
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </AuthenticatedNavigation>
    );
    const { rerender } = render(renderNavigation());

    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(nav.querySelectorAll('a[href="/"]')).toHaveLength(1);
    expect(nav.querySelectorAll('a[href="/incidents"]')).toHaveLength(1);
    expect(nav.querySelectorAll('a[href="/incidents/analyzer"]')).toHaveLength(1);
    expect(within(nav).getByRole("link", { name: "Pipeline" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Gestión de incidencias" })).toHaveAttribute("href", "/incidents");
    expect(within(nav).getByRole("link", { name: "Analizador de incidencias" })).toHaveAttribute("href", "/incidents/analyzer");
    expect(within(nav).getByRole("link", { name: "Pipeline" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Gestión de incidencias" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Analizador de incidencias" })).not.toHaveAttribute("aria-current");
    const userMenuButton = within(nav).getByRole("button", { name: "Menú de usuario: Prueba" });
    expect(userMenuButton).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).queryByRole("link", { name: "Mi perfil" })).not.toBeInTheDocument();
    fireEvent.click(userMenuButton);
    expect(userMenuButton).toHaveAttribute("aria-expanded", "true");
    expect(within(nav).getByRole("link", { name: "Mi perfil" })).toHaveAttribute("href", "/account/profile");
    expect(within(nav).queryByRole("link", { name: "Cambiar contraseña" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar candidatura" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nueva incidencia" })).not.toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(userMenuButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(userMenuButton);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(userMenuButton).toHaveAttribute("aria-expanded", "false");
    expect(userMenuButton).toHaveFocus();

    pathname.current = "/incidents";
    rerender(renderNavigation());
    expect(within(nav).getByRole("link", { name: "Gestión de incidencias" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Analizador de incidencias" })).not.toHaveAttribute("aria-current");

    pathname.current = "/incidents/analyzer";
    rerender(renderNavigation());
    expect(within(nav).getByRole("link", { name: "Analizador de incidencias" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Gestión de incidencias" })).not.toHaveAttribute("aria-current");

    pathname.current = "/account/profile";
    rerender(renderNavigation());
    fireEvent.click(userMenuButton);
    expect(within(nav).getByRole("link", { name: "Mi perfil" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(within(nav).getByRole("button", { name: "Cerrar sesión" }));
    expect(logout).toHaveBeenCalledOnce();
  });
});

