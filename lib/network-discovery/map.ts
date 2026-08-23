import { PRODUCTION_SITE_URL } from "@/lib/site";
import { FLORIDA_COUNTIES } from "@/lib/discovery/counties";
import { FLORIDA_TRADES } from "@/lib/discovery/trades";
import { categoriesFromOccupationCodes } from "./trades";
import { uspsState } from "./geo";
import type { ContractorSourceRow, NetworkDiscoveryEntity } from "./types";

export function buildContractorNetworkId(id: string): string {
  return `contractor:${id}`;
}

export function buildCanonicalProfileUrl(slug: string): string {
  return `${PRODUCTION_SITE_URL}/contractors/${encodeURIComponent(slug)}`;
}

function countySlugFromName(name: string | null | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  const lower = name.trim().toLowerCase();
  const hit = FLORIDA_COUNTIES.find(
    (c) =>
      c.matchNames.some((n) => n.toLowerCase() === lower) ||
      c.slug === lower.replace(/\s+/g, "-")
  );
  return hit?.slug;
}

function flTradeSlug(category: string): string | undefined {
  if (category === "roofing") return "roofers";
  if (category === "plumbing") return "plumbing";
  if (category === "hvac") return "air-conditioning";
  if (category === "pool") return "pool-spa";
  if (category === "general_contractor") return "general-contractors";
  return undefined;
}

function regulatorySummary(row: ContractorSourceRow): string {
  const src = row.sourceSystems[0] || "";
  const active = row.licenseStatuses.some((s) => s === "active" || s === "current");
  if (src === "fl_dbpr" && active) return "Florida DBPR construction license on file (active)";
  if (src === "nj_dca" && active) return "New Jersey contractor credential on file (active)";
  if (src.startsWith("tx_") && active) return "Texas specialty trade credential on file (active)";
  if (active) return "Published contractor credential on file (active)";
  return "Published contractor credential on file";
}

/**
 * Company → discovery entity.
 *
 * Physical city/county/state come from the contractor shell / license address.
 * Service areas are omitted: this product has no verified service-territory graph,
 * and office/license jurisdiction must not be flattened into "serves county X".
 */
export function mapContractorToDiscovery(
  row: ContractorSourceRow,
  opts?: { sourceVersion?: string; updatedAt?: string }
): NetworkDiscoveryEntity | null {
  const categories = categoriesFromOccupationCodes(row.occupationCodes);
  if (!categories.length) return null;
  const state =
    uspsState(row.physicalState) ||
    uspsState(row.homeState) ||
    uspsState(row.licenseStates[0]);
  const city = row.primaryCity || row.licenseCities[0] || undefined;
  const county = row.primaryCounty || row.licenseCounties[0] || undefined;
  const zip = row.postalCode?.replace(/\D/g, "").slice(0, 5) || undefined;

  const countySlug = countySlugFromName(county);
  const tradeSlug = flTradeSlug(categories[0]!);
  const canonical_search_url =
    state === "FL" && countySlug && tradeSlug
      ? `${PRODUCTION_SITE_URL}/florida/${countySlug}/${tradeSlug}`
      : `${PRODUCTION_SITE_URL}/verify`;

  const search_terms = [
    row.displayName,
    row.slug.replace(/-/g, " "),
    ...categories,
    city,
    county,
    state,
    ...row.occupationCodes,
    ...row.licenseCounties,
    ...row.licenseCities,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  const entity: NetworkDiscoveryEntity = {
    network_entity_id: buildContractorNetworkId(row.id),
    hub: "contractor",
    source_entity_id: row.slug,
    entity_type: "contractor",
    display_name: row.displayName.trim(),
    city,
    county,
    state,
    zip: zip && zip.length === 5 ? zip : undefined,
    categories,
    regulatory_status_summary: regulatorySummary(row),
    trust_report_available: true,
    canonical_profile_url: buildCanonicalProfileUrl(row.slug),
    canonical_search_url,
    search_terms: [...new Set(search_terms)],
    discovery_status: "active",
    source_version: opts?.sourceVersion,
    updated_at: opts?.updatedAt,
  };
  const legal = row.legalName?.trim();
  if (legal) entity.legal_name = legal;
  return entity;
}

export function floridaTradeForCategory(category: string) {
  const slug = flTradeSlug(category);
  return slug ? FLORIDA_TRADES.find((t) => t.slug === slug) : undefined;
}
