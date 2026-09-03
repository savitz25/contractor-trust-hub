import { PRODUCTION_SITE_URL } from "@/lib/site";
import { NEW_JERSEY_INTELLIGENCE_GATE } from "./publication";
import { NEW_JERSEY_SNAPSHOT, type NewJerseyContractorSnapshot } from "./snapshot";

export function buildNewJerseyContractorJsonLd(
  snapshot: NewJerseyContractorSnapshot = NEW_JERSEY_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${NEW_JERSEY_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: NEW_JERSEY_INTELLIGENCE_GATE.title,
      description: NEW_JERSEY_INTELLIGENCE_GATE.description,
      url,
      about: "New Jersey contractor and construction research",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "New Jersey contractor research", item: url },
      ],
    },
  ];
}

export function buildNewJerseyCountyJsonLd(snapshot: {
  county: string;
  path: string;
  publication_gate: { indexable: boolean };
}): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${snapshot.path}`;
  const stateUrl = `${origin}${NEW_JERSEY_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${snapshot.county} County NJ contractor and construction research`,
      description: NEW_JERSEY_INTELLIGENCE_GATE.description,
      url,
      about: `${snapshot.county} County construction source records and contractor research`,
      isPartOf: stateUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "New Jersey contractor research", item: stateUrl },
        { "@type": "ListItem", position: 3, name: `${snapshot.county} County`, item: url },
      ],
    },
  ];
}

export function njJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
