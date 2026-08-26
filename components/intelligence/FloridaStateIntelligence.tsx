import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { getSiteUrl } from "@/lib/site";
import type { FloridaIntelligencePayload } from "@/lib/intelligence/florida-snapshot";
import { metricById } from "@/lib/intelligence/florida-snapshot";
import { IntelligenceHero } from "./IntelligenceHero";
import { IntelligenceMetricGrid } from "./IntelligenceMetricGrid";
import { IntelligenceCategoryExplorer } from "./IntelligenceCategoryExplorer";
import { IntelligenceGeographyExplorer } from "./IntelligenceGeographyExplorer";
import { IntelligenceEvidenceScale } from "./IntelligenceEvidenceScale";
import { IntelligenceCoverageSection } from "./IntelligenceCoverageSection";
import { IntelligenceSourceSection } from "./IntelligenceSourceCard";
import { IntelligenceEducationSection } from "./IntelligenceEducationSection";
import { IntelligenceContinue } from "./IntelligenceContinue";

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
          name: "Research Florida Contractors",
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
        <IntelligenceCategoryExplorer
          categories={payload.categories}
          timedOut={payload.timedOut}
        />
        <IntelligenceGeographyExplorer
          counties={payload.geography}
          timedOut={payload.timedOut}
          countiesRepresented={countiesRepresented}
        />
        <IntelligenceEvidenceScale
          sources={payload.evidenceSources}
          observationTotal={observations}
          timedOut={payload.timedOut}
        />
        <IntelligenceCoverageSection items={payload.coverage} />
        <IntelligenceSourceSection sources={payload.evidenceSources} />
        <IntelligenceEducationSection modules={payload.education} />
        <IntelligenceContinue />
      </div>

      <div className="mt-12 space-y-3">
        <p className="text-xs text-[var(--muted)]">
          Intelligence aggregation {payload.version}
          {payload.generatedAt ? ` · generated ${payload.generatedAt.slice(0, 16).replace("T", " ")} UTC` : ""}
          . Regenerating the payload updates these figures without changing page copy.
        </p>
        <DiscoveryDisclaimer />
      </div>
    </main>
  );
}
