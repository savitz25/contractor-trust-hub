import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DisciplineSection,
  DiscrepanciesSection,
  EntitySection,
  EvidenceSummary,
  HiringGuidance,
  LicensesSection,
  SourcesFooter,
} from "@/components/contractor/TrustReport";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusLabel } from "@/lib/contractors/format";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { getContractorBySlug } from "@/lib/contractors/queries";
import { matchConfidenceLine } from "@/lib/contractors/trust-report";
import { absoluteUrl } from "@/lib/site";
import { getStateBySlug } from "@/lib/states/config";

type Props = {
  params: Promise<{ slug: string }>;
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

    return {
      title,
      description,
      alternates: {
        canonical: path,
      },
      openGraph: {
        title,
        description,
        url: absoluteUrl(path),
        type: "profile",
        siteName: "Contractor Trust Hub",
        locale: "en_US",
        images: [{ url: "/brand/contractor-trust-hub-logo-on-dark.svg" }],
      },
      twitter: {
        card: "summary",
        title,
        description,
        images: ["/brand/contractor-trust-hub-logo-on-dark.svg"],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: "Contractor Trust Report",
      description:
        "Florida contractor license, Sunbiz entity, and discipline evidence from Contractor Trust Hub.",
      robots: { index: false, follow: true },
    };
  }
}

function JsonLd({
  contractor,
  path,
}: {
  contractor: NonNullable<Awaited<ReturnType<typeof getContractorBySlug>>>;
  path: string;
}) {
  const lic = contractor.licenses[0];
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${contractor.displayName} — Florida Contractor Trust Report`,
    url: absoluteUrl(path),
    mainEntity: {
      "@type": "Organization",
      name: contractor.displayName,
      legalName: contractor.legalName || undefined,
      address: contractor.primaryCity
        ? {
            "@type": "PostalAddress",
            addressLocality: contractor.primaryCity,
            addressRegion: contractor.homeState || "FL",
            addressCountry: "US",
          }
        : undefined,
      identifier: lic?.externalKey,
    },
    description: `Independent Florida contractor evidence report for ${contractor.displayName}.`,
    isPartOf: {
      "@type": "WebSite",
      name: "Contractor Trust Hub",
      url: absoluteUrl("/"),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
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
        <h1 className="text-2xl font-semibold text-[var(--text)]">Unable to load trust report</h1>
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
  const entity = contractor.entities[0];
  const path = `/contractors/${encodeURIComponent(contractor.slug)}`;
  const location = [contractor.primaryCity, contractor.primaryCounty, contractor.homeState]
    .filter(Boolean)
    .join(" · ");
  const conf = matchConfidenceLine(entity);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd contractor={contractor} path={path} />

      <Link
        href="/verify"
        className="text-sm text-[var(--muted)] no-underline hover:text-[var(--text)]"
      >
        ← Back to search
      </Link>

      <header className="mt-4 border-b border-[var(--border)] pb-6 sm:pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Florida · Contractor Trust Report
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
          {entity ? (
            <StatusBadge
              status={entity.status}
              label={`Entity: ${statusLabel(entity.status)}`}
            />
          ) : (
            <StatusBadge status="unknown" label="No Sunbiz link" />
          )}
          {contractor.discipline.length > 0 ? (
            <StatusBadge status="warn" label="Discipline on file" />
          ) : (
            <StatusBadge status="active" label="No discipline linked" />
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
        {conf && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            <span className="text-[var(--text)]">Sunbiz match: </span>
            {conf}
          </p>
        )}
      </header>

      <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
        <EvidenceSummary contractor={contractor} />
        <HiringGuidance contractor={contractor} />
        <DiscrepanciesSection contractor={contractor} />

        <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
          <LicensesSection licenses={contractor.licenses} />
          <div className="space-y-5 sm:space-y-6">
            <EntitySection entities={contractor.entities} state={state} />
            <DisciplineSection discipline={contractor.discipline} />
          </div>
        </div>

        <SourcesFooter contractor={contractor} state={state} />
      </div>
    </main>
  );
}
