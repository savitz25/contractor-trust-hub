import type { Metadata } from "next";
import { ArizonaIntelPage } from "@/components/arizona/az-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildArizonaContractorJsonLd } from "@/lib/arizona-intelligence/jsonld";
import { loadArizonaContractorView } from "@/lib/arizona-intelligence/load";
import { ARIZONA_INTELLIGENCE_GATE } from "@/lib/arizona-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: ARIZONA_INTELLIGENCE_GATE.title,
  description: ARIZONA_INTELLIGENCE_GATE.description,
  path: ARIZONA_INTELLIGENCE_GATE.path,
  noIndex: !ARIZONA_INTELLIGENCE_GATE.robotsIndex,
});

export default function ArizonaIntelligencePage() {
  const snapshot = loadArizonaContractorView();
  return (
    <>
      <JsonLd data={buildArizonaContractorJsonLd(snapshot)} />
      <ArizonaIntelPage snapshot={snapshot} />
    </>
  );
}
