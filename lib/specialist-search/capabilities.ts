import type { SpecialistSearchCapability } from "./contract";

export const CONTRACTOR_SEARCH_CAPABILITIES: SpecialistSearchCapability[] = [
  { key: "credential", label: "License and credential records", supportState: "KNOWN", coverage: "Published state-source cohorts", sourceSystems: ["state licensing agencies"], limitations: ["Coverage and credential meaning vary by jurisdiction."] },
  { key: "discipline", label: "Regulatory enforcement", supportState: "PARTIAL", coverage: "Florida public-eligible DBPR links", sourceSystems: ["Florida DBPR"], limitations: ["Missing records are not proof that none exist; a record is not automatically a final finding."] },
  { key: "permits", label: "Permit evidence", supportState: "PARTIAL", coverage: "Supported local source contracts only", sourceSystems: ["participating local permit sources"], limitations: ["No complete national or statewide permit universe; permits are not endorsements."] },
  { key: "complaints", label: "Consumer complaints", supportState: "NOT_ACQUIRED", coverage: "No comparable network dataset", sourceSystems: [], limitations: ["Do not interpret unavailable complaint data as zero complaints."] },
  { key: "service-territory", label: "Service territory", supportState: "UNKNOWN", coverage: "Recorded regulator geography only", sourceSystems: ["state licensing agencies"], limitations: ["Headquarters or mailing address does not establish where a contractor works."] },
  { key: "new-york-pw-registry", label: "New York public-work contractor registry", supportState: "PARTIAL", coverage: "NYSDOL Contractor Registry Certificate snapshot; current 2026 status remains official NYSDOL/Open Data", sourceSystems: ["NYSDOL", "data.ny.gov"], limitations: ["Public-work registration is not a statewide GC or home-improvement license. Absence is not automatically illegal residential work. Not live company discovery."] },
];
