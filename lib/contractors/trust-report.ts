import { occupationLabel } from "@/lib/states/config";
import { getOrCcbTypeInfo, orCcbDisplayLabel } from "@/lib/states/or-ccb";
import { getTxTradeInfo, txTradePlainLabel } from "@/lib/states/tx-trades";
import {
  evidenceSlugFromHomeState,
  boardShortLabel,
  type EvidenceStateSlug,
} from "@/lib/states/evidence-copy";
import { formatDate, matchMethodLabel, statusLabel } from "./format";
import { getOccupationInfo } from "./occupations";
import type { ContractorDetail, EntityDetail, LicenseDetail } from "./types";

export type EvidenceTone = "good" | "warn" | "bad" | "neutral";

export type EvidencePillar = {
  id: "license" | "entity" | "discipline" | "insurance" | "freshness";
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

function homeSlug(contractor: ContractorDetail): EvidenceStateSlug {
  return evidenceSlugFromHomeState(contractor.homeState);
}

/** States with high-confidence entity auto-linking in product today. */
export function stateHasEntityLinking(slug: EvidenceStateSlug): boolean {
  return slug === "fl" || slug === "nj";
}

function boardName(slug: EvidenceStateSlug): string {
  return boardShortLabel(slug);
}

function extractPhrase(slug: EvidenceStateSlug): string {
  switch (slug) {
    case "tx":
      return "TDLR / TSBPE extract";
    case "nj":
      return "New Jersey DCA extract";
    case "or":
      return "Oregon CCB Active Licenses extract";
    case "wa":
      return "Washington L&I contractor extract";
    case "ca":
      return "CSLB public list extract";
    case "az":
      return "Arizona ROC posting list";
    case "la":
      return "Louisiana LSLBC public roster";
    case "ms":
      return "Mississippi MSBOC public list";
    case "ky":
      return "Kentucky DHBC specialty extract";
    case "wi":
      return "Wisconsin DSPS extract";
    default:
      return "Florida DBPR extract";
  }
}

export function freshestVerifiedAt(contractor: ContractorDetail): string | null {
  const times = [
    contractor.licenses[0]?.lastVerifiedAt,
    contractor.entities[0]?.lastVerifiedAt,
    contractor.discipline[0]?.lastVerifiedAt,
  ].filter(Boolean) as string[];
  if (times.length === 0) return null;
  return times.sort().reverse()[0];
}

export function buildEvidencePillars(contractor: ContractorDetail): EvidencePillar[] {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const hasDiscipline = contractor.discipline.length > 0;
  const slug = homeSlug(contractor);
  const isTx = slug === "tx";
  const isOr = slug === "or";
  const isAz = slug === "az";
  const isLa = slug === "la";
  const isMs = slug === "ms";
  const isWa = slug === "wa";
  const isCa = slug === "ca";
  const isKy = slug === "ky";
  const isNj = slug === "nj";
  const isFl = slug === "fl";

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

  const licenseLabel = isOr
    ? "CCB license"
    : isTx
      ? "Texas license"
      : isWa
        ? "L&I license"
        : isAz
          ? "ROC license"
          : isLa
            ? "LSLBC license"
            : isMs
              ? "MSBOC license"
              : isKy
                ? "DHBC specialty"
                : isCa
                  ? "CSLB license"
                  : isNj
                    ? "Registration / license"
                    : "License";

  const noLicenseDetail = isTx
    ? "No TDLR specialty or TSBPE plumbing license linked here."
    : isOr
      ? "No Oregon CCB active license linked here."
      : isWa
        ? "No Washington L&I license linked here."
        : isAz
          ? "No Arizona ROC license linked here."
          : isLa
            ? "No Louisiana LSLBC license linked here."
            : isMs
              ? "No Mississippi MSBOC license linked here."
              : isKy
                ? "No Kentucky DHBC specialty credential linked here."
                : isCa
                  ? "No California CSLB license linked here."
                  : isNj
                    ? "No New Jersey registration or specialty credential linked here."
                    : "No Florida DBPR construction license linked here.";

  const pillars: EvidencePillar[] = [
    {
      id: "license",
      label: licenseLabel,
      statusLine: lic
        ? statusLabel(
            isWa || isAz || isLa || isMs || isKy
              ? lic.primaryStatus || lic.statusNormalized
              : lic.statusNormalized
          )
        : "Not on profile",
      detail: lic ? `${lic.externalKey} · ${occLabel}` : noLicenseDetail,
      tone: licenseTone,
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    },
  ];

  // --- Entity / secondary pillar (state-aware) ---
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
  } else if (isTx) {
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
  } else if (isAz) {
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
  } else if (isLa || isMs) {
    pillars.push({
      id: "entity",
      label: "License type",
      statusLine: occLabel || (isMs ? "MSBOC credential" : "LSLBC credential"),
      detail: lic?.secondaryStatus
        ? `${lic.secondaryStatus}. As published — not a ranking.`
        : isMs
          ? "Mississippi MSBOC contractor license as published."
          : "Louisiana LSLBC contractor license as published.",
      tone: "neutral",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
  } else if (isWa) {
    pillars.push({
      id: "entity",
      label: "Trade / class",
      statusLine: occLabel || "L&I contractor",
      detail: lic?.secondaryStatus
        ? `${lic.secondaryStatus}. Confirm on official L&I Verify.`
        : "Washington L&I contractor row as published. SOS entity not auto-linked.",
      tone: "neutral",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
  } else if (isKy) {
    pillars.push({
      id: "entity",
      label: "Specialty / type",
      statusLine: occLabel || "DHBC specialty",
      detail: lic?.secondaryStatus
        ? `${lic.secondaryStatus}. Not a statewide GC license. Confirm on official DHBC search.`
        : "Kentucky DHBC specialty credential only — no statewide general contractor license.",
      tone: "neutral",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
  } else if (isCa) {
    pillars.push({
      id: "entity",
      label: "Classification",
      statusLine: occLabel || "CSLB class",
      detail: lic?.secondaryStatus
        ? `${lic.secondaryStatus}. Confirm on CSLB Instant License Check.`
        : "CSLB public list extract (high-impact counties). Bond/WC as published only.",
      tone: "neutral",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
  } else if (stateHasEntityLinking(slug)) {
    pillars.push({
      id: "entity",
      label: isNj ? "Business filing" : "Entity",
      statusLine: ent ? statusLabel(ent.status) : "Not linked",
      detail: ent
        ? `${ent.legalName} · Doc ${ent.externalKey}`
        : isNj
          ? "No high-confidence NJ entity match under our strict linking rules."
          : "No high-confidence Sunbiz match (we only link exact name + location).",
      tone: entityTone,
      lastVerifiedAt: ent?.lastVerifiedAt ?? null,
    });
  } else {
    pillars.push({
      id: "entity",
      label: "Business filing",
      statusLine: "Not auto-linked",
      detail: `${boardName(slug)} path does not auto-link SOS entity records in this extract.`,
      tone: "neutral",
      lastVerifiedAt: null,
    });
  }

  // --- Discipline / coverage pillar ---
  if (isOr) {
    pillars.push({
      id: "discipline",
      label: "Coverage",
      statusLine: "CCB active list",
      detail:
        "Oregon CCB statewide contractor licensing. Confirm current status on the official CCB search. Discipline/SOS entity linking is not in this extract.",
      tone: "warn",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
  } else if (isTx) {
    pillars.push({
      id: "discipline",
      label: "Coverage",
      statusLine: "Specialty + plumbing",
      detail:
        "No statewide GC license in Texas. City/county builder registration is not fully covered. Discipline records are not loaded for TX v1.",
      tone: "warn",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
  } else if (isAz) {
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
  } else if (isLa || isMs || isKy || isWa || isCa) {
    const coverageLine = isLa
      ? "LSLBC public roster"
      : isMs
        ? "MSBOC public list"
        : isKy
          ? "DHBC specialty only"
          : isWa
            ? "L&I extract"
            : "CSLB county extract";
    const detail = isLa
      ? "Louisiana LSLBC statewide roster. This official roster does not include bond, insurance, or discipline. Confirm on the official LSLBC lookup."
      : isMs
        ? "Mississippi MSBOC statewide list. Bond, insurance, and discipline are not in this extract. Confirm on the official board lookup."
        : isKy
          ? "Kentucky DHBC specialty trades only — no statewide GC. We do not invent bond, insurance, or discipline from this extract."
          : isWa
            ? "Washington L&I contractor extract. Discipline case narrative and live bond/COI are not invented here. Confirm on L&I Verify."
            : "CSLB public list extract (high-impact counties). Bond/WC fields as published only — not live certificates. Confirm on Instant License Check.";
    pillars.push({
      id: "discipline",
      label: isAz ? "Discipline" : "Coverage / discipline",
      statusLine: hasDiscipline
        ? `${contractor.discipline.length} linked`
        : coverageLine,
      detail: hasDiscipline
        ? "Board action(s) linked in our extracts — open the section below. Absence elsewhere is not a clean-history certificate."
        : detail,
      tone: hasDiscipline ? "warn" : "neutral",
      lastVerifiedAt:
        contractor.discipline[0]?.lastVerifiedAt ?? lic?.lastVerifiedAt ?? null,
    });
  } else {
    pillars.push({
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
    });
  }

  // Insurance path — official links only; never invent coverage
  if (isFl) {
    pillars.push({
      id: "insurance",
      label: "Insurance path",
      statusLine: "Not in extract",
      detail:
        "Request current COIs. Use Florida Division of Workers’ Comp Proof of Coverage tools — we do not store certificates.",
      tone: "neutral",
      lastVerifiedAt: null,
    });
  } else if (isOr && lic?.secondaryStatus) {
    pillars.push({
      id: "insurance",
      label: "Bond / insurance",
      statusLine: "As published",
      detail:
        "CCB extract bond/insurance fields are published values only — not a live certificate check.",
      tone: "warn",
      lastVerifiedAt: lic?.lastVerifiedAt ?? null,
    });
  } else {
    pillars.push({
      id: "insurance",
      label: "Insurance path",
      statusLine: "Ask the contractor",
      detail: `We do not invent bond or insurance from the ${extractPhrase(slug)}. Request current certificates and confirm with the carrier.`,
      tone: "neutral",
      lastVerifiedAt: null,
    });
  }

  const freshest = freshestVerifiedAt(contractor);
  pillars.push({
    id: "freshness",
    label: "Data updated",
    statusLine: freshest ? "In our extract" : "Timestamp not on file",
    detail: freshest
      ? "“Last verified” means present in our successful ingest — not a live board check at page load."
      : "No extract timestamp on this profile. Always re-check the official board before hiring.",
    tone: "neutral",
    lastVerifiedAt: freshest,
  });

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
  const slug = homeSlug(contractor);
  if (!lic || !ent || !stateHasEntityLinking(slug)) return [];

  const out: DataDiscrepancy[] = [];
  const registry = slug === "nj" ? "linked entity filing" : "Sunbiz";
  const board = boardName(slug);

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
        detail: `License profile shows “${contractor.displayName}”; ${registry} lists “${ent.legalName}”. That can still be a valid high-confidence match — confirm the name on your contract matches the company you intend.`,
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
      detail: `License ZIP ${licZip}; entity principal ZIP ${entZip}. Mailing and principal office addresses often differ.`,
      severity: "info",
    });
  }

  const licCity = (lic.city || contractor.primaryCity || "").trim().toUpperCase();
  const entCity = (ent.city || "").trim().toUpperCase();
  if (licCity && entCity && licCity !== entCity) {
    out.push({
      id: "city",
      title: "Different cities on file",
      detail: `License city: ${lic.city || contractor.primaryCity}. Entity city: ${ent.city}. Common when records use different office or mailing addresses.`,
      severity: "info",
    });
  }

  if (isActiveStatus(lic.statusNormalized) && isInactiveish(ent.status)) {
    out.push({
      id: "status-active-dissolved",
      title: "License active, entity status is not",
      detail: `${board} shows ${statusLabel(lic.statusNormalized)}; entity filing shows ${statusLabel(ent.status)}. Re-check both before you sign — confirm which party is contracting.`,
      severity: "attention",
    });
  }

  if (isInactiveish(lic.statusNormalized) && isActiveStatus(ent.status)) {
    out.push({
      id: "status-inactive-active",
      title: "License not active, entity filing looks active",
      detail: `${board} shows ${statusLabel(lic.statusNormalized)}; entity filing shows ${statusLabel(ent.status)}. An active business filing does not replace an active construction credential.`,
      severity: "attention",
    });
  }

  return out;
}

/**
 * 3–5 plain-language bullets for the first screen (“What this means for you”).
 * Educational only — not hire / don’t-hire advice.
 */
export function buildConsumerMeaning(contractor: ContractorDetail): HiringPoint[] {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const slug = homeSlug(contractor);
  const board = boardName(slug);
  const extract = extractPhrase(slug);
  const points: HiringPoint[] = [];
  const isTsbpe = (lic?.sourceSystem || "").toLowerCase() === "tx_tsbpe";

  if (lic) {
    if (isActiveStatus(lic.statusNormalized)) {
      points.push({
        id: "lic-active",
        label: "License status",
        text: `${lic.externalKey} is ${statusLabel(lic.primaryStatus || lic.statusNormalized)} in our ${extract}. Re-check ${board} the day you hire.`,
        tone: "good",
      });
    } else {
      points.push({
        id: "lic-status",
        label: "License status",
        text: `${lic.externalKey} shows as ${statusLabel(lic.primaryStatus || lic.statusNormalized)} in our ${extract}. Confirm current status on the official ${board} site before relying on it.`,
        tone: isInactiveish(lic.statusNormalized) ? "bad" : "warn",
      });
    }
  } else {
    points.push({
      id: "no-lic",
      label: "License",
      text: `No ${board} credential is linked on this profile in our current extracts.`,
      tone: "warn",
    });
  }

  // Scope / specialty honesty
  if (slug === "tx" && lic) {
    const txTrade = getTxTradeInfo(lic.occupationCode);
    points.push({
      id: "scope",
      label: "What this credential is",
      text: txTrade
        ? `${txTrade.plain}. ${txTrade.scopeNote}`
        : "Texas specialty or plumbing credential only — not a statewide general contractor license.",
      tone: "warn",
    });
  } else if (slug === "ky") {
    points.push({
      id: "scope",
      label: "Specialty only",
      text: "Kentucky has no statewide general contractor license. This path is DHBC specialty trades (electrical, HVAC, plumbing contractor-level when loaded).",
      tone: "warn",
    });
  } else if (slug === "nj") {
    points.push({
      id: "scope",
      label: "What this covers",
      text: "New Jersey: home improvement and specialty board credentials — no single statewide GC license.",
      tone: "warn",
    });
  } else if (slug === "or" && lic) {
    const orType = getOrCcbTypeInfo(lic.occupationCode);
    points.push({
      id: "scope",
      label: "What this license is",
      text: orType
        ? `${orType.plain}. ${orType.scopeNote}`
        : "Oregon CCB statewide contractor license as published on the Active Licenses extract.",
      tone: "neutral",
    });
  } else if (lic && (slug === "fl" || slug === "ca" || slug === "az" || slug === "wa" || slug === "la" || slug === "ms")) {
    const occ = getOccupationInfo(lic.occupationCode);
    if (occ?.label && occ.label !== "Construction license") {
      const note = (occ.notes || "").trim();
      points.push({
        id: "scope",
        label: "Class / type on file",
        text: note
          ? `${occ.label}. ${note}`
          : `${occ.label}. Confirm scope for your project on the official board.`,
        tone: "neutral",
      });
    }
  }

  // Discipline honesty
  if (contractor.discipline.length > 0) {
    points.push({
      id: "disc",
      label: "Discipline in extract",
      text: `${contractor.discipline.length} board action(s) appear in our extracts. Read dates and disposition below, then confirm on ${board} if it matters to your decision.`,
      tone: "warn",
    });
  } else if (slug === "az" || slug === "fl" || slug === "nj") {
    points.push({
      id: "no-disc",
      label: "Discipline in extract",
      text: "No discipline row linked in our current extract — not a certificate of clean history after our last load.",
      tone: "good",
    });
  } else {
    points.push({
      id: "no-disc",
      label: "Discipline",
      text: `We do not invent disciplinary case narratives from the ${extract}. Confirm standing on ${board} when it matters.`,
      tone: "neutral",
    });
  }

  // Entity (only when linking exists or mismatch signal)
  if (stateHasEntityLinking(slug)) {
    if (ent) {
      const licActive = lic ? isActiveStatus(lic.statusNormalized) : false;
      const entInactive = isInactiveish(ent.status);
      if (licActive && entInactive) {
        points.push({
          id: "entity-mismatch",
          label: "Entity vs license",
          text: `Entity filing shows ${statusLabel(ent.status)} while the license looks active — confirm which party is contracting and match the legal name on your written agreement.`,
          tone: "warn",
        });
      } else {
        points.push({
          id: "entity",
          label: "Business name on contract",
          text: `${slug === "fl" ? "Sunbiz" : "Linked filing"} ${statusLabel(ent.status)} · ${ent.legalName}. The name on your written contract should match this filing.`,
          tone: isActiveStatus(ent.status) ? "good" : "warn",
        });
      }
    } else if (slug === "fl") {
      points.push({
        id: "no-entity",
        label: "Business filing",
        text: "No high-confidence Sunbiz link. That does not mean unregistered — only that we require a strict name and location match.",
        tone: "neutral",
      });
    }
  }

  // Cap at 5, ensure we have insurance ask if room
  if (points.length < 5) {
    if (slug === "or" && lic?.secondaryStatus) {
      points.push({
        id: "bond-ins",
        label: "Bond / insurance on file",
        text: `${lic.secondaryStatus}. These are extract fields — not proof a policy is in force today.`,
        tone: "warn",
      });
    } else if (slug === "fl") {
      points.push({
        id: "wc",
        label: "Insurance you should still ask for",
        text: "We do not store workers’ comp or general liability status. Ask for current certificates and use official Florida Division of Workers’ Comp Proof of Coverage tools before relying on a verbal claim.",
        tone: "neutral",
      });
    } else if (isTsbpe) {
      points.push({
        id: "confirm",
        label: "Before you sign",
        text: "Confirm Responsible Master Plumber status and insurance on official TSBPE tools when required. Get a written contract.",
        tone: "neutral",
      });
    } else {
      points.push({
        id: "confirm",
        label: "Before you sign",
        text: `1) Confirm the credential on official ${board}. 2) Match the legal name on the contract. 3) Get a written scope and payment schedule. 4) Ask for current insurance certificates.`,
        tone: "neutral",
      });
    }
  }

  return points.slice(0, 5);
}

/** @deprecated Prefer buildConsumerMeaning for first-screen copy; kept for section reuse. */
export function buildHiringGuidance(contractor: ContractorDetail): HiringPoint[] {
  return buildConsumerMeaning(contractor);
}

export function primaryLicense(contractor: ContractorDetail): LicenseDetail | undefined {
  return contractor.licenses[0];
}

/** Official board verify / search URL for actions. */
export function officialBoardVerifyUrl(contractor: ContractorDetail): string {
  const slug = homeSlug(contractor);
  const home = (contractor.homeState || "").toUpperCase();
  // evidenceSlugFromHomeState defaults unknown to fl — never send non-FL profiles to DBPR
  const treatAsFl = slug === "fl" && (!home || home === "FL");
  if (!treatAsFl && slug === "fl") {
    if (home === "ID") return "https://dopl.idaho.gov/";
    return "https://www.usa.gov/state-consumer";
  }
  switch (slug) {
    case "tx":
      return (contractor.licenses[0]?.sourceSystem || "").toLowerCase() === "tx_tsbpe"
        ? "https://tsbpe.texas.gov/"
        : "https://www.tdlr.texas.gov/LicenseSearch/";
    case "or":
      return "https://search.ccb.state.or.us/search/";
    case "wa":
      return "https://secure.lni.wa.gov/verify/";
    case "az":
      return "https://azroc.my.site.com/AZRoc/s/contractor-search";
    case "ca":
      return "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx";
    case "nj":
      return "https://www.njconsumeraffairs.gov/";
    case "la":
      return "https://arlspublic.lslbc.louisiana.gov/Public/Search";
    case "ms":
      return "http://search.msboc.us/ConsolidatedSearch.cfm";
    case "ky":
      return "https://dhbc.ky.gov/Search/HBC_List_Licensees.aspx";
    case "wi":
      return "https://license.wi.gov/s/license-lookup";
    default:
      return treatAsFl
        ? "https://www2.myfloridalicense.com/construction-industry/"
        : "https://www.usa.gov/state-consumer";
  }
}

export function officialBoardVerifyLabel(contractor: ContractorDetail): string {
  const slug = homeSlug(contractor);
  const home = (contractor.homeState || "").toUpperCase();
  const treatAsFl = slug === "fl" && (!home || home === "FL");
  if (!treatAsFl && slug === "fl") {
    if (home === "ID") return "Open official Idaho DOPL";
    return home
      ? `Open official ${home} board search`
      : "Open official board search";
  }
  switch (slug) {
    case "tx":
      return "Open official TDLR / TSBPE search";
    case "or":
      return "Open official CCB search";
    case "wa":
      return "Open L&I Verify";
    case "az":
      return "Open official ROC search";
    case "ca":
      return "Open CSLB Instant License Check";
    case "nj":
      return "Open NJ DCA / MyLicense";
    case "la":
      return "Open official LSLBC lookup";
    case "ms":
      return "Open official MSBOC lookup";
    case "ky":
      return "Open official DHBC search";
    case "wi":
      return "Open official LicensE lookup";
    default:
      return treatAsFl ? "Open official DBPR search" : "Open official board search";
  }
}
