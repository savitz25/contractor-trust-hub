import type { ContractorDetail } from "@/lib/contractors/types";
import { hasRelatedEntitySignal } from "@/lib/contractors/entity-signals";

export function CautionSummary({ contractor }: { contractor: ContractorDetail }) {
  const disc = contractor.discipline.length;
  const related = hasRelatedEntitySignal(contractor);
  const thin = contractor.isThinProfile;

  let headline: string;
  let tone: "ok" | "warn" | "info";
  if (disc > 0) {
    headline = "Discipline records identified in board extracts";
    tone = "warn";
  } else if (related) {
    headline = "Related-entity observations present — review below";
    tone = "warn";
  } else if (thin) {
    headline = "Limited data in this section — treat missing fields as unknown";
    tone = "info";
  } else {
    headline = "No discipline records identified in current extracts";
    tone = "ok";
  }

  const ring =
    tone === "warn"
      ? "border-amber-200 bg-amber-50/90"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50/80"
        : "border-[var(--border)] bg-[var(--panel)]";

  return (
    <div id="caution-summary" className={`rounded-2xl border px-4 py-3 sm:px-5 ${ring}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Caution snapshot
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--text)]">{headline}</p>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-[var(--muted)]">
        <li>
          · Discipline:{" "}
          {disc > 0
            ? `${disc} record(s) linked in board extracts`
            : "None identified in current extracts (not a warranty of clean history)"}
        </li>
        <li>
          · Related-entity signals:{" "}
          {related
            ? "One or more factual observations on this profile"
            : "None flagged from current extracts"}
        </li>
        {thin ? (
          <li>· Thin profile: fewer fields populated in our extract</li>
        ) : null}
      </ul>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Educational only — describes public-record evidence, not a score or hiring recommendation.
      </p>
    </div>
  );
}
