import Link from "next/link";
import type { ContractorDetail } from "@/lib/contractors/types";

const POC_URL = "https://dwcdataportal.fldfs.com/proofofcoverage.aspx";
const EXEMPTION_URL = "https://dwcdataportal.fldfs.com/Exemption.aspx";
const WC_HOME = "https://www.myfloridacfo.com/division/wc/home";

/**
 * Insurance & workers' comp guidance — request and verify, never invent coverage.
 */
export function InsuranceGuidance({
  contractor,
}: {
  contractor: ContractorDetail;
}) {
  const entityName = contractor.entities[0]?.legalName || contractor.legalName || null;

  return (
    <section
      id="insurance"
      className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
      aria-labelledby="insurance-heading"
    >
      <h2
        id="insurance-heading"
        className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
      >
        Insurance &amp; workers&apos; compensation
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        Coverage status is <strong className="font-medium text-[var(--text)]">not shown</strong> in
        our current extracts. Homeowners should <strong className="font-medium text-[var(--text)]">request and verify</strong>{" "}
        documents with the carrier — we do not mark anyone as “insured,” “fully covered,” or
        “approved.”
      </p>

      <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-900/80">
          Evidence status on this report
        </p>
        <p className="mt-1 text-sm text-amber-950">
          Not shown in current extracts — confirm with carrier before hiring
          {contractor.displayName ? (
            <>
              {" "}
              <span className="font-medium">{contractor.displayName}</span>
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            What to request
          </p>
          <ul className="mt-2 space-y-2 text-sm text-[var(--text)]">
            <li>· Certificate of Insurance (COI) for general liability</li>
            <li>· Workers&apos; compensation evidence or exemption status where applicable</li>
            <li>
              · Named insured matching the contracting entity
              {entityName ? (
                <span className="text-[var(--muted)]">
                  {" "}
                  (on file: {entityName})
                </span>
              ) : null}
            </li>
            <li>· Policy effective and expiration dates</li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            How to verify
          </p>
          <ul className="mt-2 space-y-2 text-sm text-[var(--text)]">
            <li>· Call the carrier contact listed on the COI to confirm active status</li>
            <li>· Confirm contractor / entity name matches your contract</li>
            <li>· Keep copies with your project records</li>
            <li>· Re-check dates before work starts and after any change order</li>
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Why workers&apos; comp matters (Florida)
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
          If a contractor is required to carry workers&apos; compensation and does not, you may face
          liability and project risk if a worker is injured on your job. Requirements depend on
          structure, employees, and exemptions — the Division of Workers&apos; Compensation is the
          authority. Homeowner should confirm with carrier and official portals.
        </p>
      </div>

      <ul className="mt-4 space-y-3 text-sm">
        <li className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3">
          <p className="font-medium text-[var(--text)]">Proof of coverage search</p>
          <p className="mt-1 text-[var(--muted)]">
            Official Florida Division of Workers&apos; Compensation data portal.
          </p>
          <a
            href={POC_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[var(--accent)]"
          >
            Open Proof of Coverage →
          </a>
        </li>
        <li className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3">
          <p className="font-medium text-[var(--text)]">Exemption search</p>
          <p className="mt-1 text-[var(--muted)]">
            Confirm any exemption claim against the official published list.
          </p>
          <a
            href={EXEMPTION_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[var(--accent)]"
          >
            Open Exemption search →
          </a>
        </li>
        <li className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3">
          <p className="font-medium text-[var(--text)]">Division home</p>
          <a
            href={WC_HOME}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[var(--accent)]"
          >
            Division of Workers&apos; Compensation →
          </a>
        </li>
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
        Construction Policy Tracking / DBPR insurance flags are not displayed unless present as
        source-attributed extract fields.{" "}
        <Link href="/tools/pre-hire-checklist" className="text-[var(--accent)]">
          Pre-hire checklist
        </Link>{" "}
        ·{" "}
        <Link href="/disclaimer" className="text-[var(--accent)]">
          Disclaimer
        </Link>
      </p>
    </section>
  );
}
