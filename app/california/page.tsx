import type { Metadata } from "next";
import { CaliforniaContractorPage } from "@/components/california/ca-state-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildCaliforniaContractorJsonLd } from "@/lib/california-intelligence/jsonld";
import { loadCaliforniaContractorView } from "@/lib/california-intelligence/load";
import { CALIFORNIA_INTELLIGENCE_GATE } from "@/lib/california-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: CALIFORNIA_INTELLIGENCE_GATE.title,
  description: CALIFORNIA_INTELLIGENCE_GATE.description,
  path: CALIFORNIA_INTELLIGENCE_GATE.path,
  noIndex: !CALIFORNIA_INTELLIGENCE_GATE.robotsIndex,
});

export default function CaliforniaIntelligencePage() {
  const snapshot = loadCaliforniaContractorView();
  return (
    <>
      <JsonLd data={buildCaliforniaContractorJsonLd(snapshot)} />
      <CaliforniaContractorPage snapshot={snapshot} />
    </>
  );
}
