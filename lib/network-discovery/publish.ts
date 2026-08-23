import { loadCatalogEstimates, loadContractorDiscoveryRows } from "./load";
import { mapContractorToDiscovery } from "./map";
import { selectContractorPilot } from "./cohort";
import { contentFingerprint } from "./fingerprint";
import { validatePilotManifest } from "./validate";
import { auditContractorQueryReadiness, queryMatchCounts } from "./query-readiness";
import type { PilotExportManifest } from "./types";

export const PILOT_ARTIFACT = "contractor-discovery-pilot.v1.json";

export async function publishContractorDiscoveryPilot(): Promise<{
  manifest: PilotExportManifest;
  validationOk: boolean;
  validationIssues: { path: string; message: string }[];
  timings_ms: Record<string, number>;
  catalog_estimates: {
    contractors_reltuples: number;
    licenses_reltuples: number;
    public_fl: number;
    public_nj: number;
    thin_profiles: number;
  };
}> {
  const timings: Record<string, number> = {};
  const t0 = performance.now();

  const tLoad = performance.now();
  const { rows, considered } = await loadContractorDiscoveryRows();
  const catalog = await loadCatalogEstimates();
  timings.load_ms = performance.now() - tLoad;

  const tNorm = performance.now();
  const generatedAt = new Date().toISOString();
  const sourceVersion = "contractors+licenses#discovery-pilot";
  const mapped = rows
    .map((r) => mapContractorToDiscovery(r, { sourceVersion, updatedAt: generatedAt }))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  timings.normalize_ms = performance.now() - tNorm;

  const tElig = performance.now();
  const eligible = mapped.filter((e) => {
    if (!e.canonical_profile_url.startsWith("https://www.contractortrusthub.com/contractors/")) {
      return false;
    }
    if (!(e.categories || []).length) return false;
    if (!e.state && !(e.city || e.county)) return false;
    return true;
  });
  timings.eligibility_ms = performance.now() - tElig;

  const tCohort = performance.now();
  const pilot = selectContractorPilot(eligible);
  timings.cohort_ms = performance.now() - tCohort;

  const category_breakdown: Record<string, number> = {};
  const states: Record<string, number> = {};
  let with_county = 0;
  let with_city = 0;
  for (const e of pilot) {
    for (const c of e.categories || []) category_breakdown[c] = (category_breakdown[c] || 0) + 1;
    if (e.state) states[e.state] = (states[e.state] || 0) + 1;
    if (e.county) with_county++;
    if (e.city) with_city++;
  }

  const ids = pilot.map((e) => e.network_entity_id);
  const duplicate_network_ids = ids.length - new Set(ids).size;
  const multi_license_companies = rows.filter(
    (r) => r.licenseCount > 1 && ids.includes(`contractor:${r.id}`)
  ).length;

  const fingerprint = contentFingerprint(pilot);
  const manifest: PilotExportManifest = {
    schema_version: "ask-network-discovery-v1",
    hub: "contractor",
    generated_at: generatedAt,
    source_version: sourceVersion,
    source_path: "public.contractors + public.licenses",
    pilot_label: "PILOT / NOT YET CONSUMED BY ASK PRODUCTION",
    amendment: "ASK-SEARCH-CONTRACTOR-001.1",
    cohort_algorithm:
      "UUID-sorted round-robin by stratum `${state}|${first_category}`; queries do not choose membership",
    entity_count: pilot.length,
    fingerprint,
    content_fingerprint: fingerprint,
    eligibility: {
      considered,
      eligible: eligible.length,
      ineligible: considered - eligible.length,
      pilot_selected: pilot.length,
    },
    category_breakdown,
    geography: { states, with_county, with_city },
    query_readiness: {
      mode: "observational",
      note: "Queries evaluate the cohort; they do not choose the cohort.",
      pilot: auditContractorQueryReadiness(pilot),
      eligible_universe: auditContractorQueryReadiness(eligible),
      counts: {
        pilot: queryMatchCounts(pilot),
        eligible_universe: queryMatchCounts(eligible),
      },
    },
    identity: {
      source_ids: considered,
      network_ids: ids.length,
      duplicate_network_ids,
      multi_license_companies,
      identity_collisions: duplicate_network_ids,
    },
    entities: pilot,
  };

  const tVal = performance.now();
  const validation = validatePilotManifest(manifest);
  timings.validation_ms = performance.now() - tVal;
  timings.total_ms = performance.now() - t0;

  return {
    manifest,
    validationOk: validation.ok,
    validationIssues: validation.issues,
    catalog_estimates: catalog,
    timings_ms: Object.fromEntries(
      Object.entries(timings).map(([k, v]) => [k, Number(v.toFixed(3))])
    ),
  };
}
