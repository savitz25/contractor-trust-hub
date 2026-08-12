"use client";

import { useState } from "react";
import {
  buildRelatedEntitySignals,
  type EntitySignal,
} from "@/lib/contractors/entity-signals";
import type { ContractorDetail } from "@/lib/contractors/types";

function SignalCard({ signal }: { signal: EntitySignal }) {
  return (
    <article className="rounded-xl border border-amber-200/80 bg-white/90 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-amber-950">{signal.title}</p>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
          {signal.confidence} confidence
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-amber-950/90">{signal.detail}</p>
      {signal.evidence.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
          {signal.evidence.map((e) => (
            <li key={e}>· {e}</li>
          ))}
        </ul>
      ) : null}
      {signal.questions.length > 0 ? (
        <div className="mt-3 border-t border-amber-100 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            What to ask
          </p>
          <ul className="mt-1 space-y-1 text-xs text-[var(--text)]">
            {signal.questions.map((q) => (
              <li key={q}>· {q}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export function RelatedEntitySection({
  contractor,
}: {
  contractor: ContractorDetail;
}) {
  const signals: EntitySignal[] = buildRelatedEntitySignals(contractor);
  const [open, setOpen] = useState(signals.length > 0 && signals.length <= 2);

  if (signals.length === 0) {
    return (
      <section
        id="related-entity"
        className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Related entity signals
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          No multi-entity or principal-overlap observations met our thresholds on this profile.
          Absence of a signal is not a clearance — only that current extracts did not surface a
          pattern we flag.
        </p>
      </section>
    );
  }

  return (
    <section
      id="related-entity"
      className="scroll-mt-28 rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-900/80">
            Related entity signals
          </h2>
          <p className="mt-1 text-sm text-amber-950/85">
            Observations from public extracts — not a determination of wrongdoing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)]"
        >
          {open ? "Collapse" : `Show ${signals.length} signal(s)`}
        </button>
      </div>
      {open ? (
        <div className="mt-4 space-y-3">
          {signals.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            This is a factual relationship signal, not an accusation. Always verify the legal
            contracting party, license, and insurance name yourself.
          </p>
        </div>
      ) : null}
    </section>
  );
}
