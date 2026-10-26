"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Language = "es" | "en";
export type Theme = "dark" | "light";

const preferenceEvent = "nexova-preferences-change";

function subscribePreferences(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(preferenceEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(preferenceEvent, onChange);
  };
}

function getLanguageSnapshot(): Language {
  return localStorage.getItem("language") === "en" ? "en" : "es";
}

function getThemeSnapshot(): Theme {
  return localStorage.getItem("theme") === "light" ? "light" : "dark";
}

function notifyPreferenceChange() {
  window.dispatchEvent(new Event(preferenceEvent));
}

export function useSitePreferences() {
  const language = useSyncExternalStore(
    subscribePreferences,
    getLanguageSnapshot,
    () => "es" as const,
  );
  const theme = useSyncExternalStore(
    subscribePreferences,
    getThemeSnapshot,
    () => "dark" as const,
  );

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
  }, [language, theme]);

  const setLanguage = (next: Language) => {
    localStorage.setItem("language", next);
    notifyPreferenceChange();
  };

  const setTheme = (next: Theme) => {
    localStorage.setItem("theme", next);
    notifyPreferenceChange();
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return { language, theme, setLanguage, setTheme, toggleTheme };
}