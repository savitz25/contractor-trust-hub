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
import { NjNextActions } from "@/components/contractor/NjNextActions";
import { ArizonaCoverageBanner } from "@/components/search/ArizonaCoverageBanner";
import { CaliforniaCoverageBanner } from "@/components/search/CaliforniaCoverageBanner";
import { NjCoverageBanner } from "@/components/search/NjCoverageBanner";
import { OregonCoverageBanner } from "@/components/search/OregonCoverageBanner";
import { TexasCoverageBanner } from "@/components/search/TexasCoverageBanner";
import { StudioHandoffBanner } from "@/components/studios/StudioHandoffBanner";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { displayStatusLabel, formatDateTime, statusLabel } from "@/lib/contractors/format";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { getContractorBySlug } from "@/lib/contractors/queries";
import { matchConfidenceLine } from "@/lib/contractors/trust-report";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo/page-meta";
import { absoluteUrl } from "@/lib/site";
import { getStateBySlug } from "@/lib/states/config";
import {
  evidenceSlugFromHomeState,
  trustReportTitleSuffix,
} from "@/lib/states/evidence-copy";
import { azClassPlainLabel } from "@/lib/states/az-roc";
import { caClassPlainLabel } from "@/lib/states/ca-classifications";
import { njCredentialPlainLabel } from "@/lib/states/nj-credentials";
import { orCcbDisplayLabel } from "@/lib/states/or-ccb";
import { txTradePlainLabel } from "@/lib/states/tx-trades";
import { parseHandoffQuery } from "@/lib/studios/handoff";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  try {
    const c = await getContractorBySlug(slug);
    if (!c) {
      return {
        title: "Contractor not found",
        robots: { index: false, follow: true },
      };
    }

    const stateSlug = evidenceSlugFromHomeState(c.homeState);
    const isTx = stateSlug === "tx";
    const isNj = stateSlug === "nj";
    const isOr = stateSlug === "or";
    const lic = c.licenses[0];
    const occ = lic
      ? isTx
        ? txTradePlainLabel(lic.occupationCode)
        : isNj
          ? njCredentialPlainLabel(lic.occupationCode)
          : isOr
            ? orCcbDisplayLabel(lic.occupationCode)
          : getOccupationInfo(lic.occupationCode).label
      : isTx
        ? "Texas specialty contractor"
        : isNj
          ? "New Jersey contractor registration"
          : isOr
            ? "Oregon CCB contractor"
          : "Florida contractor";
    const status = lic ? statusLabel(lic.statusNormalized) : "status unknown";
    const city = c.primaryCity ? ` in ${c.primaryCity}` : "";
    const path = `/contractors/${encodeURIComponent(c.slug)}`;
    const title = `${c.displayName} — ${trustReportTitleSuffix(stateSlug)}`;
    const description = [
      `Trust report for ${c.displayName}${city}.`,
      lic ? `Credential ${lic.externalKey} (${occ}) — ${status}.` : null,
      isTx
        ? "TDLR specialty or TSBPE plumbing evidence — not a statewide general contractor directory."
        : isOr
          ? "Oregon CCB Active Licenses evidence. Bond/insurance as published — not a live COI."
        : isNj
          ? "New Jersey HIC / specialty evidence — no statewide general contractor license; coverage differs by state."
          : c.entities[0]
            ? `Sunbiz entity ${statusLabel(c.entities[0].status)}.`
            : "No high-confidence Sunbiz link.",
      c.discipline.length > 0
        ? `${c.discipline.length} discipline action(s) linked.`
        : "No discipline linked in our extract.",
      isTx
        ? "Official TDLR / TSBPE open-data evidence — not a marketplace."
        : isOr
          ? "Official Oregon CCB open-data evidence — not a marketplace."
        : isNj
          ? "Official NJ DCA extract evidence — not a marketplace."
          : "Official DBPR and Sunbiz evidence — not a marketplace.",
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
  const stateSlug = evidenceSlugFromHomeState(contractor.homeState);
  const isTx = stateSlug === "tx";
  const isNj = stateSlug === "nj";
  // Honest ProfilePage + Organization — no ratings, reviews, or AggregateRating.
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${contractor.displayName} — ${trustReportTitleSuffix(stateSlug)}`,
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
              addressRegion:
                contractor.homeState || (isTx ? "TX" : isNj ? "NJ" : "FL"),
              addressCountry: "US",
            }
          : undefined,
      identifier: lic?.externalKey
        ? {
            "@type": "PropertyValue",
            name: isTx
              ? "Texas TDLR license"
              : isNj
                ? "New Jersey registration"
                : "Florida DBPR license",
            value: lic.externalKey,
          }
        : undefined,
    },
    description: isTx
      ? `Independent Texas TDLR specialty or TSBPE plumbing evidence for ${contractor.displayName}. Not a statewide general contractor directory — not a ranking or endorsement.`
      : isNj
        ? `New Jersey verification pilot report for ${contractor.displayName}. Registration extract evidence — not a ranking or endorsement.`
        : `Independent Florida contractor evidence report for ${contractor.displayName}. License and entity data from public records — not a ranking or endorsement.`,
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

  let contractor;
  try {
    contractor = await getContractorBySlug(slug);
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

  const stateSlug = evidenceSlugFromHomeState(contractor.homeState);
  const isTx = stateSlug === "tx";
  const isNj = stateSlug === "nj";
  const isOr = stateSlug === "or";
  const isCa = stateSlug === "ca";
  const isAz = stateSlug === "az";
  /** TX/OR/CA/AZ keep thin reports; NJ Stage 8A is fuller Verify depth. */
  const isTxOnly = isTx || isOr || isCa || isAz;
  const isFlFull = !isTx && !isNj && !isOr && !isCa && !isAz;
  const state = getStateBySlug(stateSlug) || getStateBySlug("fl")!;
  const verifyHref =
    stateSlug === "fl" ? "/verify" : `/verify?state=${stateSlug}`;
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

  const txTradeLabel = isTx && primary ? txTradePlainLabel(primary.occupationCode) : null;
  const njCredLabel = isNj && primary ? njCredentialPlainLabel(primary.occupationCode) : null;
  const orTypeLabel = isOr && primary ? orCcbDisplayLabel(primary.occupationCode) : null;
  const caClassLabel = isCa && primary ? caClassPlainLabel(primary.occupationCode) : null;
  const azClassLabel = isAz && primary ? azClassPlainLabel(primary.occupationCode) : null;

  return (
    <main
      className={`mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 ${
        isTxOnly ? "pb-10" : "pb-28 sm:pb-10"
      }`}
    >
      <ContractorJsonLd contractor={contractor} path={path} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Verify", path: verifyHref },
          { name: contractor.displayName, path },
        ]}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link
          href={verifyHref}
          className="text-[var(--muted)] no-underline hover:text-[var(--text)]"
        >
          ← Search
        </Link>
        {isFlFull ? (
          <>
            <span className="text-[var(--border)]" aria-hidden>
              ·
            </span>
            <Link
              href="/florida"
              className="text-[var(--muted)] no-underline hover:text-[var(--text)]"
            >
              Florida browse
            </Link>
          </>
        ) : null}
        {isFlFull ? (
          <>
            <span className="text-[var(--border)]" aria-hidden>
              ·
            </span>
            <Link href="/tools" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
              Decision tools
            </Link>
          </>
        ) : (
          <>
            <span className="text-[var(--border)]" aria-hidden>
              ·
            </span>
            <Link href="/verify" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
              Florida Verify
            </Link>
            {isNj ? (
              <>
                <span className="text-[var(--border)]" aria-hidden>
                  ·
                </span>
                <Link
                  href="/tools/pre-hire-checklist?state=nj"
                  className="text-[var(--muted)] no-underline hover:text-[var(--text)]"
                >
                  Checklist
                </Link>
              </>
            ) : null}
          </>
        )}
      </div>

      {isFlFull ? (
        <StudioHandoffBanner
          initial={studioHandoff}
          contractorSlug={contractor.slug}
          contractorName={contractor.displayName}
        />
      ) : null}

      {isTx ? (
        <div className="mt-3 max-w-3xl sm:mt-4">
          <TexasCoverageBanner compact />
        </div>
      ) : null}
      {isNj ? (
        <div className="mt-3 max-w-3xl sm:mt-4">
          <NjCoverageBanner compact />
        </div>
      ) : null}
      {isOr ? (
        <div className="mt-3 max-w-3xl sm:mt-4">
          <OregonCoverageBanner compact />
        </div>
      ) : null}
      {isCa ? (
        <div className="mt-3 max-w-3xl sm:mt-4">
          <CaliforniaCoverageBanner compact />
        </div>
      ) : null}
      {isAz ? (
        <div className="mt-3 max-w-3xl sm:mt-4">
          <ArizonaCoverageBanner compact />
        </div>
      ) : null}

      {/* A. Identity snapshot */}
      <header
        id="identity"
        className="mt-3 scroll-mt-24 border-b border-[var(--border)] pb-5 sm:mt-4 sm:scroll-mt-28 sm:pb-8"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] sm:text-xs">
          {isNj
            ? "New Jersey · HIC + specialty · Trust Report"
            : isTx
              ? "Texas · TDLR / TSBPE · Trust Report"
              : isOr
                ? "Oregon · CCB statewide · Trust Report"
                : isCa
                  ? "California · CSLB counties · Trust Report"
                  : isAz
                    ? "Arizona · ROC statewide · Trust Report"
              : "Florida · Contractor Trust Report 2.0"}
        </p>
        <h1 className="mt-1.5 text-[1.5rem] font-semibold leading-tight tracking-tight text-[var(--text)] sm:mt-2 sm:text-4xl">
          {contractor.displayName}
        </h1>
        {txTradeLabel ? (
          <p className="mt-2 text-sm font-medium text-[var(--navy)] sm:text-[15px]">
            {txTradeLabel}
            <span className="font-normal text-[var(--muted)]"> · specialty trade</span>
          </p>
        ) : null}
        {caClassLabel ? (
          <p className="mt-2 text-sm font-medium text-[var(--navy)] sm:text-[15px]">
            {caClassLabel}
            <span className="font-normal text-[var(--muted)]"> · CSLB extract</span>
          </p>
        ) : null}
        {azClassLabel ? (
          <p className="mt-2 text-sm font-medium text-[var(--navy)] sm:text-[15px]">
            {azClassLabel}
            <span className="font-normal text-[var(--muted)]"> · Arizona ROC</span>
          </p>
        ) : null}
        {njCredLabel ? (
          <p className="mt-2 text-sm font-medium text-[var(--navy)] sm:text-[15px]">
            {njCredLabel}
            <span className="font-normal text-[var(--muted)]"> · NJ DCA extract</span>
          </p>
        ) : null}
        {orTypeLabel ? (
          <p className="mt-2 text-sm font-medium text-[var(--navy)] sm:text-[15px]">
            {orTypeLabel}
            <span className="font-normal text-[var(--muted)]"> · Oregon CCB</span>
          </p>
        ) : null}
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          {isNj
            ? "Credential status and identity from New Jersey DCA extracts (HIC and specialty boards when present). No statewide GC license — not Florida-depth planning or permit history."
            : isTx
              ? "Plain-language trade type, license status, and available location from the TDLR open extract. Not a statewide general contractor credential."
              : isOr
                ? "Oregon CCB Active Licenses extract: type, status, location, and published bond/insurance fields. Confirm on the official CCB search before hiring."
                : isAz
                  ? "Arizona ROC current active posting list: class, category, status, and location when published. Confirm on the official ROC contractor search before hiring."
              : "Evidence-first profile: who this business is, license and entity records, caution signals, and what to do next — not a score or endorsement."}
          {contractor.isThinProfile
            ? " Limited fields in our extract — treat missing data as unknown, not cleared."
            : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {primary ? (
            <span className="break-all font-mono text-sm tracking-wide text-[var(--accent)]">
              {primary.externalKey}
            </span>
          ) : null}
          {primary ? (
            <StatusBadge
              status={primary.primaryStatus || primary.statusNormalized}
              label={`${isNj ? "Registration" : "License"}: ${displayStatusLabel(
                primary.statusNormalized,
                primary.primaryStatus
              )}`}
            />
          ) : null}
          {isTx ? (
            <StatusBadge status="unknown" label="Specialty only" />
          ) : entity ? (
            <StatusBadge status={entity.status} label={`Entity: ${statusLabel(entity.status)}`} />
          ) : (
            <StatusBadge status="unknown" label="No high-confidence entity link" />
          )}
          {isNj ? (
            <StatusBadge status="unknown" label="NJ Verify depth" />
          ) : null}
          {contractor.discipline.length > 0 ? (
            <StatusBadge
              status="warn"
              label={
                isNj
                  ? "Enforcement records identified"
                  : "Discipline records identified"
              }
            />
          ) : !isTxOnly ? (
            <StatusBadge
              status="unknown"
              label={
                isNj
                  ? "No enforcement in current extracts"
                  : "No discipline in current extracts"
              }
            />
          ) : null}
          {primary?.sourceSystem ? (
            <span className="rounded-full border border-[var(--border)] bg-white px-2.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">
              {primary.sourceSystem}
            </span>
          ) : null}
        </div>
        {location ? <p className="mt-3 text-sm text-[var(--muted)] sm:text-[15px]">{location}</p> : null}
        {(contractor.legalName || contractor.dbaName) && (
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {contractor.legalName ? <>Legal / linked name: {contractor.legalName}</> : null}
            {contractor.legalName && contractor.dbaName ? " · " : null}
            {contractor.dbaName ? <>Principal / DBA field: {contractor.dbaName}</> : null}
          </p>
        )}
        {!isTxOnly ? (
          entity ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Linked entity: <span className="text-[var(--text)]">{entity.legalName}</span>
              {entity.status ? ` · ${statusLabel(entity.status)}` : ""}
              {conf ? ` · ${conf}` : ""}
              {entity.matchMethod ? ` · match: ${entity.matchMethod}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Linked business entity: not identified under our high-confidence match rules.
            </p>
          )
        ) : null}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Extract freshness (latest field): {formatDateTime(freshest)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <CompareToggle slug={contractor.slug} />
          {isTxOnly ? (
            <>
              <a
                href="#hiring"
                className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--navy)] no-underline"
              >
                Before you hire
              </a>
              <a
                href="#licenses"
                className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm text-[var(--muted)] no-underline hover:text-[var(--text)]"
              >
                Credential details
              </a>
            </>
          ) : (
            <>
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
                {isNj ? "Enforcement" : "Caution history"}
              </a>
            </>
          )}
        </div>
      </header>

      {!isTxOnly ? (
        <div className="mt-4">
          <TrustReportNav />
        </div>
      ) : null}

      <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
        {isFlFull ? (
          <ProjectFitBanner
            contractor={contractor}
            handoff={studioHandoff}
            projectType={projectType}
          />
        ) : null}

        <EvidenceSummary contractor={contractor} />
        {isTxOnly ? <HiringGuidance contractor={contractor} /> : null}
        {isFlFull ? <CautionSummary contractor={contractor} /> : null}
        <WhatWeChecked contractor={contractor} />

        {/* B. License / registration evidence */}
        <LicensesSection licenses={contractor.licenses} />

        {/* C. Enforcement / discipline */}
        {!isTxOnly ? (
          <DisciplineSection
            discipline={contractor.discipline}
            homeState={contractor.homeState}
          />
        ) : null}

        {/* D. Business / entity */}
        {!isTxOnly ? (
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
            <EntitySection entities={contractor.entities} state={state} />
            <DiscrepanciesSection contractor={contractor} />
          </div>
        ) : isOr ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Sources
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              License evidence from the Oregon CCB Active Licenses open-data extract. Bond and
              insurance fields are as published — not a live certificate check. Confirm on the
              official CCB search when decisions matter.
            </p>
            <a
              href="https://search.ccb.state.or.us/search/"
              className="mt-3 inline-flex text-sm font-medium text-[var(--navy)] underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Official CCB license search →
            </a>
          </section>
        ) : (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Sources
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              License evidence from TDLR specialty extracts and/or TSBPE plumbing lists. No
              statewide general contractor license exists in Texas. Confirm details on the official
              board search when decisions matter.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              <a
                href="https://www.tdlr.texas.gov/LicenseSearch/"
                className="inline-flex text-sm font-medium text-[var(--navy)] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Official TDLR license search →
              </a>
              <a
                href="https://tsbpe.texas.gov/"
                className="inline-flex text-sm font-medium text-[var(--navy)] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Official TSBPE (plumbing) →
              </a>
            </div>
          </section>
        )}
        {!isTxOnly ? <RelatedEntitySection contractor={contractor} /> : null}

        {/* Insurance guidance — FL only educational panels with FL assumptions */}
        {isFlFull ? <InsuranceGuidance contractor={contractor} /> : null}

        {/* E. Activity framework (Florida permit waves only) */}
        {isFlFull ? <ActivitySection contractor={contractor} /> : null}

        {isFlFull ? <HiringGuidance contractor={contractor} /> : null}

        {/* F. Next actions */}
        {isFlFull ? (
          <TrustNextActions
            slug={contractor.slug}
            name={contractor.displayName}
            handoff={studioHandoff}
            projectType={projectType}
            licenseKey={primary?.externalKey}
            licenseStatus={primary?.statusNormalized}
            entityStatus={entity?.status}
            disciplineCount={contractor.discipline.length}
          />
        ) : null}
        {isNj ? (
          <NjNextActions
            slug={contractor.slug}
            name={contractor.displayName}
            licenseKey={primary?.externalKey}
            licenseStatus={primary?.statusNormalized}
            entityStatus={entity?.status}
            disciplineCount={contractor.discipline.length}
          />
        ) : null}

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
