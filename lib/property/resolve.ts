import { FLORIDA_COUNTIES } from "@/lib/discovery/counties";
import {
  countyFromFloridaZip,
  normalizeZip,
} from "@/lib/plan/location";
import { coverageForCounty, coverageLabel } from "./coverage";
import { buildAddressKey, normalizeStreetKey } from "./matcher";
import { loadPermitsForAddress } from "./permits";
import type {
  PropertyAddressInput,
  PropertyPermitRecord,
  PropertyResearchResult,
} from "./types";

/** Stable property id from normalized address (no PII server store required). */
export function propertyIdFromAddress(input: {
  street: string;
  unit?: string;
  zip: string;
}): string {
  const key = buildAddressKey(input.street, input.zip, input.unit);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(key, "utf8")
      .toString("base64url")
      .replace(/=+$/, "");
  }
  return btoa(key).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePropertyId(id: string): {
  street: string;
  unit?: string;
  zip: string;
} | null {
  try {
    let raw: string;
    if (typeof Buffer !== "undefined") {
      raw = Buffer.from(id, "base64url").toString("utf8");
    } else {
      const b64 = id.replace(/-/g, "+").replace(/_/g, "/");
      raw = atob(b64);
    }
    const parts = raw.split("|");
    if (parts.length < 2) return null;
    const zip = parts[parts.length - 1];
    if (!/^\d{5}$/.test(zip)) return null;
    if (parts.length === 3) {
      return { street: parts[0], unit: parts[1], zip };
    }
    return { street: parts[0], zip };
  } catch {
    return null;
  }
}

export function normalizeStreet(street: string): string {
  return normalizeStreetKey(street);
}

function hasStreetNumber(street: string): boolean {
  return /^\d/.test(street.trim()) || /\b\d+\b/.test(street);
}

export function formatNormalizedAddress(input: {
  street: string;
  unit?: string;
  city?: string | null;
  zip: string;
  state?: string;
}): string {
  const unit = input.unit?.trim() ? ` ${input.unit.trim()}` : "";
  const city = input.city?.trim() ? `${input.city.trim()}, ` : "";
  return `${input.street.trim()}${unit}, ${city}${(input.state || "FL").toUpperCase()} ${input.zip}`;
}

/**
 * Resolve Florida address → property research result with coverage honesty.
 */
export function researchProperty(
  input: PropertyAddressInput
): PropertyResearchResult {
  const zip = normalizeZip(input.zip);
  const street = input.street?.trim() || "";
  const unit = input.unit?.trim() || undefined;
  const city = input.city?.trim() || null;
  const state = (input.state || "FL").toUpperCase();

  if (!street || street.length < 5) {
    return unresolved("Enter a full street address (number and street name).");
  }
  if (!hasStreetNumber(street)) {
    return unresolved(
      "Address looks incomplete — include a street number when possible (e.g. 100 Ocean Drive)."
    );
  }
  if (!zip) {
    return unresolved("Enter a valid 5-digit Florida ZIP code.");
  }
  const z = Number(zip);
  if (z < 32000 || z > 34999) {
    return unresolved(
      "ZIP does not look like a Florida ZIP. Florida-first — use a FL ZIP."
    );
  }

  const streetNorm = normalizeStreet(street);
  const unitNorm = unit ? normalizeStreet(unit) : undefined;
  const resolutionNotes: string[] = [];
  resolutionNotes.push(`Street normalized to “${streetNorm}” for extract matching.`);
  if (unitNorm) resolutionNotes.push(`Unit normalized to “${unitNorm}”.`);

  const countyName = countyFromFloridaZip(zip);
  const countyDef = countyName
    ? FLORIDA_COUNTIES.find(
        (c) =>
          c.name.toLowerCase() === countyName.toLowerCase() ||
          c.matchNames.some((n) => n.toLowerCase() === countyName.toLowerCase())
      )
    : null;

  if (countyName) {
    resolutionNotes.push(
      `Jurisdiction inferred from ZIP ${zip} → ${countyName} County (best-effort ZIP map; multi-county ZIPs may differ).`
    );
  } else {
    resolutionNotes.push("County could not be inferred from ZIP alone.");
  }
  if (city) {
    resolutionNotes.push(`City provided by user: ${city} (not independently verified).`);
  }

  const cov = coverageForCounty(countyDef?.name || countyName);
  if (cov) {
    resolutionNotes.push(
      `Coverage status: ${coverageLabel(cov.level)} (${cov.sourceLabel}). Wave ${cov.wave}.`
    );
  }

  const propertyId = propertyIdFromAddress({
    street: streetNorm,
    unit: unitNorm,
    zip,
  });
  const normalizedAddress = formatNormalizedAddress({
    street: street.trim(),
    unit,
    city,
    zip,
    state,
  });

  const checked = [
    "Street address and ZIP provided",
    "Street / unit normalization for address-key matching",
    "Florida ZIP → county best-effort resolution",
    "Jurisdiction coverage matrix lookup",
    "Wave A–C permit extract match by address key (when connected)",
  ];
  const notChecked = [
    "Full Assessor / parcel ownership records",
    "Live AHJ portal scrape for this request",
    "Automatic open-permit legal liability determination",
    "Complete statewide permit history",
    "Weak fuzzy-name contractor joins",
  ];

  if (!countyName && !city) {
    return {
      propertyId,
      normalizedAddress,
      street: street.trim(),
      unit,
      city,
      zip,
      state,
      county: null,
      countySlug: null,
      coverage: "source_unavailable",
      coverageNote:
        "Could not resolve county from ZIP. Address accepted, but jurisdiction context is limited.",
      checked,
      notChecked,
      permits: [],
      openCount: 0,
      expiredUnresolvedCount: 0,
      dataFreshness: null,
      resolveStatus: "limited",
      resolveMessage:
        "Address recognized with limited location resolution. Add city if known and re-check.",
    };
  }

  const level = cov?.level || "jurisdiction_unsupported";
  let permits: PropertyPermitRecord[] = [];
  if (level === "partial" || level === "full") {
    permits = loadPermitsForAddress({
      street: streetNorm,
      zip,
      unit: unitNorm,
    });
    resolutionNotes.push(
      permits.length
        ? `Matched ${permits.length} permit row(s) on address key in current extracts.`
        : "No permit rows matched this normalized address key in current extracts."
    );
  }

  const openCount = permits.filter((p) => p.status === "open").length;
  const issuedOpenCount = permits.filter(
    (p) => p.status === "open" || p.status === "issued"
  ).length;
  const expiredUnresolvedCount = permits.filter((p) => p.status === "expired").length;
  const finalizationMissingCount = permits.filter(
    (p) =>
      (p.status === "open" || p.status === "issued") && !p.finalDate
  ).length;

  let resolveStatus: PropertyResearchResult["resolveStatus"] = "resolved";
  let resolveMessage =
    permits.length > 0
      ? "Property resolved with permit records in current Wave extracts."
      : level === "partial" || level === "full"
        ? "Property resolved. No permit records matched this address in current extracts — that does not prove a clean permit history."
        : "Property resolved to county. Permit extracts are not connected for this jurisdiction yet.";

  if (level === "jurisdiction_unsupported") {
    resolveStatus = "limited";
  }

  const freshness =
    permits.map((p) => p.retrievedAt).find(Boolean) || cov?.freshness || null;

  return {
    propertyId,
    normalizedAddress,
    street: street.trim(),
    unit,
    city: city || null,
    zip,
    state,
    county: cov?.county || countyName,
    countySlug: cov?.countySlug || countyDef?.slug || null,
    coverage: level,
    openCount,
    expiredUnresolvedCount,
    issuedOpenCount,
    finalizationMissingCount,
    dataFreshness: freshness,
    resolveStatus,
    resolveMessage,
    resolutionNotes,
    coverageNote: `${coverageLabel(level)}. ${cov?.note || ""}`.trim(),
    checked,
    notChecked,
    permits,
  };
}

function unresolved(message: string): PropertyResearchResult {
  return {
    propertyId: "",
    normalizedAddress: "",
    street: "",
    zip: "",
    state: "FL",
    city: null,
    county: null,
    countySlug: null,
    coverage: "source_unavailable",
    coverageNote: message,
    checked: ["Input validation"],
    notChecked: ["County resolution", "Permit extract lookup"],
    permits: [],
    openCount: 0,
    expiredUnresolvedCount: 0,
    dataFreshness: null,
    resolveStatus: "unresolved",
    resolveMessage: message,
  };
}
