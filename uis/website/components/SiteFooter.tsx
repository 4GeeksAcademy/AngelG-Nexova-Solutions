"use client";

import Link from "next/link";
import { useSitePreferences } from "@/lib/site-preferences";

export function SiteFooter({ onHome = false }: { onHome?: boolean }) {
  const { language } = useSitePreferences();
  const spanish = language === "es";
  const destination = (anchor: string) => onHome ? `#${anchor}` : `/#${anchor}`;

  return (
    <footer className="site-footer" id="contacto">
      <div className="container footer-main">
        <div className="footer-brand">
          <Link className="brand" href={destination("inicio")}><span className="brand-mark">N</span><span>Nexova <b>Solutions</b></span></Link>
          <p>{spanish ? "Consultoría de RRHH y selección de talento, con presencia en Valencia y Miami." : "HR consulting and talent acquisition, with a presence in Valencia and Miami."}</p>
        </div>
        <div>
          <h2>{spanish ? "Servicios" : "Services"}</h2>
          <Link href={destination("servicios")}>{spanish ? "Headhunting & Selección" : "Headhunting & Selection"}</Link>
          <Link href={destination("servicios")}>{spanish ? "Outsourcing de soporte" : "Support outsourcing"}</Link>
          <Link href={destination("servicios")}>{spanish ? "Formación corporativa" : "Corporate training"}</Link>
        </div>
        <div>
          <h2>{spanish ? "Contacto" : "Contact"}</h2>
          <a href="mailto:contacto@nexova.com">contacto@nexova.com</a>
          <a href="tel:+34960123456">Valencia: +34 960 123 456</a>
          <a href="tel:+13055550191">Miami: +1 305 555 0191</a>
          <a href="https://linkedin.com/company/nexova" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href="https://instagram.com/nexova" target="_blank" rel="noopener noreferrer">Instagram</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2025 Nexova Solutions S.L. {spanish ? "Todos los derechos reservados." : "All rights reserved."}</span>
        <span>{spanish ? "Valencia · España | Miami · USA" : "Valencia · Spain | Miami · USA"}</span>
      </div>
    </footer>
  );
}