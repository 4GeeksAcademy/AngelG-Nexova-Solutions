import { LandingContent } from "@/components/LandingContent";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nexova",
  foundingDate: "2011",
  description:
    "Consultora de recursos humanos y adquisición de talento.",
  address: [
    {
      "@type": "PostalAddress",
      addressLocality: "Valencia",
      addressRegion: "Comunidad Valenciana",
      addressCountry: "ES",
    },
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