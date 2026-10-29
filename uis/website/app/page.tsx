import type { Metadata } from "next";
import { LandingContent } from "@/components/LandingContent";

const description =
  "Consultora de recursos humanos y adquisición de talento.";

export const metadata: Metadata = {
  title: "Nexova | Consultoría de recursos humanos y talento",
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
    title: "Nexova | Consultoría de recursos humanos y talento",
    description,
  },
};

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nexova",
  foundingDate: "2011",
  description,
  url: "https://nexova.com",
  address: [
    {
      "@type": "PostalAddress",
      addressCountry: "ES",
      addressLocality: "Valencia",
      addressRegion: "Comunidad Valenciana",
    },
    {
      "@type": "PostalAddress",
      addressCountry: "US",
      addressLocality: "Miami",
      addressRegion: "Florida",
    },
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+34-960-123-456",
    contactType: "customer service",
    availableLanguage: ["Spanish", "English"],
  },
  sameAs: [
    "https://linkedin.com/company/nexova",
    "https://instagram.com/nexova",
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <LandingContent />
    </>
  );
}