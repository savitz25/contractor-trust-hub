/**
 * Business contact enrichment rule.
 * Do not limit a business to a single contact value.
 * Do not overwrite a legitimate secondary contact because another field is labeled primary.
 */

export type ContactKind =
  | "email"
  | "phone"
  | "phone_extension"
  | "contact_name"
  | "contact_title"
  | "website"
  | "physical_address"
  | "mailing_address"
  | "additional_location";

export type ContactObservation = {
  kind: ContactKind;
  value: string;
  sourceSystem: string;
  sourceUrl?: string | null;
  sourceDataset?: string | null;
  observedAt?: string | null;
  retrievedAt?: string | null;
  attributedEntityId: string;
  attributedEntityKind: "credential" | "person" | "business" | "business_entity";
  attributionClass?: "CONFIRMED" | "HIGH_CONFIDENCE" | "REVIEW_REQUIRED" | "UNRESOLVED";
  ordinal?: number;
  isPrimary?: boolean;
};

export const CONTACT_RULES = {
  allowMultiplePerKind: true,
  primaryDoesNotDeleteSecondary: true,
  requireProvenance: true,
  overwritePolicy: "never_overwrite_different_value",
} as const;

export function mergeContactObservations(
  existing: ContactObservation[],
  incoming: ContactObservation
): ContactObservation[] {
  const same = existing.find(
    (e) =>
      e.kind === incoming.kind &&
      normalizeContactValue(e.kind, e.value) === normalizeContactValue(incoming.kind, incoming.value)
  );
  if (same) {
    return existing.map((e) => (e === same ? { ...e, ...incoming, value: e.value } : e));
  }
  if (incoming.isPrimary) {
    return [
      ...existing.map((e) =>
        e.kind === incoming.kind ? { ...e, isPrimary: false } : e
      ),
      incoming,
    ];
  }
  return [...existing, incoming];
}

export function normalizeContactValue(kind: ContactKind, value: string): string {
  const v = value.trim();
  if (kind === "email") return v.toLowerCase();
  if (kind === "phone" || kind === "phone_extension") return v.replace(/\D/g, "");
  if (kind === "website") return v.replace(/\/+$/, "").toLowerCase();
  return v.replace(/\s+/g, " ").toUpperCase();
}

export const FLORIDA_CONTACT_SOURCE_INVENTORY = [
  {
    source: "fl_dbpr construction licensee extract",
    fields: ["address_line_1-3", "city", "state", "zip"],
    missing: ["email", "phone", "website", "contact name", "contact title"],
  },
  {
    source: "fl_dbpr Construction Business Information LicenseDetail",
    fields: ["main_address", "county", "licensure_date"],
    missing: ["email", "phone", "website", "contact name", "contact title"],
  },
  {
    source: "fl_dbpr construction applicants extract (constr_app.csv)",
    fields: ["address", "phone", "phone_extension"],
    missing: ["email", "website", "contact title"],
  },
  {
    source: "fl_dbpr swimming pool licensed examiners extract (swimpool_exam.csv)",
    fields: ["email", "phone", "licensee_name", "expiration"],
    missing: ["website", "contact title"],
  },
  {
    source: "fl_sunbiz corporate extract",
    fields: ["principal_address", "registered_agent_name", "officers[].address"],
    missing: ["email", "phone", "website"],
  },
  {
    source: "fl_dbpr discipline / ULA / recovery fund",
    fields: ["address when not 'Private Address'"],
    missing: ["email", "phone", "website"],
  },
  {
    source: "fl_dfs stop-work list",
    fields: ["city", "county", "employer name"],
    missing: ["email", "phone", "website", "street", "FEIN"],
  },
] as const;
