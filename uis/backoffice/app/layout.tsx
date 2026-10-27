import type { Metadata } from "next";
import { Geist } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AuthenticatedNavigation>{children}</AuthenticatedNavigation>
        </AuthProvider>
      </body>
    </html>
  );
}
