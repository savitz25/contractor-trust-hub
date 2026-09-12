import type { Metadata } from "next";
import { NycIntelPage } from "@/components/new-york/nyc-local-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildNycContractorJsonLd } from "@/lib/new-york-city-intelligence/jsonld";
import { loadNycContractorView } from "@/lib/new-york-city-intelligence/load";
import { NYC_INTELLIGENCE_GATE } from "@/lib/new-york-city-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: NYC_INTELLIGENCE_GATE.title,
  description: NYC_INTELLIGENCE_GATE.description,
  path: NYC_INTELLIGENCE_GATE.path,
  noIndex: !NYC_INTELLIGENCE_GATE.robotsIndex,
});

export default function NewYorkCityIntelligencePage() {
  const snapshot = loadNycContractorView();
  return (
    <>
      <JsonLd data={buildNycContractorJsonLd(snapshot)} />
      <NycIntelPage snapshot={snapshot} />
    </>
  );
}
