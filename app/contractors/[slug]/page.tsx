import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareToggle } from "@/components/compare/CompareToggle";
import { ActivitySection } from "@/components/contractor/ActivitySection";
import { CautionSummary } from "@/components/contractor/CautionSummary";
import { InsuranceGuidance } from "@/components/contractor/InsuranceGuidance";
import { ProjectFitBanner } from "@/components/contractor/ProjectFitBanner";
import { RelatedEntitySection } from "@/components/contractor/RelatedEntitySection";
import {
  DisciplineSection,
  DiscrepanciesSection,
  EntitySection,
  EvidenceSummary,
  HiringGuidance,
  LicensesSection,
  SourcesFooter,
} from "@/components/contractor/TrustReport";
import { TrustNextActions } from "@/components/contractor/TrustNextActions";
import { TrustReportNav } from "@/components/contractor/TrustReportNav";
import { WhatWeChecked } from "@/components/contractor/WhatWeChecked";
import { StudioHandoffBanner } from "@/components/studios/StudioHandoffBanner";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime, statusLabel } from "@/lib/contractors/format";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { getContractorBySlug } from "@/lib/contractors/queries";
import { matchConfidenceLine } from "@/lib/contractors/trust-report";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo/page-meta";
import { absoluteUrl } from "@/lib/site";
import { getStateBySlug } from "@/lib/states/config";
import { parseHandoffQuery } from "@/lib/studios/handoff";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  try {
    const c = await getContractorBySlug(slug, "fl");
    if (!c) {
      return {
        title: "Contractor not found",
        robots: { index: false, follow: true },
      };
    }

    const lic = c.licenses[0];
    const occ = lic ? getOccupationInfo(lic.occupationCode).label : "Florida contractor";
    const status = lic ? statusLabel(lic.statusNormalized) : "status unknown";
    const city = c.primaryCity ? ` in ${c.primaryCity}` : "";
    const path = `/contractors/${encodeURIComponent(c.slug)}`;
    const title = `${c.displayName} — Florida Contractor Trust Report`;
    const description = [
      `Trust report for ${c.displayName}${city}.`,
      lic ? `License ${lic.externalKey} (${occ}) — ${status}.` : null,
      c.entities[0]
        ? `Sunbiz entity ${statusLabel(c.entities[0].status)}.`
        : "No high-confidence Sunbiz link.",
      c.discipline.length > 0
        ? `${c.discipline.length} discipline action(s) linked.`
        : "No discipline linked in our extract.",
      "Official DBPR and Sunbiz evidence — not a marketplace.",
    ]
      .filter(Boolean)
      .join(" ");

    return pageMetadata({
      title,
      description,
      path,
      ogType: "profile",
    });
  } catch {
    return {
      title: "Contractor Trust Report",
      description:
        "Florida contractor license, Sunbiz entity, and discipline evidence from Contractor Trust Hub.",
      robots: { index: false, follow: true },
    };
  }
}

function ContractorJsonLd({
  contractor,
  path,
}: {
  contractor: NonNullable<Awaited<ReturnType<typeof getContractorBySlug>>>;
  path: string;
}) {
  const lic = contractor.licenses[0];
  // Honest ProfilePage + Organization — no ratings, reviews, or AggregateRating.
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${contractor.displayName} — Florida Contractor Trust Report`,
    url: absoluteUrl(path),
    mainEntity: {
      "@type": "Organization",
      name: contractor.displayName,
      legalName: contractor.legalName || undefined,
      address:
        contractor.primaryCity || contractor.primaryCounty
          ? {
              "@type": "PostalAddress",
              addressLocality: contractor.primaryCity || undefined,
              addressRegion: contractor.homeState || "FL",
              addressCountry: "US",
            }
          : undefined,
      identifier: lic?.externalKey
        ? {
            "@type": "PropertyValue",
            name: "Florida DBPR license",
            value: lic.externalKey,
          }
        : undefined,
    },
    description: `Independent Florida contractor evidence report for ${contractor.displayName}. License and entity data from public records — not a ranking or endorsement.`,
    isPartOf: {
      "@type": "WebSite",
      name: "Contractor Trust Hub",
      url: absoluteUrl("/"),
    },
  };

  return <JsonLd data={data} />;
}

export default async function ContractorPage({ params, searchParams }: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const sp = await searchParams;
  const studioHandoff = parseHandoffQuery(sp);
  const state = getStateBySlug("fl")!;

  let contractor;
  try {
    contractor = await getContractorBySlug(slug, "fl");
  } catch (e) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Unable to load Trust Report</h1>
        <p className="mt-3 max-w-lg text-[var(--muted)]">
          We could not load this contractor profile right now. Please try again in a few minutes.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {e instanceof Error ? e.message : "Database connection failed."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/verify"
            className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Back to search
          </Link>
          <Link
            href="/florida"
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm text-[var(--text)] no-underline"
          >
            Browse Florida
          </Link>
        </div>
      </main>
    );
  }

  if (!contractor) notFound();

  const primary = contractor.licenses[0];
  const entity = contractor.entities[0];
  const path = `/contractors/${encodeURIComponent(contractor.slug)}`;
  const location = [contractor.primaryCity, contractor.primaryCounty, contractor.homeState]
    .filter(Boolean)
    .join(" · ");
  const conf = matchConfidenceLine(entity);
  const projectType = studioHandoff?.projectType || null;
  const freshest =
    [
      primary?.lastVerifiedAt,
      entity?.lastVerifiedAt,
      contractor.discipline[0]?.lastVerifiedAt,
    ]
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-6 sm:py-10 sm:pb-10">
      <ContractorJsonLd contractor={contractor} path={path} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Verify", path: "/verify" },
          { name: contractor.displayName, path },
        ]}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link href="/verify" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          ← Search
        </Link>
        <span className="text-[var(--border)]" aria-hidden>
          ·
        </span>
        <Link href="/florida" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          Florida browse
        </Link>
        <span className="text-[var(--border)]" aria-hidden>
          ·
        </span>
        <Link href="/tools" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          Decision tools
        </Link>
      </div>

      <StudioHandoffBanner
        initial={studioHandoff}
        contractorSlug={contractor.slug}
        contractorName={contractor.displayName}
      />

      {/* A. Identity snapshot */}
      <header
        id="identity"
        className="mt-4 scroll-mt-28 border-b border-[var(--border)] pb-6 sm:pb-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Florida · Contractor Trust Report 2.0
        </p>
        <h1 className="mt-2 text-[1.65rem] font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
          {contractor.displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Evidence-first profile: who this business is, license and entity records, caution
          signals, and what to do next — not a score or endorsement.
          {contractor.isThinProfile
            ? " Limited fields in our extract — treat missing data as unknown, not cleared."
            : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {primary && (
            <span className="font-mono text-sm tracking-wide text-[var(--accent)]">
              {primary.externalKey}
            </span>
          )}
          {primary && (
            <StatusBadge
              status={primary.statusNormalized}
              label={`License: ${statusLabel(primary.statusNormalized)}`}
            />
          )}
          {entity ? (
            <StatusBadge status={entity.status} label={`Entity: ${statusLabel(entity.status)}`} />
          ) : (
            <StatusBadge status="unknown" label="No high-confidence entity link" />
          )}
          {contractor.discipline.length > 0 ? (
            <StatusBadge status="warn" label="Discipline records identified" />
          ) : (
            <StatusBadge status="unknown" label="No discipline in current extracts" />
          )}
        </div>
        {location ? <p className="mt-3 text-[15px] text-[var(--muted)]">{location}</p> : null}
        {(contractor.legalName || contractor.dbaName) && (
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {contractor.legalName ? <>Legal / linked name: {contractor.legalName}</> : null}
            {contractor.legalName && contractor.dbaName ? " · " : null}
            {contractor.dbaName ? <>DBA: {contractor.dbaName}</> : null}
          </p>
        )}
        {entity ? (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Linked entity: <span className="text-[var(--text)]">{entity.legalName}</span>
            {entity.status ? ` · ${statusLabel(entity.status)}` : ""}
            {conf ? ` · ${conf}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Linked business entity: not identified under our high-confidence match rules.
          </p>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Extract freshness (latest field): {formatDateTime(freshest)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <CompareToggle slug={contractor.slug} />
          <a
            href="#next-actions"
            className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--navy)] no-underline"
          >
            Next actions
          </a>
          <a
            href="#caution"
            className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm text-[var(--muted)] no-underline hover:text-[var(--text)]"
          >
            Caution history
          </a>
        </div>
      </header>

      <div className="mt-4">
        <TrustReportNav />
      </div>

      <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
        <ProjectFitBanner
          contractor={contractor}
          handoff={studioHandoff}
          projectType={projectType}
        />

        <EvidenceSummary contractor={contractor} />
        <CautionSummary contractor={contractor} />
        <WhatWeChecked contractor={contractor} />

        {/* B. License evidence */}
        <LicensesSection licenses={contractor.licenses} />

        {/* C. Caution & regulatory */}
        <DisciplineSection discipline={contractor.discipline} />

        {/* D. Business / entity */}
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
          <EntitySection entities={contractor.entities} state={state} />
          <DiscrepanciesSection contractor={contractor} />
        </div>
        <RelatedEntitySection contractor={contractor} />

        {/* Insurance guidance */}
        <InsuranceGuidance contractor={contractor} />

        {/* E. Activity framework */}
        <ActivitySection contractor={contractor} />

        <HiringGuidance contractor={contractor} />

        {/* F. Next actions */}
        <TrustNextActions
          slug={contractor.slug}
          name={contractor.displayName}
          handoff={studioHandoff}
          projectType={projectType}
        />

        <SourcesFooter contractor={contractor} state={state} />

        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-[var(--muted)]">See something wrong on this report?</p>
          <Link
            href={`/corrections?slug=${encodeURIComponent(contractor.slug)}${
              primary?.externalKey
                ? `&license=${encodeURIComponent(primary.externalKey)}`
                : ""
            }`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
          >
            Request a correction
          </Link>
        </div>

        <LegalNotice />
      </div>
    </main>
  );
}
