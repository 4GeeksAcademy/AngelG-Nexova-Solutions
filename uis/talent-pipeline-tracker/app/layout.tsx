import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexova Talent Pipeline Tracker",
  description: "Herramienta interna de Nexova para seguimiento de candidaturas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-white/40 bg-white/65 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-10">
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Pipeline
            </Link>
            <Link
              href="/incidents"
              className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-800 transition hover:bg-cyan-100"
            >
              Analizador de Incidencias
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
