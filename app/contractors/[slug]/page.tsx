import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DisciplineSection,
  EntitySection,
  LicensesSection,
  VerificationSummary,
} from "@/components/contractor/DetailSections";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusLabel } from "@/lib/contractors/format";
import { getContractorBySlug } from "@/lib/contractors/queries";
import { getStateBySlug } from "@/lib/states/config";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const c = await getContractorBySlug(decodeURIComponent(slug), "fl");
    if (!c) return { title: "Contractor not found" };
    const lic = c.licenses[0]?.externalKey;
    return {
      title: `${c.displayName}${lic ? ` · ${lic}` : ""}`,
      description: `Florida contractor verification for ${c.displayName}. License status, Sunbiz entity, and discipline evidence.`,
    };
  } catch {
    return { title: "Contractor verification" };
  }
}

export default async function ContractorPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const state = getStateBySlug("fl")!;

  let contractor;
  try {
    contractor = await getContractorBySlug(slug, "fl");
  } catch (e) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Unable to load profile</h1>
        <p className="mt-3 text-[var(--muted)]">
          {e instanceof Error ? e.message : "Database connection failed."}
        </p>
        <Link href="/verify" className="mt-6 inline-block text-[var(--accent)]">
          ← Back to search
        </Link>
      </main>
    );
  }

  if (!contractor) notFound();

  const primary = contractor.licenses[0];
  const location = [contractor.primaryCity, contractor.primaryCounty, contractor.homeState]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/verify"
        className="text-sm text-[var(--muted)] no-underline hover:text-[var(--text)]"
      >
        ← Back to search
      </Link>

      <header className="mt-4 border-b border-[var(--border)] pb-6 sm:pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Florida contractor profile
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {contractor.displayName}
        </h1>
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
          {contractor.entities[0] ? (
            <StatusBadge
              status={contractor.entities[0].status}
              label={`Entity: ${statusLabel(contractor.entities[0].status)}`}
            />
          ) : (
            <StatusBadge status="unknown" label="No Sunbiz link" />
          )}
          {contractor.discipline.length > 0 && (
            <StatusBadge status="warn" label="Discipline on file" />
          )}
        </div>
        {location && <p className="mt-3 text-[15px] text-[var(--muted)]">{location}</p>}
        {(contractor.legalName || contractor.dbaName) && (
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {contractor.legalName && <>Legal: {contractor.legalName}</>}
            {contractor.legalName && contractor.dbaName ? " · " : null}
            {contractor.dbaName && <>DBA: {contractor.dbaName}</>}
          </p>
        )}
      </header>

      <div className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <VerificationSummary contractor={contractor} state={state} />
        </div>
        <div className="space-y-5 sm:space-y-6">
          <LicensesSection licenses={contractor.licenses} />
          <EntitySection entities={contractor.entities} state={state} />
          <DisciplineSection discipline={contractor.discipline} />
        </div>
      </div>

      <aside className="mt-10 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/50 px-5 py-4 text-sm text-[var(--muted)]">
        <p>
          Always confirm current status on the{" "}
          <a href={state.boardUrl} target="_blank" rel="noreferrer">
            official {state.boardLabel}
          </a>{" "}
          and{" "}
          <a href={state.entityRegistryUrl} target="_blank" rel="noreferrer">
            {state.entityRegistryLabel}
          </a>{" "}
          before hiring. Contractor Trust Hub is independent research tooling, not a licensing
          authority.
        </p>
      </aside>
    </main>
  );
}
