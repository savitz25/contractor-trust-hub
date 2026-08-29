/**
 * Deterministic Ask execution. Parameterized SQL only. No LLM facts.
 */
import { asLicenseStatus } from "@/lib/contractors/format";
import type { LicenseStatus } from "@/lib/contractors/types";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { dbUserFacingError, query, queryOne } from "@/lib/db";
import { getCounty, getDiscoveryState } from "@/lib/discovery/config";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";
import { REGULATORY_PUBLICATION_GATE_ACTIVE } from "@/lib/regulatory/publication";
import { getStateBySlug } from "@/lib/states/config";
import type { ContractorResearchQuery, EvidenceFamilyId } from "./plan";
import { ASK_PAGE_SIZE } from "./plan";
import { CLASS_LABELS } from "./ontology";

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
  sourceLabel: string;
  sourceSystem: string | null;
  geographyNote: string;
  evidenceCount: number;
  newestEvidenceDate: string | null;
  whyMatched: string;
  evidence: AskEvidenceRow[];
  profileHref: string | null;
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

function askWhere(plan: ContractorResearchQuery, countySlug?: string | null): { where: string; params: unknown[] } | null {
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

async function askCounts(where: string, params: unknown[]): Promise<{ contractors: number; credentials: number }> {
  const row = await queryOne<{ contractors: string; credentials: string }>(
    `
    SELECT
      (
        SELECT COUNT(*)::text FROM contractors c
        WHERE EXISTS (
          SELECT 1 FROM licenses l
          WHERE l.contractor_id = c.id AND ${where}
        )
      ) AS contractors,
      (
        SELECT COUNT(*)::text FROM contractors c
        JOIN licenses l ON l.contractor_id = c.id
        WHERE ${where}
      ) AS credentials
    `,
    params,
    { statementTimeoutMs: 12_000 }
  );
  return { contractors: Number(row?.contractors || 0), credentials: Number(row?.credentials || 0) };
}

function whyMatched(plan: ContractorResearchQuery, card: { evidenceCount: number }): string {
  const bits = ["This contractor appears because an indexed Florida DBPR credential record matched the structured filters."];
  if (plan.credentialStatus === "active_current") bits.push("Credential status is active/current in the extract.");
  if (plan.trade.label) bits.push(`Trade family is ${plan.trade.label} (${plan.trade.occupationCodes.join(", ")}).`);
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
    if (plan.mode === "count") {
      const totals = await askCounts(built.where, built.params);
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

    const listParams = [...built.params, plan.limit, plan.offset];
    const rows = await query<{
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
    }>(
      `
      SELECT * FROM (
        SELECT DISTINCT ON (c.id)
          c.id, c.slug, c.display_name, c.primary_city, c.primary_county, c.home_state,
          l.external_key, l.occupation_code, l.status_normalized, l.source_system
        FROM contractors c
        JOIN licenses l ON l.contractor_id = c.id
        WHERE ${built.where}
        ORDER BY c.id,
          CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
          c.display_name
      ) picked
      ORDER BY LOWER(picked.display_name), picked.id
      LIMIT $${built.params.length + 1}::int OFFSET $${built.params.length + 2}::int
      `,
      listParams,
      { statementTimeoutMs: 15_000 }
    );

    const results: AskEntityCard[] = rows.map((r) => {
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

    let totals: { contractors: number; credentials: number } | null = null;
    try {
      totals = await askCounts(built.where, built.params);
    } catch {
      totals = { contractors: results.length, credentials: results.length };
    }

    return emptyExecution({
      ok: true,
      contractorCount: totals.contractors,
      credentialCount: totals.credentials,
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
    console.error("[ask] execute failed:", detail);
    return emptyExecution({
      blocked: true,
      blockMessage:
        detail === "database error"
          ? "The structured query could not be completed against the live research graph. Try a narrower question or Verify search."
          : `The structured query could not be completed (${detail}). Try a narrower question or Verify search.`,
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
    });
  }
}

const EXEC_MEMO = new Map<string, AskExecution>();

export async function executeContractorResearchQuery(plan: ContractorResearchQuery): Promise<AskExecution> {
  const intel = loadContractorHubIntel();
  const key = `${plan.planId}:${plan.page}:${plan.sort.field}:${plan.mode}:${intel.sourceFingerprint}`;
  const hit = EXEC_MEMO.get(key);
  if (hit) return hit;
  const out = await executeUncached(plan);
  if (EXEC_MEMO.size > 48) EXEC_MEMO.clear();
  EXEC_MEMO.set(key, out);
  return out;
}

export { EVIDENCE_META, SOURCE_LABEL };
