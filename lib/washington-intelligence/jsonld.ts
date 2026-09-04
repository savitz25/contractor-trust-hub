import { PRODUCTION_SITE_URL } from "@/lib/site";
import { WASHINGTON_INTELLIGENCE_GATE } from "./publication";
import { WASHINGTON_SNAPSHOT, type WashingtonContractorSnapshot } from "./snapshot";

export function buildWashingtonContractorJsonLd(
  snapshot: WashingtonContractorSnapshot = WASHINGTON_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${WASHINGTON_INTELLIGENCE_GATE.path}`;
  const types = snapshot.general.types.map((row, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: `${row.name} — ${row.rows.toLocaleString("en-US")} L&I contractor rows`,
  }));

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: WASHINGTON_INTELLIGENCE_GATE.title,
      description: WASHINGTON_INTELLIGENCE_GATE.description,
      url,
      about:
        "Washington L&I contractor registration, bond, and liability-insurance research. Not a ranking or Trust Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Washington contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Acquired Washington L&I contractor registration, bond, and insurance records",
      description:
        "Deterministic extract of official L&I Contractor License Data — General, Bond, and Insurance. Exact ContractorLicenseNumber joins. Not a ranking.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "Washington State Department of Labor & Industries",
        url: "https://lni.wa.gov/",
      },
      temporalCoverage: snapshot.as_of,
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "L&I contractor types in the acquired extract",
      description: "Counts of acquired contractor rows by source-native type. Not a ranking.",
      numberOfItems: snapshot.general.types.length,
      itemListElement: types,
    },
  ];
}

export function waJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
