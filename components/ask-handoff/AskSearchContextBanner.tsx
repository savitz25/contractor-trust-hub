import { resolveContractorAskHandoff } from "@/lib/ask-handoff/resolve";
import type { ContractorAskSearchContext } from "@/lib/ask-handoff/allowlist";
import { AskHandoffEffects } from "./AskHandoffEffects";

export function AskSearchContextBanner({
  ctx,
  handoffType = "view_more",
}: {
  ctx: ContractorAskSearchContext | null;
  handoffType?: "view_more" | "entity";
}) {
  if (!ctx) return null;
  const dest = resolveContractorAskHandoff(ctx);

  return (
    <div
      className="mt-4 rounded-xl border border-[var(--border)] bg-white px-4 py-3 sm:px-5"
      data-ask-handoff="1"
      data-match-class={dest.matchClass || dest.status}
      data-entity={ctx.entityType || ""}
      role="status"
    >
      <AskHandoffEffects ctx={ctx} handoffType={handoffType} matchPrecision={dest.matchClass} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
        From AskTrustHub
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--text)]">{dest.bannerTitle}</p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{dest.bannerBody}</p>
    </div>
  );
}
