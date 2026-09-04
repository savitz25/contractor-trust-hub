import { PRODUCTION_SITE_URL } from "@/lib/site";
import { TX_AUSTIN_GATE } from "./publication";
import type { TexasAustinLocalSnapshot } from "./snapshot";

export function buildTexasAustinJsonLd(snapshot: TexasAustinLocalSnapshot): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${TX_AUSTIN_GATE.path}`;
  const types = snapshot.austin.permit_types.map((row, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: `${row.name} — ${row.rows.toLocaleString("en-US")} issued permit rows`,
  }));

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "City of Austin Contractor & Permit Intelligence",
      description: TX_AUSTIN_GATE.description,
      url,
      about:
        "City of Austin issued construction permits and local contractor company+phone identity. Not a state license roster and not a ranking.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Texas research", item: `${origin}/texas` },
        { "@type": "ListItem", position: 3, name: "City of Austin", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "City of Austin issued construction permits — acquired extract",
      description:
        "Deterministic extract of City of Austin Issued Construction Permits (Socrata 3syk-w9eu). One row is one issued permit. Local contractor company+phone identity is not a TDLR or TSBPE credential. Not a ranking.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "City of Austin",
        url: "https://data.austintexas.gov/Building-and-Development/Issued-Construction-Permits/3syk-w9eu",
      },
      temporalCoverage: "1921/2026",
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Permit types in the acquired City of Austin extract",
      description: "Counts of issued permit rows by source permit type. Not a ranking.",
      numberOfItems: snapshot.austin.permit_types.length,
      itemListElement: types,
    },
  ];
}

export function txAustinJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
