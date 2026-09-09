import type { Metadata } from "next";
import { ColoradoIntelPage } from "@/components/colorado/co-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildColoradoContractorJsonLd } from "@/lib/colorado-intelligence/jsonld";
import { loadColoradoContractorView, loadColoradoIdentityLookup } from "@/lib/colorado-intelligence/load";
import { COLORADO_INTELLIGENCE_GATE } from "@/lib/colorado-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

type Props = {
  searchParams: Promise<{
    q?: string;
    prefix?: string;
    number?: string;
    city?: string;
    status?: string;
  }>;
};

export const metadata: Metadata = pageMetadata({
  title: COLORADO_INTELLIGENCE_GATE.title,
  description: COLORADO_INTELLIGENCE_GATE.description,
  path: COLORADO_INTELLIGENCE_GATE.path,
  noIndex: !COLORADO_INTELLIGENCE_GATE.robotsIndex,
});

export default async function ColoradoIntelligencePage({ searchParams }: Props) {
  const sp = await searchParams;
  const snapshot = loadColoradoContractorView();
  const lookup = loadColoradoIdentityLookup(sp);
  return (
    <>
      <JsonLd data={buildColoradoContractorJsonLd(snapshot)} />
      <ColoradoIntelPage snapshot={snapshot} lookup={lookup} />
    </>
  );
}
