const THEME_STORAGE_KEY = "theme";
const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function getSystemPreference(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia(DARK_MODE_QUERY).matches
  );
}

function readTheme(): boolean {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark") return true;
  if (savedTheme === "light") return false;
  return getSystemPreference();
}

function syncDocumentTheme(): void {
  document.documentElement.classList.toggle("dark", readTheme());
}

function notifyThemeChange(): void {
  syncDocumentTheme();
  listeners.forEach((listener) => listener());
}

export function getThemeSnapshot(): boolean {
  return readTheme();
}

export function getServerThemeSnapshot(): boolean {
  // Keep server markup and the first hydration render deterministic. The
  // beforeInteractive initializer applies the browser preference before paint.
  return false;
}

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);

  const mediaQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia(DARK_MODE_QUERY)
      : null;
  const handleSystemChange = () => {
    if (window.localStorage.getItem(THEME_STORAGE_KEY) === null) {
      notifyThemeChange();
    }
  };
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      notifyThemeChange();
    }
  };

  mediaQuery?.addEventListener("change", handleSystemChange);
  window.addEventListener("storage", handleStorageChange);
  syncDocumentTheme();

  return () => {
    listeners.delete(listener);
    mediaQuery?.removeEventListener("change", handleSystemChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

export function setTheme(isDark: boolean): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  notifyThemeChange();
}
