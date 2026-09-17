import { PRODUCTION_SITE_URL } from "@/lib/site";
import { NORTH_CAROLINA_INTELLIGENCE_GATE } from "./publication";
import { NORTH_CAROLINA_SNAPSHOT, type NorthCarolinaContractorSnapshot } from "./snapshot";

export function buildNorthCarolinaContractorJsonLd(
  snapshot: NorthCarolinaContractorSnapshot = NORTH_CAROLINA_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${NORTH_CAROLINA_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: NORTH_CAROLINA_INTELLIGENCE_GATE.title,
      description: NORTH_CAROLINA_INTELLIGENCE_GATE.description,
      url,
      about:
        "North Carolina NCLBGC general-contractor licensing, electrical and plumbing/HVAC/fire-sprinkler boards, and NC DOA debarment. Not a ranking or Trust Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "North Carolina contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "North Carolina contractor official source snapshot",
      description:
        "NCLBGC search-only licensing, recent Board case summaries, unlicensed injunctions, PHFS attorney-report rows, and 2021 NC DOA debarred vendors. Classes are not added into one contractor total.",
      url,
      creator: { "@type": "GovernmentOrganization", name: "North Carolina Licensing Board for General Contractors" },
      temporalCoverage: snapshot.snapshotAsOf,
      isAccessibleForFree: true,
    },
  ];
}

export function ncJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
