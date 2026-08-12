import { FLORIDA_COUNTIES } from "@/lib/discovery/counties";
import {
  countyFromFloridaZip,
  normalizeZip,
} from "@/lib/plan/location";
import { coverageForCounty, coverageLabel } from "./coverage";
import { loadPermitsForAddress } from "./permits";
import type {
  PropertyAddressInput,
  PropertyPermitRecord,
  PropertyResearchResult,
} from "./types";

function slugifyPart(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Stable property id from normalized address (no PII server store required). */
export function propertyIdFromAddress(input: {
  street: string;
  unit?: string;
  zip: string;
}): string {
  const key = `${slugifyPart(input.street)}|${input.unit ? slugifyPart(input.unit) + "|" : ""}${input.zip}`;
  // base64url of key for compact path segment
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
  return street
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(street|st\.)\b/gi, "ST")
    .replace(/\b(avenue|ave\.)\b/gi, "AVE")
    .replace(/\b(boulevard|blvd\.)\b/gi, "BLVD")
    .replace(/\b(drive|dr\.)\b/gi, "DR")
    .replace(/\b(road|rd\.)\b/gi, "RD")
    .replace(/\b(lane|ln\.)\b/gi, "LN")
    .replace(/\b(court|ct\.)\b/gi, "CT")
    .toUpperCase();
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
  if (!zip) {
    return unresolved("Enter a valid 5-digit Florida ZIP code.");
  }
  // Florida ZIP range rough check
  const z = Number(zip);
  if (z < 32000 || z > 34999) {
    return unresolved(
      "ZIP does not look like a Florida ZIP. Stage 3 is Florida-first — use a FL ZIP."
    );
  }

  const countyName = countyFromFloridaZip(zip);
  const countyDef = countyName
    ? FLORIDA_COUNTIES.find(
        (c) =>
          c.name.toLowerCase() === countyName.toLowerCase() ||
          c.matchNames.some((n) => n.toLowerCase() === countyName.toLowerCase())
      )
    : null;

  const cov = coverageForCounty(countyDef?.name || countyName);
  const propertyId = propertyIdFromAddress({ street: normalizeStreet(street), unit, zip });
  const normalizedAddress = formatNormalizedAddress({
    street: street.trim(),
    unit,
    city,
    zip,
    state,
  });

  const checked = [
    "Street address and ZIP provided",
    "Florida ZIP → county best-effort resolution",
    "Jurisdiction coverage matrix lookup",
    "Pilot permit extract match by address key (when connected)",
  ];
  const notChecked = [
    "Full Assessor / parcel ownership records",
    "Live AHJ portal scrape for this request",
    "Automatic open-permit legal liability determination",
    "Complete statewide permit history",
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
      street: normalizeStreet(street),
      zip,
    });
  }

  const openCount = permits.filter((p) => p.status === "open" || p.status === "issued")
    .length;
  const expiredUnresolvedCount = permits.filter((p) => p.status === "expired").length;

  let resolveStatus: PropertyResearchResult["resolveStatus"] = "resolved";
  let resolveMessage =
    permits.length > 0
      ? "Property resolved with permit records in current pilot extracts."
      : level === "partial" || level === "full"
        ? "Property resolved. No permit records matched this address in current extracts — that does not prove a clean permit history."
        : "Property resolved to county. Permit extracts are not connected for this jurisdiction yet.";

  if (level === "jurisdiction_unsupported") {
    resolveStatus = "limited";
  }

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
    coverageNote: `${coverageLabel(level)}. ${cov?.note || ""}`.trim(),
    checked,
    notChecked,
    permits,
    openCount,
    expiredUnresolvedCount,
    dataFreshness: permits.length ? "2026-03-01" : null,
    resolveStatus,
    resolveMessage,
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
