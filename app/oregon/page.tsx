import type { Metadata } from "next";
import { OregonIntelPage } from "@/components/oregon/or-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildOregonContractorJsonLd } from "@/lib/oregon-intelligence/jsonld";
import { loadOregonContractorView } from "@/lib/oregon-intelligence/load";
import { OREGON_INTELLIGENCE_GATE } from "@/lib/oregon-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: OREGON_INTELLIGENCE_GATE.title,
  description: OREGON_INTELLIGENCE_GATE.description,
  path: OREGON_INTELLIGENCE_GATE.path,
  noIndex: !OREGON_INTELLIGENCE_GATE.robotsIndex,
});

export default function OregonIntelligencePage() {
  const snapshot = loadOregonContractorView();
  return (
    <>
      <JsonLd data={buildOregonContractorJsonLd(snapshot)} />
      <OregonIntelPage snapshot={snapshot} />
    </>
  );
}
