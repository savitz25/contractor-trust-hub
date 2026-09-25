/**
 * CTH-CARD-001 recorded-address display.
 *
 * The name-candidate v1 response stays free of street and ZIP. This module only
 * formats an address that a separate, credential-keyed projection already loaded
 * for the current /ask page. It never reads the database and never treats a
 * credential jurisdiction as the address state.
 */
import type { AskEntityCard } from "@/lib/ask/execute";
import { explicitCountyLabel, isOutOfJurisdictionMarker } from "@/lib/ask/candidate-card-presentation";

export const NAME_CANDIDATE_CARD_CAUTION = "Name matched — not proof this is the firm you mean.";
export const ADDRESS_UNAVAILABLE_NOTE =
  "Recorded address could not be loaded. That is not a finding that the source has no address.";
export const ADDRESS_NOT_CONFIRMED_NOTE = "Street and ZIP were not confirmed for this credential.";
export const OUT_OF_JURISDICTION_NOTE = "Source marks this address as out of jurisdiction.";

export type PublicAddressStatus = "loaded" | "missing_row" | "unavailable";

export type PublicAddressView = {
  status: PublicAddressStatus;
  line: string | null;
  countyLabel: string | null;
  locationOnly: string | null;
  outOfJurisdiction: boolean;
};

function clean(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function addressState(value: string | null | undefined): string {
  const state = clean(value).toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : "";
}

/** Format one license row's own address. County is labeled separately when a street or city is present. */
export function formatLicenseAddress(input: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  county?: string | null;
}): Pick<PublicAddressView, "line" | "countyLabel" | "locationOnly" | "outOfJurisdiction"> {
  const street = clean(input.street);
  const city = clean(input.city);
  const state = addressState(input.state);
  const zip = clean(input.postalCode);
  const countyRaw = clean(input.county);
  const outOfJurisdiction = isOutOfJurisdictionMarker(countyRaw);
  const countyLabel = outOfJurisdiction ? null : explicitCountyLabel(countyRaw, state);
  if (outOfJurisdiction && city && !street && !zip && !state) {
    return { line: null, countyLabel: null, locationOnly: city, outOfJurisdiction: true };
  }
  if (street || city || zip) {
    const place = [street, city, state].filter(Boolean).join(", ");
    return {
      line: [place, zip].filter(Boolean).join(" ") || null,
      countyLabel,
      locationOnly: null,
      outOfJurisdiction,
    };
  }
  if (countyLabel && state) {
    return { line: `${countyLabel}, ${state}`, countyLabel: null, locationOnly: null, outOfJurisdiction };
  }
  if (countyLabel) return { line: countyLabel, countyLabel: null, locationOnly: null, outOfJurisdiction };
  if (state) return { line: state, countyLabel: null, locationOnly: null, outOfJurisdiction };
  if (city) return { line: null, countyLabel: null, locationOnly: city, outOfJurisdiction };
  return { line: null, countyLabel: null, locationOnly: null, outOfJurisdiction };
}

export function fallbackProfileAddress(card: Pick<AskEntityCard, "city" | "county" | "state">): PublicAddressView {
  const formatted = formatLicenseAddress({ city: card.city, state: card.state, county: card.county });
  return { status: "missing_row", ...formatted };
}

export type NameSearchFilterAccount = {
  selected: string[];
  applied: string;
};

/** Form selections are not name-search filters unless the name operation's jurisdiction constraint ran. */
export function nameSearchFilterAccount(
  plan: {
    geography: { state: string | null; countySlug: string | null; countyLabel: string | null };
    trade: { label: string | null };
    credentialStatus: string;
    evidenceFamily: string | null;
  },
  nameSearch: { jurisdiction: string | null },
): NameSearchFilterAccount {
  const selected: string[] = [];
  if (plan.geography.countySlug && plan.geography.countyLabel) selected.push(plan.geography.countyLabel);
  else if (plan.geography.state === "FL") selected.push("Florida");
  if (plan.trade.label) selected.push(plan.trade.label);
  if (plan.credentialStatus === "active_current") selected.push("Active/current");
  else if (plan.credentialStatus === "expired") selected.push("Expired/inactive");
  if (plan.evidenceFamily) selected.push(plan.evidenceFamily.replaceAll("_", " "));
  const applied = nameSearch.jurisdiction
    ? `Credential jurisdiction ${nameSearch.jurisdiction} was applied. Place, trade, status, and evidence selections were not applied.`
    : "The supplied name only. Place, trade, status, and evidence selections were not applied.";
  return { selected, applied };
}
