/**
 * Map Ask context onto existing Contractor Florida browse / Verify.
 * No second search engine. No service-area invention.
 */

import { FLORIDA_BROWSE_TRADE_SLUGS } from "@/lib/network-discovery/florida-policy";
import type { ContractorAskCategory, ContractorAskSearchContext } from "./allowlist";
import {
  resolveContractorHandoffGeography,
  type ContractorGeoMatchClass,
  type ResolvedContractorGeography,
} from "./geography";
import { withContractorAskParams } from "./parse";

export type ContractorAskHandoffStatus = "ok" | "unsupported" | "soft";

export type ContractorAskHandoffResolution = {
  status: ContractorAskHandoffStatus;
  path: string;
  href: string;
  category?: ContractorAskCategory;
  geography?: ResolvedContractorGeography;
  matchClass?: ContractorGeoMatchClass;
  backLabel: string;
  bannerTitle: string;
  bannerBody: string;
  reason?: string;
};

function tradeLabel(cat?: ContractorAskCategory): string {
  if (cat === "roofing") return "roofing contractors";
  if (cat === "plumbing") return "plumbers";
  if (cat === "hvac") return "HVAC contractors";
  if (cat === "pool") return "pool contractors";
  if (cat === "general_contractor") return "general contractors";
  return "contractors";
}

function tradeSlug(cat: ContractorAskCategory): string {
  return FLORIDA_BROWSE_TRADE_SLUGS[cat];
}

function unsupported(
  ctx: ContractorAskSearchContext,
  title: string,
  body: string,
  reason: string
): ContractorAskHandoffResolution {
  const path = "/from-ask/unsupported";
  return {
    status: "unsupported",
    path,
    href: withContractorAskParams(path, ctx),
    category: ctx.category,
    backLabel: "Back to Florida contractor browse",
    bannerTitle: title,
    bannerBody: body,
    reason,
  };
}

function njSoft(
  ctx: ContractorAskSearchContext,
  title: string,
  body: string,
  reason: string
): ContractorAskHandoffResolution {
  const path = "/verify";
  const href = withContractorAskParams(`${path}?state=nj`, ctx);
  return {
    status: "soft",
    path,
    href,
    category: ctx.category,
    matchClass: "license_state",
    backLabel: "Back to New Jersey contractor verification",
    bannerTitle: title,
    bannerBody: body,
    reason,
  };
}

export function resolveContractorAskHandoff(
  ctx: ContractorAskSearchContext
): ContractorAskHandoffResolution {
  if (
    ctx.unsupportedEntity === "home_inspector" ||
    ctx.unsupportedCategory === "home_inspector" ||
    ctx.unsupportedCategory === "home_inspectors"
  ) {
    return unsupported(
      ctx,
      "Home inspectors are not in this Florida contractor browse",
      "ContractorTrustHub did not convert this search into general contractors or another trade. Zero exact supported results.",
      "home_inspector_unsupported"
    );
  }
  if (
    ctx.unsupportedEntity === "electrician" ||
    ctx.unsupportedCategory === "electrical" ||
    ctx.unsupportedCategory === "electrician"
  ) {
    if (ctx.state === "NJ") {
      return njSoft(
        ctx,
        "New Jersey electrical credentials — Verify only",
        "New Jersey has no county/trade browse on ContractorTrustHub. This is not Florida-ready discovery and is not an electrician directory invented from general contractors.",
        "nj_electrical_soft"
      );
    }
    return unsupported(
      ctx,
      "Florida electrical contractors are not in this Ask browse",
      "The bounded Florida feed does not include electrical occupation pages. This search was not widened to general contractors.",
      "fl_electrical_unsupported"
    );
  }
  if (
    ctx.unsupportedCategory === "solar" ||
    ctx.unsupportedCategory === "solar_contractor" ||
    ctx.unsupportedEntity === "solar_contractor"
  ) {
    return unsupported(
      ctx,
      "Solar is not a source-backed Florida browse category",
      "Name-assist solar was not promoted into a trade page. This search was not widened to roofing or general contractors.",
      "solar_unsupported"
    );
  }
  if (
    ctx.unsupportedCategory === "painting" ||
    ctx.unsupportedCategory === "painter" ||
    ctx.unsupportedEntity === "painter"
  ) {
    return unsupported(
      ctx,
      "Painting is not a supported Florida Ask category",
      "ContractorTrustHub did not substitute general contractors or another trade.",
      "painting_unsupported"
    );
  }
  if (ctx.unsupportedEntity) {
    return unsupported(
      ctx,
      "This contractor type is not available here",
      "Unsupported entity classes are not converted into generic contractors.",
      `unsupported_entity:${ctx.unsupportedEntity}`
    );
  }
  if (ctx.unsupportedCategory) {
    return unsupported(
      ctx,
      "This trade is not in the bounded Florida Ask set",
      "Roofing, plumbing, HVAC (CAC), pool/spa, and certified general contractors (CGC) are the Florida-ready categories. CBC, CRC, and CMC are not widened.",
      `unsupported_category:${ctx.unsupportedCategory}`
    );
  }

  if (ctx.state === "NJ") {
    if (ctx.category === "roofing") {
      return unsupported(
        ctx,
        "New Jersey roofing is not a browse category",
        "NJ has no roofing occupation page and no county browse. Home-improvement registration was not inferred as roofing.",
        "nj_roofing_unsupported"
      );
    }
    return njSoft(
      ctx,
      "New Jersey contractor verification",
      "New Jersey stays Verify-oriented (SOFT). There is no county/trade browse and no statewide general-contractor license like Florida CGC.",
      "nj_soft_verify"
    );
  }

  if (ctx.state && ctx.state !== "FL") {
    return unsupported(
      ctx,
      "This state is not in the Florida Ask browse",
      "The current Ask-ready Contractor subset is bounded Florida county/trade browse. Other states were not activated.",
      "state_not_florida_ready"
    );
  }

  const geo = resolveContractorHandoffGeography(ctx);
  const cat = ctx.category;

  if (cat && geo) {
    const path = `/florida/${geo.countySlug}/${tradeSlug(cat)}`;
    const who = tradeLabel(cat);
    const place = `${geo.countyName} County`;
    const body = geo.cityCoveredByCountyOnly
      ? `These are ${who} with a physical license address in ${place}. That is not proof they serve ${ctx.city}, and a ${place} address is not an exact ${ctx.city} location unless the published city matches. Occupations follow the frozen Florida mapping — HVAC is CAC only; general contractor is CGC only.`
      : `These are ${who} with a physical license address in ${place}. Physical county is not a service area. Occupations follow the frozen Florida mapping.`;
    return {
      status: "ok",
      path,
      href: withContractorAskParams(path, ctx),
      category: cat,
      geography: geo,
      matchClass: geo.matchClass,
      backLabel: `Back to ${who} in ${place}`,
      bannerTitle: `${who.charAt(0).toUpperCase()}${who.slice(1)} in ${place}`,
      bannerBody: body,
    };
  }

  if (cat && (ctx.state === "FL" || !ctx.state)) {
    const path = `/florida/${tradeSlug(cat)}`;
    return {
      status: "ok",
      path,
      href: withContractorAskParams(path, ctx),
      category: cat,
      matchClass: "physical_state",
      backLabel: `Back to Florida ${tradeLabel(cat)}`,
      bannerTitle: `Florida ${tradeLabel(cat)}`,
      bannerBody:
        "Statewide Florida occupation browse from DBPR extracts. Pick a county for local physical-address lists. This is not a service-territory graph.",
    };
  }

  if (geo) {
    const path = `/florida/${geo.countySlug}`;
    return {
      status: "ok",
      path,
      href: withContractorAskParams(path, ctx),
      geography: geo,
      matchClass: geo.matchClass,
      backLabel: `Back to contractors in ${geo.countyName} County`,
      bannerTitle: `Contractors in ${geo.countyName} County`,
      bannerBody: `Florida DBPR license evidence associated with ${geo.countyName} County. Physical county is not a claimed service area.`,
    };
  }

  if (ctx.city && !geo) {
    return unsupported(
      ctx,
      "That city is not in the curated Florida county map",
      "ContractorTrustHub did not geocode or invent a county. Use a supported Florida county or a known city such as Miami, Tampa, Orlando, or Jacksonville.",
      "city_unmapped"
    );
  }

  return unsupported(
    ctx,
    "Not enough structured Florida context",
    "Ask handoff needs a supported trade and Florida county or known city. Raw search text is not consumed.",
    "incomplete_context"
  );
}

export function isResolvedContractorAskPath(
  pathname: string,
  resolution: ContractorAskHandoffResolution
): boolean {
  const current = pathname.replace(/\/$/, "") || "/";
  const target = resolution.path.replace(/\/$/, "") || "/";
  if (current === target) return true;
  if (current.startsWith("/contractors/")) return true;
  if (current.startsWith("/from-ask")) return true;
  return false;
}

export function shouldRedirectContractorAskEntry(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === "/from-ask";
}
