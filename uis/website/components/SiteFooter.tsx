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
          <a href="mailto:hola@nexovasolutions.com">hola@nexovasolutions.com</a>
          <span>{spanish ? "Valencia, España" : "Valencia, Spain"}</span>
          <span>{spanish ? "Miami, Florida, EE. UU." : "Miami, Florida, USA"}</span>
          <a href="https://linkedin.com/company/nexova-solutions" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} Nexova Solutions</span><Link href={destination("inicio")}>{spanish ? "Volver al inicio" : "Back to home"} ↑</Link></div>
    </footer>
  );
}