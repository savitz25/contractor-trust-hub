import { PRODUCTION_SITE_URL } from "@/lib/site";
import { TEXAS_INTELLIGENCE_GATE } from "./publication";
import { TEXAS_SNAPSHOT, type TexasContractorSnapshot } from "./snapshot";

export function buildTexasContractorJsonLd(
  snapshot: TexasContractorSnapshot = TEXAS_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${TEXAS_INTELLIGENCE_GATE.path}`;
  const trades = snapshot.trade_distribution.tdlr_business.map((row, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: `${row.trade} — ${row.rows.toLocaleString("en-US")} acquired business-contractor credential rows`,
  }));

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: TEXAS_INTELLIGENCE_GATE.title,
      description: TEXAS_INTELLIGENCE_GATE.description,
      url,
      about: "Texas specialty contractor and trade credential research. Texas has no statewide general-contractor license.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Texas contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Acquired Texas specialty contractor and trade credentials",
      description:
        "Deterministic extract of official TDLR specialty contractor files, TSBPE plumbing lists, Comptroller CMBL vendors, and TxDOT project rows. This is not the complete Texas contractor universe. Texas has no statewide general-contractor license.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "Texas Department of Licensing and Regulation",
        url: "https://www.tdlr.texas.gov/",
      },
      temporalCoverage: snapshot.as_of,
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "TDLR business contractor license types in the acquired extract",
      description: "Counts of acquired business-contractor credential rows by source-native license type. Not a ranking.",
      numberOfItems: snapshot.trade_distribution.tdlr_business.length,
      itemListElement: trades,
    },
  ];
}

export function txJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
