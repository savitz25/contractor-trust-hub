import type { Metadata } from "next";
import { TexasAustinLocalPage } from "@/components/texas/tx-austin-local-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildTexasAustinJsonLd } from "@/lib/texas-intelligence/local/jsonld";
import { loadAustinIdentityLookup, loadTexasAustinLocalSnapshot } from "@/lib/texas-intelligence/local/load";
import { TX_AUSTIN_GATE } from "@/lib/texas-intelligence/local/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

type Props = {
  searchParams: Promise<{
    company?: string;
    phone?: string;
    permit?: string;
    trade?: string;
    zip?: string;
  }>;
};

export const metadata: Metadata = pageMetadata({
  title: TX_AUSTIN_GATE.title,
  description: TX_AUSTIN_GATE.description,
  path: TX_AUSTIN_GATE.path,
  noIndex: !TX_AUSTIN_GATE.robotsIndex,
});

export default async function AustinLocalPage({ searchParams }: Props) {
  const sp = await searchParams;
  const snapshot = loadTexasAustinLocalSnapshot();
  const lookup = loadAustinIdentityLookup({
    company: sp.company,
    phone: sp.phone,
    permit: sp.permit,
    trade: sp.trade,
    zip: sp.zip,
  });
  return (
    <>
      <JsonLd data={buildTexasAustinJsonLd(snapshot)} />
      <TexasAustinLocalPage snapshot={snapshot} lookup={lookup} />
    </>
  );
}
