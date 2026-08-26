import type { ReactNode } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { SearchForm } from "@/components/search/SearchForm";

export function FloridaLandingChrome({
  children,
  stats,
}: {
  children: ReactNode;
  stats?: { credentials: number; activeCredentials: number; sunbizLinks: number };
}) {
  const values = stats ?? { credentials: 0, activeCredentials: 0, sunbizLinks: 0 };
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida" },
        ]}
      />

      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Discovery · FL
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Florida contractor verification
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
          Browse Florida construction license evidence by county and trade. Independent
          verification from DBPR and high-confidence Sunbiz links — not a marketplace or lead
          board.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Florida contractor credentials tracked", value: values.credentials },
            { label: "Active credentials", value: values.activeCredentials },
            { label: "High-confidence Sunbiz links", value: values.sunbizLinks },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3"
            >
              <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">
                {s.value > 0 ? s.value.toLocaleString() : "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
          Credentials are board license records, not distinct businesses. Active means DBPR
          secondary status Active. Financially responsible officer and course/provider rows are
          excluded from these two counts. Sunbiz links are unique name+address or name+ZIP matches
          (city-only links are not shown here).
        </p>

        <div className="mt-6 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="mb-3 text-sm font-medium text-[var(--text)]">
            Already have a name or license number?
          </p>
          <SearchForm size="default" />
        </div>
      </header>

      {children}

      <div className="mt-12 space-y-4">
        <DiscoveryDisclaimer />
        <p className="text-sm text-[var(--muted)]">
          Looking for a specific firm?{" "}
          <Link href="/verify" className="text-[var(--accent)]">
            Use search
          </Link>{" "}
          for the fastest path to a Trust Report. New to the process?{" "}
          <Link href="/guides/how-to-verify-florida-contractor" className="text-[var(--accent)]">
            How to verify a Florida contractor
          </Link>
          {" · "}
          <Link href="/guides/florida-contractor-license-types" className="text-[var(--accent)]">
            License types
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
