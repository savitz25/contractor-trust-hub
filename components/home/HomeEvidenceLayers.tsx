import Link from "next/link";

const LAYERS = [
  {
    title: "Identity",
    body: "Who is the contractor or business in the research graph?",
  },
  {
    title: "License",
    body: "What official credential appears in the regulatory source?",
    href: "/#search",
  },
  {
    title: "Status",
    body: "Active, current, expired, inactive, suspended, revoked, and other source-normalized statuses.",
  },
  {
    title: "Trade / classification",
    body: "What type of work does the credential cover, using published occupation codes?",
    href: "/#trades",
  },
  {
    title: "Business relationships",
    body: "Which business or entity links can be supported with exact evidence?",
  },
  {
    title: "Regulatory history",
    body: "Disciplinary, unlicensed-activity, stop-work, recovery-fund, and other source rows when present.",
    href: "/#enforcement",
  },
  {
    title: "Permit intelligence",
    body: "Where supported, public permit-source records — not a national jobs count.",
    href: "/#beyond-license",
  },
  {
    title: "Public contact evidence",
    body: "Source-backed business contact details when they are publication-eligible.",
  },
] as const;

export function HomeEvidenceLayers() {
  return (
    <section id="why" className="border-b border-[var(--border)]">
      <div className="th-shell py-10 sm:py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          More than a directory
        </p>
        <h2 className="mt-1.5 max-w-2xl text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          An evidence graph for investigating before you hire
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          ContractorTrustHub organizes public records so you can research identity, licensing,
          status, and history. Not every contractor has every layer. Absence is not a clean record,
          and we do not rank who is “good” or “safe.”
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LAYERS.map((layer) => {
            const inner = (
              <>
                <p className="text-sm font-semibold text-[var(--text)]">{layer.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{layer.body}</p>
              </>
            );
            return (
              <li
                key={layer.title}
                className="rounded-2xl border border-[var(--border)] bg-white p-4"
              >
                {"href" in layer && layer.href ? (
                  <Link href={layer.href} className="block no-underline">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
