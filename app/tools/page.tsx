import type { Metadata } from "next";
import Link from "next/link";
import { DecisionJourney } from "@/components/decision/DecisionJourney";
import { DECISION_ENGINE_DISCLAIMER } from "@/lib/decision/disclaimers";

export const metadata: Metadata = {
  title: "Decision tools — Scope, quotes, bids, checklist",
  description:
    "Contractor Trust Hub decision tools: build a project scope, analyze a quote, compare bids, and follow a pre-hire checklist. Educational research only.",
  alternates: { canonical: "/tools" },
};

const tools = [
  {
    href: "/watch",
    title: "Watched contractors",
    body: "Finalists saved on this device so you can re-check Trust Reports later — not live board monitoring.",
    step: "4",
  },
  {
    href: "/projects",
    title: "Protect an active project",
    body: "Milestones, payments, documents, and contractor watches in one workspace.",
    step: "4",
  },
  {
    href: "/passport",
    title: "Home Passport",
    body: "Permanent property timeline, warranties, and document vault after completion.",
    step: "5",
  },
  {
    href: "/account",
    title: "Save & alerts",
    body: "Optional account, import device data, watch alerts, preferences.",
    step: "5",
  },
  {
    href: "/tools/contract-analyzer",
    title: "Contract Analyzer",
    body: "Spot missing or unclear protection items before you sign — educational only.",
    step: "4",
  },
  {
    href: "/property",
    title: "Check My Address",
    body: "Property research — permit history signals with progressive coverage honesty.",
    step: "3",
  },
  {
    href: "/tools/coverage",
    title: "Where we have coverage",
    body: "Which states are live for Verify, what each includes, and honest limits — including Florida permit research.",
    step: "6",
  },
  {
    href: "/tools/permit-planner",
    title: "Permit & Inspection Planner",
    body: "Likely permit categories, contractor questions, and AHJ next steps by project type.",
    step: "3",
  },
  {
    href: "/tools/scope-builder",
    title: "Scope Builder",
    body: "Turn plan or studio answers into a contractor-ready scope so bids can be compared fairly.",
    step: "1",
  },
  {
    href: "/tools/quote-analyzer",
    title: "Quote Analyzer",
    body: "Review one estimate for scope gaps, caution patterns, price context, and questions to ask.",
    step: "1",
  },
  {
    href: "/tools/compare-bids",
    title: "Compare My Bids",
    body: "Normalize 2–4 quotes side by side — included, excluded, allowances, and unclear items.",
    step: "1",
  },
  {
    href: "/tools/pre-hire-checklist",
    title: "Pre-Hire Checklist",
    body: "A practical sequence before you sign: license, insurance, scope, payments, permits, red flags.",
    step: "1",
  },
];

export default function ToolsHubPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
        Decision engine
      </p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
        Plan clearly before you hire
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
        Plan → property → quotes → verify → contract → protect project. Evidence-first tools —
        not rankings, star scores, or a marketplace.
      </p>

      <div className="mt-6">
        <DecisionJourney />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-3xl border border-[var(--border)] bg-white p-5 no-underline shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/25 sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Step {t.step}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">{t.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t.body}</p>
            <p className="mt-3 text-sm font-semibold text-[var(--accent)]">Open tool →</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <Link
          href="/studios"
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm no-underline"
        >
          <p className="font-semibold text-[var(--text)]">Project Studios</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Kitchen, bath, roofing scope first</p>
        </Link>
        <Link
          href="/plan"
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm no-underline"
        >
          <p className="font-semibold text-[var(--text)]">Plan a project</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Quick path to ranges + matches</p>
        </Link>
        <Link
          href="/verify"
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm no-underline"
        >
          <p className="font-semibold text-[var(--text)]">Verify a contractor</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Trust Report from license or name</p>
        </Link>
      </div>

      <p className="mt-10 max-w-3xl text-[11px] leading-relaxed text-[var(--muted)]">
        {DECISION_ENGINE_DISCLAIMER}
      </p>
    </main>
  );
}
