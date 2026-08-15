/**
 * Verify "What kind of work?" chips.
 * Routes use published occupation/class codes from live state adapters only.
 * Never invent a license class that is not in the extract.
 */

import { ARIZONA_TRADES } from "@/lib/arizona/trades";
import { FLORIDA_TRADES } from "@/lib/discovery/trades";
import { discoveryPath, getDiscoveryState } from "@/lib/discovery/config";
import type { TradeDef } from "@/lib/discovery/types";
import { WASHINGTON_TRADES } from "@/lib/washington/trades";
import { getStateBySlug, verifyPathFor } from "@/lib/states/config";

export const WORK_INTENT_IDS = [
  "electrical",
  "plumbing",
  "hvac",
  "roofing",
  "solar",
  "general",
] as const;

export type WorkIntentId = (typeof WORK_INTENT_IDS)[number];

export type WorkChipMode = "discovery" | "class" | "assist";

export type WorkSearchFilter = {
  occupationCodes: string[];
  classCodes: string[];
  descriptionTerms: string[];
  nameTerms: string[];
};

export type ResolvedWorkChip = {
  id: WorkIntentId;
  label: string;
  mode: WorkChipMode;
  href: string;
  /** Shown under chips when this intent is active and mode is assist. */
  honesty?: string;
  filter: WorkSearchFilter;
};

const LABELS: Record<WorkIntentId, string> = {
  electrical: "Electrical",
  plumbing: "Plumbing",
  hvac: "HVAC",
  roofing: "Roofing",
  solar: "Solar",
  general: "General contractor",
};

const ASSIST_HONESTY =
  "Filters by name/specialty text in this state’s extract — not a formal license-class directory.";

const ASSIST_TERMS: Record<WorkIntentId, string[]> = {
  electrical: ["electrical", "electrician"],
  plumbing: ["plumbing", "plumber"],
  hvac: ["hvac", "air conditioning", "heating"],
  roofing: ["roofing", "roofer"],
  solar: ["solar"],
  general: ["general contractor", "general construction"],
};

function emptyFilter(): WorkSearchFilter {
  return {
    occupationCodes: [],
    classCodes: [],
    descriptionTerms: [],
    nameTerms: [],
  };
}

function fromTrade(trade: TradeDef, extraNames: string[] = []): WorkSearchFilter {
  return {
    occupationCodes: [...trade.occupationCodes],
    classCodes: [...(trade.classCodes || [])],
    descriptionTerms: [...(trade.descriptionIncludes || [])],
    nameTerms: extraNames,
  };
}

function findTrade(trades: TradeDef[], slugs: string[]): TradeDef | null {
  for (const slug of slugs) {
    const hit = trades.find((t) => t.slug === slug);
    if (hit) return hit;
  }
  return null;
}

function verifyHref(stateSlug: string, work: WorkIntentId, q?: string): string {
  const params = new URLSearchParams();
  if (stateSlug !== "fl") params.set("state", stateSlug);
  params.set("work", work);
  if (q?.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return qs ? `/verify?${qs}` : "/verify";
}

function flDiscoveryHref(tradeSlug: string): string {
  const disc = getDiscoveryState("florida");
  if (!disc) return `/florida/${tradeSlug}`;
  return discoveryPath(disc, { tradeSlug });
}

function resolveFlorida(id: WorkIntentId, q?: string): ResolvedWorkChip | null {
  const map: Partial<Record<WorkIntentId, string>> = {
    plumbing: "plumbing",
    hvac: "air-conditioning",
    roofing: "roofers",
    general: "general-contractors",
  };
  const tradeSlug = map[id];
  if (tradeSlug) {
    const trade = findTrade(FLORIDA_TRADES, [tradeSlug]);
    return {
      id,
      label: LABELS[id],
      mode: "discovery",
      href: flDiscoveryHref(tradeSlug),
      filter: trade ? fromTrade(trade) : emptyFilter(),
    };
  }
  // Electrical / solar are not CILB occupation pages on this extract.
  return {
    id,
    label: LABELS[id],
    mode: "assist",
    href: verifyHref("fl", id, q),
    honesty: ASSIST_HONESTY,
    filter: { ...emptyFilter(), nameTerms: ASSIST_TERMS[id] },
  };
}

function classChip(
  stateSlug: string,
  id: WorkIntentId,
  filter: WorkSearchFilter,
  q?: string
): ResolvedWorkChip {
  return {
    id,
    label: LABELS[id],
    mode: "class",
    href: verifyHref(stateSlug, id, q),
    filter,
  };
}

function assistChip(
  stateSlug: string,
  id: WorkIntentId,
  filter: WorkSearchFilter,
  q?: string
): ResolvedWorkChip {
  const assistQ = q?.trim() || ASSIST_TERMS[id][0];
  return {
    id,
    label: LABELS[id],
    mode: "assist",
    href: verifyHref(stateSlug, id, assistQ),
    honesty: ASSIST_HONESTY,
    filter,
  };
}

export function resolveWorkIntent(
  stateSlug: string,
  id: WorkIntentId,
  q?: string
): ResolvedWorkChip | null {
  const state = getStateBySlug(stateSlug);
  if (!state?.live) return null;

  if (state.slug === "fl") return resolveFlorida(id, q);

  if (state.slug === "tx") {
    if (id === "electrical") {
      return classChip(state.slug, id, {
        ...emptyFilter(),
        occupationCodes: ["TEC", "TES", "TME", "TJE", "TAE"],
      }, q);
    }
    if (id === "hvac") {
      return classChip(state.slug, id, { ...emptyFilter(), occupationCodes: ["TAC"] }, q);
    }
    if (id === "plumbing") {
      return classChip(state.slug, id, {
        ...emptyFilter(),
        occupationCodes: ["TRMP", "TMP", "TJP", "TTP"],
      }, q);
    }
    return null;
  }

  if (state.slug === "nj") {
    if (id === "electrical") {
      return classChip(state.slug, id, { ...emptyFilter(), occupationCodes: ["ELE", "TEL"] }, q);
    }
    if (id === "plumbing") {
      return classChip(state.slug, id, { ...emptyFilter(), occupationCodes: ["PLB"] }, q);
    }
    if (id === "hvac") {
      return classChip(state.slug, id, { ...emptyFilter(), occupationCodes: ["HVAC"] }, q);
    }
    if (id === "general") {
      return classChip(state.slug, id, { ...emptyFilter(), occupationCodes: ["HIC", "GEN"] }, q);
    }
    return assistChip(state.slug, id, { ...emptyFilter(), nameTerms: ASSIST_TERMS[id] }, q);
  }

  if (state.slug === "ca") {
    const codes: Partial<Record<WorkIntentId, string[]>> = {
      electrical: ["C10"],
      plumbing: ["C36"],
      hvac: ["C20"],
      roofing: ["C39"],
      solar: ["C46"],
      general: ["B"],
    };
    const occupationCodes = codes[id];
    if (!occupationCodes) return null;
    return classChip(state.slug, id, { ...emptyFilter(), occupationCodes }, q);
  }

  if (state.slug === "az") {
    const slugs: Partial<Record<WorkIntentId, string[]>> = {
      electrical: ["electrical"],
      plumbing: ["plumbing"],
      hvac: ["hvac"],
      roofing: ["roofing"],
      general: ["dual-general", "general-residential"],
    };
    const trade = slugs[id] ? findTrade(ARIZONA_TRADES, slugs[id]!) : null;
    if (!trade) {
      if (id === "solar") {
        return assistChip(state.slug, id, { ...emptyFilter(), nameTerms: ASSIST_TERMS.solar }, q);
      }
      return null;
    }
    return classChip(state.slug, id, fromTrade(trade), q);
  }

  if (state.slug === "ky") {
    if (id === "electrical") {
      return classChip(state.slug, id, {
        ...emptyFilter(),
        occupationCodes: ["ELEC", "ELE", "MEL"],
      }, q);
    }
    if (id === "hvac") {
      return classChip(state.slug, id, { ...emptyFilter(), occupationCodes: ["HVAC"] }, q);
    }
    if (id === "plumbing") {
      return classChip(state.slug, id, { ...emptyFilter(), occupationCodes: ["PLB"] }, q);
    }
    return null;
  }

  if (state.slug === "wa") {
    const slugs: Partial<Record<WorkIntentId, string[]>> = {
      electrical: ["electrical"],
      plumbing: ["plumbing"],
      hvac: ["hvac"],
      roofing: ["roofing"],
      general: ["construction", "general-construction"],
    };
    const trade = slugs[id] ? findTrade(WASHINGTON_TRADES, slugs[id]!) : null;
    // Prefer published L&I type / specialty codes. Name ILIKE is a last resort
    // (solar) — OR-ing it with EC/PC scans the whole extract and starves the pooler.
    const filter = trade
      ? fromTrade(trade)
      : { ...emptyFilter(), nameTerms: ASSIST_TERMS[id] };
    return assistChip(state.slug, id, filter, q);
  }

  if (state.slug === "or") {
    if (id === "general") {
      const trade = findTrade(getDiscoveryState("oregon")?.trades || [], [
        "residential-general",
      ]);
      return classChip(
        state.slug,
        id,
        trade ? fromTrade(trade) : { ...emptyFilter(), occupationCodes: ["RGC"] },
        q
      );
    }
    return assistChip(state.slug, id, { ...emptyFilter(), nameTerms: ASSIST_TERMS[id] }, q);
  }

  // LA / MS / others: published types are commercial/residential, not trades.
  return assistChip(state.slug, id, { ...emptyFilter(), nameTerms: ASSIST_TERMS[id] }, q);
}

export function workChipsForState(stateSlug: string, q?: string): ResolvedWorkChip[] {
  return WORK_INTENT_IDS.map((id) => resolveWorkIntent(stateSlug, id, q)).filter(
    (c): c is ResolvedWorkChip => Boolean(c)
  );
}

export function parseWorkIntent(raw: string | undefined): WorkIntentId | null {
  const id = (raw || "").toLowerCase();
  return (WORK_INTENT_IDS as readonly string[]).includes(id) ? (id as WorkIntentId) : null;
}

export function workFilterIsEmpty(filter: WorkSearchFilter): boolean {
  return (
    filter.occupationCodes.length === 0 &&
    filter.classCodes.length === 0 &&
    filter.descriptionTerms.length === 0 &&
    filter.nameTerms.length === 0
  );
}

export function verifyPathWithWork(
  stateSlug: string,
  opts: { q?: string; work?: WorkIntentId | null; intent?: string | null }
): string {
  const params = new URLSearchParams();
  if (stateSlug !== "fl") params.set("state", stateSlug);
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.work) params.set("work", opts.work);
  if (opts.intent) params.set("intent", opts.intent);
  const qs = params.toString();
  if (!qs) return verifyPathFor(stateSlug);
  if (stateSlug === "fl") return `/verify?${qs}`;
  return `/verify?${qs}`;
}
