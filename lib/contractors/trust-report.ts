import { occupationLabel } from "@/lib/states/config";
import { getOrCcbTypeInfo, orCcbDisplayLabel } from "@/lib/states/or-ccb";
import { getTxTradeInfo, txTradePlainLabel } from "@/lib/states/tx-trades";
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
  /** Short lead label for scanning */
  label: string;
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
  const isTx = (contractor.homeState || "").toUpperCase() === "TX";
  const isOr = (contractor.homeState || "").toUpperCase() === "OR";
  const isAz = (contractor.homeState || "").toUpperCase() === "AZ";

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

  const txTrade = isTx && lic ? getTxTradeInfo(lic.occupationCode) : null;
  const orType = isOr && lic ? getOrCcbTypeInfo(lic.occupationCode) : null;
  const occLabel = lic
    ? isTx
      ? txTradePlainLabel(lic.occupationCode)
      : isOr
        ? orCcbDisplayLabel(lic.occupationCode)
      : occupationLabel(lic.occupationCode) || getOccupationInfo(lic.occupationCode).label
    : null;

  const pillars: EvidencePillar[] = [
    {
      id: "license",
      label: isOr ? "CCB license" : isTx ? "Texas license" : "License",
      statusLine: lic ? statusLabel(lic.statusNormalized) : "Not on profile",
      detail: lic
        ? `${lic.externalKey} · ${occLabel}`
        : isTx
          ? "No TDLR specialty or TSBPE plumbing license linked here."
          : isOr
            ? "No Oregon CCB active license linked here."
          : "No Florida DBPR construction license linked here.",
      tone: licenseTone,
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    },
  ];

  if (isOr) {
    pillars.push({
      id: "entity",
      label: "Bond / insurance",
      statusLine: lic?.secondaryStatus ? "Listed in extract" : "Not on this row",
      detail: lic?.secondaryStatus
        ? `${lic.secondaryStatus}. As published — not a live certificate check.`
        : "No bond/insurance fields on this CCB row.",
      tone: lic?.secondaryStatus ? "neutral" : "warn",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
    pillars.push({
      id: "discipline",
      label: "Coverage",
      statusLine: "CCB active list",
      detail:
        "Oregon CCB statewide contractor licensing. Confirm current status on the official CCB search. Discipline/SOS entity linking is not in this extract.",
      tone: "warn",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
    return pillars;
  }

  if (isTx) {
    pillars.push({
      id: "entity",
      label: "Trade type",
      statusLine: txTrade?.chip ?? "Specialty",
      detail: txTrade
        ? `${txTrade.scopeNote}`
        : "Texas specialty trade or TSBPE plumbing only — not a statewide general contractor license.",
      tone: "neutral",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
    pillars.push({
      id: "discipline",
      label: "Coverage",
      statusLine: "Specialty + plumbing",
      detail:
        "No statewide GC license in Texas. City/county builder registration is not fully covered. Discipline records are not loaded for TX v1.",
      tone: "warn",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
    return pillars;
  }

  if (isAz) {
    pillars.push({
      id: "entity",
      label: "Category",
      statusLine: lic?.secondaryStatus?.includes("Category:")
        ? "Published class type"
        : "ROC extract",
      detail: lic?.secondaryStatus
        ? `${lic.secondaryStatus}. Confirm standing on the official ROC contractor search.`
        : "Arizona ROC posting-list extract. Confirm current status on the official ROC search.",
      tone: "neutral",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
    pillars.push({
      id: "discipline",
      label: "Discipline",
      statusLine: hasDiscipline
        ? `${contractor.discipline.length} linked`
        : "None linked",
      detail: hasDiscipline
        ? "ROC disciplinary actions posting list row(s) linked — open the section below for case number and published status. Not a full case narrative."
        : "No ROC disciplinary actions posting-list row linked in our current extracts (not a warranty of clean history).",
      tone: hasDiscipline ? "warn" : "good",
      lastVerifiedAt:
        contractor.discipline[0]?.lastVerifiedAt ?? lic?.lastVerifiedAt ?? null,
    });
    return pillars;
  }

  pillars.push(
    {
      id: "entity",
      label: "Entity",
      statusLine: ent ? statusLabel(ent.status) : "Not linked",
      detail: ent
        ? `${ent.legalName} · Doc ${ent.externalKey}`
        : "No high-confidence Sunbiz match (we only link exact name + location).",
      tone: entityTone,
      lastVerifiedAt: ent?.lastVerifiedAt ?? null,
    },
    {
      id: "discipline",
      label: "Discipline",
      statusLine: hasDiscipline
        ? `${contractor.discipline.length} linked`
        : "None linked",
      detail: hasDiscipline
        ? "Board action(s) in our extracts — open the Discipline section below for dates and source."
        : "No board actions linked in our current extracts (not a warranty of clean history).",
      tone: hasDiscipline ? "warn" : "good",
      lastVerifiedAt:
        contractor.discipline[0]?.lastVerifiedAt ?? lic?.lastVerifiedAt ?? null,
    }
  );

  return pillars;
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
        title: "Business names do not match exactly",
        detail: `License profile shows “${contractor.displayName}”; Sunbiz lists “${ent.legalName}”. That can still be a valid high-confidence geo match — confirm the name on your contract matches the company you intend.`,
        severity: "attention",
      });
    }
  }

  const licZip = zip5(lic.postalCode);
  const entZip = zip5(ent.postalCode);
  if (licZip && entZip && licZip !== entZip) {
    out.push({
      id: "zip",
      title: "Different ZIP codes on file",
      detail: `DBPR license ZIP ${licZip}; Sunbiz principal ZIP ${entZip}. Mailing and principal office addresses often differ — useful to know which location you are dealing with.`,
      severity: "info",
    });
  }

  const licCity = (lic.city || contractor.primaryCity || "").trim().toUpperCase();
  const entCity = (ent.city || "").trim().toUpperCase();
  if (licCity && entCity && licCity !== entCity) {
    out.push({
      id: "city",
      title: "Different cities on file",
      detail: `License city: ${lic.city || contractor.primaryCity}. Sunbiz city: ${ent.city}. Common when records use different office or mailing addresses.`,
      severity: "info",
    });
  }

  if (isActiveStatus(lic.statusNormalized) && isInactiveish(ent.status)) {
    out.push({
      id: "status-active-dissolved",
      title: "License active, entity status is not",
      detail: `DBPR shows ${statusLabel(lic.statusNormalized)}; Sunbiz shows ${statusLabel(ent.status)}. Re-check both the license and the corporate filing before you sign.`,
      severity: "attention",
    });
  }

  if (isInactiveish(lic.statusNormalized) && isActiveStatus(ent.status)) {
    out.push({
      id: "status-inactive-active",
      title: "License not active, entity filing looks active",
      detail: `DBPR shows ${statusLabel(lic.statusNormalized)}; Sunbiz shows ${statusLabel(ent.status)}. An active business filing does not replace an active construction license.`,
      severity: "attention",
    });
  }

  return out;
}

export function buildHiringGuidance(contractor: ContractorDetail): HiringPoint[] {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const points: HiringPoint[] = [];
  const isTx = (contractor.homeState || "").toUpperCase() === "TX";
  const isOr = (contractor.homeState || "").toUpperCase() === "OR";
  const isTsbpe = (lic?.sourceSystem || "").toLowerCase() === "tx_tsbpe";
  const occ = lic ? getOccupationInfo(lic.occupationCode) : null;
  const txTrade = isTx && lic ? getTxTradeInfo(lic.occupationCode) : null;
  const txBoard = isTsbpe ? "TSBPE" : "TDLR";

  if (lic) {
    if (isActiveStatus(lic.statusNormalized)) {
      points.push({
        id: "lic-active",
        label: "License status",
        text: isOr
          ? `${lic.externalKey} is ${statusLabel(lic.statusNormalized)} in the CCB Active Licenses extract. Re-check the official CCB search the day you hire.`
          : isTx
          ? `${lic.externalKey} is ${statusLabel(lic.statusNormalized)} in our ${txBoard} extract. Re-check the official ${txBoard} search the day you hire.`
          : `${lic.externalKey} is ${statusLabel(lic.statusNormalized)} in our DBPR extract. Always re-check the official board the day you hire.`,
        tone: "good",
      });
    } else {
      points.push({
        id: "lic-status",
        label: "License status",
        text: isTx
          ? `${lic.externalKey} shows as ${statusLabel(lic.statusNormalized)} in our ${txBoard} extract. Confirm current status on the official ${txBoard} site before relying on it.`
          : `${lic.externalKey} shows as ${statusLabel(lic.statusNormalized)} in our extract. Confirm current status on the official DBPR site before relying on it.`,
        tone: isInactiveish(lic.statusNormalized) ? "bad" : "warn",
      });
    }
    if (isOr) {
      const orType = getOrCcbTypeInfo(lic.occupationCode);
      points.push({
        id: "scope",
        label: "What this license is",
        text: orType
          ? `${orType.plain}. ${orType.scopeNote}`
          : "Oregon CCB statewide contractor license as published on the Active Licenses extract.",
        tone: "neutral",
      });
      if (lic.secondaryStatus) {
        points.push({
          id: "bond-ins",
          label: "Bond / insurance on file",
          text: `${lic.secondaryStatus}. These are extract fields — not proof a policy is in force today.`,
          tone: "warn",
        });
      }
    } else if (isTx) {
      points.push({
        id: "scope",
        label: "What this license is",
        text: txTrade
          ? `${txTrade.plain}. ${txTrade.scopeNote}`
          : "Texas specialty or plumbing credential only — not a statewide general contractor license.",
        tone: "warn",
      });
    } else if (occ) {
      points.push({
        id: "scope",
        label: "What this class typically covers",
        text: `${occ.label}. ${occ.notes}`,
        tone: "neutral",
      });
    }
    if (lic.expirationDate) {
      points.push({
        id: "exp",
        label: "Expiration on file",
        text: isTx
          ? `Extract lists ${formatDate(lic.expirationDate)}. Confirm renewal on the official ${txBoard} license search.`
          : `Extract lists ${formatDate(lic.expirationDate)}. Confirm renewal status on DBPR.`,
        tone: "neutral",
      });
    }
  } else {
    points.push({
      id: "no-lic",
      label: "License",
      text: isTx
        ? "No TDLR specialty or TSBPE plumbing license is linked on this profile."
        : "No Florida construction license is linked on this consumer profile.",
      tone: "warn",
    });
  }

  if (isOr) {
    points.push({
      id: "confirm",
      label: "Before you sign",
      text: "1) Confirm the license on the official Oregon CCB search. 2) Treat bond/insurance amounts as published only. 3) Get a written contract and ask for current certificates.",
      tone: "neutral",
    });
    return points;
  }

  if (!isTx) {
    if (ent) {
      points.push({
        id: "entity",
        label: "Business name on contract",
        text: `Sunbiz ${statusLabel(ent.status)} · ${ent.legalName}. The name on your written contract should match this filing.`,
        tone: isActiveStatus(ent.status) ? "good" : "warn",
      });
    } else {
      points.push({
        id: "no-entity",
        label: "Business filing",
        text: "No high-confidence Sunbiz link. That does not mean unregistered — only that we require a strict name and location match.",
        tone: "neutral",
      });
    }

    if (contractor.discipline.length > 0) {
      points.push({
        id: "disc",
        label: "Discipline",
        text: `${contractor.discipline.length} board action(s) appear in our extracts. Read dates and disposition below, then confirm on the official board if it matters to your decision.`,
        tone: "warn",
      });
    } else {
      points.push({
        id: "no-disc",
        label: "Discipline",
        text: "None linked in our current extracts. That is a fact about our files — not a certificate of a clean record after our last load.",
        tone: "good",
      });
    }

    points.push({
      id: "wc",
      label: "Insurance you should still ask for",
      text: "We do not store workers’ comp or general liability status. Ask for current certificates and use official Florida Proof of Coverage tools before relying on a verbal claim.",
      tone: "neutral",
    });

    points.push({
      id: "confirm",
      label: "Before you sign",
      text: "1) Confirm the license on Florida DBPR. 2) Match the legal name on the contract to Sunbiz if a filing is linked. 3) Get a written scope and payment schedule. 4) Check local permits.",
      tone: "neutral",
    });
  } else {
    points.push({
      id: "coverage",
      label: "What this search cannot prove",
      text: "Texas has no statewide GC license. City/county builder registration is not fully covered. A miss or a match here is not a full “cleared to hire” for every trade.",
      tone: "warn",
    });
    points.push({
      id: "confirm",
      label: "Before you sign",
      text: isTsbpe
        ? "1) Confirm the license on the official TSBPE search. 2) For public plumbing contracts, confirm Responsible Master Plumber status and insurance on file. 3) Ask the city or county what registration they require. 4) Get a written contract."
        : "1) Confirm the license on the official TDLR search. 2) Ask the city or county what registration they require. 3) Get a written contract.",
      tone: "neutral",
    });
  }

  return points;
}

export function primaryLicense(contractor: ContractorDetail): LicenseDetail | undefined {
  return contractor.licenses[0];
}
