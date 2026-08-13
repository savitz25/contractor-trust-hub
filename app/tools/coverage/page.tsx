import type { Metadata } from "next";
import Link from "next/link";
import { coverageAnalyticsSnapshot } from "@/lib/property/coverage";
import {
  waveAOpsSnapshot,
  waveBOpsSnapshot,
  waveCOpsSnapshot,
} from "@/lib/property/ops-health";
import { extractStats } from "@/lib/property/permits";
import { pageMetadata } from "@/lib/seo/page-meta";
import { isNjVerifyPilotEnabled } from "@/lib/states/feature-flags";
import { NJ_SOURCE_MATRIX } from "@/lib/states/nj-credentials";

export const metadata: Metadata = pageMetadata({
  title: "Permit coverage matrix — Florida jurisdictions",
  description:
    "Which Florida counties have partial permit extract coverage on Contractor Trust Hub, Wave B/C depth, freshness, and matching rules. NJ Verify pilot is separate.",
  path: "/tools/coverage",
});

function WaveOpsBlock({
  title,
  ops,
}: {
  title: string;
  ops: ReturnType<typeof waveAOpsSnapshot>;
}) {
  return (
    <section className="mt-6 rounded-3xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Freshness {ops.extract.freshness || "—"} · join rate proxy {ops.extract.joinRateProxyPercent}%
      </p>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {Object.entries(ops.recordsByCounty).map(([county, n]) => (
          <li
            key={county}
            className="rounded-xl border border-[var(--border)] bg-white px-3 py-2"
          >
            <span className="font-medium text-[var(--text)]">{county}</span>
            <span className="text-[var(--muted)]"> · {n} sample/extract row(s)</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CoveragePage() {
  const snap = coverageAnalyticsSnapshot();
  const stats = extractStats();
  const waveA = waveAOpsSnapshot();
  const waveB = waveBOpsSnapshot();
  const waveC = waveCOpsSnapshot();
  const njPilot = isNjVerifyPilotEnabled();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
        Stage 7 — Florida waves + multi-state note
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Permit coverage matrix
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Progressive Florida coverage. Empty property results are common and do not prove a clean
        permit history. High-confidence license joins only — never name-only auto-links.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="text-xs text-[var(--muted)]">License-bearing rows</p>
          <p className="text-2xl font-semibold text-[var(--navy)]">{stats.withLicenseKey}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-xs text-[var(--muted)]">Join rate proxy</p>
          <p className="text-2xl font-semibold text-[var(--navy)]">
            {stats.joinRateProxy}%
          </p>
          <p className="text-[10px] text-[var(--muted)]">
            activity keys ∩ permit keys / permit keys
          </p>
        </div>
      </div>

      <WaveOpsBlock title="Wave A ops snapshot" ops={waveA} />
      <WaveOpsBlock title="Wave B ops snapshot (Stage 7 depth)" ops={waveB} />
      <WaveOpsBlock title="Wave C ops snapshot (Stage 7 depth)" ops={waveC} />

      <section className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--text)]">Extract join health</h2>
        <dl className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
          <div>
            Unmatched license-bearing keys:{" "}
            <strong className="text-[var(--text)]">{stats.unmatchedLicenseBearingRows}</strong>
          </div>
          <div>
            Activity keys also on permits:{" "}
            <strong className="text-[var(--text)]">{stats.activityKeysAlsoOnPermits}</strong>
          </div>
          <div>
            Join rate proxy:{" "}
            <strong className="text-[var(--text)]">{stats.joinRateProxy}%</strong>
          </div>
          <div>
            Freshness: <strong className="text-[var(--text)]">{stats.freshness || "—"}</strong>
          </div>
        </dl>
        <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
          {waveA.knownLimits.map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      </section>

      {njPilot ? (
        <section className="mt-6 rounded-3xl border border-violet-200 bg-violet-50/50 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            New Jersey Verify depth (Stage 8A)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Separate from Florida permit waves. NJ is Verify-first — registration search, Trust
            Report depth, high-confidence entity and enforcement when available. Not permit history
            or Florida full-journey parity.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {NJ_SOURCE_MATRIX.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-violet-200/80 bg-white px-3 py-2"
              >
                <p className="font-medium text-[var(--text)]">
                  <span className="font-mono text-[11px] text-[var(--muted)]">{row.id}</span>
                  {" · "}
                  {row.label}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Includes: {row.includes}</p>
                <p className="text-xs text-[var(--muted)]">Gaps: {row.gaps}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Florida-only: Plan, Studios, property/permit waves, payment legal trackers, full Home
            Passport localization.
          </p>
          <Link
            href="/verify?state=nj"
            className="mt-3 inline-flex text-sm font-semibold text-[var(--navy)]"
          >
            Open NJ Verify →
          </Link>
        </section>
      ) : null}

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
