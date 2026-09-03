import type { Metadata } from "next";
import { TexasContractorPage } from "@/components/texas/tx-state-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildTexasContractorJsonLd } from "@/lib/texas-intelligence/jsonld";
import { loadTexasContractorView } from "@/lib/texas-intelligence/load";
import { TEXAS_INTELLIGENCE_GATE } from "@/lib/texas-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: TEXAS_INTELLIGENCE_GATE.title,
  description: TEXAS_INTELLIGENCE_GATE.description,
  path: TEXAS_INTELLIGENCE_GATE.path,
  noIndex: !TEXAS_INTELLIGENCE_GATE.robotsIndex,
});

export default function TexasIntelligencePage() {
  const snapshot = loadTexasContractorView();
  return (
    <>
      <JsonLd data={buildTexasContractorJsonLd(snapshot)} />
      <TexasContractorPage snapshot={snapshot} />
    </>
  );
}
