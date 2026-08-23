import { query, queryOne } from "@/lib/db";
import type { ContractorSourceRow } from "./types";

type RawRow = {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string | null;
  primary_city: string | null;
  primary_county: string | null;
  home_state: string | null;
  occupation_code: string | null;
  status_normalized: string | null;
  source_system: string | null;
  city: string | null;
  county_name: string | null;
  postal_code: string | null;
  license_state: string | null;
};

/**
 * Equality filters only — occupation_code btree + optional county_code / city.
 * Wide OR predicates and COUNT(DISTINCT) time out on this catalog.
 */
const SLICES: {
  source: string;
  occupation: string;
  countyCode?: string;
  city?: string;
  licenseState?: string;
}[] = [
  { source: "fl_dbpr", occupation: "CCC", countyCode: "23" },
  { source: "fl_dbpr", occupation: "CCC", city: "MIAMI" },
  { source: "fl_dbpr", occupation: "CCC", countyCode: "16" },
  { source: "fl_dbpr", occupation: "RR", countyCode: "23" },
  { source: "fl_dbpr", occupation: "CFC", countyCode: "60" },
  { source: "fl_dbpr", occupation: "CFC", countyCode: "23" },
  { source: "fl_dbpr", occupation: "CAC", countyCode: "39" },
  { source: "fl_dbpr", occupation: "CAC", city: "TAMPA" },
  { source: "fl_dbpr", occupation: "CGC", countyCode: "58" },
  { source: "fl_dbpr", occupation: "CGC", city: "ORLANDO" },
  { source: "fl_dbpr", occupation: "CPC", countyCode: "23" },
  { source: "fl_dbpr", occupation: "CPC", countyCode: "16" },
  { source: "nj_dca", occupation: "PLB", licenseState: "NJ" },
  { source: "nj_dca", occupation: "HVAC", licenseState: "NJ" },
  { source: "nj_dca", occupation: "ELE", licenseState: "NJ" },
  { source: "nj_dca", occupation: "HIC", licenseState: "NJ" },
];

function mergeRow(into: Map<string, ContractorSourceRow>, r: RawRow) {
  const city = r.primary_city || r.city;
  const county = r.primary_county || r.county_name;
  const add = (arr: string[], v: string | null | undefined) => {
    if (v && !arr.includes(v)) arr.push(v);
  };
  const cur = into.get(r.id);
  if (!cur) {
    into.set(r.id, {
      id: r.id,
      slug: r.slug,
      displayName: r.display_name,
      legalName: r.legal_name,
      occupationCodes: r.occupation_code ? [r.occupation_code] : [],
      licenseStatuses: r.status_normalized ? [r.status_normalized] : [],
      licenseStates: r.license_state ? [r.license_state] : r.home_state ? [r.home_state] : [],
      licenseCities: city ? [city] : [],
      licenseCounties: county ? [county] : [],
      sourceSystems: r.source_system ? [r.source_system] : [],
      homeState: r.home_state,
      physicalState: r.license_state || r.home_state,
      primaryCity: city,
      primaryCounty: county,
      postalCode: r.postal_code,
      licenseCount: 1,
    });
    return;
  }
  add(cur.occupationCodes, r.occupation_code);
  add(cur.licenseStatuses, r.status_normalized);
  add(cur.licenseStates, r.license_state || r.home_state);
  add(cur.licenseCities, city);
  add(cur.licenseCounties, county);
  add(cur.sourceSystems, r.source_system);
  if (!cur.physicalState && (r.license_state || r.home_state)) {
    cur.physicalState = r.license_state || r.home_state;
  }
  cur.licenseCount += 1;
}

async function loadEq(slice: (typeof SLICES)[number]): Promise<RawRow[]> {
  const clauses = [
    "l.source_system = $1",
    "l.occupation_code = $2",
    "l.status_normalized IN ('active', 'current')",
    "c.is_thin_profile = FALSE",
    "COALESCE(c.slug, '') <> ''",
  ];
  const params: unknown[] = [slice.source, slice.occupation];
  if (slice.countyCode) {
    params.push(slice.countyCode);
    clauses.push(`l.county_code = $${params.length}`);
  }
  if (slice.licenseState) {
    params.push(slice.licenseState.toUpperCase());
    clauses.push(`l.state = $${params.length}`);
  }
  if (slice.city) {
    params.push(slice.city.toLowerCase());
    clauses.push(`LOWER(TRIM(l.city)) = $${params.length}`);
  }
  params.push(40);
  try {
    return await query<RawRow>(
      `
      SELECT
        c.id, c.slug, c.display_name, c.legal_name,
        c.primary_city, c.primary_county, c.home_state,
        l.occupation_code, l.status_normalized, l.source_system,
        l.city, l.county_name, l.postal_code, l.state AS license_state
      FROM licenses l
      JOIN contractors c ON c.id = l.contractor_id
      WHERE ${clauses.join(" AND ")}
      LIMIT $${params.length}
      `,
      params,
      { statementTimeoutMs: 12_000 }
    );
  } catch (err) {
    console.error(
      "[discovery-pilot] slice failed",
      slice.occupation,
      slice.countyCode || slice.city || slice.licenseState || "",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

async function countOrNeg1(sql: string): Promise<number> {
  try {
    const row = await queryOne<{ n: string }>(sql, [], { statementTimeoutMs: 6_000 });
    return Number(row?.n || 0);
  } catch {
    return -1;
  }
}

export async function loadCatalogEstimates(): Promise<{
  contractors_reltuples: number;
  licenses_reltuples: number;
  public_fl: number;
  public_nj: number;
  thin_profiles: number;
}> {
  let contractors_reltuples = 0;
  let licenses_reltuples = 0;
  try {
    const rows = await query<{ relname: string; est: string }>(
      `
      SELECT relname, reltuples::bigint::text AS est
      FROM pg_class
      WHERE relname IN ('contractors', 'licenses')
      `,
      [],
      { statementTimeoutMs: 4_000 }
    );
    const map = Object.fromEntries(rows.map((r) => [r.relname, Number(r.est)]));
    contractors_reltuples = map.contractors || 0;
    licenses_reltuples = map.licenses || 0;
  } catch {
    /* catalog estimates unavailable */
  }
  const [public_fl, public_nj] = await Promise.all([
    countOrNeg1(
      `SELECT COUNT(*)::text AS n FROM contractors WHERE home_state = 'FL' AND is_thin_profile = FALSE`
    ),
    countOrNeg1(
      `SELECT COUNT(*)::text AS n FROM contractors WHERE home_state = 'NJ' AND is_thin_profile = FALSE`
    ),
  ]);
  return {
    contractors_reltuples,
    licenses_reltuples,
    public_fl,
    public_nj,
    thin_profiles: -1,
  };
}

export async function loadContractorDiscoveryRows(): Promise<{
  rows: ContractorSourceRow[];
  considered: number;
}> {
  const byId = new Map<string, ContractorSourceRow>();
  for (const slice of SLICES) {
    for (const r of await loadEq(slice)) mergeRow(byId, r);
  }
  const rows = [...byId.values()]
    .filter((r) => r.slug && r.displayName)
    .sort((a, b) => a.id.localeCompare(b.id));
  return { rows, considered: rows.length };
}
