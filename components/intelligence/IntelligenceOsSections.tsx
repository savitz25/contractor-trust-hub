import Link from "next/link";
import type { IntelligenceCategory, IntelligenceCounty } from "@/lib/intelligence/payload-types";
import {
  RESEARCH_CHECKLIST,
  WHAT_WE_DONT_KNOW,
  type AskItem,
  type CompareRow,
  type FeaturedFinding,
  type TraceFamily,
  traceSum,
} from "@/lib/intelligence/os-layer";
import { formatIntelNumber } from "./format";

function Explain({ title, what, why, not, source, asOf }: { title: string; what: string; why: string; not: string; source: string; asOf: string | null }) {
  return (
    <details className="mt-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">Explain this chart — {title}</summary>
      <dl className="mt-3 space-y-2 text-sm text-[var(--muted)]">
        <div>
          <dt className="font-medium text-[var(--text)]">What am I looking at?</dt>
          <dd>{what}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--text)]">Why might this matter?</dt>
          <dd>{why}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--text)]">What does this NOT mean?</dt>
          <dd>{not}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--text)]">Source</dt>
          <dd>{source}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--text)]">Official as-of / retrieved</dt>
          <dd>{asOf ? asOf.slice(0, 10) : "See source extract dates on this page."}</dd>
        </div>
      </dl>
    </details>
  );
}

export function TraceNumber({
  total,
  families,
  timedOut,
}: {
  total: number | null;
  families: TraceFamily[];
  timedOut: boolean;
}) {
  const sum = timedOut ? null : traceSum(families);
  const matches = total != null && sum != null && total === sum;
  return (
    <section id="trace" aria-labelledby="trace-heading" className="scroll-mt-24">
      <h2 id="trace-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Trace this number
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        {formatIntelNumber(timedOut ? null : total, timedOut)} Florida regulatory/public-record
        observations. This is a count of <strong className="font-medium text-[var(--text)]">source records</strong>, not
        contractors disciplined.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {families.map((f) => (
          <li key={f.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
            <p className="text-2xl font-semibold tabular-nums">{formatIntelNumber(timedOut ? null : f.count, timedOut)}</p>
            <p className="mt-1 text-sm font-medium">{f.label}</p>
            <dl className="mt-3 space-y-1 text-xs text-[var(--muted)]">
              <div>
                <dt className="font-medium text-[var(--text)]">Agency</dt>
                <dd>{f.agency}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--text)]">Dataset</dt>
                <dd>{f.dataset}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--text)]">Definition</dt>
                <dd>{f.definition}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--text)]">Row grain</dt>
                <dd>{f.grain}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--text)]">Official as-of</dt>
                <dd>{f.asOf || "See source extract dates."}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--text)]">Retrieved</dt>
                <dd>{f.retrieved ? f.retrieved.slice(0, 10) : "See ingest batch timestamps."}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--text)]">Limitation</dt>
                <dd>{f.limitation}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Decomposition {matches ? "reconciles exactly" : timedOut ? "is unavailable on this request" : `sums to ${sum?.toLocaleString() ?? "—"}`}.
      </p>
    </section>
  );
}

export function FeaturedFindings({ findings }: { findings: FeaturedFinding[] }) {
  return (
    <section id="findings" aria-labelledby="findings-heading" className="scroll-mt-24">
      <h2 id="findings-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        What the Florida data says
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        Four research findings. Each is a benchmark or coverage gap — not a ranking.
      </p>
      <ol className="mt-6 space-y-6">
        {findings.map((f) => (
          <li key={f.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">{f.storyType}</p>
            <h3 className="mt-1 text-lg font-semibold">{f.headline}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{f.whyUseful}</p>
            {f.numerator != null && f.denominator != null ? (
              <p className="mt-3 text-sm tabular-nums">
                {f.numerator.toLocaleString()} / {f.denominator.toLocaleString()}
                {f.denominator > 0
                  ? ` (${Math.round((1000 * f.numerator) / f.denominator) / 10}%)`
                  : ""}
              </p>
            ) : f.numerator != null ? (
              <p className="mt-3 text-sm tabular-nums">{f.numerator.toLocaleString()}</p>
            ) : null}
            <Explain
              title={f.id.replaceAll("_", " ")}
              what={`${f.grain}. ${f.comparison}`}
              why={f.whyUseful}
              not={f.doesNotMean}
              source={f.source}
              asOf={f.asOf}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function CategoryBars({ categories, timedOut }: { categories: IntelligenceCategory[]; timedOut: boolean }) {
  const max = Math.max(...categories.map((c) => c.tracked), 1);
  return (
    <section id="trades" aria-labelledby="trades-heading" className="scroll-mt-24">
      <h2 id="trades-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Trade intelligence
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        Credential categories from official DBPR occupation codes. Larger is not better.
      </p>
      <ul className="mt-6 space-y-3">
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={c.href} className="block no-underline">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-[var(--text)]">{c.label}</span>
                <span className="tabular-nums text-[var(--muted)]">
                  {formatIntelNumber(timedOut ? null : c.tracked, timedOut)} credentials ·{" "}
                  {formatIntelNumber(timedOut ? null : c.active, timedOut)} active
                </span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-[var(--bg)]" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-[var(--navy)]"
                  style={{ width: `${Math.max(2, Math.round((100 * c.tracked) / max))}%` }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Explain
        title="trade composition"
        what="Horizontal bars of DBPR credential counts by consumer trade bucket (certified + registered classes listed on each category)."
        why="Shows market composition of tracked credentials."
        not="Not quality, competition-as-value, or distinct businesses. A credential holder may hold more than one class."
        source="licenses.occupation_code"
        asOf={null}
      />
    </section>
  );
}

export function MarketCompare({ rows, statements }: { rows: CompareRow[]; statements: string[] }) {
  return (
    <section id="compare" aria-labelledby="compare-heading" className="scroll-mt-24">
      <h2 id="compare-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Compare this market
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        Identical definitions only: HQ/base credential counts, active share on that same universe, and trade-bucket share. Not permit volume vs credentials.
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">Florida and selected counties, identical credential definitions</caption>
          <thead className="bg-[var(--bg)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-3" scope="col">Geography</th>
              <th className="px-3 py-3" scope="col">Tracked credentials</th>
              <th className="px-3 py-3" scope="col">Active share</th>
              <th className="px-3 py-3" scope="col">Roofing share</th>
              <th className="px-3 py-3" scope="col">General share</th>
              <th className="px-3 py-3" scope="col">Research depth</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <th className="px-3 py-3 font-medium" scope="row">
                  <Link href={r.href} className="text-[var(--navy)] underline-offset-2 hover:underline">
                    {r.label}
                  </Link>
                </th>
                <td className="px-3 py-3 tabular-nums">{r.tracked?.toLocaleString() ?? "—"}</td>
                <td className="px-3 py-3 tabular-nums">
                  {r.activeShare != null ? `${Math.round(r.activeShare * 1000) / 10}%` : "—"}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {r.roofingShare != null ? `${Math.round(r.roofingShare * 1000) / 10}%` : "—"}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {r.generalShare != null ? `${Math.round(r.generalShare * 1000) / 10}%` : "—"}
                </td>
                <td className="px-3 py-3">{r.researchDepth === "enhanced" ? "Enhanced local" : "Statewide research"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {statements.length ? (
        <div className="mt-6">
          <h3 className="text-base font-semibold">What stands out</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            {statements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted)]">Descriptive statements only. Not best, safer, or more trusted.</p>
        </div>
      ) : null}
    </section>
  );
}

export function AskMarket({ items }: { items: AskItem[] }) {
  return (
    <section id="ask" aria-labelledby="ask-heading" className="scroll-mt-24">
      <h2 id="ask-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Ask the market
      </h2>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <details className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">{item.question}</summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{item.answer}</p>
              {item.href ? (
                <p className="mt-2">
                  <Link href={item.href} className="text-sm text-[var(--navy)] underline-offset-2 hover:underline">
                    Open related research
                  </Link>
                </p>
              ) : null}
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ResearchChecklist() {
  return (
    <section id="checklist" aria-labelledby="checklist-heading" className="scroll-mt-24">
      <h2 id="checklist-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Research checklist
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
        This evaluates your due diligence process. It is not a contractor quality score.
      </p>
      <ol className="mt-6 space-y-2">
        {RESEARCH_CHECKLIST.map((item, i) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-2 no-underline"
            >
              <span className="tabular-nums text-sm text-[var(--muted)]">{i + 1}</span>
              <span className="text-sm font-medium text-[var(--text)]">{item.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function WhatWeDontKnow() {
  return (
    <section id="gaps" aria-labelledby="gaps-heading" className="scroll-mt-24">
      <h2 id="gaps-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        What we don’t know
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--muted)]">
        {WHAT_WE_DONT_KNOW.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export function EvidenceJourney() {
  const nodes = [
    "State credential",
    "License holder / qualifier",
    "Business relationship",
    "Corporate identity",
    "Regulatory observations",
    "Local permit / enforcement evidence",
    "Public contractor profile",
  ];
  return (
    <section id="journey" aria-labelledby="journey-heading" className="scroll-mt-24">
      <h2 id="journey-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        How this research was assembled
      </h2>
      <ol className="mt-6 space-y-2">
        {nodes.map((n, i) => (
          <li key={n} className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 text-sm">
            <span className="tabular-nums text-[var(--muted)]">{i + 1}</span>
            <span className="font-medium">{n}</span>
            <span className="ml-auto text-xs text-[var(--muted)]">
              {n.includes("permit")
                ? "Where acquired — requested/pending in Broward"
                : "Where connected / where available"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function UseTheResearch() {
  const tools = [
    { href: "/verify", label: "Verify a contractor" },
    { href: "/tools/scope-builder", label: "Scope Builder" },
    { href: "/tools/quote-analyzer", label: "Quote Analyzer" },
    { href: "/tools/contract-analyzer", label: "Contract Analyzer" },
    { href: "/tools/compare-bids", label: "Compare Bids" },
    { href: "/tools/permit-planner", label: "Permit Planner" },
    { href: "/passport", label: "Home Passport" },
  ];
  return (
    <section id="tools" aria-labelledby="tools-heading" className="scroll-mt-24">
      <h2 id="tools-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Use the research
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
        Tools are ways to act after you understand the market. They are not rankings.
      </p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {tools.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium no-underline"
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CountyPreviewList({ counties }: { counties: IntelligenceCounty[] }) {
  const featured = ["broward", "palm-beach", "miami-dade", "pinellas"]
    .map((slug) => counties.find((c) => c.slug === slug))
    .filter((c): c is IntelligenceCounty => Boolean(c));
  return (
    <section id="county-preview" aria-labelledby="county-preview-heading" className="scroll-mt-24">
      <h2 id="county-preview-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Explore contractor intelligence by county
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
        Intelligence pages exist for Broward, Palm Beach, Miami-Dade, and Pinellas. Other counties remain credential browse. Darker research depth means more acquired research, not a better market.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {featured.map((c) => (
          <li key={c.slug} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
            <p className="font-semibold">{c.name} County</p>
            <p className="mt-1 text-sm tabular-nums text-[var(--muted)]">
              {c.tracked.toLocaleString()} HQ/base credentials · {c.active.toLocaleString()} active
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Statewide Research · mailing county, not service area</p>
            <Link
              href={c.href}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--navy)] underline-offset-2 hover:underline"
            >
              Explore {c.name} Intelligence
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
