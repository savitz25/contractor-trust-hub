import type { Metadata } from "next";
import Link from "next/link";
import { coverageAnalyticsSnapshot } from "@/lib/property/coverage";
import { extractStats } from "@/lib/property/permits";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Permit coverage matrix — Florida jurisdictions",
  description:
    "Which Florida counties have partial permit extract coverage on Contractor Trust Hub, freshness, and matching rules. Not complete statewide coverage.",
  path: "/tools/coverage",
});

export default function CoveragePage() {
  const snap = coverageAnalyticsSnapshot();
  const stats = extractStats();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
        Stage 6 data expansion
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Permit coverage matrix
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Progressive Florida coverage. Empty property results are common and do not prove a clean
        permit history. High-confidence license joins only — never name-only auto-links.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-xs text-[var(--muted)]">Jurisdictions enabled</p>
          <p className="text-2xl font-semibold text-[var(--navy)]">
            {snap.jurisdictionsEnabled}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-xs text-[var(--muted)]">Shipped extract rows</p>
          <p className="text-2xl font-semibold text-[var(--navy)]">{stats.permitRows}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-xs text-[var(--muted)]">Activity license keys</p>
          <p className="text-2xl font-semibold text-[var(--navy)]">
            {stats.activityLicenseKeys}
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--text)]">Waves</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <strong>Wave A:</strong> {snap.byWave.A.join(", ")}
          </li>
          <li>
            <strong>Wave B:</strong> {snap.byWave.B.join(", ")}
          </li>
          <li>
            <strong>Wave C:</strong> {snap.byWave.C.join(", ")}
          </li>
        </ul>
      </section>

      <section className="mt-6 overflow-x-auto rounded-3xl border border-[var(--border)] bg-white">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
              <th className="px-4 py-3 font-semibold text-[var(--muted)]">County</th>
              <th className="px-4 py-3 font-semibold text-[var(--muted)]">Level</th>
              <th className="px-4 py-3 font-semibold text-[var(--muted)]">Wave</th>
              <th className="px-4 py-3 font-semibold text-[var(--muted)]">Freshness</th>
              <th className="px-4 py-3 font-semibold text-[var(--muted)]">Sample rows</th>
            </tr>
          </thead>
          <tbody>
            {snap.matrix.map((m) => (
              <tr key={m.county} className="border-b border-[var(--border)]/70">
                <td className="px-4 py-2.5 font-medium text-[var(--text)]">{m.county}</td>
                <td className="px-4 py-2.5 text-[var(--muted)]">{m.level}</td>
                <td className="px-4 py-2.5 text-[var(--muted)]">{m.wave}</td>
                <td className="px-4 py-2.5 text-[var(--muted)]">{m.freshness || "—"}</td>
                <td className="px-4 py-2.5 text-[var(--muted)]">{m.sampleRecordCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-semibold text-[var(--text)]">Matching rulebook</h2>
        <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
          <li>· Preferred: exact license number</li>
          <li>· Never: name-only auto-join or invented profile slugs</li>
          <li>· UI discloses match method and confidence</li>
          <li>· False joins refused when uncertain</li>
        </ul>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Extract address keys: {stats.addressKeys} · With license field: {stats.withLicenseKey} ·
          Freshness: {stats.freshness || "—"}
        </p>
      </section>

      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/property" className="text-[var(--navy)]">
          Check my address →
        </Link>
        <Link href="/tools" className="text-[var(--navy)]">
          Tools hub →
        </Link>
      </div>
    </main>
  );
}
