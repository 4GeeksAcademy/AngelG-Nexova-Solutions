import { LandingContent } from "@/components/LandingContent";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nexova Solutions",
  foundingDate: "2011",
  description:
    "Consultora de recursos humanos y selección de talento con servicios de headhunting, outsourcing de soporte al cliente y formación corporativa.",
  address: [
    { "@type": "PostalAddress", addressLocality: "Valencia", addressCountry: "ES" },
    {
      "@type": "PostalAddress",
      addressLocality: "Miami",
      addressRegion: "Florida",
      addressCountry: "US",
    },
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