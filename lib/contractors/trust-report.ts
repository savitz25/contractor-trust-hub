import { formatDate, matchMethodLabel, statusLabel } from "./format";
import { getOccupationInfo } from "./occupations";
import type { ContractorDetail, EntityDetail, LicenseDetail } from "./types";

export type EvidenceTone = "good" | "warn" | "bad" | "neutral";

export type EvidencePillar = {
  id: "license" | "entity" | "discipline";
  label: string;
  statusLine: string;
  detail: string;
  tone: EvidenceTone;
  lastVerifiedAt: string | null;
};

export type DataDiscrepancy = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "attention";
};

export type HiringPoint = {
  id: string;
  text: string;
  tone: EvidenceTone;
};

function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .replace(/[.,'"/\\-]/g, " ")
    .replace(/\b(INC|LLC|L L C|CORP|CORPORATION|CO|COMPANY|LTD|PLLC|PA|LP)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function zip5(postal: string | null | undefined): string | null {
  if (!postal) return null;
  const m = postal.replace(/\D/g, "").slice(0, 5);
  return m.length === 5 ? m : null;
}

function isActiveStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "active" || s === "current";
}

function isInactiveish(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "inactive" || s === "dissolved" || s === "revoked" || s === "expired";
}

export function buildEvidencePillars(contractor: ContractorDetail): EvidencePillar[] {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const hasDiscipline = contractor.discipline.length > 0;

  const licenseTone: EvidenceTone = !lic
    ? "neutral"
    : isActiveStatus(lic.statusNormalized)
      ? "good"
      : isInactiveish(lic.statusNormalized)
        ? "bad"
        : "warn";

  const entityTone: EvidenceTone = !ent
    ? "neutral"
    : isActiveStatus(ent.status)
      ? "good"
      : isInactiveish(ent.status)
        ? "bad"
        : "warn";

  return [
    {
      id: "license",
      label: "License status",
      statusLine: lic
        ? `${statusLabel(lic.statusNormalized)}${lic.externalKey ? ` · ${lic.externalKey}` : ""}`
        : "No license on profile",
      detail: lic
        ? `${getOccupationInfo(lic.occupationCode).label}`
        : "No Florida DBPR construction license is linked to this profile.",
      tone: licenseTone,
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    },
    {
      id: "entity",
      label: "Entity status",
      statusLine: ent
        ? `${statusLabel(ent.status)} · Doc ${ent.externalKey}`
        : "No high-confidence link",
      detail: ent
        ? ent.legalName
        : "No Sunbiz entity linked at high confidence (exact name/geo match required).",
      tone: entityTone,
      lastVerifiedAt: ent?.lastVerifiedAt ?? null,
    },
    {
      id: "discipline",
      label: "Discipline status",
      statusLine: hasDiscipline
        ? `${contractor.discipline.length} action(s) linked`
        : "None linked in extract",
      detail: hasDiscipline
        ? "Board discipline rows are linked in our current extracts — review details below."
        : "No discipline actions are linked to this contractor in our current board extracts.",
      tone: hasDiscipline ? "warn" : "good",
      lastVerifiedAt:
        contractor.discipline[0]?.lastVerifiedAt ?? lic?.lastVerifiedAt ?? null,
    },
  ];
}

export function matchConfidenceLine(entity: EntityDetail | undefined): string | null {
  if (!entity) return null;
  const method = matchMethodLabel(entity.matchMethod);
  if (entity.matchConfidence != null) {
    return `Linked on ${method.toLowerCase()} · ${entity.matchConfidence.toFixed(2)} confidence`;
  }
  return `Linked on ${method.toLowerCase()}`;
}

export function findDiscrepancies(contractor: ContractorDetail): DataDiscrepancy[] {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  if (!lic || !ent) return [];

  const out: DataDiscrepancy[] = [];

  const nameCandidates = [
    contractor.displayName,
    contractor.legalName,
    contractor.dbaName,
    lic.externalKey ? null : null,
  ].filter(Boolean) as string[];

  const licNames = nameCandidates.map(normalizeName).filter(Boolean);
  const entName = normalizeName(ent.legalName);
  if (entName && licNames.length > 0) {
    const anyClose = licNames.some(
      (n) => n === entName || n.includes(entName) || entName.includes(n)
    );
    if (!anyClose) {
      out.push({
        id: "name",
        title: "Name differs between license and entity records",
        detail: `DBPR-facing name on this profile is “${contractor.displayName}”; linked Sunbiz legal name is “${ent.legalName}”. High-confidence geo matching still applied — verify you have the intended business.`,
        severity: "attention",
      });
    }
  }

  const licZip = zip5(lic.postalCode);
  const entZip = zip5(ent.postalCode);
  if (licZip && entZip && licZip !== entZip) {
    out.push({
      id: "zip",
      title: "ZIP codes differ between DBPR and Sunbiz",
      detail: `License address ZIP is ${licZip}; Sunbiz principal address ZIP is ${entZip}. Addresses can legitimately differ (mailing vs principal office), but it is worth confirming which location you are dealing with.`,
      severity: "info",
    });
  }

  const licCity = (lic.city || contractor.primaryCity || "").trim().toUpperCase();
  const entCity = (ent.city || "").trim().toUpperCase();
  if (licCity && entCity && licCity !== entCity) {
    out.push({
      id: "city",
      title: "City differs between DBPR and Sunbiz",
      detail: `License city on file: ${lic.city || contractor.primaryCity}. Sunbiz city: ${ent.city}. Confirm the operating location for your project.`,
      severity: "info",
    });
  }

  if (isActiveStatus(lic.statusNormalized) && isInactiveish(ent.status)) {
    out.push({
      id: "status-active-dissolved",
      title: "License appears active while entity status does not",
      detail: `DBPR license status is ${statusLabel(lic.statusNormalized)}, but the linked Sunbiz entity status is ${statusLabel(ent.status)}. Confirm both the license and the corporate filing before signing a contract.`,
      severity: "attention",
    });
  }

  if (isInactiveish(lic.statusNormalized) && isActiveStatus(ent.status)) {
    out.push({
      id: "status-inactive-active",
      title: "License is not active while entity appears active",
      detail: `DBPR license status is ${statusLabel(lic.statusNormalized)}, while Sunbiz shows ${statusLabel(ent.status)}. An active business filing does not replace an active construction license for the work.`,
      severity: "attention",
    });
  }

  return out;
}

export function buildHiringGuidance(contractor: ContractorDetail): HiringPoint[] {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const points: HiringPoint[] = [];
  const occ = lic ? getOccupationInfo(lic.occupationCode) : null;

  if (lic) {
    if (isActiveStatus(lic.statusNormalized)) {
      points.push({
        id: "lic-active",
        text: `Florida DBPR shows license ${lic.externalKey} as ${statusLabel(lic.statusNormalized)} in our extract. That is a starting point — not a guarantee the record is current the day you hire.`,
        tone: "good",
      });
    } else {
      points.push({
        id: "lic-status",
        text: `Florida DBPR shows license ${lic.externalKey} as ${statusLabel(lic.statusNormalized)} in our extract. Confirm current status on the official board before relying on this license for work.`,
        tone: isInactiveish(lic.statusNormalized) ? "bad" : "warn",
      });
    }
    if (occ) {
      points.push({
        id: "scope",
        text: `License class: ${occ.label}. ${occ.notes}`,
        tone: "neutral",
      });
    }
    if (lic.expirationDate) {
      points.push({
        id: "exp",
        text: `Board extract lists an expiration date of ${formatDate(lic.expirationDate)}. Always re-check expiration and any renewal status on the official DBPR site.`,
        tone: "neutral",
      });
    }
  } else {
    points.push({
      id: "no-lic",
      text: "This profile does not currently show a linked Florida construction license in our consumer evidence set.",
      tone: "warn",
    });
  }

  if (ent) {
    const conf = matchConfidenceLine(ent);
    points.push({
      id: "entity",
      text: `A Sunbiz business entity is linked${conf ? ` (${conf})` : ""}. Entity status in our data: ${statusLabel(ent.status)}. Confirm the legal name on your contract matches the filing.`,
      tone: isActiveStatus(ent.status) ? "good" : "warn",
    });
  } else {
    points.push({
      id: "no-entity",
      text: "We did not find a high-confidence Sunbiz match for this contractor. That does not prove the business is unregistered — only that we will not invent an entity link without a strict name and location match.",
      tone: "neutral",
    });
  }

  if (contractor.discipline.length > 0) {
    points.push({
      id: "disc",
      text: `Our extract links ${contractor.discipline.length} discipline or regulatory action(s). Read the disposition details below and verify on official board records before hiring.`,
      tone: "warn",
    });
  } else {
    points.push({
      id: "no-disc",
      text: "No discipline actions are linked to this contractor in our current board extracts. Absence in our extract is not a warranty that no history exists outside these sources.",
      tone: "good",
    });
  }

  points.push({
    id: "confirm",
    text: "Before hiring: confirm identity and license status on the official Florida DBPR board site, confirm the business on Sunbiz if relevant, get a written contract, and verify local permits for the work.",
    tone: "neutral",
  });

  return points;
}

export function primaryLicense(contractor: ContractorDetail): LicenseDetail | undefined {
  return contractor.licenses[0];
}
