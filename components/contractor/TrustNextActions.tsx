"use client";

import { useEffect } from "react";
import { CompareToggle } from "@/components/compare/CompareToggle";
import { WatchButton } from "@/components/projects/WatchButton";
import {
  NextBestAction,
  NextBestActionSticky,
} from "@/components/funnel/NextBestAction";
import { trackFunnel } from "@/lib/funnel/analytics";
import { trustReportActions } from "@/lib/funnel/cta-matrix";
import { saveJourneyContext } from "@/lib/funnel/journey-context";
import type { StudioHandoff } from "@/lib/studios/handoff";

export function TrustNextActions({
  slug,
  name,
  handoff,
  projectType,
  licenseKey,
  licenseStatus,
  entityStatus,
  disciplineCount,
}: {
  slug: string;
  name: string;
  handoff?: StudioHandoff | null;
  projectType?: string | null;
  licenseKey?: string | null;
  licenseStatus?: string | null;
  entityStatus?: string | null;
  disciplineCount?: number;
}) {
  const q = new URLSearchParams();
  q.set("name", name);
  q.set("contractor", slug);
  if (projectType) q.set("type", projectType);
  if (handoff?.scaleLabel) {
    const s = handoff.scaleLabel.toLowerCase();
    if (s.includes("small") || s.includes("light") || s.includes("cosmetic"))
      q.set("scale", "small");
    else if (s.includes("large") || s.includes("full") || s.includes("complex"))
      q.set("scale", "large");
    else q.set("scale", "medium");
  }
  if (handoff?.locationLabel) {
    const zip = handoff.locationLabel.match(/\b\d{5}\b/);
    if (zip) q.set("zip", zip[0]);
  }
  const toolsQs = q.toString();

  useEffect(() => {
    trackFunnel("trust_report_viewed", { slug, name });
    saveJourneyContext({
      contractorSlug: slug,
      contractorName: name,
      projectType: projectType || undefined,
      entryPath: handoff ? "studio" : "verify",
    });
  }, [slug, name, projectType, handoff]);

  const spec = trustReportActions({
    slug,
    name,
    hasProjectContext: Boolean(handoff || projectType),
    projectType,
    toolsQs,
  });

  return (
    <>
      <NextBestAction spec={spec} />

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
        <CompareToggle slug={slug} />
        <span className="text-xs text-[var(--muted)]">Compare side by side</span>
        <span className="hidden text-[var(--border)] sm:inline">·</span>
        <WatchButton
          slug={slug}
          name={name}
          licenseKey={licenseKey}
          licenseStatus={licenseStatus}
          entityStatus={entityStatus}
          disciplineCount={disciplineCount}
        />
      </div>

      {handoff ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Project context from {handoff.studioName} is preserved in tool links.{" "}
          <a href={handoff.resultsPath} className="font-semibold text-[var(--navy)]">
            Back to studio results →
          </a>
        </p>
      ) : null}

      <NextBestActionSticky
        surface="trust_report"
        primaryHref={`/tools/quote-analyzer?${toolsQs}`}
        primaryLabel="Analyze quote"
        secondaryHref={`/tools/pre-hire-checklist?${toolsQs}`}
        secondaryLabel="Checklist"
      />
    </>
  );
}
