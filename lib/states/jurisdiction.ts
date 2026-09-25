import { EVIDENCE_STATES, licenseSourcesFor, type EvidenceState } from "./config";
import { evidenceSlugFromHomeState, type EvidenceStateSlug } from "./evidence-copy";

/**
 * Issuing jurisdiction is the credential source (az_roc, fl_dbpr, …).
 * Business location stays on contractor.home_state and is not a substitute
 * for the board that issued the license.
 */
const sourceToState = new Map<string, EvidenceState>();
for (const state of Object.values(EVIDENCE_STATES)) {
  for (const source of licenseSourcesFor(state)) {
    sourceToState.set(source.toLowerCase(), state);
  }
}

export function stateForLicenseSource(sourceSystem: string | null | undefined): EvidenceState | null {
  if (!sourceSystem) return null;
  return sourceToState.get(sourceSystem.toLowerCase()) ?? null;
}

/** First known credential source wins. Callers pass licenses in display order. */
export function issuingStateForLicenses(
  licenses: ReadonlyArray<{ sourceSystem?: string | null }>,
): EvidenceState | null {
  for (const license of licenses) {
    const state = stateForLicenseSource(license.sourceSystem);
    if (state) return state;
  }
  return null;
}

const EVIDENCE_COPY_SLUGS = new Set<string>(["fl", "tx", "nj", "or", "wa", "ca", "az", "la", "ms", "ky", "wi"]);

export function isEvidenceCopySlug(slug: string): slug is EvidenceStateSlug {
  return EVIDENCE_COPY_SLUGS.has(slug);
}

/** Registry slug when a credential source is known, otherwise the business-home fallback. */
export function reportEvidenceSlug(
  licenses: ReadonlyArray<{ sourceSystem?: string | null }>,
  homeState?: string | null,
): string {
  const issuing = issuingStateForLicenses(licenses);
  if (issuing) return issuing.slug;
  return evidenceSlugFromHomeState(homeState);
}
