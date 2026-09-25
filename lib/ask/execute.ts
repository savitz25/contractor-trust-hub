/**
 * Deterministic Ask execution. Parameterized SQL only. No LLM facts.
 */
import { asLicenseStatus } from "@/lib/contractors/format";
import type { LicenseStatus } from "@/lib/contractors/types";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { searchContractors } from "@/lib/contractors/queries";
import { dbUserFacingError, query } from "@/lib/db";
import { getCounty, getDiscoveryState } from "@/lib/discovery/config";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";
import { REGULATORY_PUBLICATION_GATE_ACTIVE } from "@/lib/regulatory/publication";
import { getStateBySlug } from "@/lib/states/config";
import type { ContractorResearchQuery, EvidenceFamilyId } from "./plan";
import { ASK_PAGE_SIZE } from "./plan";
import { CLASS_LABELS, TRADE_ONTOLOGY, TRADE_TO_DISCOVERY_SLUG } from "./ontology";
import { stateName } from "./geography";
import { NAME_CANDIDATES_CONTRACT, NAME_CANDIDATES_OPERATION, NAME_DEFAULT_LIMIT, executeContractorNameCandidates } from "@/lib/specialist-execution/contractor-name-candidates";
import type { NameCandidateDb } from "@/lib/contractors/name-candidates-query";

/** Same first-page size AskTrustHub receives from the name-candidate operation (parity); later pages via ?page=. */
export const NAME_CANDIDATE_PAGE_SIZE = NAME_DEFAULT_LIMIT;

export const NAME_MATCH_DISCLAIMER = "A matching name is not proof that the record is the specific business you mean.";

const SOURCE_LABEL: Record<string, string> = {
  fl_dbpr: "Florida DBPR",
  fl_dfs: "Florida DFS",
  nj_enforcement: "New Jersey consumer affairs / licensing source",
  nj_dca: "New Jersey Division of Consumer Affairs",
  az_roc: "Arizona ROC",
};

const EVIDENCE_META: Record<
  EvidenceFamilyId,
  { label: string; sourceSystem: string; datasets: string[]; joinable: boolean; grain: string }
> = {
  dbpr_discipline: {
    label: "Florida DBPR licensing discipline",
    sourceSystem: "fl_dbpr",
    datasets: ["contractor_disc_lic"],
    joinable: REGULATORY_PUBLICATION_GATE_ACTIVE,
    grain: "Indexed source rows; contractor listing requires public-eligible identity joins",
  },
  unlicensed_activity: {
    label: "Florida DBPR unlicensed activity",
    sourceSystem: "fl_dbpr",
    datasets: ["contractor_disc_ula"],
    joinable: REGULATORY_PUBLICATION_GATE_ACTIVE,
    grain: "Indexed source rows; contractor listing requires public-eligible identity joins",
  },
  recovery_fund: {
    label: "Florida Construction Recovery Fund",
    sourceSystem: "fl_dbpr",
    datasets: ["contractor_disc_rf"],
    joinable: REGULATORY_PUBLICATION_GATE_ACTIVE,
    grain: "Indexed source rows; contractor listing requires public-eligible identity joins",
  },
  stop_work: {
    label: "Florida DFS workers' compensation stop-work",
    sourceSystem: "fl_dfs",
    datasets: ["fl_dfs_workers_comp_stop_work"],
    joinable: false,
    grain: "Indexed source rows. Contractor-level publication is not enabled for DFS stop-work.",
  },
};

export type AskEvidenceRow = {
  id: string;
  family: string;
  sourceLabel: string;
  sourceDataset: string;
  caseId: string | null;
  actionDate: string | null;
  disposition: string | null;
  classification: string | null;
};

export type AskEntityCard = {
  contractorId: string;
  slug: string;
  displayName: string;
  credentialKey: string | null;
  occupationCode: string | null;
  occupationLabel: string | null;
  statusNormalized: LicenseStatus | null;
  statusLabel: string;
  city: string | null;
  county: string | null;
  state: string | null;
  /** Optional. Name-candidate results do not include a ZIP; the public query excludes it. */
  postalCode?: string | null;
  sourceLabel: string;
  sourceSystem: string | null;
  geographyNote: string;
  evidenceCount: number;
  newestEvidenceDate: string | null;
  whyMatched: string;
  evidence: AskEvidenceRow[];
  profileHref: string | null;
  /** Company-name candidates only: issuing jurisdiction + source board of the representative credential row. */
  credentialJurisdictionLabel?: string | null;
  /** Issuing jurisdiction code, e.g. FL or TX. Display only. */
  credentialJurisdictionCode?: string | null;
  /** Company-name candidates only: the source field/value that satisfied the name predicate and how. */
  matchedOn?: { field: string; value: string; method: string } | null;
};

/** Company-name search state, carried alongside the cards. Same operation AskTrustHub consumes. */
export type AskNameSearch = {
  resultState: string;
  supplied: string;
  normalized: string;
  requiredWords: string[];
  optionalWordsDropped: string[];
  jurisdiction: string | null;
  scopeMeaning: string;
  searchedJurisdictions: string[];
  returned: number;
  hasMore: boolean;
  nextPage: number | null;
  truncated: boolean;
  completeness: string | null;
  limitations: string[];
  continuation: Array<{ label: string; href: string }>;
  failure: { kind: string; message: string } | null;
  timingMs: number;
};

export type AskExecution = {
  ok: boolean;
  blocked: boolean;
  blockMessage: string | null;
  contractorCount: number | null;
  credentialCount: number | null;
  evidenceSourceRows: number | null;
  grainLabel: string;
  asOf: string;
  snapshotFingerprint: string;
  results: AskEntityCard[];
  page: number;
  pageSize: number;
  sqlContract: string;
  evidenceJoinable: boolean | null;
  compare: {
    left: { label: string; href: string; contractors: number; credentials: number };
    right: { label: string; href: string; contractors: number; credentials: number };
    limitation: string;
  } | null;
  nameSearch?: AskNameSearch | null;
};

function emptyExecution(partial: Partial<AskExecution> = {}): AskExecution {
  const intel = loadContractorHubIntel();
  return {
    ok: false,
    blocked: false,
    blockMessage: null,
    contractorCount: null,
    credentialCount: null,
    evidenceSourceRows: null,
    grainLabel: "none",
    asOf: intel.generatedAt.slice(0, 10),
    snapshotFingerprint: intel.sourceFingerprint,
    results: [],
    page: 1,
    pageSize: ASK_PAGE_SIZE,
    sqlContract: "contractors ⋈ licenses; optional discipline_actions via PUBLIC_REGULATORY_SQL",
    evidenceJoinable: null,
    compare: null,
    ...partial,
  };
}

function classLabel(code: string | null): string | null {
  if (!code) return null;
  return CLASS_LABELS[code] || getOccupationInfo(code).label || code;
}

export function askWhere(plan: ContractorResearchQuery, countySlug?: string | null): { where: string; params: unknown[] } | null {
  const state = getStateBySlug("fl");
  const disc = getDiscoveryState("florida");
  if (!state?.live || !disc) return null;
  const slug = countySlug === undefined ? plan.geography.countySlug : countySlug;
  const county = slug && slug !== "fl" ? getCounty(disc, slug) : null;
  const params: unknown[] = [state.licenseSource, state.code];
  let where = `l.source_system = $1 AND c.is_thin_profile = FALSE AND (c.home_state = $2 OR l.state = $2)`;
  if (plan.trade.occupationCodes.length) {
    params.push(plan.trade.occupationCodes.map((c) => c.toUpperCase()));
    where += ` AND l.occupation_code = ANY($${params.length}::text[])`;
  }
  if (plan.credentialStatus === "active_current") {
    where += ` AND l.status_normalized IN ('active', 'current')`;
  } else if (plan.credentialStatus === "expired") {
    where += ` AND l.status_normalized = 'expired'`;
  }
  if (plan.geography.city) {
    params.push(plan.geography.city.toLowerCase());
    where += ` AND LOWER(TRIM(l.city)) = $${params.length} AND l.state = 'FL'`;
  }
  if (county) {
    if (county.matchCodes?.[0]) {
      params.push(county.matchCodes[0]);
      where += ` AND l.county_code = $${params.length}`;
    } else {
      params.push(county.matchNames[0] || county.name);
      where += ` AND l.county_name ILIKE $${params.length}`;
    }
  }
  return { where, params };
}

type ContractorRow = {
  id: string;
  slug: string;
  display_name: string;
  primary_city: string | null;
  primary_county: string | null;
  home_state: string | null;
  external_key: string | null;
  occupation_code: string | null;
  status_normalized: string | null;
  source_system: string | null;
};

/**
 * TH-DISCOVERY-FINAL-REPAIR-A: the list path used to run two sequential DB
 * round trips (a rows query, then a separate COUNT query) against the same
 * filtered join. Under the production connection pool (max 1 client per
 * serverless isolate — see lib/db.ts), a second concurrent request on a warm
 * isolate has to queue behind that first request's *two* round trips, and
 * their combined statement-timeout budgets (15s + 10s) could exceed the
 * platform's real function duration, producing an intermittent truncated
 * render instead of a clean result. Computing the filtered join once in a
 * materialized CTE and reading both the paginated page and the totals out of
 * it in a single round trip removes the duplicate scan and the second
 * connection acquisition/release, not just the appearance of one.
 */
/**
 * Exported only so a regression test can assert on the SQL text directly:
 * the LATERAL subquery's own ORDER BY makes its OWN output deterministic,
 * but SQL gives no guarantee that a join preserves a subquery's row order
 * into the outer result set -- the outer SELECT needs its own top-level
 * ORDER BY (repeating the same tie-broken sort) or pagination can still
 * reshuffle equal-name rows across requests.
 */
export function buildCohortRowsSql(limitIdx: number, offsetIdx: number, where: string): string {
  return `
    WITH matched AS MATERIALIZED (
      SELECT
        c.id, c.slug, c.display_name, l.city AS primary_city, l.county_name AS primary_county, l.state AS home_state,
        l.external_key, l.occupation_code, l.status_normalized, l.source_system,
        ROW_NUMBER() OVER (
          PARTITION BY c.id
          ORDER BY CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END
        ) AS rn
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE ${where}
    ),
    totals AS (
      SELECT COUNT(*) FILTER (WHERE rn = 1)::text AS contractors, COUNT(*)::text AS credentials
      FROM matched
    )
    SELECT sub.id, sub.slug, sub.display_name, sub.primary_city, sub.primary_county, sub.home_state,
           sub.external_key, sub.occupation_code, sub.status_normalized, sub.source_system,
           totals.contractors, totals.credentials
    FROM totals
    LEFT JOIN LATERAL (
      SELECT * FROM matched WHERE rn = 1
      ORDER BY LOWER(display_name), id
      LIMIT $${limitIdx}::int OFFSET $${offsetIdx}::int
    ) sub ON true
    ORDER BY LOWER(sub.display_name), sub.id
    `;
}

async function fetchRowsWithTotals(
  where: string,
  params: unknown[],
  limit: number,
  offset: number
): Promise<{ rows: ContractorRow[]; contractors: number; credentials: number }> {
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const rows = await query<ContractorRow & { contractors: string; credentials: string }>(
    buildCohortRowsSql(limitIdx, offsetIdx, where),
    [...params, limit, offset],
    { statementTimeoutMs: 15_000 }
  );
  const contractors = Number(rows[0]?.contractors ?? "0");
  const credentials = Number(rows[0]?.credentials ?? "0");
  if (![contractors, credentials].every((n) => Number.isSafeInteger(n) && n >= 0)) {
    throw new Error("invalid_source_count");
  }
  return { rows: rows.filter((r) => r.id != null), contractors, credentials };
}

async function askCounts(where: string, params: unknown[]): Promise<{ contractors: number; credentials: number }> {
  const { contractors, credentials } = await fetchRowsWithTotals(where, params, 0, 0);
  return { contractors, credentials };
}

function whyMatched(plan: ContractorResearchQuery, card: { evidenceCount: number }): string {
  const bits = ["This contractor appears because an indexed Florida DBPR credential record matched the structured filters."];
  if (plan.credentialStatus === "active_current") bits.push("Credential status is active/current in the extract.");
  if (plan.trade.label) bits.push(`Trade family is ${plan.trade.label} (${plan.trade.occupationCodes.join(", ")}).`);
  if (plan.geography.city) bits.push(`Recorded credential city is ${plan.geography.city}, Florida; not service territory.`);
  if (plan.geography.countyLabel) {
    bits.push(
      `Recorded geography is ${plan.geography.countyLabel} from the indexed mailing/business address county — not a service area.`
    );
  }
  if (plan.evidenceFamily && card.evidenceCount > 0) {
    bits.push(
      `ContractorTrustHub also linked ${card.evidenceCount} indexed ${EVIDENCE_META[plan.evidenceFamily].label} record(s) to this credential/entity.`
    );
  }
  return bits.join(" ");
}

async function executeUncached(plan: ContractorResearchQuery): Promise<AskExecution> {
  const intel = loadContractorHubIntel();
  const asOf = intel.generatedAt.slice(0, 10);

  if (plan.mode === "fail_closed" || plan.mode === "definition") {
    return emptyExecution({ asOf, snapshotFingerprint: intel.sourceFingerprint });
  }

  if (plan.mode === "aggregate") {
    return emptyExecution({
      ok: true,
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
      grainLabel: "Mapped occupation-code family active/current credential rows in the live public cohort (snapshot)",
    });
  }

  if (plan.evidenceFamily && !EVIDENCE_META[plan.evidenceFamily].joinable) {
    const fam = intel.regulatoryEvidence.byEvidenceFamily.find((f) => {
      if (plan.evidenceFamily === "stop_work") return f.key === "fl_dfs_stop_work";
      if (plan.evidenceFamily === "unlicensed_activity") return f.key === "fl_dbpr_unlicensed";
      if (plan.evidenceFamily === "dbpr_discipline") return f.key === "fl_dbpr_discipline";
      if (plan.evidenceFamily === "recovery_fund") return f.key === "fl_recovery_fund";
      return false;
    });
    return emptyExecution({
      ok: true,
      blocked: true,
      blockMessage: `${EVIDENCE_META[plan.evidenceFamily].label} is indexed as source rows, but public contractor-level attribution is not enabled for this family. Indexed family total: ${fam ? fam.rows.toLocaleString("en-US") : "n/a"} source rows. This is not a list of contractors, not a guilt score, and not a complaint dataset.`,
      evidenceSourceRows: fam?.rows ?? null,
      evidenceJoinable: false,
      grainLabel: EVIDENCE_META[plan.evidenceFamily].grain,
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
    });
  }

  if (plan.trade.familyId === "electrical" && plan.geography.state === "FL") {
    // TH-DISCOVERY-RESET-001B: RESULTS FIRST -- electrical-specific coverage is genuinely
    // unavailable in this extract, but that is not a reason to show zero providers. The requested
    // geography (county, if given) still has real, indexed Florida contractors of other trades one
    // query away -- show them immediately as an explicitly labeled broader alternative instead of
    // stonewalling. Never relabeled as electricians: the trade filter is dropped, not substituted.
    const broaderPlan: ContractorResearchQuery = { ...plan, trade: { familyId: null, label: null, occupationCodes: [], classLabels: [], discoverySlug: null } };
    let built = askWhere(broaderPlan);
    let broaderGeographyLabel = plan.geography.countyLabel ? `${plan.geography.countyLabel} County` : "Florida";
    if (built) {
      let fetched = await fetchRowsWithTotals(built.where, built.params, plan.limit, 0);
      if (fetched.rows.length === 0 && plan.geography.countySlug) {
        // County-level broader inventory is itself empty -- auto-broaden once more to statewide
        // Florida rather than showing nothing; still explicitly labeled, never silent.
        built = askWhere(broaderPlan, null);
        broaderGeographyLabel = "Florida";
        fetched = built ? await fetchRowsWithTotals(built.where, built.params, plan.limit, 0) : { rows: [], contractors: 0, credentials: 0 };
      }
      if (fetched.rows.length > 0) {
        const totals = { contractors: fetched.contractors, credentials: fetched.credentials };
        const results: AskEntityCard[] = fetched.rows.map((r) => {
          const card: AskEntityCard = {
            contractorId: r.id, slug: r.slug, displayName: r.display_name, credentialKey: r.external_key,
            occupationCode: r.occupation_code, occupationLabel: classLabel(r.occupation_code),
            statusNormalized: asLicenseStatus(r.status_normalized),
            statusLabel: r.status_normalized === "active" || r.status_normalized === "current" ? "Active/current in indexed DBPR record" : r.status_normalized ? `${r.status_normalized} in indexed DBPR record` : "Status as published",
            city: r.primary_city, county: r.primary_county, state: r.home_state,
            sourceLabel: SOURCE_LABEL[r.source_system || "fl_dbpr"] || r.source_system || "Florida DBPR",
            sourceSystem: r.source_system || "fl_dbpr",
            geographyNote: `${broaderGeographyLabel} recorded address in the indexed licensing record — not service territory.`,
            evidenceCount: 0, newestEvidenceDate: null,
            whyMatched: `Broader ${broaderGeographyLabel} contractor result, not a confirmed electrician -- Florida CILB in this extract does not publish an electrical occupation page. ${whyMatched(broaderPlan, { evidenceCount: 0 })}`,
            evidence: [], profileHref: r.slug ? `/contractors/${r.slug}` : null,
          };
          return card;
        });
        return emptyExecution({
          ok: true,
          blocked: false,
          blockMessage: `ELECTRICAL-SPECIFIC RESULTS: Florida CILB in this extract does not publish an electrical occupation page. Electrical credential research is available in specialty-state Verify, not as a Florida Intelligence trade list. BROADER ${broaderGeographyLabel.toUpperCase()} CONTRACTOR OPTIONS below are not confirmed electricians.`,
          contractorCount: totals.contractors,
          credentialCount: totals.credentials,
          results,
          grainLabel: `Broader Florida DBPR contractor profiles in ${broaderGeographyLabel} across all recorded trades; not filtered to electrical, and not confirmed electricians.`,
          asOf,
          snapshotFingerprint: intel.sourceFingerprint,
        });
      }
    }
    return emptyExecution({
      blocked: true,
      blockMessage:
        "Florida CILB in this extract does not publish an electrical occupation page. Electrical credential research is available in specialty-state Verify, not as a Florida Intelligence trade list.",
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
    });
  }

  try {
    if (plan.mode === "comparison") {
      const leftW = askWhere(plan, "broward");
      const rightW = askWhere(plan, "palm-beach");
      if (!leftW || !rightW) {
        return emptyExecution({ blocked: true, blockMessage: "Comparison counties are not configured." });
      }
      const [left, right] = await Promise.all([askCounts(leftW.where, leftW.params), askCounts(rightW.where, rightW.params)]);
      return emptyExecution({
        ok: true,
        asOf,
        snapshotFingerprint: intel.sourceFingerprint,
        grainLabel:
          "Florida DBPR contractor profiles and matching credential rows whose indexed mailing/business address county matches. Not service-area market size and not permit volume.",
        compare: {
          left: {
            label: "Broward County (indexed address county)",
            href: "/florida/broward",
            contractors: left.contractors,
            credentials: left.credentials,
          },
          right: {
            label: "Palm Beach County (indexed address county)",
            href: "/florida/palm-beach",
            contractors: right.contractors,
            credentials: right.credentials,
          },
          limitation:
            "Counts use the same Florida DBPR extract and the same address-county method. Contractor profiles and credential rows are different grains. Permit volume is not compared.",
        },
      });
    }

    const built = askWhere(plan);
    if (!built) {
      return emptyExecution({ blocked: true, blockMessage: "Florida discovery configuration is not available." });
    }
    if (plan.mode === "count" && !plan.geography.countySlug && !plan.geography.city && !plan.geographyRequirement && plan.trade.familyId) {
      const snap = intel.tradeFamilies.families.find((f) => {
        if (plan.trade.familyId === "roofing") return f.id === "roofing";
        if (plan.trade.familyId === "hvac") return f.id === "hvac";
        if (plan.trade.familyId === "plumbing") return f.id === "plumbing";
        if (plan.trade.familyId === "electrical") return f.id === "electrical";
        if (plan.trade.familyId === "pool_spa") return f.id === "pool-spa";
        if (plan.trade.familyId === "general" || plan.trade.familyId === "building") return f.id === "general-building";
        if (plan.trade.familyId === "residential") return f.id === "residential";
        return false;
      });
      if (snap) {
        return emptyExecution({
          ok: true,
          contractorCount: null,
          credentialCount: snap.activeCurrentRows,
          grainLabel:
            "Active/current credential rows in the mapped occupation-code family in the live public cohort (snapshot). Not a Florida-only census and not a contractor-entity count.",
          asOf,
          snapshotFingerprint: intel.sourceFingerprint,
          sqlContract: "contractor-hub-intel-v2 tradeFamilies snapshot",
        });
      }
    }

    if (plan.mode === "count") {
      const totals = await fetchRowsWithTotals(built.where, built.params, 0, 0);
      return emptyExecution({
        ok: true,
        contractorCount: totals.contractors,
        credentialCount: totals.credentials,
        grainLabel:
          "Canonical contractor profiles vs matching credential rows in Florida DBPR. These are not the same grain.",
        asOf,
        snapshotFingerprint: intel.sourceFingerprint,
        evidenceJoinable: plan.evidenceFamily ? EVIDENCE_META[plan.evidenceFamily].joinable : null,
        sqlContract: "parameterized contractors ⋈ licenses (Ask lean path)",
      });
    }

    let fetched: { rows: ContractorRow[]; contractors: number; credentials: number };
    try {
      fetched = await fetchRowsWithTotals(built.where, built.params, plan.limit, plan.offset);
    } catch {
      return emptyExecution({blocked:true,blockMessage:"The scoped total could not be checked. Retry this same research request; no page-size total was inferred.",asOf,snapshotFingerprint:intel.sourceFingerprint});
    }

    const results: AskEntityCard[] = fetched.rows.map((r) => {
      const card: AskEntityCard = {
        contractorId: r.id,
        slug: r.slug,
        displayName: r.display_name,
        credentialKey: r.external_key,
        occupationCode: r.occupation_code,
        occupationLabel: classLabel(r.occupation_code),
        statusNormalized: asLicenseStatus(r.status_normalized),
        statusLabel:
          r.status_normalized === "active" || r.status_normalized === "current"
            ? "Active/current in indexed DBPR record"
            : r.status_normalized
              ? `${r.status_normalized} in indexed DBPR record`
              : "Status as published",
        city: r.primary_city,
        county: r.primary_county,
        state: r.home_state,
        sourceLabel: SOURCE_LABEL[r.source_system || "fl_dbpr"] || r.source_system || "Florida DBPR",
        sourceSystem: r.source_system || "fl_dbpr",
        geographyNote: plan.geography.countyLabel
          ? `${plan.geography.countyLabel} recorded address in the indexed licensing record — not service territory.`
          : "Recorded address on the indexed licensing record is not service territory.",
        evidenceCount: 0,
        newestEvidenceDate: null,
        whyMatched: "",
        evidence: [],
        profileHref: r.slug ? `/contractors/${r.slug}` : null,
      };
      card.whyMatched = whyMatched(plan, card);
      return card;
    });

    return emptyExecution({
      ok: true,
      contractorCount: fetched.contractors,
      credentialCount: fetched.credentials,
      grainLabel:
        "Matching canonical contractor profiles (contractors.id) vs matching credential rows. These are not the same grain.",
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
      results,
      page: plan.page,
      evidenceJoinable: plan.evidenceFamily ? EVIDENCE_META[plan.evidenceFamily].joinable : null,
      sqlContract: "parameterized contractors ⋈ licenses (Ask lean path)",
    });
  } catch (err) {
    const detail = dbUserFacingError(err);
    console.error("[ask] source query unavailable");
    return emptyExecution({
      blocked: true,
      blockMessage: "The source query could not be completed. Retry this same research request; no broader scope or zero-result count was inferred.",
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
    });
  }
}

/**
 * TH-DISCOVERY-FINAL-REPAIR-A: a genuinely unsupported state (recovery.ts's
 * generic COHORT_UNAVAILABLE branch, e.g. Colorado) used to end at a bare
 * "BROADER TRUSTHUB CONTRACTOR DIRECTORY" text link with zero providers on the
 * first screen -- a Results-First violation. Real, indexed Florida
 * contractors for the requested trade family (or "general" if none was
 * named) are one query away; show a bounded set of them immediately,
 * clearly labeled as NOT specific to the requested state.
 */
async function cohortUnavailableBroaderResults(
  plan: ContractorResearchQuery,
  intel: ReturnType<typeof loadContractorHubIntel>
): Promise<{ results: AskEntityCard[]; contractorCount: number | null; credentialCount: number | null }> {
  const requestedTradeId = plan.recovery?.requestedTrade;
  const tradeMeta =
    TRADE_ONTOLOGY.find((t) => t.id === requestedTradeId) ?? TRADE_ONTOLOGY.find((t) => t.id === "general")!;
  const stateLabel = plan.recovery?.requestedState ? stateName(plan.recovery.requestedState) : (plan.recovery?.locationLabel ?? "the requested jurisdiction");
  const broaderPlan: ContractorResearchQuery = {
    ...plan,
    trade: {
      familyId: tradeMeta.id,
      label: tradeMeta.label,
      occupationCodes: [...tradeMeta.exactClasses],
      classLabels: tradeMeta.exactClasses.map((c) => CLASS_LABELS[c] || c),
      discoverySlug: TRADE_TO_DISCOVERY_SLUG[tradeMeta.id],
    },
    geography: { ...plan.geography, state: "FL", city: null, countySlug: null, countyLabel: null },
    credentialStatus: "active_current",
  };
  const built = askWhere(broaderPlan, null);
  if (!built) return { results: [], contractorCount: null, credentialCount: null };
  const fetched = await fetchRowsWithTotals(built.where, built.params, 20, 0);
  const results: AskEntityCard[] = fetched.rows.map((r) => ({
    contractorId: r.id, slug: r.slug, displayName: r.display_name, credentialKey: r.external_key,
    occupationCode: r.occupation_code, occupationLabel: classLabel(r.occupation_code),
    statusNormalized: asLicenseStatus(r.status_normalized),
    statusLabel: r.status_normalized === "active" || r.status_normalized === "current" ? "Active/current in indexed DBPR record" : r.status_normalized ? `${r.status_normalized} in indexed DBPR record` : "Status as published",
    city: r.primary_city, county: r.primary_county, state: r.home_state,
    sourceLabel: SOURCE_LABEL[r.source_system || "fl_dbpr"] || r.source_system || "Florida DBPR",
    sourceSystem: r.source_system || "fl_dbpr",
    geographyNote: "Florida recorded address in the indexed licensing record — not service territory, and NOT " + stateLabel + ".",
    evidenceCount: 0, newestEvidenceDate: null,
    whyMatched: `BROADER TRUSTHUB CONTRACTOR DIRECTORY result -- these are NOT ${stateLabel}-specific. TrustHub has not acquired ${stateLabel} contractor-license directory data; this is a real, indexed Florida ${tradeMeta.label.toLowerCase()} credential holder shown as the broader, currently-covered alternative.`,
    evidence: [], profileHref: r.slug ? `/contractors/${r.slug}` : null,
  }));
  return { results, contractorCount: fetched.contractors, credentialCount: fetched.credentials };
}

const EXEC_MEMO = new Map<string, AskExecution>();

export async function executeContractorResearchQuery(plan: ContractorResearchQuery, deps: { nameDb?: NameCandidateDb } = {}): Promise<AskExecution> {
  if (plan.mode === "guidance") {
    const intel = loadContractorHubIntel();
    if (plan.recovery?.capabilityState === "COHORT_UNAVAILABLE") {
      try {
        const broader = await cohortUnavailableBroaderResults(plan, intel);
        return emptyExecution({
          ok: true,
          results: broader.results,
          contractorCount: broader.contractorCount,
          credentialCount: broader.credentialCount,
          grainLabel: "Broader Florida DBPR contractor profiles shown as a labeled fallback; not filtered to the requested state.",
          asOf: intel.generatedAt.slice(0, 10),
          snapshotFingerprint: intel.sourceFingerprint,
          sqlContract: "parameterized contractors ⋈ licenses (broader-state fallback for an unsupported jurisdiction)",
        });
      } catch {
        return emptyExecution({ ok: true, grainLabel: "Guidance; no provider retrieval or count", sqlContract: "No query: guidance/recovery operation." });
      }
    }
    return emptyExecution({ok:true,grainLabel:"Guidance; no provider retrieval or count",sqlContract:"No query: guidance/recovery operation."});
  }
  const intel = loadContractorHubIntel();
  const key = `${plan.planId}:${plan.page}:${plan.sort.field}:${plan.mode}:${intel.sourceFingerprint}`;
  if(plan.geographyRequirement&&!plan.geographyRequirement.executionGeography)return emptyExecution({blocked:true,blockMessage:plan.geographyRequirement.message,sqlContract:"No query: requested geography not authorized for execution."});
  const hit = EXEC_MEMO.get(key);
  if (hit) return hit;
  // CONTRACTOR-NAME-PARITY-001: an exact credential keeps the Florida Verify lookup; a company name
  // runs the hub's own name-candidate operation (every name-searchable jurisdiction, bounded), the
  // same operation AskTrustHub consumes -- previously it ran a Florida-only Verify name search.
  const out = plan.identity.identifier
    ? await executeIdentityLookup(plan.identity.identifier, plan, intel.generatedAt.slice(0, 10), intel.sourceFingerprint)
    : plan.identity.entityQuery
      ? await executeNameCandidates(plan.identity.entityQuery, plan, intel.generatedAt.slice(0, 10), intel.sourceFingerprint, deps.nameDb)
      : await executeUncached(plan);
  if (EXEC_MEMO.size > 48) EXEC_MEMO.clear();
  if(out.ok&&!out.blocked)EXEC_MEMO.set(key, out);
  return out;
}

async function executeIdentityLookup(
  lookup: string,
  plan: ContractorResearchQuery,
  asOf: string,
  fingerprint: string
): Promise<AskExecution> {
  let found: Awaited<ReturnType<typeof searchContractors>>;
  try {
    found = await searchContractors(lookup, { stateSlug: "fl", limit: ASK_PAGE_SIZE });
  } catch {
    return emptyExecution({
      blocked: true,
      blockMessage: "Contractor identity research is temporarily unavailable. No result was inferred or substituted.",
      asOf,
      snapshotFingerprint: fingerprint,
      sqlContract: "parameterized exact credential / normalized name search",
    });
  }
  const exactIdentifier = Boolean(plan.identity.identifier);
  return emptyExecution({
    ok: true,
    contractorCount: found.results.length,
    credentialCount: found.results.length,
    grainLabel: "contractor profile",
    asOf,
    snapshotFingerprint: fingerprint,
    sqlContract: "parameterized exact credential / normalized name search",
    results: found.results.map((row) => ({
      contractorId: row.id,
      slug: row.slug,
      displayName: row.displayName,
      credentialKey: row.primaryLicenseKey,
      occupationCode: row.occupationCode,
      occupationLabel: classLabel(row.occupationCode),
      statusNormalized: row.licenseStatus,
      statusLabel: row.primaryStatus || row.licenseStatus || "Status not reported",
      city: row.city,
      county: row.county,
      state: row.state,
      sourceLabel: SOURCE_LABEL[row.sourceSystem || ""] || found.state.boardShortLabel,
      sourceSystem: row.sourceSystem || null,
      geographyNote: "Recorded licensing address; not service territory or current availability.",
      evidenceCount: row.hasDiscipline ? 1 : 0,
      newestEvidenceDate: null,
      whyMatched: exactIdentifier
        ? "Matches the submitted credential identifier in the published licensing corpus."
        : "Matches the submitted company name using the bounded normalized identity search.",
      evidence: [],
      profileHref: `/contractors/${row.slug}`,
    })),
  });
}

type NameCandidateView = {
  stableKey: string;
  displayName: string;
  match: { field: string; value: string; method: string; explanation: string };
  credential: { number: string | null; class: string | null; occupationCode: string | null; status: string | null; sourceNativeStatus: string | null };
  credentialJurisdiction: { code: string; label: string; sourceSystem: string | null; sourceLabel: string };
  recordedLocation: { city: string | null; county: string | null; state: string | null; postalCode?: string | null; meaning: string };
  source: { system: string | null };
  action: { href: string };
};

const MATCH_FIELD_LABEL: Record<string, string> = {
  display_name: "public display name",
  legal_name: "recorded legal/licensee name",
  dba_name: "documented DBA name",
  licensee_name_raw: "source licensee name on the credential row",
  dba_name_raw: "source DBA name on the credential row",
};

function nameCandidateCard(c: NameCandidateView): AskEntityCard {
  const slug = c.stableKey.replace(/^contractor:profile:/, "");
  const status = c.credential.sourceNativeStatus ?? c.credential.status;
  const location = c.recordedLocation;
  return {
    contractorId: c.stableKey,
    slug,
    displayName: c.displayName,
    credentialKey: c.credential.number,
    occupationCode: c.credential.occupationCode,
    occupationLabel: c.credential.class,
    statusNormalized: asLicenseStatus(c.credential.status),
    statusLabel: status ? `${status} in indexed ${c.credentialJurisdiction.label} record` : "Status not reported",
    city: location.city,
    county: location.county,
    state: location.state,
    postalCode: location.postalCode ?? null,
    sourceLabel: c.credentialJurisdiction.sourceLabel,
    sourceSystem: c.source.system,
    geographyNote: location.meaning,
    evidenceCount: 0,
    newestEvidenceDate: null,
    whyMatched: `${c.match.explanation} Matched on the ${MATCH_FIELD_LABEL[c.match.field] ?? c.match.field}: “${c.match.value}”. ${NAME_MATCH_DISCLAIMER}`,
    evidence: [],
    profileHref: `/contractors/${slug}`,
    credentialJurisdictionLabel: `${c.credentialJurisdiction.label} · ${c.credentialJurisdiction.sourceLabel}`,
    credentialJurisdictionCode: c.credentialJurisdiction.code,
    matchedOn: { field: c.match.field, value: c.match.value, method: c.match.method },
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * CONTRACTOR-NAME-PARITY-001: company-name research through the hub's own name-candidate
 * operation, in process. Matching semantics, ordering, limits and publishability rules are the
 * operation's; nothing is re-implemented here.
 */
async function executeNameCandidates(name: string, plan: ContractorResearchQuery, asOf: string, fingerprint: string, db?: NameCandidateDb): Promise<AskExecution> {
  const base = { asOf, snapshotFingerprint: fingerprint, grainLabel: "contractor profile (one card per public profile with a representative credential row)", sqlContract: "contractor-name-candidates-v1 (shared name core; every name-searchable jurisdiction)" };
  const jurisdiction = plan.identity.nameJurisdiction ?? null;
  const body = { contract: NAME_CANDIDATES_CONTRACT, operation: NAME_CANDIDATES_OPERATION, name, page: plan.page, limit: NAME_CANDIDATE_PAGE_SIZE, ...(jurisdiction ? { jurisdiction } : {}) };
  let response: Awaited<ReturnType<typeof executeContractorNameCandidates>>;
  try {
    response = await executeContractorNameCandidates(body, db);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return emptyExecution({
      ...base, blocked: true,
      blockMessage: code === "invalid_page"
        ? "That page is past the bounded company-name search. Go back to the first page, or add more of the name or a state to narrow."
        : code === "invalid_jurisdiction"
          ? "That state is not a jurisdiction ContractorTrustHub can constrain a company-name search to. Nothing was searched or substituted."
          : "Company-name research could not run for that input. No result was inferred or substituted.",
    });
  }
  const r = response as Record<string, unknown>;
  const nameEcho = record(r.name);
  const scope = record(r.scope);
  const pagination = record(r.pagination);
  const continuation = record(r.continuation);
  const completeness = record(r.completeness);
  const searched = (Array.isArray(scope.searched) ? scope.searched : []).map((s) => String(record(s).code));
  const scoped = (Array.isArray(continuation.scoped) ? continuation.scoped : []).map((link) => ({ label: String(record(link).label), href: String(record(link).href) }));
  const nameSearch: AskNameSearch = {
    resultState: String(r.resultState),
    supplied: String(nameEcho.supplied ?? name),
    normalized: String(nameEcho.normalized ?? ""),
    requiredWords: Array.isArray(nameEcho.requiredWords) ? nameEcho.requiredWords.map(String) : [],
    optionalWordsDropped: Array.isArray(nameEcho.optionalWordsDropped) ? nameEcho.optionalWordsDropped.map(String) : [],
    jurisdiction,
    scopeMeaning: String(scope.meaning ?? ""),
    searchedJurisdictions: searched,
    returned: Number(pagination.returned ?? 0),
    hasMore: pagination.hasMore === true,
    nextPage: typeof pagination.nextPage === "number" ? pagination.nextPage : null,
    truncated: pagination.truncated === true,
    completeness: typeof completeness.meaning === "string" ? completeness.meaning : null,
    limitations: Array.isArray(r.limitations) ? r.limitations.map(String) : [],
    continuation: scoped,
    failure: null,
    timingMs: Number(record(r.timing).queryMs ?? 0),
  };
  if (response.resultState === "SOURCE_FAILURE") {
    const kind = String(r.failureKind ?? "unavailable");
    nameSearch.failure = { kind, message: kind === "timeout" ? "The name search did not finish in time." : "The license database did not complete the name search." };
    return emptyExecution({ ...base, blocked: true, blockMessage: `Company-name research is temporarily unavailable (${kind}). No result was inferred or substituted -- retry, or search the same name in ContractorTrustHub Verify for a state.`, nameSearch });
  }
  if (response.resultState === "INVALID_QUERY") {
    return emptyExecution({ ...base, blocked: true, blockMessage: "That company name could not be searched. No result was inferred or substituted.", nameSearch });
  }
  const candidates = (Array.isArray(r.candidates) ? (r.candidates as NameCandidateView[]) : []).map(nameCandidateCard);
  return emptyExecution({
    ...base, ok: true,
    contractorCount: null, credentialCount: null,
    results: candidates,
    page: plan.page, pageSize: NAME_CANDIDATE_PAGE_SIZE,
    nameSearch,
  });
}

export { EVIDENCE_META, SOURCE_LABEL };
