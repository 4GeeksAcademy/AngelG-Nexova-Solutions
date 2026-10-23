"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

function ThemeToggleButton({
  darkMode,
  onToggle,
}: {
  darkMode: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={darkMode}
      onClick={onToggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 transition hover:border-cyan-600 hover:text-cyan-700"
    >
      {darkMode ? (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3c0 .34.02.67.06 1a7 7 0 0 0 8.73 8.73c.33.04.66.06 1 .06z" />
        </svg>
      )}
    </button>
  );
}

export function AuthenticatedNavigation({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isReady, logout, user } = useAuth();
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark =
      savedTheme === "dark" ||
      (!savedTheme && prefersDark);

    document.documentElement.classList.toggle("dark", shouldUseDark);
    setDarkMode(shouldUseDark);
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
        userMenuTriggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isUserMenuOpen]);

  function toggleTheme() {
    const nextDarkMode = !darkMode;
    document.documentElement.classList.toggle("dark", nextDarkMode);
    window.localStorage.setItem("theme", nextDarkMode ? "dark" : "light");
    setDarkMode(nextDarkMode);
  }

  const showNavigation = isReady && isAuthenticated;
  const userDisplayName = user?.name?.trim() || user?.email || "Usuario";

  return (
    <>
      {showNavigation ? (
        <header className="relative z-50 border-b border-white/40 bg-white/65 backdrop-blur">
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
              <ThemeToggleButton darkMode={darkMode} onToggle={toggleTheme} />
              <div className="relative" ref={userMenuRef}>
                <button
                  ref={userMenuTriggerRef}
                  type="button"
                  aria-label={`Menú de usuario: ${userDisplayName}`}
                  aria-expanded={isUserMenuOpen}
                  aria-controls="account-menu"
                  onClick={() => setIsUserMenuOpen((open) => !open)}
                  className="inline-flex max-w-56 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-cyan-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:hover:border-cyan-400 dark:hover:bg-slate-800"
                >
                  <span className="truncate">{userDisplayName}</span>
                  <svg
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {isUserMenuOpen ? (
                  <div
                    id="account-menu"
                    className="account-menu-enter absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/25 dark:bg-[#1b3155]"
                  >
                    <Link
                      href="/account/profile"
                      aria-current={isCurrentRoute(pathname, "/account/profile") ? "page" : undefined}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:text-white dark:hover:bg-[#263f66] dark:hover:text-white"
                    >
                      Mi perfil
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/50"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </nav>
        </header>
      ) : null}
      {isReady && !isAuthenticated ? (
        <div className="fixed right-4 top-4 z-50 md:right-6 md:top-6">
          <ThemeToggleButton darkMode={darkMode} onToggle={toggleTheme} />
        </div>
      ) : null}
      {children}
    </>
  );
}
