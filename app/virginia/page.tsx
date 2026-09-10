import type { Metadata } from "next";
import { VirginiaIntelPage } from "@/components/virginia/va-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildVirginiaContractorJsonLd } from "@/lib/virginia-intelligence/jsonld";
import { loadVirginiaContractorView } from "@/lib/virginia-intelligence/load";
import { VIRGINIA_INTELLIGENCE_GATE } from "@/lib/virginia-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: VIRGINIA_INTELLIGENCE_GATE.title,
  description: VIRGINIA_INTELLIGENCE_GATE.description,
  path: VIRGINIA_INTELLIGENCE_GATE.path,
  noIndex: !VIRGINIA_INTELLIGENCE_GATE.robotsIndex,
});

export default function VirginiaIntelligencePage() {
  const snapshot = loadVirginiaContractorView();
  return (
    <>
      <JsonLd data={buildVirginiaContractorJsonLd(snapshot)} />
      <VirginiaIntelPage snapshot={snapshot} />
    </>
  );
}
