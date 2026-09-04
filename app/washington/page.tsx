import type { Metadata } from "next";
import { WashingtonIntelPage } from "@/components/washington/wa-state-intel-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildWashingtonContractorJsonLd } from "@/lib/washington-intelligence/jsonld";
import { loadWashingtonContractorView, loadWashingtonIdentityLookup } from "@/lib/washington-intelligence/load";
import { WASHINGTON_INTELLIGENCE_GATE } from "@/lib/washington-intelligence/publication";
import { pageMetadata } from "@/lib/seo/page-meta";

type Props = {
  searchParams: Promise<{
    q?: string;
    registration?: string;
    ubi?: string;
    city?: string;
    zip?: string;
    type?: string;
    specialty?: string;
    status?: string;
  }>;
};

export const metadata: Metadata = pageMetadata({
  title: WASHINGTON_INTELLIGENCE_GATE.title,
  description: WASHINGTON_INTELLIGENCE_GATE.description,
  path: WASHINGTON_INTELLIGENCE_GATE.path,
  noIndex: !WASHINGTON_INTELLIGENCE_GATE.robotsIndex,
});

export default async function WashingtonIntelligencePage({ searchParams }: Props) {
  const sp = await searchParams;
  const snapshot = loadWashingtonContractorView();
  const lookup = loadWashingtonIdentityLookup(sp);
  return (
    <>
      <JsonLd data={buildWashingtonContractorJsonLd(snapshot)} />
      <WashingtonIntelPage snapshot={snapshot} lookup={lookup} />
    </>
  );
}
