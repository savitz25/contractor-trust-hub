import { PRODUCTION_SITE_URL } from "@/lib/site";
import { COLORADO_INTELLIGENCE_GATE } from "./publication";
import { COLORADO_SNAPSHOT, type ColoradoContractorSnapshot } from "./snapshot";

export function buildColoradoContractorJsonLd(
  snapshot: ColoradoContractorSnapshot = COLORADO_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${COLORADO_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: COLORADO_INTELLIGENCE_GATE.title,
      description: COLORADO_INTELLIGENCE_GATE.description,
      url,
      about:
        "Colorado DORA electrical and plumbing contractor registrations. Not a statewide general-contractor license, ranking, or Trust Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Colorado contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Colorado DORA electrical and plumbing contractor registrations",
      description:
        "Official DORA EC and PC business-grain credentials plus exact license-linked discipline. Not a general-contractor universe and not a ranking.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "Colorado Department of Regulatory Agencies",
        url: "https://dpo.colorado.gov/",
      },
      temporalCoverage: snapshot.as_of,
      isAccessibleForFree: true,
    },
  ];
}

export function coJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
