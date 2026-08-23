import type { NetworkDiscoveryEntity, PilotExportManifest } from "./types";
import { ASK_CONTRACTOR_CATEGORIES, ASK_TRADE_META } from "./trades";
import { USPS_STATES } from "./geo";

export type ValidationIssue = { path: string; message: string };

const FORBIDDEN = [
  "email",
  "phone",
  "consumer_email",
  "premium",
  "paid_rank",
  "trust_score",
  "overall_rating",
  "review_count",
  "google_data",
];

const CATS = new Set<string>(ASK_CONTRACTOR_CATEGORIES);

export function validateDiscoveryEntity(e: NetworkDiscoveryEntity, path = "entity"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!e.network_entity_id?.startsWith("contractor:")) {
    issues.push({ path: `${path}.network_entity_id`, message: "must start with contractor:" });
  }
  if (e.hub !== "contractor") issues.push({ path: `${path}.hub`, message: "must be contractor" });
  if (e.entity_type !== "contractor") issues.push({ path: `${path}.entity_type`, message: "must be contractor" });
  if (!e.display_name?.trim()) issues.push({ path: `${path}.display_name`, message: "required" });
  if (!e.source_entity_id) issues.push({ path: `${path}.source_entity_id`, message: "required" });
  if (!(e.categories || []).length) issues.push({ path: `${path}.categories`, message: "at least one trade" });
  if (e.state && !USPS_STATES.has(e.state)) {
    issues.push({ path: `${path}.state`, message: `not a USPS state: ${e.state}` });
  }
  for (const c of e.categories || []) {
    if (!CATS.has(c)) issues.push({ path: `${path}.categories`, message: `unsupported ${c}` });
    const meta = ASK_TRADE_META[c as keyof typeof ASK_TRADE_META];
    if (meta?.readiness === "UNSUPPORTED") {
      issues.push({ path: `${path}.categories`, message: `unsupported trade ${c}` });
    }
  }
  try {
    const u = new URL(e.canonical_profile_url);
    if (u.protocol !== "https:") issues.push({ path: `${path}.canonical_profile_url`, message: "https required" });
    if (u.hostname !== "www.contractortrusthub.com") {
      issues.push({ path: `${path}.canonical_profile_url`, message: `host ${u.hostname}` });
    }
    if (!u.pathname.startsWith("/contractors/")) {
      issues.push({ path: `${path}.canonical_profile_url`, message: "path must be /contractors/{slug}" });
    }
    if ([...u.searchParams.keys()].length > 0) {
      issues.push({ path: `${path}.canonical_profile_url`, message: "no query params" });
    }
  } catch {
    issues.push({ path: `${path}.canonical_profile_url`, message: "malformed" });
  }
  if (e.canonical_search_url) {
    try {
      const s = new URL(e.canonical_search_url);
      if (s.protocol !== "https:") {
        issues.push({ path: `${path}.canonical_search_url`, message: "https required" });
      }
      if (s.hostname !== "www.contractortrusthub.com") {
        issues.push({ path: `${path}.canonical_search_url`, message: `host ${s.hostname}` });
      }
      if (s.hostname.includes("localhost") || s.hostname.includes("vercel.app")) {
        issues.push({ path: `${path}.canonical_search_url`, message: "preview/localhost host" });
      }
      if ([...s.searchParams.keys()].length > 0) {
        issues.push({ path: `${path}.canonical_search_url`, message: "no query params" });
      }
    } catch {
      issues.push({ path: `${path}.canonical_search_url`, message: "malformed" });
    }
  }
  for (const bad of FORBIDDEN) {
    if (Object.prototype.hasOwnProperty.call(e, bad)) {
      issues.push({ path: `${path}.${bad}`, message: "forbidden field" });
    }
  }
  return issues;
}

export function validateDiscoveryExport(entities: NetworkDiscoveryEntity[]): {
  ok: boolean;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]!;
    issues.push(...validateDiscoveryEntity(e, `entities[${i}]`));
    if (seen.has(e.network_entity_id)) {
      issues.push({ path: `entities[${i}].network_entity_id`, message: "duplicate" });
    }
    seen.add(e.network_entity_id);
  }
  for (let i = 1; i < entities.length; i++) {
    if (entities[i]!.network_entity_id < entities[i - 1]!.network_entity_id) {
      issues.push({ path: "entities", message: "must be sorted by network_entity_id" });
      break;
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validatePilotManifest(m: PilotExportManifest): {
  ok: boolean;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  if (m.schema_version !== "ask-network-discovery-v1") {
    issues.push({ path: "schema_version", message: "must be ask-network-discovery-v1" });
  }
  if (m.hub !== "contractor") issues.push({ path: "hub", message: "must be contractor" });
  if (m.entity_count !== m.entities.length) {
    issues.push({ path: "entity_count", message: "must equal entities.length" });
  }
  if (m.fingerprint !== m.content_fingerprint) {
    issues.push({ path: "fingerprint", message: "must match content_fingerprint" });
  }
  issues.push(...validateDiscoveryExport(m.entities).issues);
  return { ok: issues.length === 0, issues };
}
