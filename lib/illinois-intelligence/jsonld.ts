import { PRODUCTION_SITE_URL } from "@/lib/site";
import { ILLINOIS_INTELLIGENCE_GATE } from "./publication";
import { ILLINOIS_SNAPSHOT, type IllinoisContractorSnapshot } from "./snapshot";

export function buildIllinoisContractorJsonLd(
  snapshot: IllinoisContractorSnapshot = ILLINOIS_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${ILLINOIS_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: ILLINOIS_INTELLIGENCE_GATE.title,
      description: ILLINOIS_INTELLIGENCE_GATE.description,
      url,
      about: "IDFPR licensed roofing contractor credentials. Not a statewide general-contractor license, ranking, or Trust Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Illinois roofing research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "IDFPR Illinois roofing contractor licenses",
      description: "Roofing-only slice of IDFPR Professional Licensing Open Data. Business licenses are not qualifying-party persons.",
      url,
      creator: { "@type": "GovernmentOrganization", name: "Illinois Department of Financial and Professional Regulation", url: "https://idfpr.illinois.gov/" },
      temporalCoverage: snapshot.clocks.sourceAsOf,
      isAccessibleForFree: true,
    },
  ];
}

export function ilJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
