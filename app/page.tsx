import { BrandLogo } from "@/components/BrandLogo";

const stats = [
  { label: "FL construction rows profiled", value: "270,560" },
  { label: "Licensed credentials staged", value: "143,516" },
  { label: "Qualifying businesses (QB)", value: "~127k" },
  { label: "Discipline rows (FY 24/25 sample)", value: "1,541" },
];

const sources = [
  {
    name: "Florida DBPR — Construction licensees",
    detail: "Official bulk extract (CILB). No invented license numbers.",
  },
  {
    name: "Florida DBPR — Contractor discipline",
    detail: "Licensed / ULA / recovery-fund fiscal-year reports.",
  },
  {
    name: "Sunbiz (planned)",
    detail: "Entity linkage for DBA / corporate standing.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 sm:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] bg-transparent pb-6">
        <div className="flex flex-col gap-1 bg-transparent">
          <BrandLogo height={52} priority surface="onDark" className="bg-transparent" />
          <p className="pl-1 text-xs text-[var(--muted)]">
            Before you hire, verify. · Phase 0 evidence foundation
          </p>
        </div>
        <p className="hidden text-sm text-[var(--muted)] sm:block">
          Research tooling · Not a substitute for the board
        </p>
      </header>

      <section className="mt-14 max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Before you hire, verify
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-5xl">
          Independent contractor license evidence — starting with Florida.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">
          We source public board extracts, stage them with transparent keys, and refuse thin
          invented profiles. Phase 0 ships the data backbone and FL DBPR adapter; search UI
          comes next.
        </p>
      </section>

      <section className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4"
          >
            <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">{s.value}</p>
            <p className="mt-1 text-xs leading-snug text-[var(--muted)]">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            What&apos;s live in the repo
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--text)]">
            <li>Postgres schema for licenses, entities, discipline, permits, trust scores</li>
            <li>
              Python ingest adapter:{" "}
              <code className="rounded bg-[var(--panel)] px-1.5 py-0.5 text-[var(--accent)]">
                ingest/adapters/fl_dbpr.py
              </code>
            </li>
            <li>Sample + field profile from the real DBPR construction extract</li>
            <li>QB businesses staged separately — no fake license IDs</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Source stack (wave 1)
          </h2>
          <ul className="mt-4 space-y-4">
            {sources.map((src) => (
              <li key={src.name}>
                <p className="text-sm font-medium text-[var(--text)]">{src.name}</p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{src.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-6 py-5">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          <span className="font-medium text-[var(--success)]">Status:</span> Phase 0 data
          foundation is on{" "}
          <a
            href="https://github.com/savitz25/contractor-trust-hub"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          . Always confirm current license status on the official Florida DBPR site before
          hiring.
        </p>
      </section>

      <footer className="mt-auto border-t border-[var(--border)] pt-8 pb-4 text-xs text-[var(--muted)]">
        <p>
          Contractor Trust Hub · Educational research tooling · Public records remain property
          of the issuing government body.
        </p>
      </footer>
    </main>
  );
}
