import type { NetworkDiscoveryEntity } from "./types";
import { isUnsupportedAskTrade } from "./trades";

export type QueryMatch = {
  network_entity_id: string;
  display_name: string;
  reasons: string[];
};

export type QueryFixture = {
  label: string;
  /** Fail-closed: must never match via widening. */
  expectUnsupported?: boolean;
  match: (e: NetworkDiscoveryEntity) => string[] | null;
};

function norm(s: string | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function countyHit(e: NetworkDiscoveryEntity, needle: string): boolean {
  const n = needle.toLowerCase();
  if ((e.county || "").toLowerCase().includes(n)) return true;
  return (e.service_areas || []).some(
    (a) => a.kind === "county" && a.county.toLowerCase().includes(n)
  );
}

function cityHit(e: NetworkDiscoveryEntity, city: string): boolean {
  return norm(e.city) === norm(city);
}

function tradeHit(e: NetworkDiscoveryEntity, cat: string): boolean {
  return (e.categories || []).includes(cat as never);
}

const CITY_COUNTY: Record<string, { county: string; state: string }> = {
  miami: { county: "miami-dade", state: "FL" },
  tampa: { county: "hillsborough", state: "FL" },
  jacksonville: { county: "duval", state: "FL" },
  orlando: { county: "orange", state: "FL" },
};

export const REQUIRED_QUERY_FIXTURES: QueryFixture[] = [
  {
    label: "roofers Miami FL",
    match: (e) => {
      if (!tradeHit(e, "roofing") || e.state !== "FL") return null;
      const reasons = ["trade_match"];
      if (cityHit(e, "Miami")) reasons.push("exact_physical_city");
      if (countyHit(e, "miami")) reasons.push("exact_physical_county");
      if (reasons.length === 1) return null;
      return reasons;
    },
  },
  {
    label: "roofing contractors Broward County FL",
    match: (e) => {
      if (!tradeHit(e, "roofing") || e.state !== "FL") return null;
      if (!countyHit(e, "broward")) return null;
      return ["trade_match", "exact_physical_county"];
    },
  },
  {
    label: "plumbers Palm Beach County FL",
    match: (e) => {
      if (!tradeHit(e, "plumbing") || e.state !== "FL") return null;
      if (!countyHit(e, "palm")) return null;
      return ["trade_match", "exact_physical_county"];
    },
  },
  {
    label: "HVAC contractors Tampa FL",
    match: (e) => {
      if (!tradeHit(e, "hvac") || e.state !== "FL") return null;
      const reasons = ["trade_match"];
      if (cityHit(e, "Tampa")) reasons.push("exact_physical_city");
      if (countyHit(e, "hillsborough")) reasons.push("exact_physical_county");
      if (reasons.length === 1) return null;
      return reasons;
    },
  },
  {
    label: "electricians Jacksonville FL",
    match: (e) => {
      if (!tradeHit(e, "electrical") || e.state !== "FL") return null;
      const reasons = ["trade_match"];
      if (cityHit(e, "Jacksonville")) reasons.push("exact_physical_city");
      if (countyHit(e, "duval")) reasons.push("exact_physical_county");
      if (reasons.length === 1) return null;
      return reasons;
    },
  },
  {
    label: "general contractors Orlando FL",
    match: (e) => {
      if (!tradeHit(e, "general_contractor") || e.state !== "FL") return null;
      const reasons = ["trade_match"];
      if (cityHit(e, "Orlando")) reasons.push("exact_physical_city");
      if (countyHit(e, "orange")) reasons.push("exact_physical_county");
      if (reasons.length === 1) return null;
      return reasons;
    },
  },
  {
    label: "roofers Monmouth County NJ",
    match: (e) => {
      if (!tradeHit(e, "roofing") || e.state !== "NJ") return null;
      if (!countyHit(e, "monmouth")) return null;
      return ["trade_match", "exact_physical_county"];
    },
  },
  {
    label: "plumbers Bergen County NJ",
    match: (e) => {
      if (!tradeHit(e, "plumbing") || e.state !== "NJ") return null;
      if (!countyHit(e, "bergen")) return null;
      return ["trade_match", "exact_physical_county"];
    },
  },
  {
    label: "contractors Middlesex County NJ",
    match: (e) => {
      if (!tradeHit(e, "general_contractor") || e.state !== "NJ") return null;
      if (!countyHit(e, "middlesex")) return null;
      return ["trade_match", "exact_physical_county"];
    },
  },
  {
    label: "general contractors New Jersey",
    match: (e) => {
      if (!tradeHit(e, "general_contractor")) return null;
      if (e.state === "NJ") return ["trade_match", "physical_state"];
      if (/new jersey contractor credential/i.test(e.regulatory_status_summary || "")) {
        return ["trade_match", "license_state"];
      }
      return null;
    },
  },
  {
    label: "home inspectors Miami",
    expectUnsupported: true,
    match: () => null,
  },
];

export function matchesQuery(e: NetworkDiscoveryEntity, fixture: QueryFixture): boolean {
  if (fixture.expectUnsupported) return false;
  return Boolean(fixture.match(e)?.length);
}

function collect(
  entities: NetworkDiscoveryEntity[],
  pred: (e: NetworkDiscoveryEntity) => string[] | null
): QueryMatch[] {
  return entities
    .map((e) => {
      const reasons = pred(e);
      if (!reasons?.length) return null;
      return { network_entity_id: e.network_entity_id, display_name: e.display_name, reasons };
    })
    .filter((x): x is QueryMatch => Boolean(x));
}

export function auditContractorQueryReadiness(entities: NetworkDiscoveryEntity[]) {
  const out: Record<string, unknown> = {};
  for (const fixture of REQUIRED_QUERY_FIXTURES) {
    if (fixture.expectUnsupported) {
      out[fixture.label] = isUnsupportedAskTrade("home inspector")
        ? { count: 0, note: "home_inspector is not in the accepted Contractor taxonomy — fail closed." }
        : { count: -1 };
      continue;
    }
    const matches = collect(entities, fixture.match);
    const extra: Record<string, unknown> = { matches: matches.length, sample: matches.slice(0, 5) };
    if (fixture.label === "roofers Miami FL") {
      extra.note = "Physical city/county only — not a fabricated Miami service area.";
    }
    if (fixture.label === "HVAC contractors Tampa FL") {
      extra.note = "CAC occupation only. City Tampa and/or Hillsborough County physical evidence.";
    }
    if (fixture.label === "electricians Jacksonville FL") {
      extra.note =
        "Florida electrical is not a CILB occupation page; expected 0 in this occupation-code feed.";
    }
    if (fixture.label === "roofers Monmouth County NJ") {
      extra.note =
        "NJ has no roofing occupation code; HIC is not inferred as roofing. Zero is fail-closed, not a gap to fill from names.";
    }
    out[fixture.label] = extra;
  }
  out.city_county_aliases = CITY_COUNTY;
  return out;
}
