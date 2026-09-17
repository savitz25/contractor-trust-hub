import accepted from "./accepted-snapshot.json";
import { PA_STATE_INTEL_VERSION, PA_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const PENNSYLVANIA_SNAPSHOT = accepted;
export type PennsylvaniaContractorSnapshot = typeof accepted;

export function assertPennsylvaniaSnapshot(
  value: PennsylvaniaContractorSnapshot = PENNSYLVANIA_SNAPSHOT,
): PennsylvaniaContractorSnapshot {
  if (value.version !== PA_STATE_INTEL_VERSION) throw new Error(`Unexpected PA contract ${value.version}`);
  if (value.fingerprint !== PA_STATE_PUBLIC_FINGERPRINT) {
    throw new Error("PA-CON-001 snapshot fingerprint mismatch");
  }
  if (value.publicationPath !== "/pennsylvania") throw new Error("Pennsylvania path must be /pennsylvania");
  if (value.hicpa.PA_HICPA_ROSTER_STATUS !== "OPEN_SEARCH_ONLY") {
    throw new Error("HICPA bulk must remain OPEN_SEARCH_ONLY");
  }
  if (value.hicpa.PA_HICPA_ROWS !== null) throw new Error("HICPA rows must be null, not zero");
  if (value.hicpa.PA_HICPA_DISTINCT_REGISTRATION_IDS !== null) {
    throw new Error("HICPA distinct IDs must be null, not zero");
  }
  if (value.hero.universe_value !== null) throw new Error("do not headline a manufactured PA contractor census");
  if (value.asbestos.PA_ASBESTOS_CONTRACTOR_ROWS !== 299) throw new Error("asbestos rows drifted");
  if (value.asbestos.PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS !== 283) throw new Error("asbestos IDs drifted");
  if (Number(value.asbestos.PA_ASBESTOS_CONTRACTOR_ROWS) === Number(value.asbestos.PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS)) {
    throw new Error("asbestos rows must not equal distinct IDs in this freeze");
  }
  if (value.lead.PA_LEAD_CONTRACTOR_ROWS !== 155) throw new Error("lead rows drifted");
  if (value.lead.PA_LEAD_CONTRACTOR_DISTINCT_IDS !== 148) throw new Error("lead IDs drifted");
  if (Number(value.asbestos.PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS) === Number(value.lead.PA_LEAD_CONTRACTOR_DISTINCT_IDS)) {
    throw new Error("asbestos firms must stay separate from lead firms");
  }
  if (value.asbestos.PA_ASBESTOS_INDIVIDUAL_ROWS !== 4985) throw new Error("asbestos individuals drifted");
  if (value.lead.PA_LEAD_INDIVIDUAL_ROWS !== 943) throw new Error("lead individuals drifted");
  if (!value.asbestos.firm_ne_person || !value.lead.firm_ne_person) {
    throw new Error("firm certification is not person certification");
  }
  if (value.debarment.PA_PREVAILING_WAGE_DEBARMENT_ROWS !== 6) throw new Error("debarment rows drifted");
  if (value.debarment.PA_PREVAILING_WAGE_FIRM_ROWS !== 8) throw new Error("debarment firms drifted");
  if (value.debarment.PA_PREVAILING_WAGE_PERSON_ROWS !== 8) throw new Error("debarment persons drifted");
  if (value.debarment.settlements.CURRENT_SOURCE_OBSERVATION !== "NONE") {
    throw new Error("settlements current observation drifted");
  }
  if (value.debarment.settlements.PA_CURRENT_SETTLEMENT_ROWS !== 0) {
    throw new Error("current settlements observation is NONE");
  }
  if (value.identity.EXACT_SOURCE_NATIVE_CROSSWALKS !== 0) throw new Error("no invented HICPA bridges");
  if (value.identity.NAME_ONLY_UNSAFE !== 0) throw new Error("name-only joins must remain unattempted");
  if (value.adverse_publication.EXACT_PROFILE_ATTACHMENTS !== 0) throw new Error("no profile attachments");
  if (value.adverse_publication.UNRESOLVED !== null) throw new Error("unresolved stays null, not zero");
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("no graph writes");
  if (value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED !== false) {
    throw new Error("claim eligibility unchanged");
  }
  if (!value.no_local_pennsylvania_routes) throw new Error("no local Pennsylvania routes");
  if (!value.no_ranking || !value.no_trust_score) throw new Error("no ranking or Trust Score");
  if (value.municipal.PA_LOCAL_CONTRACTOR_LICENSING !== "MUNICIPAL / NOT_CENTRALIZED") {
    throw new Error("municipal gap drifted");
  }
  if (value.permits_ucc.coverage !== "LOCAL_OR_FRAGMENTED") throw new Error("UCC coverage drifted");
  if (value.gate.live_cohort_not_inflated !== true) throw new Error("do not inflate live credentials");
  if (value.clocks.hicpa_sourceAsOf !== null) throw new Error("do not fake HICPA sourceAsOf");
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
