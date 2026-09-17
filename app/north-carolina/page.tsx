import type { Metadata } from "next";
import { NorthCarolinaIntelPage } from "@/components/north-carolina/nc-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildNorthCarolinaContractorJsonLd } from "@/lib/north-carolina-intelligence/jsonld";
import { loadNorthCarolinaContractorView } from "@/lib/north-carolina-intelligence/load";
import { NORTH_CAROLINA_INTELLIGENCE_GATE } from "@/lib/north-carolina-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: NORTH_CAROLINA_INTELLIGENCE_GATE.title,
  description: NORTH_CAROLINA_INTELLIGENCE_GATE.description,
  path: NORTH_CAROLINA_INTELLIGENCE_GATE.path,
  noIndex: !NORTH_CAROLINA_INTELLIGENCE_GATE.robotsIndex,
});

export default function NorthCarolinaIntelligencePage() {
  const snapshot = loadNorthCarolinaContractorView();
  return (
    <>
      <JsonLd data={buildNorthCarolinaContractorJsonLd(snapshot)} />
      <NorthCarolinaIntelPage snapshot={snapshot} />
    </>
  );
}
