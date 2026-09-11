import type { Metadata } from "next";
import { NewYorkIntelPage } from "@/components/new-york/ny-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildNewYorkContractorJsonLd } from "@/lib/new-york-intelligence/jsonld";
import { loadNewYorkContractorView } from "@/lib/new-york-intelligence/load";
import { NEW_YORK_INTELLIGENCE_GATE } from "@/lib/new-york-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: NEW_YORK_INTELLIGENCE_GATE.title,
  description: NEW_YORK_INTELLIGENCE_GATE.description,
  path: NEW_YORK_INTELLIGENCE_GATE.path,
  noIndex: !NEW_YORK_INTELLIGENCE_GATE.robotsIndex,
});

export default function NewYorkIntelligencePage() {
  const snapshot = loadNewYorkContractorView();
  return (
    <>
      <JsonLd data={buildNewYorkContractorJsonLd(snapshot)} />
      <NewYorkIntelPage snapshot={snapshot} />
    </>
  );
}
