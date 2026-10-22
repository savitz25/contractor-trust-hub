/**
 * Public OSHA view for one existing license. License-level totals only.
 * Inspection rows stay blocked until an official per-activity extract is loaded.
 */

export const OSHA_LEGAL_DISCLAIMER =
  "Citations are allegations by OSHA and may be contested, reduced, or withdrawn. A citation is not a final finding of violation.";

export const OSHA_MATCH_METHOD =
  "Matched to this business by name and location from public OSHA records.";

export const OSHA_REPORT_ERROR_LABEL = "Report an error";

export const OSHA_PENALTY_LABEL = "Cited penalty (current)";

export const OSHA_INSPECTION_LIST_STATUS = "blocked" as const;
export const OSHA_DETAIL_HELD_LICENSE_KEYS = new Set(["FL:CCC1329816", "FL:CGC1519699"]);

export const PUBLIC_OSHA_MATCH_SQL = `
SELECT id, license_key, state, match_tier, n_inspections,
       to_char(first_open, 'YYYY-MM-DD') AS first_open,
       to_char(last_open, 'YYYY-MM-DD') AS last_open,
       n_citation_items, n_serious, current_penalty_amount,
       n_with_final_order, n_contested
FROM contractor_osha_license_matches
WHERE contractor_id = $1::uuid
  AND state = $2
  AND match_tier IN ('exact', 'strong')
  AND license_key = ANY($3::text[])
ORDER BY license_key
`.trim();

const PUBLIC_TIERS = new Set(["exact", "strong"]);
const PILOT_STATES = new Set(["FL", "NJ"]);

export type OshaPublicRecord = {
  publicMatchId?: string;
  licenseKey: string;
  state: "FL" | "NJ";
  matchTier: "exact" | "strong";
  nInspections: number;
  firstOpen: string | null;
  lastOpen: string | null;
  nCitationItems: number;
  nSerious: number;
  currentPenalty: number;
  nWithFinalOrder: number;
  nContested: number;
  summary: string;
  penaltyLabel: typeof OSHA_PENALTY_LABEL;
  inspectionList: typeof OSHA_INSPECTION_LIST_STATUS;
  detailEligible: boolean;
};

export type OshaSourceMatch = {
  id?: string;
  licenseKey: string;
  state: string;
  matchTier: string;
  nInspections: number;
  firstOpen?: string | Date | null;
  lastOpen?: string | Date | null;
  nCitationItems: number;
  nSerious: number;
  currentPenalty: number;
  nWithFinalOrder: number;
  nContested: number;
  initialPenalty?: number;
  activityNumbers?: string | null;
};

export function isOshaPilotState(state: string | null | undefined): state is "FL" | "NJ" {
  return PILOT_STATES.has((state || "").trim().toUpperCase());
}

function whole(value: number): number | null {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Civil YYYY-MM-DD. Date values use local calendar getters so a PostgreSQL
 * DATE parsed at local midnight does not shift to the previous or next day.
 */
function isoDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = value.getMonth() + 1;
    const day = value.getDate();
    if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return null;
  return text.slice(0, 10);
}

function readOshaDate(value: unknown): string | Date | null {
  if (typeof value === "string" || value instanceof Date) return value;
  return null;
}

export function formatOshaSummary(
  nInspections: number,
  firstOpen: string | null,
  lastOpen: string | null,
  nCitationItems: number,
  nSerious: number,
): string {
  const noun = nInspections === 1 ? "inspection" : "inspections";
  const cited = nCitationItems === 1 ? "cited item" : "cited items";
  let when = "";
  if (firstOpen && lastOpen) {
    const start = firstOpen.slice(0, 4);
    const end = lastOpen.slice(0, 4);
    if (/^\d{4}$/.test(start) && /^\d{4}$/.test(end)) {
      when = start === end ? ` (${start})` : ` (${start}\u2013${end})`;
    }
  }
  return `${nInspections} OSHA ${noun}${when} · ${nCitationItems} ${cited} · ${nSerious} serious`;
}

export function formatCitedPenalty(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrentCitedPenalty(amount: number | null | undefined): string {
  return amount == null ? "—" : formatCitedPenalty(amount);
}

/** Exact and strong only. Drops placeholder tiers, other states, and unsupported inspection fields. */
export function toPublicOshaRecord(input: OshaSourceMatch): OshaPublicRecord | null {
  const state = input.state.trim().toUpperCase();
  const tier = input.matchTier.trim().toLowerCase();
  if (!isOshaPilotState(state) || !PUBLIC_TIERS.has(tier)) return null;
  const nInspections = whole(input.nInspections);
  const nCitationItems = whole(input.nCitationItems);
  const nSerious = whole(input.nSerious);
  const currentPenalty = whole(input.currentPenalty);
  const nWithFinalOrder = whole(input.nWithFinalOrder);
  const nContested = whole(input.nContested);
  const licenseKey = input.licenseKey.trim();
  if (
    nInspections == null ||
    nCitationItems == null ||
    nSerious == null ||
    currentPenalty == null ||
    nWithFinalOrder == null ||
    nContested == null ||
    !licenseKey
  ) {
    return null;
  }
  const firstOpen = isoDate(input.firstOpen);
  const lastOpen = isoDate(input.lastOpen);
  return {
    publicMatchId: input.id,
    licenseKey,
    state,
    matchTier: tier as "exact" | "strong",
    nInspections,
    firstOpen,
    lastOpen,
    nCitationItems,
    nSerious,
    currentPenalty,
    nWithFinalOrder,
    nContested,
    summary: formatOshaSummary(nInspections, firstOpen, lastOpen, nCitationItems, nSerious),
    penaltyLabel: OSHA_PENALTY_LABEL,
    inspectionList: OSHA_INSPECTION_LIST_STATUS,
    detailEligible: !OSHA_DETAIL_HELD_LICENSE_KEYS.has(`${state}:${licenseKey}`),
  };
}

export type OshaQuery = <T extends Record<string, unknown>>(
  text: string,
  params: unknown[],
) => Promise<T[]>;

export async function loadPublicOshaMatches(
  input: { contractorId: string; homeState: string | null; licenseKeys: string[] },
  deps: { enabled: boolean; query: OshaQuery },
): Promise<{ records: OshaPublicRecord[] | null; queryCount: number }> {
  if (!deps.enabled) return { records: null, queryCount: 0 };
  if (!isOshaPilotState(input.homeState)) return { records: null, queryCount: 0 };
  const licenseKeys = [...new Set(input.licenseKeys.map((key) => key.trim()).filter(Boolean))];
  if (!input.contractorId || licenseKeys.length === 0) return { records: null, queryCount: 0 };
  const rows = await deps.query<OshaSourceMatch & Record<string, unknown>>(PUBLIC_OSHA_MATCH_SQL, [
    input.contractorId,
    input.homeState.trim().toUpperCase(),
    licenseKeys,
  ]);
  const records = rows
    .map((row) =>
      toPublicOshaRecord({
        id: String(row.id ?? ""),
        licenseKey: String(row.license_key ?? row.licenseKey ?? ""),
        state: String(row.state ?? ""),
        matchTier: String(row.match_tier ?? row.matchTier ?? ""),
        nInspections: Number(row.n_inspections ?? row.nInspections),
        firstOpen: readOshaDate(row.first_open ?? row.firstOpen),
        lastOpen: readOshaDate(row.last_open ?? row.lastOpen),
        nCitationItems: Number(row.n_citation_items ?? row.nCitationItems),
        nSerious: Number(row.n_serious ?? row.nSerious),
        currentPenalty: Number(row.current_penalty_amount ?? row.currentPenalty),
        nWithFinalOrder: Number(row.n_with_final_order ?? row.nWithFinalOrder),
        nContested: Number(row.n_contested ?? row.nContested),
      }),
    )
    .filter((row): row is OshaPublicRecord => row != null);
  return { records: records.length ? records : null, queryCount: 1 };
}
