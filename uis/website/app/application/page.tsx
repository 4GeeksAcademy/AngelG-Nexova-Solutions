import type { Metadata } from "next";
import { ApplicationForm } from "@/components/ApplicationForm";

export const metadata: Metadata = {
  title: "Banco de Talento | Nexova Solutions",
  description:
    "Regístrate en el banco de talento de Nexova Solutions y comparte tu perfil profesional.",
};

export default function ApplicationPage() {
  return <ApplicationForm />;
}