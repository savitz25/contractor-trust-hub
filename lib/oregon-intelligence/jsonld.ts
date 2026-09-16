import { PRODUCTION_SITE_URL } from "@/lib/site";
import { OREGON_INTELLIGENCE_GATE } from "./publication";
import { OREGON_SNAPSHOT, type OregonContractorSnapshot } from "./snapshot";

export function buildOregonContractorJsonLd(
  snapshot: OregonContractorSnapshot = OREGON_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${OREGON_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: OREGON_INTELLIGENCE_GATE.title,
      description: OREGON_INTELLIGENCE_GATE.description,
      url,
      about: "Oregon CCB active licenses and BCD trade credentials. Not a ranking or Trust Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Oregon contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Oregon CCB Active Licenses",
      description: "Official CCB Active Licenses open data. A license row is not a unique company.",
      url,
      creator: { "@type": "GovernmentOrganization", name: "Oregon Construction Contractors Board", url: "https://www.oregon.gov/ccb/" },
      temporalCoverage: snapshot.clocks.ccb_sourceAsOf,
      isAccessibleForFree: true,
    },
  ];
}

export function orJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
