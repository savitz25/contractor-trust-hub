import type { Metadata } from "next";
import Link from "next/link";
import { SavedContractorsClient } from "@/components/saved/SavedContractorsClient";
import { MY_TRUSTHUB_ACCOUNT_HREF, ONE_ACCOUNT_PRESENTATION, workspaceSyncCopy } from "@/lib/my-trusthub/one-account";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "My Contractor — your contractor research workspace",
  description:
    "Saved contractors, watched contractors, projects, comparisons, Home Passport and decision tools for contractor research. Saved on this device.",
  path: "/my-contractor",
  noIndex: true,
});

/** Existing specialist capabilities only. Nothing here is new functionality. */
const WORKSPACE = [
  { href: "/watch", label: "Watched contractors", hint: "License snapshots you chose to re-check. A Watch is separate from a Save." },
  { href: "/compare", label: "Compare contractors", hint: "Side-by-side license evidence for up to four." },
  { href: "/projects", label: "Projects", hint: "Milestones, payments and contract analysis." },
  { href: "/passport", label: "Home Passport", hint: "Completed-project records for a property." },
  { href: "/property", label: "Property and permits", hint: "Permit research where we have coverage." },
  { href: "/verify", label: "Verify a license", hint: "License or name search by state." },
  { href: "/tools", label: "Decision tools", hint: "Scope Builder, Quote Analyzer, Compare bids, Pre-hire checklist, Contract Analyzer." },
] as const;

export default function MyContractorPage() {
  const sync = workspaceSyncCopy();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Specialist workspace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">My Contractor</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-[15px]">
        Your contractor research in one place: saved and watched contractors, comparisons, projects and tools.
        Everything here works on this device without signing in.
      </p>

      {ONE_ACCOUNT_PRESENTATION ? (
        <section className="mt-6 rounded-xl border border-[var(--border)] bg-white p-4" data-my-trusthub-entry="true">
          <h2 className="text-sm font-semibold text-[var(--text)]">Your account is My TrustHub</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            One account across every TrustHub site. My Contractor is the contractor workspace inside it, not a separate
            account. Saves on this page are on this device for now.
          </p>
          <a
            href={MY_TRUSTHUB_ACCOUNT_HREF}
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[var(--text)] px-4 text-sm font-semibold text-[var(--bg)] no-underline"
          >
            Open My TrustHub
          </a>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="saved-heading">
        <h2 id="saved-heading" className="text-lg font-semibold text-[var(--text)]">Saved contractors</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Trust Reports you saved. Saving does not start a Watch and does not monitor a license.
        </p>
        <div className="mt-3">
          <SavedContractorsClient />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="workspace-heading">
        <h2 id="workspace-heading" className="text-lg font-semibold text-[var(--text)]">Workspace</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {WORKSPACE.map((item) => (
            <li key={item.href} className="rounded-xl border border-[var(--border)] bg-white p-4">
              <Link href={item.href} className="font-semibold text-[var(--navy)] no-underline hover:underline">
                {item.label}
              </Link>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{item.hint}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--muted)]">
          <Link href="/account" className="font-medium text-[var(--navy)] no-underline hover:underline">
            {sync.linkLabel}
          </Link>{" "}
          keeps projects, watches and Home Passport durable across your devices.
        </p>
      </section>
    </main>
  );
}
