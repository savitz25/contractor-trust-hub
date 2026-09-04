import { PRODUCTION_SITE_URL } from "@/lib/site";
import { ARIZONA_INTELLIGENCE_GATE } from "./publication";
import { ARIZONA_SNAPSHOT, type ArizonaContractorSnapshot } from "./snapshot";

export function buildArizonaContractorJsonLd(
  snapshot: ArizonaContractorSnapshot = ARIZONA_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${ARIZONA_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: ARIZONA_INTELLIGENCE_GATE.title,
      description: ARIZONA_INTELLIGENCE_GATE.description,
      url,
      about:
        "Arizona ROC current contractor licenses and classification research. Not a ranking or Trust Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Arizona contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Arizona ROC current contractor posting",
      description:
        "Official ROC All Current Contractors posting-list header plus last full extract overlap proof. Commercial, residential, and dual files overlap. Not a ranking.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "Arizona Registrar of Contractors",
        url: "https://roc.az.gov/",
      },
      temporalCoverage: snapshot.current_posting.header_as_of,
      isAccessibleForFree: true,
    },
  ];
}

export function azJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
