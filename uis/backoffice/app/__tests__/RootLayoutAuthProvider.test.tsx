import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RootLayout from "@/app/layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace, push: vi.fn() }),
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

describe("RootLayout authentication provider", () => {
  it("provides auth context to the guard while auth is initializing", () => {
    const markup = renderToString(
      <RootLayout>
        <ProtectedRoute>
          <p>Contenido protegido</p>
        </ProtectedRoute>
      </RootLayout>,
    );

    expect(markup).toContain("Cargando datos del pipeline de Nexova...");
    expect(markup).not.toContain("Contenido protegido");
  });
});