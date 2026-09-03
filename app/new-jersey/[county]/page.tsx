import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewJerseyCountyPage } from "@/components/new-jersey/nj-county-page";
import { JsonLd } from "@/components/seo/JsonLd";
import { NJ_COUNTY_SLUGS, isNjCountySlug } from "@/lib/new-jersey-intelligence/counties/catalog";
import { loadNjCountySnapshot, njsaviVendorsForCounty } from "@/lib/new-jersey-intelligence/counties/load";
import { njCountyGate } from "@/lib/new-jersey-intelligence/counties/publication";
import { buildNewJerseyCountyJsonLd } from "@/lib/new-jersey-intelligence/jsonld";
import { pageMetadata } from "@/lib/seo/page-meta";

type Params = { county: string };

export function generateStaticParams() {
  return NJ_COUNTY_SLUGS.map((county) => ({ county }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { county } = await params;
  if (!isNjCountySlug(county)) return { title: "Not found", robots: { index: false } };
  const snapshot = loadNjCountySnapshot(county);
  if (!snapshot) return { title: "Not found", robots: { index: false } };
  const gate = njCountyGate(county, snapshot.county, snapshot.publication_gate.indexable);
  return pageMetadata({
    title: gate.title,
    description: gate.description,
    path: gate.path,
    noIndex: !gate.robotsIndex,
  });
}

export default async function NewJerseyCountyIntelligencePage({ params }: { params: Promise<Params> }) {
  const { county } = await params;
  if (!isNjCountySlug(county)) notFound();
  const snapshot = loadNjCountySnapshot(county);
  if (!snapshot) notFound();
  const vendors = njsaviVendorsForCounty(snapshot.county);
  return (
    <>
      <JsonLd data={buildNewJerseyCountyJsonLd(snapshot)} />
      <NewJerseyCountyPage snapshot={snapshot} vendors={vendors} />
    </>
  );
}
