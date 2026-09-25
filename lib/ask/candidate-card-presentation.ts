/**
 * ATH-SEARCH-UX-001 display copy. Does not match, sort, count, or choose destinations.
 * Match wording is derived from the method the name operation already attached to the card.
 */
import type { AskEntityCard } from "@/lib/ask/execute";
import { NAME_MATCH_DISCLAIMER } from "@/lib/ask/execute";
import { NAME_CANDIDATE_RECORDED_ADDRESS_MEANING } from "@/lib/specialist-execution/contractor-name-candidates";

export { NAME_CANDIDATE_RECORDED_ADDRESS_MEANING };

/** One notice above the company-name candidate list. Not applied to exact-identifier results. */
export const NAME_CANDIDATE_LIST_NOTICE =
  "A matching name does not establish that the record is the exact business you mean. Source order is not a recommendation. A recorded address is distinct from the credential jurisdiction, service territory, and current availability.";

const FIELD_SHORT: Record<string, string> = {
  display_name: "display name",
  legal_name: "legal name",
  dba_name: "DBA name",
  licensee_name_raw: "source licensee name",
  dba_name_raw: "source DBA name",
};

function fieldLabel(field: string): string {
  return FIELD_SHORT[field] ?? field.replaceAll("_", " ");
}

/**
 * Short face summary. Name-candidate methods stay distinct.
 * A prefix/token or alias match is never labeled exact.
 * Returns null when the card has no supported match metadata, so other result types keep their own explanation.
 */
export function matchSummary(card: Pick<AskEntityCard, "matchedOn" | "whyMatched">, suppliedName?: string | null): string | null {
  const matched = card.matchedOn;
  if (matched?.method) {
    const quoted = suppliedName?.trim() ? `Matched “${suppliedName.trim()}”` : "Matched the supplied name";
    const field = fieldLabel(matched.field);
    switch (matched.method) {
      case "EXACT_SOURCE_NAME":
        return `${quoted} · exact source name on ${field}`;
      case "NORMALIZED_NAME":
        return `${quoted} · normalized name match on ${field}`;
      case "DOCUMENTED_ALIAS":
        return `${quoted} · documented alias on ${field}`;
      case "PREFIX_OR_TOKEN":
        return `${quoted} · prefix/token match on ${field}`;
      default:
        return `${quoted} · ${matched.method.replaceAll("_", " ").toLowerCase()} on ${field}`;
    }
  }
  if (card.whyMatched.startsWith("Matches the submitted credential identifier")) return "Exact credential identifier match";
  if (card.whyMatched.startsWith("Matches the submitted company name")) return "Normalized company-name match";
  return null;
}

/** Trace keeps the row explanation. The shared name disclaimer is the list notice, not a per-card copy. */
export function traceMatchText(whyMatched: string): string {
  const suffix = ` ${NAME_MATCH_DISCLAIMER}`;
  if (whyMatched.endsWith(suffix)) return whyMatched.slice(0, -suffix.length).trim();
  if (whyMatched.endsWith(NAME_MATCH_DISCLAIMER)) return whyMatched.slice(0, -NAME_MATCH_DISCLAIMER.length).trim();
  return whyMatched;
}

const COUNTY_KIND = /\b(county|parish|borough|census area|municipality)\b/i;
const NOT_A_COUNTY = /^(out[-\s]?of[-\s]?state|unknown|n\/a|na|none|not reported|other)$/i;

/** Bare county names become "Palm Beach County". Louisiana uses Parish. Two-letter codes and "Out-of-State" stay as stored. */
export function explicitCountyLabel(county: string | null | undefined, state: string | null | undefined): string | null {
  const raw = county?.replace(/\s+/g, " ").trim() || "";
  if (!raw) return null;
  if (NOT_A_COUNTY.test(raw) || /^[A-Za-z]{2}$/.test(raw) || COUNTY_KIND.test(raw)) return raw;
  if ((state || "").trim().toUpperCase() === "LA") return `${raw} Parish`;
  if ((state || "").trim().toUpperCase() === "AK") return raw;
  return `${raw} County`;
}

export function recordedAddressLine(card: Pick<AskEntityCard, "city" | "county" | "state" | "postalCode">): string | null {
  const city = card.city?.replace(/\s+/g, " ").trim() || "";
  const state = card.state?.replace(/\s+/g, " ").trim() || "";
  const county = explicitCountyLabel(card.county, state) || "";
  const zip = card.postalCode?.replace(/\s+/g, " ").trim() || "";
  const place = [city, county, state].filter(Boolean).join(", ");
  const line = [place, zip].filter(Boolean).join(" ");
  return line || null;
}

/** Visible when a place filter is selected but company-name search did not use it. */
export function unappliedNameSearchPlace(plan: { geography: { state: string | null; countySlug: string | null; countyLabel: string | null } }, nameSearch: { jurisdiction: string | null } | null | undefined): string | null {
  if (!nameSearch || nameSearch.jurisdiction) return null;
  if (plan.geography.countySlug && plan.geography.countyLabel) return plan.geography.countyLabel;
  if (plan.geography.state === "FL") return "Florida";
  return null;
}

export function showGeographyOnFace(card: Pick<AskEntityCard, "geographyNote">): boolean {
  return Boolean(card.geographyNote) && card.geographyNote !== NAME_CANDIDATE_RECORDED_ADDRESS_MEANING;
}
