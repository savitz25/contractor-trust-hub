/**
 * Enhanced-county identity gates. County data enriches the Florida graph;
 * it does not replace DBPR credential identity.
 *
 * Never confirm a contractor from numeric license core alone.
 * Never publish permit volume from a name-only match.
 */

export type IdentityState =
  | "CONFIRMED"
  | "HIGH_CONFIDENCE"
  | "REVIEW_REQUIRED"
  | "UNRESOLVED";

export type IdentityMethod =
  | "FULL_DBPR_LICENSE"
  | "LOCAL_LICENSE_CROSSWALK"
  | "OFFICIAL_CONTRACTOR_ID"
  | "MULTI_FIELD_HIGH_CONFIDENCE"
  | "REVIEW_REQUIRED"
  | "UNRESOLVED";

export type NewProviderKind =
  | "existing_dbpr_unmatched"
  | "local_only_or_historical"
  | "other_board"
  | "out_of_state"
  | "owner_builder"
  | "unlicensed_record"
  | "unknown";

const OCCUPATION_PREFIX = /^([A-Z]{2,6})(\d{4,})$/;

export function normalizeFullLicense(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[\s\-_.]/g, "").toUpperCase();
}

/** Numeric core without occupation prefix — not a unique Florida identity. */
export function numericCoreOnly(raw: string | null | undefined): boolean {
  const n = normalizeFullLicense(raw);
  if (!n) return false;
  if (OCCUPATION_PREFIX.test(n)) return false;
  return /^\d{4,}$/.test(n);
}

export function hasOccupationPrefixedLicense(raw: string | null | undefined): boolean {
  return OCCUPATION_PREFIX.test(normalizeFullLicense(raw));
}

export type AttributionInput = {
  dbprFullLicense?: string | null;
  dbprLicenseExists?: boolean;
  localCertificateId?: string | null;
  localCrosswalksToDbpr?: boolean;
  officialContractorId?: string | null;
  officialIdLinkedToLicense?: boolean;
  legalNameAgree?: boolean;
  firmNameAgree?: boolean;
  addressAgree?: boolean;
  phoneAgree?: boolean;
  qualifierAgree?: boolean;
  nameOnly?: boolean;
  ambiguousName?: boolean;
};

export function classifyPermitAttribution(input: AttributionInput): {
  identityState: IdentityState;
  identityMethod: IdentityMethod;
} {
  const full = normalizeFullLicense(input.dbprFullLicense);
  if (full && numericCoreOnly(full)) {
    return { identityState: "UNRESOLVED", identityMethod: "UNRESOLVED" };
  }
  if (full && hasOccupationPrefixedLicense(full) && input.dbprLicenseExists) {
    return { identityState: "CONFIRMED", identityMethod: "FULL_DBPR_LICENSE" };
  }
  if (input.localCertificateId && input.localCrosswalksToDbpr && input.dbprLicenseExists) {
    return { identityState: "CONFIRMED", identityMethod: "LOCAL_LICENSE_CROSSWALK" };
  }
  if (input.officialContractorId && input.officialIdLinkedToLicense && input.dbprLicenseExists) {
    return { identityState: "CONFIRMED", identityMethod: "OFFICIAL_CONTRACTOR_ID" };
  }
  const strongAgrees =
    Number(Boolean(input.legalNameAgree)) +
    Number(Boolean(input.firmNameAgree)) +
    Number(Boolean(input.addressAgree)) +
    Number(Boolean(input.phoneAgree)) +
    Number(Boolean(input.qualifierAgree));
  if (strongAgrees >= 3 && (input.localCertificateId || full)) {
    return { identityState: "HIGH_CONFIDENCE", identityMethod: "MULTI_FIELD_HIGH_CONFIDENCE" };
  }
  if (input.ambiguousName || input.nameOnly) {
    return {
      identityState: input.ambiguousName ? "UNRESOLVED" : "REVIEW_REQUIRED",
      identityMethod: "REVIEW_REQUIRED",
    };
  }
  return { identityState: "UNRESOLVED", identityMethod: "UNRESOLVED" };
}

export function mayPublishPermitVolume(state: IdentityState): boolean {
  return state === "CONFIRMED";
}

export const PERMIT_RECORD_IDENTITY =
  "Permit identity is (source_jurisdiction, permit_number) or official source_record_id. Permit number alone is never unique.";

export const HQ_VS_ACTIVITY =
  "HQ/base county is the DBPR mailing county. Permit activity county is operating evidence. Do not overwrite one with the other.";

export const VALUATION_IS_NOT_REVENUE =
  "Recorded permit valuation is a government field, not company revenue or contract price. Missing value is null, never zero.";

export const EXPIRED_PERMIT_IS_NOT_DISCIPLINE =
  "Permit expired is not contractor discipline. Failed inspection is not a bad-contractor finding.";

/** Miami-Dade Open Data ContractorNumber mixed namespace. */
export type MdcContractorNamespace =
  | "DBPR_FULL_PREFIXED"
  | "MIAMI_DADE_COC"
  | "OWNER_BUILDER"
  | "OTHER_LOCAL_IDENTIFIER"
  | "AMBIGUOUS"
  | "BLANK";

const DBPR_PREFIXES = new Set([
  "CAC",
  "CBC",
  "CCC",
  "CFC",
  "CGC",
  "CMC",
  "CPC",
  "CRC",
  "CSC",
  "CUC",
  "CVC",
  "SCC",
  "PCC",
  "RA",
  "RB",
  "RC",
  "RF",
  "RG",
  "RM",
  "RP",
  "RQ",
  "RR",
  "RS",
  "RU",
  "RV",
  "RX",
  "EC",
  "ES",
  "ER",
  "EF",
  "EG",
  "ET",
  "EY",
  "LE",
  "FPC",
  "FSC",
]);

const MDC_COC = /^\d{2}[A-Z]{1,3}\d{4,}$/;

export function classifyMdcContractorNumber(
  raw: string | null | undefined,
  contractorName?: string | null,
): { namespace: MdcContractorNamespace; normalized: string } {
  const name = (contractorName || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  if (name === "OWNER" || name.startsWith("OWNERBUILD")) {
    return { namespace: "OWNER_BUILDER", normalized: normalizeFullLicense(raw) || "OWNER" };
  }
  const n = normalizeFullLicense(raw);
  if (!n) return { namespace: "BLANK", normalized: "" };
  const m = n.match(OCCUPATION_PREFIX);
  if (m) {
    const prefix = m[1];
    if (DBPR_PREFIXES.has(prefix)) return { namespace: "DBPR_FULL_PREFIXED", normalized: n };
    return { namespace: "AMBIGUOUS", normalized: n };
  }
  if (MDC_COC.test(n)) return { namespace: "MIAMI_DADE_COC", normalized: n };
  return { namespace: "OTHER_LOCAL_IDENTIFIER", normalized: n };
}
