import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { getSiteUrl } from "@/lib/site";
import type { FloridaIntelligencePayload } from "@/lib/intelligence/florida-snapshot";
import { metricById } from "@/lib/intelligence/florida-snapshot";
import { IntelligenceHero } from "./IntelligenceHero";
import { IntelligenceMetricGrid } from "./IntelligenceMetricGrid";
import { IntelligenceGeographyExplorer } from "./IntelligenceGeographyExplorer";
import { IntelligenceCoverageSection } from "./IntelligenceCoverageSection";
import { IntelligenceSourceSection } from "./IntelligenceSourceCard";
import { IntelligenceEducationSection } from "./IntelligenceEducationSection";
import { IntelligenceContinue } from "./IntelligenceContinue";
import {
  AskMarket,
  CategoryBars,
  CountyPreviewList,
  EvidenceJourney,
  FeaturedFindings,
  MarketCompare,
  ResearchChecklist,
  TraceNumber,
  UseTheResearch,
  WhatWeDontKnow,
} from "./IntelligenceOsSections";
import {
  buildAskItems,
  buildCompareRows,
  buildFloridaFindings,
  buildTraceFamilies,
  standsOutStatements,
} from "@/lib/intelligence/os-layer";

export function FloridaStateIntelligence({ payload }: { payload: FloridaIntelligencePayload }) {
  const countiesRepresented =
    metricById(payload, "florida_counties_represented")?.value ?? null;
  const observations =
    metricById(payload, "regulatory_observations_researched")?.value ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Florida Contractor Intelligence",
          description:
            "Independent research of Florida contractor credentials, trade categories, HQ/base county distribution, and public regulatory records. Not a marketplace or ranking.",
          url: `${getSiteUrl()}/florida`,
          isPartOf: { "@id": `${getSiteUrl()}/#website` },
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Florida", path: "/florida" },
        ]}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida" },
        ]}
      />

      <div className="mt-4 space-y-14 sm:space-y-16">
        <IntelligenceHero />
        <IntelligenceMetricGrid
          metrics={payload.metrics}
          timedOut={payload.timedOut}
          asOf={payload.asOf}
        />
        <TraceNumber
          total={observations}
          families={buildTraceFamilies(payload.evidenceSources)}
          timedOut={payload.timedOut}
        />
        <FeaturedFindings
          findings={buildFloridaFindings({
            metrics: payload.metrics,
            categories: payload.categories,
            geography: payload.geography,
            sources: payload.evidenceSources,
            asOf: payload.asOf,
          })}
        />
        <IntelligenceCoverageSection items={payload.coverage} />
        <WhatWeDontKnow />
        <CountyPreviewList counties={payload.geography} />
        <IntelligenceGeographyExplorer
          counties={payload.geography}
          timedOut={payload.timedOut}
          countiesRepresented={countiesRepresented}
        />
        {(() => {
          const tracked = metricById(payload, "dbpr_credentials_tracked")?.value ?? null;
          const active = metricById(payload, "active_credentials")?.value ?? null;
          const roofing = payload.categories.find((c) => c.slug === "roofers")?.tracked ?? null;
          const general = payload.categories.find((c) => c.slug === "general-contractors")?.tracked ?? null;
          const slugs = ["broward", "palm-beach", "miami-dade", "pinellas"] as const;
          const rows = buildCompareRows({
            floridaTracked: tracked,
            floridaActive: active,
            floridaRoofing: roofing,
            floridaGeneral: general,
            counties: slugs.map((slug) => {
              const c = payload.geography.find((g) => g.slug === slug);
              return {
                id: slug,
                label: c?.name ? `${c.name} County` : slug,
                href: c?.href || `/florida/${slug}`,
                tracked: c?.tracked ?? null,
                active: c?.active ?? null,
                roofing: c?.roofing ?? null,
                general: c?.general ?? null,
                researchDepth: "statewide" as const,
              };
            }),
          });
          return <MarketCompare rows={rows} statements={standsOutStatements(rows)} />;
        })()}
        <CategoryBars categories={payload.categories} timedOut={payload.timedOut} />
        <AskMarket items={buildAskItems({ metrics: payload.metrics, categories: payload.categories })} />
        <UseTheResearch />
        <ResearchChecklist />
        <EvidenceJourney />
        <IntelligenceSourceSection sources={payload.evidenceSources} />
        <IntelligenceEducationSection modules={payload.education} />
        <IntelligenceContinue />
      </div>

      <div className="mt-12 space-y-3">
        <p className="text-xs text-[var(--muted)]">
          Intelligence aggregation {payload.version}
          {payload.canonicalFingerprint ? ` · fingerprint ${payload.canonicalFingerprint.slice(0, 12)}` : ""}
          {payload.generatedAt ? ` · generated ${payload.generatedAt.slice(0, 16).replace("T", " ")} UTC` : ""}
          . Fingerprint excludes generatedAt. Regenerating from unchanged evidence keeps the fingerprint.
        </p>
        <DiscoveryDisclaimer />
      </div>
    </main>
  );
}
