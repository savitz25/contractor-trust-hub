import { PRODUCTION_SITE_URL } from "@/lib/site";
import { OHIO_INTELLIGENCE_GATE } from "./publication";
import { OHIO_SNAPSHOT, type OhioContractorSnapshot } from "./snapshot";

export function buildOhioContractorJsonLd(
  snapshot: OhioContractorSnapshot = OHIO_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${OHIO_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: OHIO_INTELLIGENCE_GATE.title,
      description: OHIO_INTELLIGENCE_GATE.description,
      url,
      about:
        "Ohio OCILB commercial specialty-trade licensing, person versus company identity, and State Fire Marshal fire-protection certifications. Not a ranking or Trust Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Ohio contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Ohio contractor official source snapshot",
      description:
        "OCILB current no-fee five-trade listing, person-to-company roster associations, and State Fire Marshal fire-protection installer and company certifications. Classes are not added into one contractor total.",
      url,
      creator: { "@type": "GovernmentOrganization", name: "Ohio Construction Industry Licensing Board" },
      temporalCoverage: snapshot.snapshotAsOf,
      isAccessibleForFree: true,
    },
  ];
}

export function ohJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
