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

export function recordedAddressLine(card: Pick<AskEntityCard, "city" | "county" | "state">): string | null {
  const city = card.city?.trim() || "";
  const state = card.state?.trim() || "";
  let county = card.county?.trim() || "";
  if (county && state && (county === state || county.endsWith(`, ${state}`) || county.endsWith(` ${state}`))) {
    // County text already names the state, as name candidates store "County, ST".
  } else if (county && state) county = `${county}, ${state}`;
  else if (!county && state) county = state;
  const parts = [city, county].filter(Boolean);
  const line = parts.join(", ");
  return line || null;
}

export function showGeographyOnFace(card: Pick<AskEntityCard, "geographyNote">): boolean {
  return Boolean(card.geographyNote) && card.geographyNote !== NAME_CANDIDATE_RECORDED_ADDRESS_MEANING;
}
