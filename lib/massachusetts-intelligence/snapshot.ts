import accepted from "./accepted-snapshot.json";
import events from "./events.json";
import { MA_STATE_INTEL_VERSION, MA_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const MASSACHUSETTS_SNAPSHOT = accepted;
export type MassachusettsContractorSnapshot = typeof accepted;
/** Event rows. Server-side only (page and tests); the Ask interpreter imports summary.json instead. */
export const MASSACHUSETTS_EVENTS = events;
export type MaDolEvent = (typeof events)["dol_discipline"][number];

export const MA_TRADE_BOARDS = {
  electrician: ["EL"],
  plumber: ["PL", "GF"],
  "gas fitter": ["PL", "GF"],
  "sheet metal": ["SM"],
} as const;

export function assertMassachusettsSnapshot(
  value: MassachusettsContractorSnapshot = MASSACHUSETTS_SNAPSHOT,
): MassachusettsContractorSnapshot {
  if (value.contract_name !== MA_STATE_INTEL_VERSION) throw new Error(`Unexpected MA contract ${value.contract_name}`);
  if (value.fingerprint !== MA_STATE_PUBLIC_FINGERPRINT) throw new Error("MA-CON-001 snapshot fingerprint mismatch");
  if (value.path !== "/massachusetts") throw new Error("Massachusetts path must be /massachusetts");
  const hic = value.credential_systems.find((c) => c.id === "hic");
  const csl = value.credential_systems.find((c) => c.id === "csl");
  if (!hic || !csl || hic.id === csl.id) throw new Error("HIC and CSL must be separate credential systems");
  if (hic.bulk !== "NOT_ACQUIRED" || hic.rowsAcquired !== null) throw new Error("HIC rows must be null, not zero");
  if (csl.bulk !== "NOT_ACQUIRED" || csl.rowsAcquired !== null) throw new Error("CSL rows must be null, not zero");
  if (hic.lookup !== "KNOWN" || csl.lookup !== "KNOWN") throw new Error("HIC and CSL lookups are known");
  const d = value.dol_discipline;
  if (d.rows !== 518 || d.distinctComplaints !== 364) throw new Error("DOL construction discipline drifted");
  if (events.dol_discipline.length !== d.rows) throw new Error("DOL event rows must match the count");
  if (d.coverage !== "PARTIAL") throw new Error("DOL discipline window is partial");
  if (events.dol_discipline.some((e) => !["EL", "PL", "GF", "SM"].includes(e.boardCode))) throw new Error("Only construction-trade boards");
  if (value.dcamm_debarment.rows !== 7 || value.ag_fair_labor_debarment.rows !== 464) throw new Error("Debarment rows drifted");
  if (events.dcamm_debarment.length !== value.dcamm_debarment.rows || events.ag_fair_labor_debarment.length !== value.ag_fair_labor_debarment.rows) {
    throw new Error("Debarment event rows must match the counts");
  }
  for (const family of [d, value.dcamm_debarment, value.ag_fair_labor_debarment]) {
    if (family.profileAttachments !== 0) throw new Error("No profile attachments without an exact identifier bridge");
  }
  const all = [...events.dol_discipline, ...events.dcamm_debarment, ...events.ag_fair_labor_debarment];
  if (all.some((e) => e.attribution !== "standalone_event_no_profile_join")) throw new Error("Events stay standalone");
  if (value.net_new.NEW_PROFILES !== 0 || value.net_new.PROFILE_ATTACHMENTS !== 0) throw new Error("No new profiles or attachments");
  if (value.capability_matrix.find((c) => c.capability.startsWith("Combined"))?.state !== "UNSUPPORTED") {
    throw new Error("Combined Massachusetts contractor count is unsupported");
  }
  return value;
}

/** Exact DOL license-number match inside the acquired discipline rows. Never a name match. */
export function findMaDolEvents(license: string, boards?: readonly string[]): MaDolEvent[] {
  const wanted = license.trim().toUpperCase().replace(/^0+(?=\d)/, "");
  if (!/^[A-Z0-9-]{1,12}$/.test(wanted)) return [];
  return events.dol_discipline.filter(
    (e) =>
      e.licenseNumber !== null &&
      e.licenseNumber.toUpperCase().replace(/^0+(?=\d)/, "") === wanted &&
      (!boards || boards.includes(e.boardCode)),
  );
}
