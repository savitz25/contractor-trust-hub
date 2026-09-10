import { PRODUCTION_SITE_URL } from "@/lib/site";
import { VIRGINIA_INTELLIGENCE_GATE } from "./publication";
import { VIRGINIA_SNAPSHOT, type VirginiaContractorSnapshot } from "./snapshot";

export function buildVirginiaContractorJsonLd(
  snapshot: VirginiaContractorSnapshot = VIRGINIA_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${VIRGINIA_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: VIRGINIA_INTELLIGENCE_GATE.title,
      description: VIRGINIA_INTELLIGENCE_GATE.description,
      url,
      about:
        "Virginia DPOR Board for Contractors Class A, B, and C business licenses. Not a ranking or Trust Score. Class is not quality.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Virginia contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Virginia DPOR Board for Contractors Class A/B/C licenses",
      description:
        "Official statewide contractor-business regulant lists plus revocation-release observations attached only by exact DPOR license number. Not a ranking.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "Virginia Department of Professional and Occupational Regulation",
        url: "https://www.dpor.virginia.gov/",
      },
      temporalCoverage: snapshot.as_of,
      isAccessibleForFree: true,
    },
  ];
}

export function vaJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
