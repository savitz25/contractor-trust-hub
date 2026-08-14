import { formatDate, statusLabel } from "./format";
import { getOccupationInfo } from "./occupations";
import { hasRelatedEntitySignal } from "./entity-signals";
import type { ContractorDetail } from "./types";

export type CompareField = {
  id: string;
  label: string;
  /** One value per contractor column */
  values: string[];
  /** Optional tone per column for subtle highlighting */
  tones?: Array<"good" | "warn" | "bad" | "neutral">;
};

function yearsSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const years = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 0) return "—";
  if (years < 1) return "Under 1 year";
  const n = Math.floor(years);
  return `About ${n} year${n === 1 ? "" : "s"}`;
}

function isActive(s: string | null | undefined): boolean {
  const x = (s || "").toLowerCase();
  return x === "active" || x === "current";
}

function isBad(s: string | null | undefined): boolean {
  const x = (s || "").toLowerCase();
  return x === "inactive" || x === "dissolved" || x === "revoked";
}

function toneStatus(s: string | null | undefined): "good" | "warn" | "bad" | "neutral" {
  if (isActive(s)) return "good";
  if (isBad(s)) return "bad";
  if (!s) return "neutral";
  return "warn";
}

export function buildCompareFields(contractors: ContractorDetail[]): CompareField[] {
  if (contractors.length === 0) return [];

  return [
    {
      id: "license_status",
      label: "License status",
      values: contractors.map((c) => {
        const lic = c.licenses[0];
        return lic ? statusLabel(lic.statusNormalized) : "No license on profile";
      }),
      tones: contractors.map((c) => toneStatus(c.licenses[0]?.statusNormalized)),
    },
    {
      id: "license_key",
      label: "License id",
      values: contractors.map((c) => c.licenses[0]?.externalKey || "—"),
    },
    {
      id: "license_class",
      label: "License class(es)",
      values: contractors.map((c) => {
        if (!c.licenses.length) return "—";
        return c.licenses
          .slice(0, 3)
          .map((l) => {
            const code = l.occupationCode;
            return code ? `${code} · ${getOccupationInfo(code).label}` : l.externalKey;
          })
          .join("; ");
      }),
    },
    {
      id: "years_licensed",
      label: "Years licensed (from board date)",
      values: contractors.map((c) =>
        yearsSince(c.licenses[0]?.originalLicensureDate)
      ),
    },
    {
      id: "entity_status",
      label: "Sunbiz entity status",
      values: contractors.map((c) =>
        c.entities[0] ? statusLabel(c.entities[0].status) : "No high-confidence link"
      ),
      tones: contractors.map((c) =>
        c.entities[0] ? toneStatus(c.entities[0].status) : "neutral"
      ),
    },
    {
      id: "entity_link",
      label: "Entity linkage",
      values: contractors.map((c) => {
        const e = c.entities[0];
        if (!e) return "Not linked (strict match only)";
        const conf =
          e.matchConfidence != null ? ` · conf ${e.matchConfidence.toFixed(2)}` : "";
        return `${e.matchMethod || "linked"}${conf}`;
      }),
    },
    {
      id: "entity_name",
      label: "Linked entity name",
      values: contractors.map((c) => c.entities[0]?.legalName || "—"),
    },
    {
      id: "entity_formed",
      label: "Entity formation date",
      values: contractors.map((c) => formatDate(c.entities[0]?.formationDate)),
    },
    {
      id: "discipline",
      label: "Discipline in our extracts",
      values: contractors.map((c) =>
        c.discipline.length === 0
          ? "None identified in current extracts"
          : `${c.discipline.length} record(s) identified`
      ),
      tones: contractors.map((c) =>
        c.discipline.length === 0 ? "good" : "warn"
      ),
    },
    {
      id: "related_entity",
      label: "Related-entity signal",
      values: contractors.map((c) =>
        hasRelatedEntitySignal(c)
          ? "Observation(s) present — see Trust Report"
          : "None flagged on this profile"
      ),
      tones: contractors.map((c) =>
        hasRelatedEntitySignal(c) ? "warn" : "neutral"
      ),
    },
    {
      id: "location",
      label: "Location on file",
      values: contractors.map((c) => {
        const parts = [c.primaryCity, c.primaryCounty, c.homeState].filter(Boolean);
        return parts.length ? parts.join(" · ") : "—";
      }),
    },
    {
      id: "insurance_guidance",
      label: "Insurance / WC guidance",
      values: contractors.map(
        () => "Not verified here — request COI & confirm with carrier"
      ),
      tones: contractors.map(() => "neutral" as const),
    },
    {
      id: "permits",
      label: "Permit / activity history",
      values: contractors.map(
        () => "Not yet linked in current dataset"
      ),
    },
  ];
}

/** Max contractors in shortlist / side-by-side evidence compare. */
export const MAX_COMPARE = 3;
