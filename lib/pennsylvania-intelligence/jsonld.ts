import { PRODUCTION_SITE_URL } from "@/lib/site";
import { PENNSYLVANIA_INTELLIGENCE_GATE } from "./publication";
import { PENNSYLVANIA_SNAPSHOT, type PennsylvaniaContractorSnapshot } from "./snapshot";

export function buildPennsylvaniaContractorJsonLd(
  snapshot: PennsylvaniaContractorSnapshot = PENNSYLVANIA_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${PENNSYLVANIA_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: PENNSYLVANIA_INTELLIGENCE_GATE.title,
      description: PENNSYLVANIA_INTELLIGENCE_GATE.description,
      url,
      about:
        "Pennsylvania HICPA registration, DLI asbestos and lead contractor certifications, and prevailing-wage debarments. Not a statewide general-contractor license, ranking, or Trust Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Pennsylvania contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Pennsylvania contractor official source snapshot",
      description:
        "HICPA search-only registration, DLI asbestos/lead contractor certifications, and current prevailing-wage debarment listings. Classes are not added into one contractor total.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "Pennsylvania Office of Attorney General and Department of Labor & Industry",
      },
      temporalCoverage: snapshot.snapshotAsOf,
      isAccessibleForFree: true,
    },
  ];
}

export function paJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
