import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import "./responsive.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
  display: "optional",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
  weight: ["600", "700", "800"],
  display: "optional",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nexova.com"),
  title: "Nexova Solutions | Talento que transforma empresas",
  description:
    "Consultora de recursos humanos y selección de talento con servicios de headhunting, outsourcing de soporte al cliente y formación corporativa.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Nexova",
    title: "Nexova Solutions | Talento que transforma empresas",
    description:
      "Consultora de recursos humanos y selección de talento con servicios de headhunting, outsourcing de soporte al cliente y formación corporativa.",
  },
  twitter: {
    card: "summary",
    title: "Nexova Solutions | Talento que transforma empresas",
    description:
      "Consultora de recursos humanos y selección de talento con servicios de headhunting, outsourcing de soporte al cliente y formación corporativa.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${dmSans.variable} ${playfairDisplay.variable}`}>
      <body>{children}</body>
    </html>
  );
}