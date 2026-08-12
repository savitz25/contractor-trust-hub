/**
 * Re-export Trust Report sections for any legacy imports.
 * Prefer importing from TrustReport.tsx in new code.
 */
export {
  DisciplineSection,
  EntitySection,
  LicensesSection,
} from "./TrustReport";

// VerificationSummary replaced by EvidenceSummary + HiringGuidance on profile pages.
export { EvidenceSummary as VerificationSummary } from "./TrustReport";
