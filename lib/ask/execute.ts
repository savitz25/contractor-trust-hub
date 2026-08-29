/**
 * Deterministic Ask execution. Parameterized SQL only. No LLM facts.
 */
import type { LicenseStatus } from "@/lib/contractors/types";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { DEFAULT_BROWSE } from "@/lib/discovery/browse";
import { getCounty, getDiscoveryState, getTrade } from "@/lib/discovery/config";
import { listFloridaBrowse } from "@/lib/discovery/florida-list";
import type { CountyDef, TradeDef } from "@/lib/discovery/types";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";
import { REGULATORY_PUBLICATION_GATE_ACTIVE } from "@/lib/regulatory/publication";
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

function discoveryBits(plan: ContractorResearchQuery): { county: CountyDef | null; trade: TradeDef | null } | null {
  const disc = getDiscoveryState("florida");
  if (!disc) return null;
  const trade = plan.trade.discoverySlug ? getTrade(disc, plan.trade.discoverySlug) : null;
  const county =
    plan.geography.countySlug && plan.geography.countySlug !== "fl"
      ? getCounty(disc, plan.geography.countySlug)
      : null;
  return { county, trade };
}

async function browseFor(plan: ContractorResearchQuery, countySlug?: string | null) {
  const bits = discoveryBits({
    ...plan,
    geography: {
      ...plan.geography,
      countySlug: countySlug === undefined ? plan.geography.countySlug : countySlug,
    },
  });
  if (!bits) return null;
  const disc = getDiscoveryState("florida")!;
  const county =
    (countySlug === undefined ? plan.geography.countySlug : countySlug) &&
    (countySlug === undefined ? plan.geography.countySlug : countySlug) !== "fl"
      ? getCounty(disc, (countySlug === undefined ? plan.geography.countySlug : countySlug) as string)
      : bits.county;
  return listFloridaBrowse({
    county,
    trade: bits.trade,
    browse: {
      ...DEFAULT_BROWSE,
      status: plan.credentialStatus === "active_current" ? "active" : "any",
      page: plan.page,
      sort: "name",
      discipline:
        plan.evidenceFamily && EVIDENCE_META[plan.evidenceFamily].joinable ? "present" : "any",
    },
  });
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
    const [left, right] = await Promise.all([browseFor(plan, "broward"), browseFor(plan, "palm-beach")]);
    if (!left || !right) {
      return emptyExecution({ blocked: true, blockMessage: "Comparison counties are not configured." });
    }
    return emptyExecution({
      ok: true,
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
      grainLabel:
        "Florida DBPR contractor/firm identities whose indexed mailing/business address county matches. Not service-area market size and not permit volume.",
      compare: {
        left: {
          label: "Broward County (indexed address county)",
          href: "/florida/broward",
          contractors: left.stats.firms,
          credentials: left.stats.activeFirms,
        },
        right: {
          label: "Palm Beach County (indexed address county)",
          href: "/florida/palm-beach",
          contractors: right.stats.firms,
          credentials: right.stats.activeFirms,
        },
        limitation:
          "Firm identity counts use the same Florida DBPR extract and the same address-county method. Active-firm counts are a subset. Permit volume is not compared. Address county is not service territory.",
      },
    });
  }

  const browsed = await browseFor(plan);
  if (!browsed) {
    return emptyExecution({ blocked: true, blockMessage: "Florida discovery configuration is not available." });
  }

  if (plan.mode === "count") {
    return emptyExecution({
      ok: true,
      contractorCount: browsed.stats.firms,
      credentialCount: browsed.stats.activeFirms,
      grainLabel:
        "Firm identities (canonical contractor or high-confidence Sunbiz entity). Active-firm count is a subset. This is not a raw credential-row total.",
      asOf,
      snapshotFingerprint: intel.sourceFingerprint,
      evidenceJoinable: plan.evidenceFamily ? EVIDENCE_META[plan.evidenceFamily].joinable : null,
    });
  }

  const results: AskEntityCard[] = browsed.results.map((r) => {
    const card: AskEntityCard = {
      contractorId: r.id,
      slug: r.slug,
      displayName: r.displayName,
      credentialKey: r.primaryLicenseKey,
      occupationCode: r.occupationCode,
      occupationLabel: classLabel(r.occupationCode),
      statusNormalized: r.licenseStatus,
      statusLabel:
        r.licenseStatus === "active" || r.licenseStatus === "current"
          ? "Active/current in indexed DBPR record"
          : r.licenseStatus
            ? `${r.licenseStatus} in indexed DBPR record`
            : "Status as published",
      city: r.city,
      county: r.county,
      state: r.state,
      sourceLabel: SOURCE_LABEL[r.sourceSystem || "fl_dbpr"] || r.sourceSystem || "Florida DBPR",
      sourceSystem: r.sourceSystem || "fl_dbpr",
      geographyNote: plan.geography.countyLabel
        ? `${plan.geography.countyLabel} recorded address in the indexed licensing record — not service territory.`
        : "Recorded address on the indexed licensing record is not service territory.",
      evidenceCount: r.hasDiscipline ? 1 : 0,
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
    contractorCount: browsed.total,
    credentialCount: browsed.stats.activeFirms,
    grainLabel:
      "Matching contractor/firm identities from contractors ⋈ licenses (Sunbiz entity roll-up when confidence ≥ 0.9). Active-firm count is a subset, not a credential-row census.",
    asOf,
    snapshotFingerprint: intel.sourceFingerprint,
    results,
    page: plan.page,
    evidenceJoinable: plan.evidenceFamily ? EVIDENCE_META[plan.evidenceFamily].joinable : null,
    sqlContract: "listFloridaBrowse — contractors ⋈ licenses via buildFilterClause",
  });
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
