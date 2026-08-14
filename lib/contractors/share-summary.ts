/**
 * Shareable / printable Trust Report summary model.
 * Evidence fields only — state-scoped sources, no scores or rankings.
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
  buildConsumerMeaning,
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
  stateSlug: EvidenceStateSlug;
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

function classLabel(contractor: ContractorDetail, slug: EvidenceStateSlug): string | null {
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

function disciplineLine(contractor: ContractorDetail, slug: EvidenceStateSlug): string {
  const n = contractor.discipline.length;
  const isNj = slug === "nj";
  if (n > 0) {
    return isNj
      ? `${n} enforcement record(s) in our extracts — open the full report for dates and disposition`
      : `${n} discipline action(s) in our extracts — open the full report for dates and disposition`;
  }
  return isNj
    ? "No enforcement rows in our current extracts (not a guarantee of a clean history)"
    : "No discipline rows in our current extracts (not a guarantee of a clean history)";
}

/** Build a share/print summary from a loaded contractor profile. */
export function buildShareSummary(contractor: ContractorDetail): ShareSummaryModel {
  const slug = evidenceSlugFromHomeState(contractor.homeState);
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const location = [contractor.primaryCity, contractor.primaryCounty, contractor.homeState]
    .filter(Boolean)
    .join(" · ");
  const showEntity = stateHasEntityLinking(slug) || Boolean(ent);
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
    stateSlug: slug,
    stateContextLine: stateContextLine(slug),
    licenseId: lic?.externalKey || lic?.licenseNumber || null,
    licenseClass: classLabel(contractor, slug),
    licenseStatus,
    entityStatus,
    showEntity,
    disciplineLine: disciplineLine(contractor, slug),
    boardSource: boardShortLabel(slug),
    extractLabel: sourceExtractLabel(slug),
    sourceSystem: lic?.sourceSystem || null,
    freshestAt: freshestVerifiedAt(contractor),
    fullReportPath: `/contractors/${encodeURIComponent(contractor.slug)}`,
    officialBoardUrl: officialBoardVerifyUrl(contractor),
    officialBoardLabel: officialBoardVerifyLabel(contractor),
    meaning: buildConsumerMeaning(contractor)
      .slice(0, 4)
      .map((p) => ({ id: p.id, label: p.label, text: p.text })),
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
      label: slug === "fl" ? "Sunbiz entity" : "Business entity",
      value: model.entityStatus,
      detail: ent?.legalName || undefined,
    });
  }
  rows.push({
    id: "discipline",
    label: slug === "nj" ? "Enforcement in extract" : "Discipline in extract",
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
