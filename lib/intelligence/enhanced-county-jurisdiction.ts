/**
 * Jurisdiction coverage for Broward and Palm Beach.
 * Never label a dataset "Broward County permits" or "Palm Beach County permits"
 * unless coverage is literally countywide.
 */

export type JurisdictionKind =
  | "county"
  | "unincorporated"
  | "municipal"
  | "multi_jurisdiction"
  | "unknown";

export type CoverageLevelClaim = "statewide" | "enhanced";

export type JurisdictionDef = {
  countySlug: "broward" | "palm-beach";
  slug: string;
  label: string;
  kind: JurisdictionKind;
  permittingAuthority: string;
  publicSearchUrl?: string;
  vendor?: string;
  notes: string;
  ePermitsOneStop?: boolean;
};

/** Palm Beach County PZB building permits are unincorporated-only unless another source proves otherwise. */
export const PBC_PZB_COVERAGE: JurisdictionKind = "unincorporated";

export const PBC_OPEN_PERMIT_DISCLOSURE =
  "Unincorporated Palm Beach County Building permits. Not Palm Beach County permit activity.";

export const ONESTOP_IS_NOT_COUNTYWIDE =
  "ePermits OneStop participation is a submittal path for associated county approvals and some municipal applications. It is not complete countywide historical permit coverage.";

export function permitLabelForJurisdiction(j: JurisdictionDef): string {
  if (j.kind === "unincorporated" && j.countySlug === "palm-beach") {
    return "Unincorporated Palm Beach County building permits";
  }
  if (j.kind === "unincorporated" && j.countySlug === "broward") {
    return "Broward Municipal Services District / unincorporated Broward building permits";
  }
  if (j.kind === "municipal") {
    return `${j.label} municipal building permits`;
  }
  if (j.kind === "county") {
    return `${j.label} county-issued records`;
  }
  return `${j.label} (jurisdiction unknown — do not count as countywide)`;
}

export function isCountywidePermitDataset(kind: JurisdictionKind): boolean {
  return false;
}

export function pcnUnincorporated(pcn: string | null | undefined): boolean {
  const d = (pcn || "").replace(/\D/g, "").slice(0, 2);
  return d === "00";
}

/**
 * Coverage level stays Statewide Research until loaded contractor-level local
 * activity exists, coverage is documented, and metrics are defensible.
 */
export function enhancedCountyReady(opts: {
  contractorLevelSourceLoaded: boolean;
  coverageDocumented: boolean;
  identityRulesDocumented: boolean;
  freshnessExists: boolean;
  provenanceExists: boolean;
  metricsDefensible: boolean;
  missingMunicipalitiesDisclosed: boolean;
}): boolean {
  return (
    opts.contractorLevelSourceLoaded &&
    opts.coverageDocumented &&
    opts.identityRulesDocumented &&
    opts.freshnessExists &&
    opts.provenanceExists &&
    opts.metricsDefensible &&
    opts.missingMunicipalitiesDisclosed
  );
}
