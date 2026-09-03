import type { Metadata } from "next";
import { NewJerseyContractorPage } from "@/components/new-jersey/nj-state-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildNewJerseyContractorJsonLd } from "@/lib/new-jersey-intelligence/jsonld";
import { loadNewJerseyContractorView } from "@/lib/new-jersey-intelligence/load";
import { NEW_JERSEY_INTELLIGENCE_GATE } from "@/lib/new-jersey-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: NEW_JERSEY_INTELLIGENCE_GATE.title,
  description: NEW_JERSEY_INTELLIGENCE_GATE.description,
  path: NEW_JERSEY_INTELLIGENCE_GATE.path,
  noIndex: !NEW_JERSEY_INTELLIGENCE_GATE.robotsIndex,
});

export default function NewJerseyIntelligencePage() {
  const snapshot = loadNewJerseyContractorView();
  return (
    <>
      <JsonLd data={buildNewJerseyContractorJsonLd(snapshot)} />
      <NewJerseyContractorPage snapshot={snapshot} />
    </>
  );
}
