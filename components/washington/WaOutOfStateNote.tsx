import { WA_LNI_VERIFY_URL } from "@/lib/states/wa-lni";

export function WaOutOfStateNote({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 sm:px-5"
      role="note"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        Out of state on this extract
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-[var(--text)]">
        Mailing address is outside Washington. The L&I license can still be a Washington credential.
      </p>
      {compact ? (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
          Mailing address is not the jobsite. Confirm current status on the{" "}
          <a
            href={WA_LNI_VERIFY_URL}
            className="font-medium text-[var(--navy)] underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            official L&I verify site
          </a>
          .
        </p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
          <li>
            These businesses have a Washington L&I license and a non-Washington mailing address on
            the contractor-license extract.
          </li>
          <li>They may still work in Washington under L&I rules — mailing address is not the jobsite.</li>
          <li>
            This list is not a ZIP-derived Washington county. County browse uses five-digit mailing
            ZIP only when the address is in Washington.
          </li>
          <li>
            Always confirm current status on the{" "}
            <a
              href={WA_LNI_VERIFY_URL}
              className="font-medium text-[var(--navy)] underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              official L&I verify site
            </a>
            .
          </li>
        </ul>
      )}
    </aside>
  );
}
