import Link from "next/link";

/** Compact, calm disclaimer for page footers and Trust Reports. */
export function LegalNotice({ className = "" }: { className?: string }) {
  return (
    <aside
      className={
        className ||
        "rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-xs leading-relaxed text-[var(--muted)] shadow-[var(--shadow-sm)] sm:px-5 sm:text-sm"
      }
    >
      <p>
        <strong className="font-medium text-[var(--text)]">Educational research only.</strong>{" "}
        Contractor Trust Hub organizes public licensing and business records for independent
        research. We are not a consumer reporting agency under the FCRA, not a licensing board,
        and not a substitute for official government databases. Always confirm critical details
        (license status, insurance, contract terms) with the official board and the contractor
        before you hire.
      </p>
      <p className="mt-2">
        <Link href="/disclaimer" className="text-[var(--accent)]">
          Full disclaimer
        </Link>
        {" · "}
        <Link href="/independence" className="text-[var(--accent)]">
          Independence
        </Link>
        {" · "}
        <Link href="/corrections" className="text-[var(--accent)]">
          Request a correction
        </Link>
      </p>
    </aside>
  );
}
