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
  ConsumerMeaning,
  DisciplineSection,
  DiscrepanciesSection,
  EntitySection,
  EvidenceSummary,
  HiringGuidance,
  LicensesSection,
  SourcesFooter,
} from "@/components/contractor/TrustReport";
import { EntityLineageSection } from "@/components/contractor/EntityLineageSection";
import { TrustNextActions } from "@/components/contractor/TrustNextActions";
import { TrustReportActions } from "@/components/contractor/TrustReportActions";
import { TrustReportNav } from "@/components/contractor/TrustReportNav";
import { WhatWeChecked } from "@/components/contractor/WhatWeChecked";
import { NjNextActions } from "@/components/contractor/NjNextActions";
import { loadFloridaEntityLineage } from "@/lib/contractors/entity-lineage";
import { ArizonaCoverageBanner } from "@/components/search/ArizonaCoverageBanner";
import { CaliforniaCoverageBanner } from "@/components/search/CaliforniaCoverageBanner";
import { KentuckyCoverageBanner } from "@/components/search/KentuckyCoverageBanner";
import { LouisianaCoverageBanner } from "@/components/search/LouisianaCoverageBanner";
import { MississippiCoverageBanner } from "@/components/search/MississippiCoverageBanner";
import { NjCoverageBanner } from "@/components/search/NjCoverageBanner";
import { OregonCoverageBanner } from "@/components/search/OregonCoverageBanner";
import { TexasCoverageBanner } from "@/components/search/TexasCoverageBanner";
import { WashingtonCoverageBanner } from "@/components/search/WashingtonCoverageBanner";
import { StudioHandoffBanner } from "@/components/studios/StudioHandoffBanner";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { JourneyNextStep } from "@/components/network/JourneyNextStep";
import {
  parseNetworkJourney,
  resolveContractorJourneyModule,
} from "@/lib/network/journey-handoff";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { displayStatusLabel, formatDateTime, statusLabel } from "@/lib/contractors/format";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { getContractorBySlug } from "@/lib/contractors/queries";
import {
  matchConfidenceLine,
  officialBoardVerifyLabel,
  officialBoardVerifyUrl,
} from "@/lib/contractors/trust-report";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { trustReportJsonLd, trustReportMetadata } from "@/lib/seo/trust-report-seo";
import { getStateBySlug } from "@/lib/states/config";
import { evidenceSlugFromHomeState } from "@/lib/states/evidence-copy";
import { azClassPlainLabel } from "@/lib/states/az-roc";
import { caClassPlainLabel } from "@/lib/states/ca-classifications";
import { njCredentialPlainLabel } from "@/lib/states/nj-credentials";
import { orCcbDisplayLabel } from "@/lib/states/or-ccb";
import { txTradePlainLabel } from "@/lib/states/tx-trades";
import { parseHandoffQuery } from "@/lib/studios/handoff";
import { Suspense } from "react";
import { AskProfileBackLink } from "@/components/ask-handoff/AskProfileBackLink";
import { AskSearchContextBanner } from "@/components/ask-handoff/AskSearchContextBanner";
import { parseContractorAskHandoff } from "@/lib/ask-handoff/parse";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const sp = await searchParams;
  const askNoIndex = Boolean(parseContractorAskHandoff(sp));

  try {
    const c = await getContractorBySlug(slug);
    if (!c) {
      return {
        title: "Contractor not found",
        robots: { index: false, follow: true },
      };
    }

    const meta = trustReportMetadata(c);
    if (!askNoIndex) return meta;
    return { ...meta, robots: { index: false, follow: true } };
  } catch {
    return {
      title: "Contractor Trust Report",
      description:
        "Contractor license evidence from official public records on Contractor Trust Hub.",
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
  return <JsonLd data={trustReportJsonLd(contractor, path)} />;
}

export default async function ContractorPage({ params, searchParams }: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const sp = await searchParams;
  const studioHandoff = parseHandoffQuery(sp);
  const journeyModule = resolveContractorJourneyModule(
    parseNetworkJourney(sp),
    "trust-report"
  );

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
  const isLa = stateSlug === "la";
  const isMs = stateSlug === "ms";
  const isWa = stateSlug === "wa";
  const isKy = stateSlug === "ky";
  const isFlFull = stateSlug === "fl";
  /** Verify-first thin reports (no FL plan/activity stack). */
  const isThin =
    isTx || isOr || isCa || isAz || isWa || isLa || isMs || isKy;
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
  const officialHref = officialBoardVerifyUrl(contractor);
  const officialLabel = officialBoardVerifyLabel(contractor);
  const correctionHref = `/corrections?slug=${encodeURIComponent(contractor.slug)}${
    primary?.externalKey ? `&license=${encodeURIComponent(primary.externalKey)}` : ""
  }`;

  // FL only: officer-name lineage from stored Sunbiz officers (no invented links)
  const entityLineage =
    isFlFull && contractor.entities.length > 0
      ? await loadFloridaEntityLineage(contractor.entities)
      : null;

  return (
    <main
      className={`mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 ${
        isThin && !isFlFull ? "pb-24 sm:pb-10" : "pb-28 sm:pb-10"
      }`}
    >
      <ContractorJsonLd contractor={contractor} path={path} />
      <Suspense fallback={null}>
        <AskProfileBackLink />
      </Suspense>
      <AskSearchContextBanner ctx={parseContractorAskHandoff(sp)} handoffType="entity" />
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
          Search
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
              All states
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
      {isWa ? (
        <div className="mt-3 max-w-3xl sm:mt-4">
          <WashingtonCoverageBanner compact />
        </div>
      ) : null}
      {isLa ? (
        <div className="mt-3 max-w-3xl sm:mt-4">
          <LouisianaCoverageBanner compact />
        </div>
      ) : null}
      {isMs ? (
        <div className="mt-3 max-w-3xl sm:mt-4">
          <MississippiCoverageBanner compact />
        </div>
      ) : null}
      {isKy ? (
        <div className="mt-3 max-w-3xl sm:mt-4">
          <KentuckyCoverageBanner compact />
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
                    : isWa
                      ? "Washington · L&I statewide · Trust Report"
                      : isLa
                        ? "Louisiana · LSLBC · Trust Report"
                        : isMs
                          ? "Mississippi · MSBOC · Trust Report"
                          : isKy
                            ? "Kentucky · DHBC specialty · Trust Report"
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
                  : isWa
                    ? "Washington L&I contractor extract: status, trade class when published, and location. Confirm on official L&I Verify before hiring."
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
          ) : !isThin ? (
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
        {!isThin ? (
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
          {isThin ? (
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
              {isAz ? (
                <a
                  href="#caution"
                  className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm text-[var(--muted)] no-underline hover:text-[var(--text)]"
                >
                  ROC discipline
                </a>
              ) : null}
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

      {!isThin ? (
        <div className="mt-4 print:hidden">
          <TrustReportNav />
        </div>
      ) : null}

      <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
        {/* —— First screen: summary → meaning → actions —— */}
        <EvidenceSummary contractor={contractor} />
        <ConsumerMeaning contractor={contractor} />
        <TrustReportActions
          slug={contractor.slug}
          name={contractor.displayName}
          licenseKey={primary?.externalKey}
          licenseStatus={primary?.statusNormalized}
          entityStatus={entity?.status}
          disciplineCount={contractor.discipline.length}
          officialHref={officialHref}
          officialLabel={officialLabel}
          correctionHref={correctionHref}
          sticky
        />

        {entityLineage ? <EntityLineageSection lineage={entityLineage} /> : null}

        {isFlFull ? (
          <ProjectFitBanner
            contractor={contractor}
            handoff={studioHandoff}
            projectType={projectType}
          />
        ) : null}
        {isFlFull ? <CautionSummary contractor={contractor} /> : null}

        {/* Full dossier below the fold */}
        <WhatWeChecked contractor={contractor} />

        <LicensesSection licenses={contractor.licenses} />

        {!isThin || isAz || isNj || isFlFull ? (
          <DisciplineSection
            discipline={contractor.discipline}
            homeState={contractor.homeState}
          />
        ) : null}

        {!isThin ? (
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
            <EntitySection entities={contractor.entities} state={state} />
            <DiscrepanciesSection contractor={contractor} />
          </div>
        ) : null}
        {!isThin ? <RelatedEntitySection contractor={contractor} /> : null}

        {isFlFull ? <InsuranceGuidance contractor={contractor} /> : null}
        {isFlFull ? <ActivitySection contractor={contractor} /> : null}
        {isFlFull ? <HiringGuidance contractor={contractor} /> : null}

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

        <LegalNotice />
        <JourneyNextStep module={journeyModule} />
      </div>
    </main>
  );
}
