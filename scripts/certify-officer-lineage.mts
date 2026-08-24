import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Pool } from "pg";
import { principalKeysFromEntities } from "../lib/contractors/entity-lineage";
import type { EntityDetail } from "../lib/contractors/types";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 1_000,
  allowExitOnIdle: true,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

type PlanNode = {
  "Node Type": string;
  "Index Name"?: string;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  "Rows Removed by Filter"?: number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
  Plans?: PlanNode[];
};
function planSummary(root: PlanNode) {
  const nodes: string[] = [];
  const indexes = new Set<string>();
  let rows = 0;
  let removed = 0;
  let hits = 0;
  let reads = 0;
  const visit = (node: PlanNode) => {
    nodes.push(node["Node Type"]);
    if (node["Index Name"]) indexes.add(node["Index Name"]);
    rows += (node["Actual Rows"] || 0) * (node["Actual Loops"] || 1);
    removed += node["Rows Removed by Filter"] || 0;
    hits += node["Shared Hit Blocks"] || 0;
    reads += node["Shared Read Blocks"] || 0;
    node.Plans?.forEach(visit);
  };
  visit(root);
  return { nodes: [...new Set(nodes)], indexes: [...indexes], rows, removed, hits, reads };
}

try {
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL lock_timeout = '2s'");
  await client.query("SET LOCAL statement_timeout = '120s'");

  const reconciliation = await client.query<{
    linked_entities: string;
    source_elements: string;
    valid_elements: string;
    invalid_elements: string;
    lookup_rows: string;
    missing_rows: string;
    extra_rows: string;
  }>(`
    WITH linked AS (
      SELECT DISTINCT e.id, e.officers
      FROM entities e
      JOIN contractor_entities ce ON ce.entity_id = e.id
      WHERE e.source_system = 'fl_sunbiz'
        AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
        AND ce.confidence >= 0.90
    ), source_rows AS (
      SELECT l.id AS entity_id, officer.ordinality::int - 1 AS source_ordinal,
             officer.item->>'name' AS officer_name_raw,
             normalize_entity_officer_name(officer.item->>'name') AS officer_name_normalized,
             NULLIF(btrim(officer.item->>'title'), '') AS officer_title,
             NULLIF(btrim(officer.item->>'type'), '') AS officer_type
      FROM linked l
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(l.officers) = 'array' THEN l.officers ELSE '[]'::jsonb END
      ) WITH ORDINALITY officer(item, ordinality)
      WHERE jsonb_typeof(officer.item) = 'object'
        AND jsonb_typeof(officer.item->'name') = 'string'
        AND normalize_entity_officer_name(officer.item->>'name') <> ''
    ), source_count AS (
      SELECT COALESCE(SUM(
        CASE WHEN jsonb_typeof(officers) = 'array' THEN jsonb_array_length(officers) ELSE 0 END
      ), 0) AS n FROM linked
    ), missing AS (
      SELECT * FROM source_rows
      EXCEPT SELECT entity_id, source_ordinal, officer_name_raw, officer_name_normalized,
                    officer_title, officer_type FROM entity_officer_lookup
    ), extra AS (
      SELECT entity_id, source_ordinal, officer_name_raw, officer_name_normalized,
             officer_title, officer_type FROM entity_officer_lookup
      EXCEPT SELECT * FROM source_rows
    )
    SELECT
      (SELECT COUNT(*) FROM linked)::text AS linked_entities,
      (SELECT n FROM source_count)::text AS source_elements,
      (SELECT COUNT(*) FROM source_rows)::text AS valid_elements,
      ((SELECT n FROM source_count) - (SELECT COUNT(*) FROM source_rows))::text AS invalid_elements,
      (SELECT COUNT(*) FROM entity_officer_lookup)::text AS lookup_rows,
      (SELECT COUNT(*) FROM missing)::text AS missing_rows,
      (SELECT COUNT(*) FROM extra)::text AS extra_rows
  `);
  console.log(`reconciliation=${JSON.stringify(reconciliation.rows[0])}`);
  assert.equal(reconciliation.rows[0].missing_rows, "0");
  assert.equal(reconciliation.rows[0].extra_rows, "0");

  const profileRows = await client.query<{
    contractor_id: string;
    slug: string;
    id: string;
    external_key: string;
    legal_name: string;
    status: string | null;
    entity_type: string | null;
    formation_date: Date | null;
    officers: unknown;
    last_verified_at: Date | null;
    match_method: string | null;
    confidence: string | null;
  }>(`
    WITH required AS (
      SELECT DISTINCT ON (requested.city, requested.occupation_code) c.id
      FROM (VALUES ('MIAMI', 'CCC'), ('TAMPA', 'CAC'), ('ORLANDO', 'CGC'))
        requested(city, occupation_code)
      JOIN licenses l ON upper(l.city) = requested.city
        AND l.occupation_code = requested.occupation_code
      JOIN contractors c ON c.id = l.contractor_id AND c.is_thin_profile = false
      ORDER BY requested.city, requested.occupation_code, c.slug
    ), corpus AS (
      SELECT id FROM required
      UNION
      SELECT c.id
      FROM contractors c
      WHERE c.is_thin_profile = false
        AND EXISTS (
          SELECT 1
          FROM contractor_entities ce
          JOIN entities e ON e.id = ce.entity_id
          WHERE ce.contractor_id = c.id
            AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
            AND ce.confidence >= 0.90
            AND e.source_system = 'fl_sunbiz'
            AND jsonb_typeof(e.officers) = 'array'
            AND jsonb_array_length(e.officers) > 0
        )
      ORDER BY id
      LIMIT 50
    )
    SELECT c.id AS contractor_id, c.slug, e.id, e.external_key, e.legal_name,
           e.status, e.entity_type, e.formation_date, e.officers, e.last_verified_at,
           ce.match_method, ce.confidence
    FROM corpus x
    JOIN contractors c ON c.id = x.id
    JOIN contractor_entities ce ON ce.contractor_id = c.id
    JOIN entities e ON e.id = ce.entity_id
    WHERE ce.role IN ('sunbiz_entity', 'linked', 'entity')
      AND ce.confidence >= 0.90
      AND e.source_system = 'fl_sunbiz'
    ORDER BY c.slug, ce.confidence DESC NULLS LAST
  `);

  const profiles = new Map<string, { ids: string[]; keys: string[] }>();
  for (const row of profileRows.rows) {
    const entity: EntityDetail = {
      id: row.id,
      externalKey: row.external_key,
      legalName: row.legal_name,
      status: row.status,
      entityType: row.entity_type,
      formationDate: row.formation_date?.toISOString() || null,
      principalAddress: null,
      city: null,
      state: null,
      postalCode: null,
      registeredAgentName: null,
      officers: Array.isArray(row.officers) ? (row.officers as EntityDetail["officers"]) : [],
      matchMethod: row.match_method,
      matchConfidence: row.confidence == null ? null : Number(row.confidence),
      lastVerifiedAt: row.last_verified_at?.toISOString() || null,
      sourceSystem: "fl_sunbiz",
    };
    const profile = profiles.get(row.contractor_id) || { ids: [], keys: [] };
    profile.ids.push(row.id);
    profile.keys = [...new Set([...profile.keys, ...principalKeysFromEntities([entity]).map((p) => p.key)])];
    profiles.set(row.contractor_id, profile);
  }
  const fixtures = [...profiles.entries()]
    .filter(([, profile]) => profile.keys.length > 0)
    .slice(0, 50)
    .map(([profileId, profile]) => ({ profileId, ...profile }));
  assert.ok(fixtures.length >= 25);
  const allKeys = [...new Set(fixtures.flatMap((fixture) => fixture.keys))];

  const oldRows = await client.query<{ profile_id: string; entity_id: string; matched_key: string }>(
    `WITH fixture AS (
       SELECT profile_id::uuid, exclude_ids::uuid[], keys::text[]
       FROM jsonb_to_recordset($1::jsonb)
         AS f(profile_id text, exclude_ids text[], keys text[])
     ), expanded AS MATERIALIZED (
       SELECT e.id AS entity_id,
         upper(trim(regexp_replace(
           regexp_replace(COALESCE(o->>'name', ''), '[.,''"/\\-]+', ' ', 'g'),
           '\\s+', ' ', 'g'
         ))) AS matched_key
       FROM contractor_entities ce
       JOIN entities e ON e.id = ce.entity_id
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.officers, '[]'::jsonb)) o
       WHERE e.source_system = 'fl_sunbiz'
         AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
         AND ce.confidence >= 0.90
     ), ranked AS (
       SELECT f.profile_id, x.entity_id, x.matched_key,
         row_number() OVER (PARTITION BY f.profile_id ORDER BY x.entity_id, x.matched_key) AS rn
       FROM fixture f
       JOIN expanded x ON x.matched_key = ANY(f.keys)
       WHERE NOT (x.entity_id = ANY(f.exclude_ids))
     )
     SELECT DISTINCT profile_id::text, entity_id::text, matched_key
     FROM ranked WHERE rn <= 40`,
    [JSON.stringify(fixtures.map((f) => ({ profile_id: f.profileId, exclude_ids: f.ids, keys: f.keys })))]
  );

  const newRows = await client.query<{ profile_id: string; entity_id: string; matched_key: string }>(
    `WITH fixture AS (
       SELECT profile_id::uuid, exclude_ids::uuid[], keys::text[]
       FROM jsonb_to_recordset($1::jsonb)
         AS f(profile_id text, exclude_ids text[], keys text[])
     ), ranked AS (
       SELECT f.profile_id, lookup.entity_id,
              lookup.officer_name_normalized AS matched_key,
         row_number() OVER (
           PARTITION BY f.profile_id
           ORDER BY lookup.entity_id, lookup.officer_name_normalized
         ) AS rn
       FROM fixture f
       JOIN entity_officer_lookup lookup
         ON lookup.officer_name_normalized = ANY(f.keys)
       WHERE NOT (lookup.entity_id = ANY(f.exclude_ids))
     )
     SELECT DISTINCT profile_id::text, entity_id::text, matched_key
     FROM ranked WHERE rn <= 40`,
    [JSON.stringify(fixtures.map((f) => ({ profile_id: f.profileId, exclude_ids: f.ids, keys: f.keys })))]
  );
  const key = (row: { profile_id: string; entity_id: string; matched_key: string }) =>
    `${row.profile_id}|${row.entity_id}|${row.matched_key}`;
  const oldSet = new Set(oldRows.rows.map(key));
  const newSet = new Set(newRows.rows.map(key));
  const differences = [...oldSet].filter((x) => !newSet.has(x)).length +
    [...newSet].filter((x) => !oldSet.has(x)).length;
  const exactProfiles = fixtures.filter((fixture) => {
    const prefix = `${fixture.profileId}|`;
    const oldProfile = [...oldSet].filter((x) => x.startsWith(prefix));
    const newProfile = [...newSet].filter((x) => x.startsWith(prefix));
    return oldProfile.length === newProfile.length && oldProfile.every((x) => newSet.has(x));
  }).length;
  console.log(`parity profiles=${fixtures.length} exact=${exactProfiles} differences=${differences}`);
  assert.equal(exactProfiles, fixtures.length);
  assert.equal(differences, 0);

  const sample = fixtures.find((fixture) => fixture.keys.length > 0)!;
  const planRuns: number[] = [];
  let finalPlanSummary: ReturnType<typeof planSummary> | undefined;
  let planning = 0;
  for (let i = 0; i < 10; i += 1) {
    const started = performance.now();
    const explained = await client.query<{
      "QUERY PLAN": [{ Plan: PlanNode; "Planning Time": number; "Execution Time": number }];
    }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT DISTINCT ON (e.id, lookup.officer_name_normalized)
         e.id, lookup.officer_name_normalized
       FROM entity_officer_lookup lookup
       JOIN entities e ON e.id = lookup.entity_id
       JOIN contractor_entities ce ON ce.entity_id = e.id
       WHERE e.source_system = 'fl_sunbiz'
         AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
         AND ce.confidence >= 0.90
         AND NOT (e.id = ANY($1::uuid[]))
         AND lookup.officer_name_normalized = ANY($2::text[])
       ORDER BY e.id, lookup.officer_name_normalized
       LIMIT 40`,
      [sample.ids, sample.keys]
    );
    const plan = explained.rows[0]["QUERY PLAN"][0];
    planRuns.push(plan["Execution Time"] || performance.now() - started);
    planning = plan["Planning Time"];
    finalPlanSummary = planSummary(plan.Plan);
  }
  planRuns.sort((a, b) => a - b);
  const median = planRuns[Math.floor(planRuns.length / 2)];
  const p95 = planRuns[Math.ceil(planRuns.length * 0.95) - 1];
  console.log(
    `post_plan planning_ms=${planning} median_ms=${median} p95_ms=${p95} summary=${JSON.stringify(finalPlanSummary)}`
  );
  assert.ok(finalPlanSummary?.indexes.includes("entity_officer_lookup_name_entity_idx"));
  assert.ok(!finalPlanSummary?.nodes.includes("Function Scan"));
  assert.ok(p95 < 8_000);
  await client.query("ROLLBACK");

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const entity = await client.query<{ id: string }>(`
      SELECT entity_id AS id FROM entity_officer_lookup LIMIT 1
    `);
    const synthetic = "Consistency Verification Person QXZ";
    await client.query(
      `UPDATE entities SET officers = officers || jsonb_build_array(
         jsonb_build_object('name', $2::text, 'title', 'TEST', 'type', 'Officer')
       ) WHERE id = $1`,
      [entity.rows[0].id, synthetic]
    );
    const reflected = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM entity_officer_lookup
       WHERE entity_id = $1 AND officer_name_normalized = normalize_entity_officer_name($2)`,
      [entity.rows[0].id, synthetic]
    );
    assert.equal(reflected.rows[0].n, "1");
    await client.query("ROLLBACK");
    console.log("future_sync=PASS transaction_rolled_back=yes");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
} finally {
  client.release();
  await pool.end();
}
