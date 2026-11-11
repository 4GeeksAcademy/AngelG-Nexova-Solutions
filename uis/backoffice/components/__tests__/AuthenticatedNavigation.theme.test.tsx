import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticatedNavigation } from "@/components/AuthenticatedNavigation";

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isReady: true,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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
  useAuth: () => ({
    ...authState,
    logout: vi.fn(),
    user: null,
  }),
}));

function mockSystemPreference(matches: boolean) {
  const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    matches,
    addEventListener: vi.fn((_, listener: (event: MediaQueryListEvent) => void) => {
      mediaListeners.add(listener);
    }),
    removeEventListener: vi.fn((_, listener: (event: MediaQueryListEvent) => void) => {
      mediaListeners.delete(listener);
    }),
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mediaQuery));
  return {
    change(matches: boolean) {
      mediaQuery.matches = matches;
      mediaListeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
    },
  };
}

function renderNavigation() {
  return render(
    <AuthenticatedNavigation>
      <main>Contenido</main>
    </AuthenticatedNavigation>,
  );
}

describe("authenticated navigation theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    authState.isAuthenticated = false;
    authState.isReady = true;
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  it.each([
    { saved: null, systemDark: false, expectedDark: false },
    { saved: null, systemDark: true, expectedDark: true },
    { saved: "dark", systemDark: false, expectedDark: true },
    { saved: "light", systemDark: true, expectedDark: false },
  ])(
    "uses saved preference ($saved) or system preference ($systemDark)",
    ({ saved, systemDark, expectedDark }) => {
      mockSystemPreference(systemDark);
      if (saved) window.localStorage.setItem("theme", saved);

      renderNavigation();

      const button = screen.getByRole("button", {
        name: expectedDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
      });
      expect(button).toHaveAttribute("aria-pressed", String(expectedDark));
      expect(document.documentElement.classList.contains("dark")).toBe(expectedDark);
    },
  );

  it("toggles the theme, updates ARIA, and persists the manual choice", () => {
    mockSystemPreference(false);
    renderNavigation();

    fireEvent.click(screen.getByRole("button", { name: "Cambiar a modo oscuro" }));
    expect(screen.getByRole("button", { name: "Cambiar a modo claro" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Cambiar a modo claro" }));
    expect(screen.getByRole("button", { name: "Cambiar a modo oscuro" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem("theme")).toBe("light");
  });

  it("keeps the manual choice after remount and follows system changes only without one", () => {
    const system = mockSystemPreference(false);
    const { unmount } = renderNavigation();

    act(() => system.change(true));
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Cambiar a modo claro" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Cambiar a modo claro" }));
    expect(window.localStorage.getItem("theme")).toBe("light");
    unmount();

    renderNavigation();
    expect(screen.getByRole("button", { name: "Cambiar a modo oscuro" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    act(() => system.change(true));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("hydrates without warnings when the browser preference is dark", async () => {
    mockSystemPreference(true);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const serverMarkup = renderToString(
      <AuthenticatedNavigation>
        <main>Contenido</main>
      </AuthenticatedNavigation>,
    );
    const container = document.createElement("div");
    container.innerHTML = serverMarkup;
    document.body.append(container);

    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(
        container,
        <AuthenticatedNavigation>
          <main>Contenido</main>
        </AuthenticatedNavigation>,
      );
    });

    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration|did not match/i);
    expect(
      screen.getByRole("button", { name: "Cambiar a modo claro" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveClass("dark");

    await act(async () => root.unmount());
    container.remove();
    consoleError.mockRestore();
  });
});
