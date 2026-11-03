import { PRODUCTION_SITE_URL } from "@/lib/site";
import { GEORGIA_INTELLIGENCE_GATE } from "./publication";
import { GA_RETRIEVED_AT } from "./snapshot";

export function buildGeorgiaContractorJsonLd(): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${GEORGIA_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: GEORGIA_INTELLIGENCE_GATE.title,
      description: GEORGIA_INTELLIGENCE_GATE.description,
      url,
      about:
        "Georgia Secretary of State credential classes and residential and general contractor cease-and-desist respondents.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Georgia contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Georgia contractor official source snapshot",
      description:
        "Georgia SOS credential classes and the public residential and general contractor cease-and-desist list. Each class keeps its own count.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "Georgia Secretary of State, Professional Licensing Boards Division",
      },
      temporalCoverage: GA_RETRIEVED_AT,
      isAccessibleForFree: true,
    },
  ];
}

export function gaJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
