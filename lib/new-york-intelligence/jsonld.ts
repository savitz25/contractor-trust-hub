import { PRODUCTION_SITE_URL } from "@/lib/site";
import { NEW_YORK_INTELLIGENCE_GATE } from "./publication";
import { NEW_YORK_SNAPSHOT, type NewYorkContractorSnapshot } from "./snapshot";

export function buildNewYorkContractorJsonLd(
  snapshot: NewYorkContractorSnapshot = NEW_YORK_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${NEW_YORK_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: NEW_YORK_INTELLIGENCE_GATE.title,
      description: NEW_YORK_INTELLIGENCE_GATE.description,
      url,
      about:
        "NYSDOL public-work contractor registration certificates. Not a statewide general-contractor license, home-improvement roster, ranking, or Trust Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "New York contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "NYSDOL Contractor Registry Certificate",
      description:
        "Official New York Open Data public-work contractor and subcontractor registration certificates. Not all New York contractors and not a ranking.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "New York State Department of Labor",
        url: "https://dol.ny.gov/",
      },
      temporalCoverage: snapshot.clocks.sourceAsOf,
      isAccessibleForFree: true,
    },
  ];
}

export function nyJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
