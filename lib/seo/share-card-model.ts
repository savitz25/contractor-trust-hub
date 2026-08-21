/**
 * SHARE-003 — Contractor share-card models (no I/O).
 * Cards use only fields already published on the public page.
 * Never convert missing discipline / missing license into an endorsement.
 */

export type ContractorShareCardKind = "fallback" | "entity" | "content";

export type ContractorShareCardModel = {
  kind: ContractorShareCardKind;
  eyebrow: string;
  title: string;
  subtitle?: string;
  fact?: string;
};

const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

export function truncateShareText(value: string, maxChars: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function displayStateName(codeOrName?: string | null): string {
  const raw = (codeOrName || "").trim();
  if (!raw) return "";
  if (raw.length === 2) return US_STATE_NAMES[raw.toUpperCase()] || raw.toUpperCase();
  return raw;
}

function tradeEyebrow(tradeLabel?: string | null): string {
  const cleaned = (tradeLabel || "")
    .replace(/^(Certified|Registered|Licensed)\s+/i, "")
    .trim();
  if (!cleaned) return "CONTRACTOR RESEARCH";
  return `${truncateShareText(cleaned, 32).toUpperCase()} RESEARCH`;
}

function locationLine(input: {
  city?: string | null;
  county?: string | null;
  state?: string | null;
}): string {
  const state = displayStateName(input.state);
  const city = (input.city || "").trim();
  const county = (input.county || "").trim();
  if (city && state) return `${city}, ${state}`;
  if (county && state) {
    const countyLabel = /county$/i.test(county) ? county : `${county} County`;
    return `${countyLabel}, ${state}`;
  }
  return city || county || state;
}

export function contractorEntityShareModel(input: {
  name: string;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  tradeLabel?: string | null;
}): ContractorShareCardModel {
  const location = locationLine({
    city: input.city,
    county: input.county,
    state: input.state,
  });
  return {
    kind: "entity",
    eyebrow: tradeEyebrow(input.tradeLabel),
    title: truncateShareText(input.name || "", 48) || "Contractor profile",
    subtitle: location ? truncateShareText(location, 52) : undefined,
    fact: "Licensing · company research",
  };
}

export function contractorStateShareModel(stateName: string): ContractorShareCardModel {
  const name = truncateShareText(stateName || "", 36);
  return {
    kind: "content",
    eyebrow: "STATE CONTRACTOR RESEARCH",
    title: name ? `${name} contractors` : "State contractor research",
    fact: "Licensing · company research · county guides",
  };
}

export function contractorPlaceShareModel(input: {
  placeName: string;
  stateName: string;
  isCounty?: boolean;
}): ContractorShareCardModel {
  const state = truncateShareText((input.stateName || "").toUpperCase(), 28);
  const raw = (input.placeName || "").trim();
  const place = input.isCounty && raw && !/county$/i.test(raw) ? `${raw} County` : raw;
  return {
    kind: "content",
    eyebrow: state ? `${state} CONTRACTOR RESEARCH` : "CONTRACTOR RESEARCH",
    title: place ? `${truncateShareText(place, 40)} contractors` : "Local contractor research",
    fact: "Licensing · company research",
  };
}

export function contractorTradeShareModel(input: {
  tradeTitle: string;
  stateName: string;
}): ContractorShareCardModel {
  const state = truncateShareText(input.stateName || "", 28);
  return {
    kind: "content",
    eyebrow: state ? `${state.toUpperCase()} LICENSE RESEARCH` : "CONTRACTOR RESEARCH",
    title: truncateShareText(input.tradeTitle || "Trade research", 46),
    fact: "Licensing · company research",
  };
}

export function contractorPlaceTradeShareModel(input: {
  tradeTitle: string;
  placeName: string;
  stateName: string;
}): ContractorShareCardModel {
  const place = truncateShareText(input.placeName || "", 36);
  const state = truncateShareText(input.stateName || "", 24);
  const where = [place, state].filter(Boolean).join(", ");
  return {
    kind: "content",
    eyebrow: tradeEyebrow(input.tradeTitle),
    title: truncateShareText(input.tradeTitle || "Contractor research", 46),
    subtitle: where || undefined,
    fact: "Licensing · company research",
  };
}

export function contractorGuideShareModel(input: {
  title: string;
  kicker?: string | null;
}): ContractorShareCardModel {
  return {
    kind: "content",
    eyebrow: truncateShareText((input.kicker || "CONSUMER RESEARCH GUIDE").toUpperCase(), 40),
    title: truncateShareText(input.title || "Contractor research guide", 52),
    fact: "Independent license research · not a marketplace",
  };
}
