"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth-context";

function isCurrentRoute(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/candidates/");
  }

  if (href === "/incidents") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) && !pathname.startsWith("/incidents/analyzer"))
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClassName(pathname: string, href: string): string {
  const active = isCurrentRoute(pathname, href);
  return `rounded-full border px-3 py-1 text-sm font-medium transition ${
    active
      ? "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  }`;
}

export function AuthenticatedNavigation({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isReady, logout, user } = useAuth();
  const pathname = usePathname();

  return (
    <>
      {isReady && isAuthenticated ? (
        <header className="border-b border-white/40 bg-white/65 backdrop-blur">
          <nav
            aria-label="Navegación principal"
            className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-10"
          >
            <Link
              href="/"
              aria-current={isCurrentRoute(pathname, "/") ? "page" : undefined}
              className={navLinkClassName(pathname, "/")}
            >
              Pipeline
            </Link>
            <Link
              href="/incidents"
              aria-current={isCurrentRoute(pathname, "/incidents") ? "page" : undefined}
              className={navLinkClassName(pathname, "/incidents")}
            >
              Gestión de incidencias
            </Link>
            <Link
              href="/incidents/analyzer"
              aria-current={isCurrentRoute(pathname, "/incidents/analyzer") ? "page" : undefined}
              className={navLinkClassName(pathname, "/incidents/analyzer")}
            >
              Analizador de incidencias
            </Link>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <span className="px-2 text-sm text-slate-600">
                {user?.name?.trim() || user?.email}
              </span>
              <Link
                href="/account/profile"
                aria-current={isCurrentRoute(pathname, "/account/profile") ? "page" : undefined}
                className={navLinkClassName(pathname, "/account/profile")}
              >
                Mi perfil
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Cerrar sesión
              </button>
            </div>
          </nav>
        </header>
      ) : null}
      {children}
    </>
  );
}
