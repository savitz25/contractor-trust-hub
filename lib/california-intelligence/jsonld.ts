import { PRODUCTION_SITE_URL } from "@/lib/site";
import { CALIFORNIA_INTELLIGENCE_GATE } from "./publication";
import { CALIFORNIA_SNAPSHOT, type CaliforniaContractorSnapshot } from "./snapshot";

export function buildCaliforniaContractorJsonLd(
  snapshot: CaliforniaContractorSnapshot = CALIFORNIA_SNAPSHOT,
): Record<string, unknown>[] {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${CALIFORNIA_INTELLIGENCE_GATE.path}`;
  const topClasses = snapshot.classifications.top.map((row, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: `${row.token} — ${row.rows.toLocaleString("en-US")} acquired license rows holding this class`,
  }));

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: CALIFORNIA_INTELLIGENCE_GATE.title,
      description: CALIFORNIA_INTELLIGENCE_GATE.description,
      url,
      about: "California contractor license research from acquired CSLB public-data rows",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "California contractor research", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Acquired CSLB public-data rows",
      description:
        "Deterministic extract of the official CSLB Public Data Portal License Master. Coverage is ACQUIRED_PARTIAL_STREAM_TRUNCATED. This is not the complete California contractor universe.",
      url,
      creator: {
        "@type": "GovernmentOrganization",
        name: "Contractors State License Board",
        url: "https://www.cslb.ca.gov/",
      },
      temporalCoverage: snapshot.as_of,
      isAccessibleForFree: true,
      license: "https://www.cslb.ca.gov/onlineservices/dataportal",
      variableMeasured: [
        "CSLB license number",
        "business name",
        "primary status",
        "classification tokens",
        "city",
        "ZIP",
        "mailing county",
        "business phone",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Top classification tokens in the acquired extract",
      description: "Counts of acquired license rows holding each class token. Not a ranking.",
      numberOfItems: snapshot.classifications.top.length,
      itemListElement: topClasses,
    },
  ];
}

export function caJsonLdHasForbiddenRatings(data: unknown): boolean {
  return /aggregateRating|reviewRating|"ratingValue"/i.test(JSON.stringify(data));
}
