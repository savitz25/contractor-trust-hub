import type { Metadata } from "next";
import { CaliforniaSanFranciscoPage } from "@/components/california/ca-sf-local-page";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  loadCaliforniaLocalSnapshot,
  loadExactLocalActivity,
} from "@/lib/california-intelligence/local/load";
import { CA_SF_GATE } from "@/lib/california-intelligence/local/publication";
import { pageMetadata } from "@/lib/seo/page-meta";
import { PRODUCTION_SITE_URL } from "@/lib/site";

type Props = { searchParams: Promise<{ license?: string }> };

export const metadata: Metadata = pageMetadata({
  title: CA_SF_GATE.title,
  description: CA_SF_GATE.description,
  path: CA_SF_GATE.path,
  noIndex: !CA_SF_GATE.robotsIndex,
});

export default async function SanFranciscoLocalPage({ searchParams }: Props) {
  const sp = await searchParams;
  const snapshot = loadCaliforniaLocalSnapshot();
  const query = (sp.license || "").trim();
  const hit = loadExactLocalActivity(query);
  const origin = PRODUCTION_SITE_URL.replace(/\/$/, "");
  const url = `${origin}${CA_SF_GATE.path}`;
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "City and County of San Francisco Contractor & Permit Intelligence",
            description: CA_SF_GATE.description,
            url,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
              { "@type": "ListItem", position: 2, name: "California research", item: `${origin}/california` },
              { "@type": "ListItem", position: 3, name: "San Francisco", item: url },
            ],
          },
        ]}
      />
      <CaliforniaSanFranciscoPage
        snapshot={snapshot}
        query={query}
        hit={hit && hit.sfContacts ? hit : null}
      />
    </>
  );
}
