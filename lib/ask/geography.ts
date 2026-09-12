import { CONTRACTOR_STATE_NAMES } from "../search/state-names";
import { FLORIDA_COUNTIES } from "../discovery/counties";
import {
  NJ_COUNTIES,
  resolveNjMunicipality,
} from "../specialist-execution/nj-geography";
import {
  getExecutionCapability,
  getTradeCapability,
} from "../specialist-execution/state-capabilities";
import type { AskUrlOverrides } from "./url";

export type GeographyRequirement = {
  rawPlace: string;
  requestedKind: "city" | "county" | "state" | "unknown";
  requestedCity?: string;
  requestedCounty?: string;
  requestedState?: string;
  normalizedPlace: string;
  resolution: "EXACT" | "CORRECTION_SUGGESTED" | "AMBIGUOUS" | "UNSUPPORTED";
  executionOutcome:
    | "APPLIED"
    | "NEEDS_CLARIFICATION"
    | "UNSUPPORTED"
    | "USER_APPROVED_RELAXATION";
  executionGeography?: {
    state: string;
    city?: string;
    county?: string;
    countySlug?: string;
    meaning: string;
  };
  correction?: { id: string; county: string; state: string };
  acceptedCorrection?: boolean;
  canBroaden: boolean;
  message: string;
  source?: string;
  officialHref?: string;
};
const normalized = (s: string) => s.trim().replace(/\s+/g, " ");
const title = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function stateName(code: string) {
  return title(
    Object.keys(CONTRACTOR_STATE_NAMES).find(
      (k) => CONTRACTOR_STATE_NAMES[k] === code,
    ) ?? code,
  );
}
function stateSuffix(raw: string) {
  return Object.entries(CONTRACTOR_STATE_NAMES)
    .sort(([a], [b]) => b.length - a.length)
    .find(([name, code]) =>
      new RegExp(`(?:^|[ ,])(?:${esc(name)}|${code})$`, "i").test(raw),
    );
}
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = old;
    }
  }
  return row[b.length];
}
const counties = [
  ...FLORIDA_COUNTIES.map((c) => ({ id: c.slug, county: c.name, state: "FL" })),
  ...NJ_COUNTIES.map((c) => ({
    id: c.toLowerCase().replaceAll(" ", "-"),
    county: c,
    state: "NJ",
  })),
];
/** Extract an explicit requirement. Source capability is a separate decision. */
export function extractGeographyRequirement(
  question: string,
): GeographyRequirement | null {
  if (/\b(?:llc|inc|corp|corporation|company|holdings)\b/i.test(question))
    return null;
  let raw = question.match(
    /\b(?:in|near|around|serving|within)\s+(.+?)(?=\s+(?:with|having|that|which|sorted|sort|active|expired|licensed)\b|[?!;]|$)/i,
  )?.[1];
  if (!raw) {
    raw = question.match(/\bcontractors?\s+([a-z][a-z ,.'-]+)$/i)?.[1];
    if (!raw && stateSuffix(question.trim().replace(/[?.]+$/, "")))
      raw = question.replace(
        /^(?:show\s+|find\s+)?(?:active\s+|current\s+)?(?:roofers?|roofing|hvacr?|plumb(?:ers?|ing)|electrical|electricians?|home improvement|general|mechanical)\s+/i,
        "",
      );
  }
  if (!raw) return null;
  raw = normalized(raw).replace(/[?.]+$/, "");
  const base: GeographyRequirement = {
    rawPlace: raw,
    requestedKind: "unknown",
    normalizedPlace: raw,
    resolution: "AMBIGUOUS",
    executionOutcome: "NEEDS_CLARIFICATION",
    canBroaden: false,
    message:
      "Clarify the requested city, county and state. No broader search has run.",
  };
  if (
    /\b(?:and|or|near me|miles?|radius)\b/i.test(raw) ||
    /\b(?:near me|within\s+\d+)\b/i.test(question)
  )
    return base;
  const suffix = stateSuffix(raw);
  let place = suffix
    ? raw
        .replace(
          new RegExp(`(?:^|[ ,])(?:${esc(suffix[0])}|${suffix[1]})$`, "i"),
          "",
        )
        .trim()
        .replace(/[, ]+$/, "")
    : raw;
  let state = suffix?.[1];
  if (
    suffix &&
    Object.entries(CONTRACTOR_STATE_NAMES).some(([name, code]) =>
      new RegExp(`(?:^|[ ,])(?:${esc(name)}|${code})(?:$|[ ,])`, "i").test(
        place,
      ),
    )
  )
    return {
      ...base,
      message:
        "Multiple or conflicting places need clarification. No state was selected.",
    };
  if (!/^[a-z .,'-]*$/i.test(place)) return base;
  if (suffix && !place)
    return {
      ...base,
      requestedKind: "state",
      requestedState: state,
      normalizedPlace: stateName(state!),
      resolution: "EXACT",
    };
  const countyWord = /\s+county$/i.test(place);
  place = place.replace(/\s+county$/i, "");
  const exact = counties.filter(
    (c) =>
      (!state || c.state === state) &&
      c.county.toLowerCase().replaceAll("-", " ") ===
        place.toLowerCase().replaceAll("-", " "),
  );
  if (
    exact.length === 1 &&
    (countyWord ||
      ["Broward", "Palm Beach", "Miami-Dade"].includes(exact[0].county))
  ) {
    state ??= exact[0].state;
    return {
      ...base,
      requestedKind: "county",
      requestedCounty: exact[0].county,
      requestedState: state,
      normalizedPlace: `${exact[0].county} County, ${stateName(state)}`,
      resolution: "EXACT",
    };
  }
  if (countyWord) {
    const candidates = counties
      .filter((c) => (!state || state === c.state) && place.length >= 5)
      .map((c) => ({
        ...c,
        d: distance(place.toLowerCase(), c.county.toLowerCase()),
      }))
      .filter((c) => c.d > 0 && c.d <= (place.length >= 7 ? 2 : 1))
      .sort((a, b) => a.d - b.d);
    const correction =
      candidates.length && (!candidates[1] || candidates[0].d < candidates[1].d)
        ? candidates[0]
        : undefined;
    return {
      ...base,
      requestedKind: "county",
      requestedCounty: title(place),
      requestedState: state,
      normalizedPlace: `${title(place)} County${state ? `, ${stateName(state)}` : ""}`,
      resolution: correction ? "CORRECTION_SUGGESTED" : "UNSUPPORTED",
      correction: correction
        ? {
            id: correction.id,
            county: correction.county,
            state: correction.state,
          }
        : undefined,
    };
  }
  // Retain the existing accepted Boca Raton mapping; do not infer other cities' states from a partial corpus.
  if (!state && /^boca raton$/i.test(place)) state = "FL";
  if (!state && /^summit$/i.test(place)) state = "NJ";
  return {
    ...base,
    requestedKind: "city",
    requestedCity: title(place),
    requestedState: state,
    normalizedPlace: `${title(place)}${state ? `, ${stateName(state)}` : ""}`,
    resolution: state ? "EXACT" : "AMBIGUOUS",
  };
}

export function decideGeography(
  requirement: GeographyRequirement | null,
  trade: string | null,
  overrides: AskUrlOverrides = {},
): GeographyRequirement | null {
  if (!requirement) return null;
  const r = { ...requirement, executionGeography: undefined };
  let state = r.requestedState,
    city = r.requestedCity,
    county = r.requestedCounty;
  if (overrides.geoAction === "correct") {
    if (!r.correction || overrides.geoChoice !== r.correction.id)
      return {
        ...r,
        message:
          "That correction does not match the suggested place. Choose a valid correction or edit the question.",
      };
    state = r.correction.state;
    county = r.correction.county;
    city = undefined;
    r.acceptedCorrection = true;
  } else if (r.resolution === "CORRECTION_SUGGESTED")
    return {
      ...r,
      message: `Did you mean ${r.correction!.county} County, ${stateName(r.correction!.state)}? Apply the correction before research runs.`,
    };
  if (!state || r.resolution === "AMBIGUOUS") return r;
  const capability = getExecutionCapability(state);
  const tradeCapability =
    capability && trade
      ? getTradeCapability(state as "FL" | "NJ" | "TX", trade)
      : null;
  if (!capability || (trade && !tradeCapability)) {
    return {
      ...r,
      executionOutcome: "UNSUPPORTED",
      message:
        state === "TX"
          ? "Texas TDLR trade intelligence is published, but this credential-list path does not provide a queryable cohort for this requested trade. The requested locality has not been applied. Texas source overviews and Austin permits are separate research grains; Florida classes are not substituted."
          : `This credential-list path does not support the requested trade in ${stateName(state)}. No other state or trade was substituted.`,
      source:
        state === "TX"
          ? "Texas TDLR intelligence snapshot; no credential-list executor"
          : undefined,
      officialHref:
        state === "TX"
          ? "https://www.tdlr.texas.gov/LicenseSearch/"
          : undefined,
    };
  }
  const exactCounty = county
    ? counties.find(
        (c) =>
          c.state === state && c.county.toLowerCase() === county!.toLowerCase(),
      )
    : undefined;
  const unsupportedLocal = Boolean(
    (state === "TX" && (city || county)) ||
      (county && !exactCounty) ||
      (state === "NJ" && city && !resolveNjMunicipality(city)),
  );
  const broaden =
    overrides.geoAction === "broaden" &&
    overrides.geoChoice === state.toLowerCase();
  if (overrides.geoAction === "broaden" && !broaden)
    return {
      ...r,
      message: "The broader state must match the requested jurisdiction.",
    };
  if (
    (unsupportedLocal ||
      (overrides.geo &&
        overrides.geo !== exactCounty?.id &&
        !(
          r.requestedKind === "state" && overrides.geo === state.toLowerCase()
        ))) &&
    !broaden
  )
    return {
      ...r,
      executionOutcome: "UNSUPPORTED",
      canBroaden: true,
      message: `The requested local geography cannot be applied in this credential path. You can explicitly choose ${stateName(state)} statewide research instead.`,
    };
  if (broaden) {
    city = undefined;
    county = undefined;
  }
  return {
    ...r,
    executionOutcome: broaden ? "USER_APPROVED_RELAXATION" : "APPLIED",
    canBroaden: !!(city || county),
    source: capability.state.boardLabel,
    message: broaden
      ? "User selected broader state research; the original local requirement was not applied."
      : r.acceptedCorrection
        ? "User accepted the county correction."
        : "Requested recorded geography applied before pagination.",
    executionGeography: {
      state,
      city,
      county,
      countySlug: broaden ? undefined : exactCounty?.id,
      meaning:
        county || city
          ? "Recorded credential address, not service territory or availability."
          : "State credential jurisdiction, not service territory or availability.",
    },
  };
}
