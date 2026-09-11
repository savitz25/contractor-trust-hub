import type { Metadata } from "next";
import { IllinoisIntelPage } from "@/components/illinois/il-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildIllinoisContractorJsonLd } from "@/lib/illinois-intelligence/jsonld";
import { loadIllinoisContractorView } from "@/lib/illinois-intelligence/load";
import { ILLINOIS_INTELLIGENCE_GATE } from "@/lib/illinois-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: ILLINOIS_INTELLIGENCE_GATE.title,
  description: ILLINOIS_INTELLIGENCE_GATE.description,
  path: ILLINOIS_INTELLIGENCE_GATE.path,
  noIndex: !ILLINOIS_INTELLIGENCE_GATE.robotsIndex,
});

export default function IllinoisIntelligencePage() {
  const snapshot = loadIllinoisContractorView();
  return (
    <>
      <JsonLd data={buildIllinoisContractorJsonLd(snapshot)} />
      <IllinoisIntelPage snapshot={snapshot} />
    </>
  );
}
