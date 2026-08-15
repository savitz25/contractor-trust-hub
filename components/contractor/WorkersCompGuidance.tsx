import Link from "next/link";

/** Official Florida tools — no invented coverage status. */
const POC_URL = "https://dwcdataportal.fldfs.com/proofofcoverage.aspx";
const EXEMPTION_URL = "https://dwcdataportal.fldfs.com/Exemption.aspx";
const WC_HOME = "https://www.myfloridacfo.com/division/wc/home";

export function WorkersCompGuidance({
  contractorName,
}: {
  contractorName?: string;
}) {
  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
      aria-labelledby="wc-heading"
    >
      <h2
        id="wc-heading"
        className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
      >
        Workers&apos; compensation check
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        We do <strong className="font-medium text-[var(--text)]">not</strong> store or invent
        workers&apos; comp coverage status. Florida publishes official tools so you can verify
        coverage or exemptions yourself before hiring
        {contractorName ? (
          <>
            {" "}
            <span className="text-[var(--text)]">{contractorName}</span>
          </>
        ) : null}
        .
      </p>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Why it matters
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
          If a contractor is required to carry workers&apos; compensation and does not, you may face
          liability and project risk if a worker is injured on your job. Requirements depend on
          business structure, employee count, and exemptions — the Division of Workers&apos;
          Compensation is the authority.
        </p>
      </div>

      <ul className="mt-4 space-y-3 text-sm">
        <li className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3">
          <p className="font-medium text-[var(--text)]">Proof of coverage search</p>
          <p className="mt-1 text-[var(--muted)]">
            Look up active policy information in the Florida Division of Workers&apos; Compensation
            data portal.
          </p>
          <a
            href={POC_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[var(--accent)]"
          >
            Open Proof of Coverage
          </a>
        </li>
        <li className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3">
          <p className="font-medium text-[var(--text)]">Exemption search</p>
          <p className="mt-1 text-[var(--muted)]">
            Some individuals may hold a published exemption. Confirm any exemption claim against the
            official list.
          </p>
          <a
            href={EXEMPTION_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[var(--accent)]"
          >
            Open Exemption search
          </a>
        </li>
        <li className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3">
          <p className="font-medium text-[var(--text)]">Division home</p>
          <p className="mt-1 text-[var(--muted)]">
            Background on Florida workers&apos; compensation rules and resources (Florida CFO /
            DFS).
          </p>
          <a
            href={WC_HOME}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[var(--accent)]"
          >
            Division of Workers&apos; Compensation
          </a>
        </li>
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
        Ask the contractor for a current certificate of insurance and match it to the official
        search results. We do not rank or certify coverage.{" "}
        <Link href="/disclaimer" className="text-[var(--accent)]">
          Disclaimer
        </Link>
      </p>
    </section>
  );
}
