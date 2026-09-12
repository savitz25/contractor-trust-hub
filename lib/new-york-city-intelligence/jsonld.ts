import { PRODUCTION_SITE_URL } from "@/lib/site";
import { NYC_INTELLIGENCE_GATE } from "./publication";
import type { NycContractorSnapshot } from "./snapshot";

export function buildNycContractorJsonLd(snapshot: NycContractorSnapshot) {
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${NYC_INTELLIGENCE_GATE.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: snapshot.publication.h1,
      description: NYC_INTELLIGENCE_GATE.description,
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "New York research", item: `${origin}/new-york` },
        { "@type": "ListItem", position: 3, name: "New York City", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "NYC DCWP Home Improvement Contractor research snapshot",
      description:
        "Frozen NYC Open Data Home Improvement Contractor license slice with exact Business Unique ID research associations to DCWP complaints, inspections, and charges.",
      url,
      identifier: snapshot.version,
    },
  ];
}
