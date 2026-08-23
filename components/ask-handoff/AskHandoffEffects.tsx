"use client";

import { useEffect } from "react";
import type { ContractorAskSearchContext } from "@/lib/ask-handoff/allowlist";
import {
  analyticsFromContractorAsk,
  persistContractorAskHandoff,
  trackAskSearchHandoff,
} from "@/lib/ask-handoff/session";

export function AskHandoffEffects({
  ctx,
  handoffType,
  matchPrecision,
}: {
  ctx: ContractorAskSearchContext;
  handoffType: "view_more" | "entity";
  matchPrecision?: string;
}) {
  useEffect(() => {
    persistContractorAskHandoff(ctx);
    trackAskSearchHandoff(
      analyticsFromContractorAsk(ctx, {
        handoff_type: handoffType,
        match_precision: matchPrecision,
      })
    );
  }, [ctx, handoffType, matchPrecision]);
  return null;
}
