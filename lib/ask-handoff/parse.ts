/**
 * Bounded Ask → Contractor handoff parser. Fail-closed. No PII persistence.
 */

import { uspsState } from "@/lib/network-discovery/geo";
import {
  ASK_HANDOFF_FORBIDDEN_KEYS,
  ASK_HANDOFF_KEYS,
  CONTRACTOR_ENTITY_ALIASES,
  FLORIDA_HANDOFF_CATEGORIES,
  UNSUPPORTED_HANDOFF_CATEGORIES,
  UNSUPPORTED_HANDOFF_ENTITIES,
  type ContractorAskCategory,
  type ContractorAskSearchContext,
} from "./allowlist";

const ALLOW = new Set<string>(ASK_HANDOFF_KEYS);
const FORBIDDEN = new Set<string>(ASK_HANDOFF_FORBIDDEN_KEYS);
const ENTITY_OK = new Set<string>(CONTRACTOR_ENTITY_ALIASES);
const ENTITY_BAD = new Set<string>(UNSUPPORTED_HANDOFF_ENTITIES);
const CATS = new Set<string>(FLORIDA_HANDOFF_CATEGORIES);
const CAT_BAD = new Set<string>(UNSUPPORTED_HANDOFF_CATEGORIES);

const CATEGORY_ALIASES: Record<string, ContractorAskCategory> = {
  roofing: "roofing",
  roofers: "roofing",
  roofer: "roofing",
  plumbing: "plumbing",
  plumber: "plumbing",
  plumbers: "plumbing",
  hvac: "hvac",
  air_conditioning: "hvac",
  airconditioning: "hvac",
  ac: "hvac",
  pool: "pool",
  pool_spa: "pool",
  poolspa: "pool",
  general_contractor: "general_contractor",
  general_contractors: "general_contractor",
  gc: "general_contractor",
  cgc: "general_contractor",
};

const ENTITY_CATEGORY: Record<string, ContractorAskCategory> = {
  roofer: "roofing",
  plumber: "plumbing",
  hvac_contractor: "hvac",
  pool_contractor: "pool",
  general_contractor: "general_contractor",
};

function firstString(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  if (input instanceof URLSearchParams) {
    const v = input.get(key);
    return v == null ? undefined : v;
  }
  const raw = input[key];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export function slugish(value: string, max = 64): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

function titleCity(value: string): string | undefined {
  const cleaned = value
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return undefined;
  if (cleaned.includes("..")) return undefined;
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 64);
}

export function parseContractorAskHandoff(
  input: string | URLSearchParams | Record<string, string | string[] | undefined>
): ContractorAskSearchContext | null {
  const params =
    typeof input === "string" ? new URLSearchParams(input.replace(/^\?/, "")) : input;

  const src = (firstString(params, "src") || "").trim().toLowerCase();
  if (src !== "ask") return null;

  const ctx: ContractorAskSearchContext = { source: "ask" };

  for (const key of ASK_HANDOFF_KEYS) {
    if (key === "src") continue;
    if (FORBIDDEN.has(key)) continue;
    if (!ALLOW.has(key)) continue;
    const raw = firstString(params, key);
    if (raw == null) continue;
    const v = String(raw).trim();
    if (!v) continue;
    if (v.toLowerCase() === "unknown" && key !== "entity" && key !== "category") continue;

    if (key === "zip") {
      if (/^\d{5}$/.test(v)) ctx.zip = v;
      continue;
    }
    if (key === "state") {
      const st = uspsState(v);
      if (st) ctx.state = st;
      continue;
    }
    if (key === "county") {
      const c = slugish(v.replace(/\s+county$/i, ""));
      if (c && !c.includes("..")) ctx.county = c;
      continue;
    }
    if (key === "city") {
      const city = titleCity(v);
      if (city) ctx.city = city;
      continue;
    }
    if (key === "entity") {
      const ent = slugish(v).replace(/-/g, "_");
      if (ENTITY_OK.has(ent)) {
        ctx.entityType = "contractor";
        const inferred = ENTITY_CATEGORY[ent];
        if (inferred && !ctx.category) ctx.category = inferred;
      } else if (ENTITY_BAD.has(ent) || ent) {
        ctx.unsupportedEntity = (ent || v).slice(0, 64);
      }
      continue;
    }
    if (key === "category") {
      const cat = slugish(v).replace(/-/g, "_");
      const mapped = CATEGORY_ALIASES[cat];
      if (mapped && CATS.has(mapped)) ctx.category = mapped;
      else ctx.unsupportedCategory = (CAT_BAD.has(cat) ? cat : cat || v).slice(0, 64);
      continue;
    }
    if (key === "intent") {
      ctx.intent = slugish(v, 32).replace(/-/g, "_") || undefined;
      continue;
    }
    if (key === "journey") {
      ctx.journey = slugish(v, 32).replace(/-/g, "_") || undefined;
      continue;
    }
    if (key === "sid") {
      if (/^[a-zA-Z0-9_-]{1,64}$/.test(v)) ctx.sid = v;
    }
  }

  if (!ctx.entityType && !ctx.unsupportedEntity && ctx.category) {
    ctx.entityType = "contractor";
  }

  return ctx;
}

export function serializeContractorAskHandoff(ctx: ContractorAskSearchContext): string {
  const p = new URLSearchParams();
  p.set("src", "ask");
  if (ctx.journey) p.set("journey", ctx.journey);
  if (ctx.state) p.set("state", ctx.state);
  if (ctx.county) p.set("county", ctx.county);
  if (ctx.intent) p.set("intent", ctx.intent);
  if (ctx.entityType) p.set("entity", ctx.entityType);
  else if (ctx.unsupportedEntity) p.set("entity", ctx.unsupportedEntity);
  if (ctx.category) p.set("category", ctx.category);
  else if (ctx.unsupportedCategory) p.set("category", ctx.unsupportedCategory);
  if (ctx.city) p.set("city", slugish(ctx.city));
  if (ctx.zip) p.set("zip", ctx.zip);
  if (ctx.sid) p.set("sid", ctx.sid);
  return p.toString();
}

export function withContractorAskParams(path: string, ctx: ContractorAskSearchContext): string {
  const q = serializeContractorAskHandoff(ctx);
  const [base, existing] = path.split("?");
  if (!base?.startsWith("/") || base.startsWith("//")) return `/?${q}`;
  if (existing) {
    const merged = new URLSearchParams(existing);
    for (const [k, v] of new URLSearchParams(q)) merged.set(k, v);
    for (const bad of FORBIDDEN) merged.delete(bad);
    return `${base}?${merged.toString()}`;
  }
  return `${base}?${q}`;
}

export function hasForbiddenHandoffKey(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): boolean {
  const keys = input instanceof URLSearchParams ? [...input.keys()] : Object.keys(input);
  return keys.some((k) => FORBIDDEN.has(k.toLowerCase()));
}

export function isAskHandoffRequest(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): boolean {
  return parseContractorAskHandoff(input) !== null;
}
