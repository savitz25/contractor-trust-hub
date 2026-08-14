/**
 * Shareable / printable Trust Report summary model.
 * Evidence fields only — state-scoped sources, no scores or rankings.
 * Never attributes non-FL home states to Florida DBPR / Sunbiz.
 */

import { azClassPlainLabel } from "@/lib/states/az-roc";
import { caClassPlainLabel } from "@/lib/states/ca-classifications";
import {
  boardShortLabel,
  evidenceSlugFromHomeState,
  sourceExtractLabel,
  type EvidenceStateSlug,
} from "@/lib/states/evidence-copy";
import { njCredentialPlainLabel } from "@/lib/states/nj-credentials";
import { orCcbDisplayLabel } from "@/lib/states/or-ccb";
import { txTradePlainLabel } from "@/lib/states/tx-trades";
import { displayStatusLabel, statusLabel } from "./format";
import { getOccupationInfo } from "./occupations";
import {
  freshestVerifiedAt,
  officialBoardVerifyLabel,
  officialBoardVerifyUrl,
  stateHasEntityLinking,
} from "./trust-report";
import type { ContractorDetail } from "./types";

export type ShareSummaryRow = {
  id: string;
  label: string;
  value: string;
  detail?: string;
};

export type ShareSummaryModel = {
  displayName: string;
  legalName: string | null;
  dbaName: string | null;
  location: string | null;
  /** Product evidence slug when known; null for other US states not yet in the enum */
  stateSlug: EvidenceStateSlug | null;
  stateContextLine: string;
  licenseId: string | null;
  licenseClass: string | null;
  licenseStatus: string | null;
  entityStatus: string | null;
  /** False when this state does not auto-link entities and none is present */
  showEntity: boolean;
  disciplineLine: string;
  boardSource: string;
  extractLabel: string;
  sourceSystem: string | null;
  freshestAt: string | null;
  fullReportPath: string;
  officialBoardUrl: string;
  officialBoardLabel: string;
  meaning: Array<{ id: string; label: string; text: string }>;
  rows: ShareSummaryRow[];
};

const KNOWN: EvidenceStateSlug[] = [
  "fl",
  "tx",
  "nj",
  "or",
  "wa",
  "ca",
  "az",
  "la",
  "ms",
  "ky",
  "wi",
];

/**
 * Resolve board context without FL leakage.
 * `evidenceSlugFromHomeState` defaults unknown codes to fl — override when home_state ≠ FL.
 */
function resolveShareBoard(contractor: ContractorDetail): {
  slug: EvidenceStateSlug | null;
  home: string;
  boardSource: string;
  extractLabel: string;
  stateContextLine: string;
  isFl: boolean;
  isNj: boolean;
} {
  const home = (contractor.homeState || "").toUpperCase();
  const raw = evidenceSlugFromHomeState(contractor.homeState);
  const src = (contractor.licenses[0]?.sourceSystem || "").toLowerCase();

  // Known product states only when home matches (or empty home with FL sources)
  let slug: EvidenceStateSlug | null = KNOWN.includes(raw) ? raw : null;
  if (slug === "fl" && home && home !== "FL") {
    slug = null; // prevent FL default for ID, NV, etc.
  }
  if (!slug && home === "FL") slug = "fl";
  if (!slug && !home && (src.includes("fl_") || src.includes("dbpr"))) slug = "fl";

  if (slug) {
    return {
      slug,
      home: home || slug.toUpperCase(),
      boardSource: boardShortLabel(slug),
      extractLabel: sourceExtractLabel(slug),
      stateContextLine: stateContextLine(slug),
      isFl: slug === "fl",
      isNj: slug === "nj",
    };
  }

  // Generic non-FL (e.g. Idaho DOPL) — source_system only, no FL labels
  const boardFromSrc = boardFromSourceSystem(src, home);
  return {
    slug: null,
    home: home || "US",
    boardSource: boardFromSrc.board,
    extractLabel: boardFromSrc.extract,
    stateContextLine: `${boardFromSrc.region} · Evidence summary`,
    isFl: false,
    isNj: false,
  };
}

function boardFromSourceSystem(
  src: string,
  home: string
): { board: string; extract: string; region: string } {
  if (src.includes("id_dopl") || home === "ID") {
    return {
      board: "Idaho DOPL",
      extract: "Idaho DOPL contractor extract",
      region: "Idaho · DOPL",
    };
  }
  if (src.includes("nv_") || home === "NV") {
    return {
      board: "Nevada NSCB",
      extract: "Nevada contractor extract",
      region: "Nevada",
    };
  }
  if (src.includes("ok_") || home === "OK") {
    return {
      board: "Oklahoma CIB",
      extract: "Oklahoma contractor extract",
      region: "Oklahoma",
    };
  }
  if (src.includes("tn_") || home === "TN") {
    return {
      board: "Tennessee BLC",
      extract: "Tennessee contractor extract",
      region: "Tennessee",
    };
  }
  if (src.includes("va_") || home === "VA") {
    return {
      board: "Virginia DPOR",
      extract: "Virginia contractor extract",
      region: "Virginia",
    };
  }
  if (src.includes("ct_") || home === "CT") {
    return {
      board: "Connecticut DCP",
      extract: "Connecticut contractor extract",
      region: "Connecticut",
    };
  }
  if (src.includes("mn_") || home === "MN") {
    return {
      board: "Minnesota DLI",
      extract: "Minnesota contractor extract",
      region: "Minnesota",
    };
  }
  const region = home || "United States";
  return {
    board: home ? `${region} licensing board` : "State licensing board",
    extract: src ? `Public extract (${src})` : "Public license extract",
    region,
  };
}

function classLabel(
  contractor: ContractorDetail,
  slug: EvidenceStateSlug | null
): string | null {
  const lic = contractor.licenses[0];
  if (!lic) return null;
  if (slug === "tx") return txTradePlainLabel(lic.occupationCode);
  if (slug === "nj") return njCredentialPlainLabel(lic.occupationCode);
  if (slug === "or") return orCcbDisplayLabel(lic.occupationCode);
  if (slug === "ca") return caClassPlainLabel(lic.occupationCode);
  if (slug === "az") return azClassPlainLabel(lic.occupationCode);
  const occ = getOccupationInfo(lic.occupationCode);
  if (occ?.label && occ.label !== "Construction license") return occ.label;
  return lic.occupationCode || null;
}

function stateContextLine(slug: EvidenceStateSlug): string {
  switch (slug) {
    case "tx":
      return "Texas · TDLR / TSBPE · Evidence summary";
    case "nj":
      return "New Jersey · DCA · Evidence summary";
    case "or":
      return "Oregon · CCB · Evidence summary";
    case "wa":
      return "Washington · L&I · Evidence summary";
    case "ca":
      return "California · CSLB · Evidence summary";
    case "az":
      return "Arizona · ROC · Evidence summary";
    case "la":
      return "Louisiana · LSLBC · Evidence summary";
    case "ms":
      return "Mississippi · MSBOC · Evidence summary";
    case "ky":
      return "Kentucky · DHBC · Evidence summary";
    case "wi":
      return "Wisconsin · DSPS · Evidence summary";
    default:
      return "Florida · DBPR · Evidence summary";
  }
}

function disciplineLine(
  contractor: ContractorDetail,
  isNj: boolean
): string {
  const n = contractor.discipline.length;
  if (n > 0) {
    return isNj
      ? `${n} enforcement record(s) in our extracts — open the full report for dates and disposition`
      : `${n} discipline action(s) in our extracts — open the full report for dates and disposition`;
  }
  return isNj
    ? "No enforcement rows in our current extracts (not a guarantee of a clean history)"
    : "No discipline rows in our current extracts (not a guarantee of a clean history)";
}

/** Plain-language bullets without FL leakage for unknown product states. */
function meaningLines(
  contractor: ContractorDetail,
  opts: {
    slug: EvidenceStateSlug | null;
    board: string;
    extract: string;
    isFl: boolean;
    classLabel: string | null;
  }
): Array<{ id: string; label: string; text: string }> {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const points: Array<{ id: string; label: string; text: string }> = [];

  if (lic) {
    const st = displayStatusLabel(lic.statusNormalized, lic.primaryStatus);
    const active =
      (lic.statusNormalized || "").toLowerCase() === "active" ||
      (lic.statusNormalized || "").toLowerCase() === "current";
    points.push({
      id: "lic",
      label: "License status",
      text: active
        ? `${lic.externalKey} is ${st} in our ${opts.extract}. Re-check ${opts.board} the day you hire.`
        : `${lic.externalKey} shows as ${st} in our ${opts.extract}. Confirm current status on ${opts.board} before relying on it.`,
    });
  } else {
    points.push({
      id: "lic",
      label: "License",
      text: `No ${opts.board} credential is linked on this profile in our current extracts.`,
    });
  }

  if (opts.classLabel) {
    points.push({
      id: "class",
      label: "Class / type on file",
      text: `${opts.classLabel}. Confirm scope for your project on the official board.`,
    });
  }

  if (contractor.discipline.length > 0) {
    points.push({
      id: "disc",
      label: "Discipline in extract",
      text: `${contractor.discipline.length} board action(s) appear in our extracts. Read dates on the full report, then confirm on ${opts.board}.`,
    });
  } else {
    points.push({
      id: "disc",
      label: "Discipline in extract",
      text: `No discipline row linked in our current extract — not a certificate of clean history after our last load.`,
    });
  }

  const entityLinked =
    opts.isFl || (opts.slug != null && stateHasEntityLinking(opts.slug));
  if (entityLinked) {
    if (ent) {
      points.push({
        id: "entity",
        label: "Business filing",
        text: `Linked entity ${ent.legalName || ""} shows ${statusLabel(ent.status)} in our extract when matched under high-confidence rules.`,
      });
    } else if (opts.isFl) {
      points.push({
        id: "entity",
        label: "Business filing",
        text: "No high-confidence Sunbiz link. That is not proof the firm has no company filing.",
      });
    }
  }

  return points.slice(0, 4);
}

/** Build a share/print summary from a loaded contractor profile. */
export function buildShareSummary(contractor: ContractorDetail): ShareSummaryModel {
  const board = resolveShareBoard(contractor);
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const location = [contractor.primaryCity, contractor.primaryCounty, contractor.homeState]
    .filter(Boolean)
    .join(" · ");

  const showEntity =
    (board.slug != null && stateHasEntityLinking(board.slug)) || Boolean(ent);
  const licenseStatus = lic
    ? displayStatusLabel(lic.statusNormalized, lic.primaryStatus)
    : null;
  const entityStatus = ent
    ? statusLabel(ent.status)
    : showEntity
      ? "No high-confidence entity link in our extract"
      : null;

  const model: ShareSummaryModel = {
    displayName: contractor.displayName,
    legalName: contractor.legalName,
    dbaName: contractor.dbaName,
    location: location || null,
    stateSlug: board.slug,
    stateContextLine: board.stateContextLine,
    licenseId: lic?.externalKey || lic?.licenseNumber || null,
    licenseClass: classLabel(contractor, board.slug),
    licenseStatus,
    entityStatus,
    showEntity,
    disciplineLine: disciplineLine(contractor, board.isNj),
    boardSource: board.boardSource,
    extractLabel: board.extractLabel,
    sourceSystem: lic?.sourceSystem || null,
    freshestAt: freshestVerifiedAt(contractor),
    fullReportPath: `/contractors/${encodeURIComponent(contractor.slug)}`,
    officialBoardUrl: officialBoardVerifyUrl(contractor),
    officialBoardLabel: officialBoardVerifyLabel(contractor),
    meaning: meaningLines(contractor, {
      slug: board.slug,
      board: board.boardSource,
      extract: board.extractLabel,
      isFl: board.isFl,
      classLabel: classLabel(contractor, board.slug),
    }),
    rows: [],
  };

  const rows: ShareSummaryRow[] = [];
  if (model.licenseId) {
    rows.push({
      id: "license-id",
      label: "License / registration id",
      value: model.licenseId,
    });
  }
  if (model.licenseClass) {
    rows.push({
      id: "class",
      label: "Class / type",
      value: model.licenseClass,
    });
  }
  if (model.licenseStatus) {
    rows.push({
      id: "status",
      label: "Published status",
      value: model.licenseStatus,
      detail: "As published in our board extract — confirm live on the official board.",
    });
  }
  if (model.showEntity && model.entityStatus) {
    rows.push({
      id: "entity",
      label: board.isFl ? "Sunbiz entity" : "Business entity",
      value: model.entityStatus,
      detail: ent?.legalName || undefined,
    });
  }
  rows.push({
    id: "discipline",
    label: board.isNj ? "Enforcement in extract" : "Discipline in extract",
    value: model.disciplineLine,
  });
  rows.push({
    id: "source",
    label: "State / board source",
    value: model.boardSource,
    detail: model.sourceSystem
      ? `${model.extractLabel} · ${model.sourceSystem}`
      : model.extractLabel,
  });
  model.rows = rows;
  return model;
}

export function shareSummaryPath(slug: string): string {
  return `/contractors/${encodeURIComponent(slug)}/summary`;
}
