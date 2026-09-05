import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContractorHomeIntelligence } from "@/components/home-intel/ContractorHomeIntelligence";
import { getContractorHomeIntel } from "@/lib/home-intel/build";
import { parseNetworkJourney, resolveContractorJourneyModule } from "@/lib/network/journey-handoff";
import { pageMetadata } from "@/lib/seo/page-meta";
import { SHARE_HUB } from "@/lib/seo/share-hub";

const isProd = process.env.VERCEL_ENV === "production";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Contractor license, bond, insurance & permit research",
    description:
      "Research contractor identities through official licensing, bond, insurance, permit, enforcement, and public business records where available.",
    path: "/",
    noIndex: !isProd,
  }),
  keywords: [
    "contractor intelligence",
    "contractor license research",
    "contractor verification",
    "state contractor licensing",
    "public regulatory evidence",
    "contractor bond research",
    "contractor insurance research",
    "contractor permit history",
  ],
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const journeyModule = resolveContractorJourneyModule(parseNetworkJourney(sp), "home");
  const intel = getContractorHomeIntel();
  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${SHARE_HUB.origin}/#webpage`,
          name: "Contractor license, bond, insurance, and permit research",
          url: SHARE_HUB.origin,
          description:
            "Official-source contractor intelligence connecting identities to licensing, bonds, insurance, permits, enforcement, and public business records where available.",
          isPartOf: { "@id": `${SHARE_HUB.origin}/#website` },
          about: [
            { "@type": "Thing", name: "State contractor licensing" },
            { "@type": "Thing", name: "Contractor credential research" },
            { "@type": "Thing", name: "Public regulatory evidence" },
            { "@type": "Thing", name: "Contractor bond and insurance research" },
            { "@type": "Thing", name: "Contractor permit history" },
          ],
        }}
      />
      <ContractorHomeIntelligence intel={intel} journeyModule={journeyModule} />
    </main>
  );
}
