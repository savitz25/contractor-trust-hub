import type { Metadata } from "next";
import { PennsylvaniaIntelPage } from "@/components/pennsylvania/pa-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildPennsylvaniaContractorJsonLd } from "@/lib/pennsylvania-intelligence/jsonld";
import { loadPennsylvaniaContractorView } from "@/lib/pennsylvania-intelligence/load";
import { PENNSYLVANIA_INTELLIGENCE_GATE } from "@/lib/pennsylvania-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: PENNSYLVANIA_INTELLIGENCE_GATE.title,
  description: PENNSYLVANIA_INTELLIGENCE_GATE.description,
  path: PENNSYLVANIA_INTELLIGENCE_GATE.path,
  noIndex: !PENNSYLVANIA_INTELLIGENCE_GATE.robotsIndex,
});

export default function PennsylvaniaIntelligencePage() {
  const snapshot = loadPennsylvaniaContractorView();
  return (
    <>
      <JsonLd data={buildPennsylvaniaContractorJsonLd(snapshot)} />
      <PennsylvaniaIntelPage snapshot={snapshot} />
    </>
  );
}
