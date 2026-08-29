/**
 * Deterministic Ask execution. Parameterized SQL only. No LLM facts.
 */
import { query, queryOne } from "@/lib/db";
import { asLicenseStatus } from "@/lib/contractors/format";
import type { LicenseStatus } from "@/lib/contractors/types";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { getCounty, getDiscoveryState, getTrade } from "@/lib/discovery/config";
import { buildFilterClause } from "@/lib/discovery/queries";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";
import { PUBLIC_REGULATORY_SQL, REGULATORY_PUBLICATION_GATE_ACTIVE } from "@/lib/regulatory/publication";
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

function evidenceExistsSql(family: EvidenceFamilyId, sourceIdx: number, datasetsIdx: number): string {
  void family;
  return `
    EXISTS (
      SELECT 1 FROM discipline_actions d
      WHERE d.contractor_id = c.id
        AND d.source_system = $${sourceIdx}
        AND d.source_dataset = ANY($${datasetsIdx}::text[])
        AND ${PUBLIC_REGULATORY_SQL}
    )
  `;
}

function sortSql(plan: ContractorResearchQuery): string {
  switch (plan.sort.field) {
    case "credential":
      return "picked.external_key ASC NULLS LAST, picked.id ASC";
    case "expiration":
      return "picked.expiration_date DESC NULLS LAST, picked.display_name ASC, picked.id ASC";
    case "evidence_count":
      return "picked.evidence_count DESC, picked.display_name ASC, picked.id ASC";
    case "evidence_newest":
      return "picked.newest_evidence DESC NULLS LAST, picked.display_name ASC, picked.id ASC";
    default:
      return "LOWER(picked.display_name) ASC, picked.id ASC";
  }
}

function buildWhere(plan: ContractorResearchQuery): { where: string; params: unknown[]; datasetsIdx: number | null } | null {
  const disc = getDiscoveryState("florida");
  const state = getStateBySlug("fl");
  if (!disc || !state?.live) return null;
  const trade = plan.trade.discoverySlug ? getTrade(disc, plan.trade.discoverySlug) : null;
  const county =
    plan.geography.countySlug && plan.geography.countySlug !== "fl"
      ? getCounty(disc, plan.geography.countySlug)
      : null;
  const { where, params } = buildFilterClause({
    licenseSource: state.licenseSource,
    stateCode: state.code,
    occupationCodes: plan.trade.occupationCodes.length ? plan.trade.occupationCodes : trade?.occupationCodes ?? null,
    county,
    activeOnly: plan.credentialStatus === "active_current",
    requireInStateAddress: disc.requireInStateAddress,
  });
  let w = where;
  if (plan.credentialStatus === "expired") {
    w += ` AND l.status_normalized = 'expired'`;
  }
  let datasetsIdx: number | null = null;
  if (plan.evidenceFamily && EVIDENCE_META[plan.evidenceFamily].joinable) {
    params.push(EVIDENCE_META[plan.evidenceFamily].sourceSystem);
    const sourceIdx = params.length;
    params.push(EVIDENCE_META[plan.evidenceFamily].datasets);
    datasetsIdx = params.length;
    w += ` AND ${evidenceExistsSql(plan.evidenceFamily, sourceIdx, datasetsIdx)}`;
  }
  return { where: w, params, datasetsIdx };
}

async function countPair(where: string, params: unknown[]): Promise<{ contractors: number; credentials: number }> {
  const row = await queryOne<{ contractors: string; credentials: string }>(
    `
    SELECT
      COUNT(DISTINCT c.id)::text AS contractors,
      COUNT(DISTINCT l.id)::text AS credentials
    FROM contractors c
    JOIN licenses l ON l.contractor_id = c.id
    WHERE ${where}
    `,
    params
  );
  return {
    contractors: Number(row?.contractors || 0),
    credentials: Number(row?.credentials || 0),
  };
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

  if (plan.mode === "comparison") {
    const leftPlan: ContractorResearchQuery = {
      ...plan,
      mode: "count",
      geography: { ...plan.geography, countySlug: "broward", countyLabel: "Broward County, Florida" },
      compareCountySlugs: [],
    };
    const rightPlan: ContractorResearchQuery = {
      ...plan,
      mode: "count",
      geography: { ...plan.geography, countySlug: "palm-beach", countyLabel: "Palm Beach County, Florida" },
      compareCountySlugs: [],
    };
    const leftW = buildWhere(leftPlan);
    const rightW = buildWhere(rightPlan);
    if (!leftW || !rightW) return emptyExecution({ blocked: true, blockMessage: "Comparison counties are not configured." });
    const [left, right] = await Promise.all([countPair(leftW.where, leftW.params), countPair(rightW.where, rightW.params)]);
    return emptyExecution({
      ok: true,
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
      grainLabel: "Florida DBPR credential records and contractor profiles whose indexed address county matches",
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
          "These counts use the same Florida DBPR extract and the same county-address method. They are not service-area market size and not permit volume.",
      },
    });
  }

  const built = buildWhere(plan);
  if (!built) {
    return emptyExecution({ blocked: true, blockMessage: "Florida discovery configuration is not available." });
  }

  try {
    const totals = await countPair(built.where, built.params);
    if (plan.mode === "count") {
      return emptyExecution({
        ok: true,
        contractorCount: totals.contractors,
        credentialCount: totals.credentials,
        grainLabel:
          "Canonical contractor profiles vs matching credential records in Florida DBPR. These are not the same grain.",
        asOf,
        snapshotFingerprint: intel.sourceFingerprint,
        evidenceJoinable: plan.evidenceFamily ? EVIDENCE_META[plan.evidenceFamily].joinable : null,
      });
    }

    const listParams = [...built.params, plan.limit, plan.offset];
    const limitIdx = built.params.length + 1;
    const offsetIdx = built.params.length + 2;
    const wantsEvidenceSort = plan.sort.field === "evidence_count" || plan.sort.field === "evidence_newest";
    const evidenceSelect = plan.evidenceFamily
      ? `,
        (
          SELECT COUNT(*)::int FROM discipline_actions d
          WHERE d.contractor_id = c.id
            AND d.source_dataset = ANY($${built.datasetsIdx}::text[])
            AND ${PUBLIC_REGULATORY_SQL}
        ) AS evidence_count,
        (
          SELECT MAX(COALESCE(d.disposition_date, d.entered_date)) FROM discipline_actions d
          WHERE d.contractor_id = c.id
            AND d.source_dataset = ANY($${built.datasetsIdx}::text[])
            AND ${PUBLIC_REGULATORY_SQL}
        ) AS newest_evidence`
      : `, 0::int AS evidence_count, NULL::date AS newest_evidence`;

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
      evidence_count: number;
      newest_evidence: Date | null;
    }>(
      `
      SELECT * FROM (
        SELECT DISTINCT ON (c.id)
          c.id,
          c.slug,
          c.display_name,
          c.primary_city,
          c.primary_county,
          c.home_state,
          l.external_key,
          l.occupation_code,
          l.status_normalized,
          l.source_system,
          l.expiration_date
          ${evidenceSelect}
        FROM contractors c
        JOIN licenses l ON l.contractor_id = c.id
        WHERE ${built.where}
        ORDER BY c.id,
          CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
          c.display_name
      ) picked
      ORDER BY ${wantsEvidenceSort ? sortSql(plan) : sortSql(plan)}
      LIMIT $${limitIdx}::int OFFSET $${offsetIdx}::int
      `,
      listParams
    );

    const ids = rows.map((r) => r.id);
    const evidenceByContractor = new Map<string, AskEvidenceRow[]>();
    if (ids.length && plan.evidenceFamily && built.datasetsIdx) {
      const evParams = [ids, EVIDENCE_META[plan.evidenceFamily].datasets];
      const evRows = await query<{
        contractor_id: string;
        id: string;
        source_system: string;
        source_dataset: string;
        complaint_number: string | null;
        disposition: string | null;
        disposition_date: Date | null;
        entered_date: Date | null;
        classification: string | null;
      }>(
        `
        SELECT d.contractor_id, d.id, d.source_system, d.source_dataset, d.complaint_number,
               d.disposition, d.disposition_date, d.entered_date, d.classification
        FROM discipline_actions d
        WHERE d.contractor_id = ANY($1::uuid[])
          AND d.source_dataset = ANY($2::text[])
          AND ${PUBLIC_REGULATORY_SQL}
        ORDER BY COALESCE(d.disposition_date, d.entered_date) DESC NULLS LAST
        `,
        evParams
      );
      for (const e of evRows) {
        const list = evidenceByContractor.get(e.contractor_id) || [];
        if (list.length >= 8) continue;
        list.push({
          id: e.id,
          family: EVIDENCE_META[plan.evidenceFamily].label,
          sourceLabel: SOURCE_LABEL[e.source_system] || e.source_system,
          sourceDataset: e.source_dataset,
          caseId: e.complaint_number,
          actionDate: (e.disposition_date || e.entered_date)?.toISOString().slice(0, 10) ?? null,
          disposition: e.disposition,
          classification: e.classification,
        });
        evidenceByContractor.set(e.contractor_id, list);
      }
    }

    const results: AskEntityCard[] = rows.map((r) => {
      const evidence = evidenceByContractor.get(r.id) || [];
      const card: AskEntityCard = {
        contractorId: r.id,
        slug: r.slug,
        displayName: r.display_name,
        credentialKey: r.external_key,
        occupationCode: r.occupation_code,
        occupationLabel: classLabel(r.occupation_code),
        statusNormalized: asLicenseStatus(r.status_normalized),
        statusLabel: r.status_normalized
          ? `Active/current in indexed DBPR record`.replace(
              "Active/current",
              r.status_normalized === "active" || r.status_normalized === "current" ? "Active/current" : r.status_normalized
            )
          : "Status as published",
        city: r.primary_city,
        county: r.primary_county,
        state: r.home_state,
        sourceLabel: SOURCE_LABEL[r.source_system || "fl_dbpr"] || r.source_system || "Florida DBPR",
        sourceSystem: r.source_system,
        geographyNote: plan.geography.countyLabel
          ? `${plan.geography.countyLabel} recorded address in the indexed licensing record — not service territory.`
          : "Recorded address on the indexed licensing record is not service territory.",
        evidenceCount: Number(r.evidence_count || 0),
        newestEvidenceDate: r.newest_evidence ? r.newest_evidence.toISOString().slice(0, 10) : null,
        whyMatched: "",
        evidence,
        profileHref: r.slug ? `/contractors/${r.slug}` : null,
      };
      card.statusLabel =
        r.status_normalized === "active" || r.status_normalized === "current"
          ? "Active/current in indexed DBPR record"
          : r.status_normalized
            ? `${r.status_normalized} in indexed DBPR record`
            : "Status as published";
      card.whyMatched = whyMatched(plan, card);
      return card;
    });

    return emptyExecution({
      ok: true,
      contractorCount: totals.contractors,
      credentialCount: totals.credentials,
      grainLabel:
        "Matching canonical contractor profiles (contractors.id). Credential record count is listed separately and is not the same number.",
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
      results,
      page: plan.page,
      evidenceJoinable: plan.evidenceFamily ? EVIDENCE_META[plan.evidenceFamily].joinable : null,
    });
  } catch (err) {
    console.error("[ask] execute failed:", err instanceof Error ? err.message : err);
    return emptyExecution({
      blocked: true,
      blockMessage: "The structured query could not be completed against the live research graph. Try a narrower question or Verify search.",
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
