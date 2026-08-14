import { OR_CCB_SEARCH_URL } from "@/lib/states/or-ccb";

export function OrOutOfStateNote({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 sm:px-5"
      role="note"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        Out of state on this extract
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-[var(--text)]">
        Mailing address is outside Oregon. The CCB license can still be an Oregon credential.
      </p>
      {compact ? (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
          CCB publishes “Out of State” as the county field. That is not the jobsite. Confirm current
          status on the{" "}
          <a
            href={OR_CCB_SEARCH_URL}
            className="font-medium text-[var(--navy)] underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            official CCB search
          </a>
          .
        </p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
          <li>
            These businesses have an Oregon CCB license and a non-Oregon mailing address on the
            Active Licenses extract.
          </li>
          <li>They may still work in Oregon under CCB rules — mailing address is not the jobsite.</li>
          <li>
            Always confirm current status on the{" "}
            <a
              href={OR_CCB_SEARCH_URL}
              className="font-medium text-[var(--navy)] underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              official CCB search
            </a>
            .
          </li>
        </ul>
      )}
    </aside>
  );
}
