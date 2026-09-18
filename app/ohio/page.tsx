import type { Metadata } from "next";
import { OhioIntelPage } from "@/components/ohio/oh-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildOhioContractorJsonLd } from "@/lib/ohio-intelligence/jsonld";
import { loadOhioContractorView } from "@/lib/ohio-intelligence/load";
import { OHIO_INTELLIGENCE_GATE } from "@/lib/ohio-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: OHIO_INTELLIGENCE_GATE.title,
  description: OHIO_INTELLIGENCE_GATE.description,
  path: OHIO_INTELLIGENCE_GATE.path,
  noIndex: !OHIO_INTELLIGENCE_GATE.robotsIndex,
});

export default function OhioIntelligencePage() {
  const snapshot = loadOhioContractorView();
  return (
    <>
      <JsonLd data={buildOhioContractorJsonLd(snapshot)} />
      <OhioIntelPage snapshot={snapshot} />
    </>
  );
}
