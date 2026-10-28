"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSitePreferences, type Language } from "@/lib/site-preferences";

const labels = {
  es: {
    homeLink: "Inicio",
    services: "Servicios",
    process: "Cómo funciona",
    industries: "Sectores",
    technology: "IA",
    apply: "Aplica",
    contact: "Contacto",
    navigation: "Navegación principal",
    applyNow: "Aplica ahora",
    language: "Seleccionar idioma",
    spanish: "Español",
    themeLight: "Modo claro",
    themeDark: "Modo oscuro",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    home: "Nexova Solutions — Inicio",
  },
  en: {
    homeLink: "Home",
    services: "Services",
    process: "How it works",
    industries: "Industries",
    technology: "AI",
    apply: "Apply",
    contact: "Contact",
    navigation: "Main navigation",
    applyNow: "Apply now",
    language: "Select language",
    spanish: "Spanish",
    themeLight: "Light mode",
    themeDark: "Dark mode",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    home: "Nexova Solutions — Home",
  },
} as const;

export function SiteHeader({ page = "home" }: { page?: "home" | "application" }) {
  const [isOpen, setIsOpen] = useState(false);
  const { language, theme, setLanguage, toggleTheme } = useSitePreferences();
  const t = labels[language];

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 68rem)");
    const closeMenuOnDesktop = () => {
      if (desktop.matches) setIsOpen(false);
    };
    desktop.addEventListener("change", closeMenuOnDesktop);
    return () => desktop.removeEventListener("change", closeMenuOnDesktop);
  }, []);

  const links = [
      [t.homeLink, "#inicio"],
      [t.services, "#servicios"],
      [t.process, "#proceso"],
      [t.industries, "#sectores"],
      [t.technology, "#ia"],
      [t.apply, "#aplica"],
      [t.contact, "#contacto"],
    ] as const;

  return (
    <header className={`site-header${page === "application" ? " application-site-header" : ""}`}>
      <div className="nav-wrap">
        <a className="brand" href={page === "home" ? "#inicio" : "/"}>
          <span className="brand-mark">N</span>
          <span>Nexova <b>Solutions</b></span>
        </a>
        {page === "home" && <nav id="primary-nav" className={`primary-nav${isOpen ? " open" : ""}`} aria-label={t.navigation}>
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setIsOpen(false)}>{label}</a>
          ))}
          <Link href="/application" className="nav-cta" onClick={() => setIsOpen(false)}>{t.applyNow}</Link>
        </nav>}
        <div className="nav-right">
          <div className="nav-controls">
            <label className="sr-only" htmlFor="site-language">{t.language}</label>
            <select
              id="site-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              aria-label={t.language}
            >
              <option value="es">ES</option>
              <option value="en">EN</option>
            </select>
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
              aria-label={theme === "dark" ? t.themeLight : t.themeDark}
              title={theme === "dark" ? t.themeLight : t.themeDark}
            >
              <span aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span>
              <span>{theme === "dark" ? t.themeLight : t.themeDark}</span>
            </button>
          </div>
          {page === "home" && <button
            className="menu-toggle"
            type="button"
            aria-expanded={isOpen}
            aria-controls="primary-nav"
            aria-label={isOpen ? t.closeMenu : t.openMenu}
            onClick={() => setIsOpen((open) => !open)}
          >
            <i /><i /><i />
          </button>}
        </div>
      </div>
    </header>
  );
}