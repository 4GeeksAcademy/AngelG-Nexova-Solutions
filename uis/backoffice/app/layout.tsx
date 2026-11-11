import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { AuthenticatedNavigation } from "@/components/AuthenticatedNavigation";
import { AuthProvider } from "@/lib/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexova Talent Pipeline Tracker",
  description: "Herramienta interna de Nexova para seguimiento de candidaturas.",
};

const themeInitializer = `(() => {
  try {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const useDark = savedTheme === "dark" || (savedTheme !== "light" && prefersDark);
    document.documentElement.classList.toggle("dark", useDark);
  } catch {
    document.documentElement.classList.remove("dark");
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-initializer" strategy="beforeInteractive">
          {themeInitializer}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AuthenticatedNavigation>{children}</AuthenticatedNavigation>
        </AuthProvider>
      </body>
    </html>
  );
}
