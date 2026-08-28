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
    title: "Understand contractor licensing before you hire",
    description:
      "Independent contractor-market intelligence: how state licensing systems differ, what TrustHub can verify, and what a credential does not prove. No ranking. You decide.",
    path: "/",
    noIndex: !isProd,
  }),
  keywords: [
    "contractor intelligence",
    "contractor license research",
    "contractor verification",
    "state contractor licensing",
    "public regulatory evidence",
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
          name: "Understand contractor licensing before you hire",
          url: SHARE_HUB.origin,
          description:
            "Independent contractor-market intelligence from official public sources. TrustHub does not rank contractors.",
          isPartOf: { "@id": `${SHARE_HUB.origin}/#website` },
          about: [
            { "@type": "Thing", name: "State contractor licensing" },
            { "@type": "Thing", name: "Contractor credential research" },
            { "@type": "Thing", name: "Public regulatory evidence" },
          ],
        }}
      />
      <ContractorHomeIntelligence intel={intel} journeyModule={journeyModule} />
    </main>
  );
}
