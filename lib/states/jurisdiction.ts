import { EVIDENCE_STATES, licenseSourcesFor, type EvidenceState } from "./config";
import { boardShortLabel, sourceExtractLabel, type EvidenceStateSlug } from "./evidence-copy";

/**
 * Issuing jurisdiction is the credential source (az_roc, fl_dbpr, …).
 * Business location stays on contractor.home_state and is not a substitute
 * for the board that issued the license.
 *
 * An unrecognized source does not become Florida.
 */
const sourceToState = new Map<string, EvidenceState>();
for (const state of Object.values(EVIDENCE_STATES)) {
  for (const source of licenseSourcesFor(state)) {
    sourceToState.set(source.toLowerCase(), state);
  }
}

export const UNKNOWN_REPORT_TITLE = "Contractor Trust Report";
export const UNKNOWN_REPORT_KICKER = "Contractor Trust Report 2.0";
export const UNKNOWN_CREDENTIAL_LABEL = "Credential";

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

export type ReportJurisdiction = {
  /** Null when no license source is a registered issuing board. */
  state: EvidenceState | null;
  slug: string | null;
  /** Document title, without the contractor name. */
  title: string;
  /** Visible header kicker. Same jurisdiction as `title`. */
  kicker: string;
  /** Short credential label. Neutral when the source is unmapped. */
  credentialLabel: string;
  /** Source sentence. Neutral when the source is unmapped. */
  sourceLabel: string;
};

/**
 * Registry slug for a recognized credential source.
 * Unknown and unmapped sources return null. Business home_state is not an issuing authority.
 */
export function reportEvidenceSlug(
  licenses: ReadonlyArray<{ sourceSystem?: string | null }>,
  _homeState?: string | null,
): string | null {
  return issuingStateForLicenses(licenses)?.slug ?? null;
}

/** Title, kicker, and credential label for the public Trust Report. */
export function reportJurisdiction(
  licenses: ReadonlyArray<{ sourceSystem?: string | null }>,
): ReportJurisdiction {
  const state = issuingStateForLicenses(licenses);
  if (!state) {
    return {
      state: null,
      slug: null,
      title: UNKNOWN_REPORT_TITLE,
      kicker: UNKNOWN_REPORT_KICKER,
      credentialLabel: UNKNOWN_CREDENTIAL_LABEL,
      sourceLabel: "published credential record",
    };
  }
  const copyLabel = isEvidenceCopySlug(state.slug) ? boardShortLabel(state.slug) : state.boardShortLabel;
  const sourceLabel = isEvidenceCopySlug(state.slug) ? sourceExtractLabel(state.slug) : state.boardLabel;
  return {
    state,
    slug: state.slug,
    title: `${state.name} Contractor Trust Report`,
    kicker: `${state.name} · Contractor Trust Report 2.0`,
    credentialLabel: copyLabel,
    sourceLabel,
  };
}

/** Board cell for one license row. Unmapped sources stay generic. */
export function licenseSourcePresentation(sourceSystem: string | null | undefined): {
  board: string;
  extract: string;
} {
  const state = stateForLicenseSource(sourceSystem);
  if (!state) return { board: UNKNOWN_CREDENTIAL_LABEL, extract: UNKNOWN_CREDENTIAL_LABEL };
  if (isEvidenceCopySlug(state.slug)) {
    return { board: boardShortLabel(state.slug), extract: sourceExtractLabel(state.slug) };
  }
  return { board: state.boardShortLabel, extract: state.boardLabel };
}
