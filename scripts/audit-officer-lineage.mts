import { Pool } from "pg";
import { normalizeOfficerKey, principalKeysFromEntities } from "../lib/contractors/entity-lineage";
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

type PlanNode = {
  "Node Type": string;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  "Rows Removed by Filter"?: number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
  Plans?: PlanNode[];
};

function summarizePlan(node: PlanNode): Record<string, number> {
  const out: Record<string, number> = {};
  const visit = (n: PlanNode) => {
    out[`node:${n["Node Type"]}`] = (out[`node:${n["Node Type"]}`] || 0) + 1;
    out.actual_rows = (out.actual_rows || 0) + (n["Actual Rows"] || 0) * (n["Actual Loops"] || 1);
    out.rows_removed = (out.rows_removed || 0) + (n["Rows Removed by Filter"] || 0);
    out.shared_hits = (out.shared_hits || 0) + (n["Shared Hit Blocks"] || 0);
    out.shared_reads = (out.shared_reads || 0) + (n["Shared Read Blocks"] || 0);
    n.Plans?.forEach(visit);
  };
  visit(node);
  return out;
}

const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL lock_timeout = '2s'");
  await client.query("SET LOCAL statement_timeout = '120s'");

  const counts = await client.query<{
    entities: string;
    with_officers: string;
    officer_elements: string;
  }>(`
    SELECT
      COUNT(*)::text AS entities,
      COUNT(*) FILTER (
        WHERE jsonb_typeof(officers) = 'array' AND jsonb_array_length(officers) > 0
      )::text AS with_officers,
      COALESCE(SUM(
        CASE WHEN jsonb_typeof(officers) = 'array' THEN jsonb_array_length(officers) ELSE 0 END
      ), 0)::text AS officer_elements
    FROM entities
  `);
  console.log(`counts=${JSON.stringify(counts.rows[0])}`);

  const linkedCounts = await client.query<{
    linked_entities: string;
    linked_with_officers: string;
    linked_officer_elements: string;
  }>(`
    WITH linked AS (
      SELECT DISTINCT e.id, e.officers
      FROM contractor_entities ce
      JOIN entities e ON e.id = ce.entity_id
      WHERE e.source_system = 'fl_sunbiz'
        AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
        AND ce.confidence IS NOT NULL
        AND ce.confidence >= 0.90
    )
    SELECT
      COUNT(*)::text AS linked_entities,
      COUNT(*) FILTER (
        WHERE jsonb_typeof(officers) = 'array' AND jsonb_array_length(officers) > 0
      )::text AS linked_with_officers,
      COALESCE(SUM(
        CASE WHEN jsonb_typeof(officers) = 'array' THEN jsonb_array_length(officers) ELSE 0 END
      ), 0)::text AS linked_officer_elements
    FROM linked
  `);
  console.log(`linked_counts=${JSON.stringify(linkedCounts.rows[0])}`);

  const shapes = await client.query<{ object_type: string; keys: string; rows: string }>(`
    WITH sampled_entities AS (
      SELECT officers
      FROM entities
      WHERE jsonb_typeof(officers) = 'array' AND jsonb_array_length(officers) > 0
      LIMIT 10000
    )
    SELECT
      jsonb_typeof(officer) AS object_type,
      COALESCE((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(
        CASE WHEN jsonb_typeof(officer) = 'object' THEN officer ELSE '{}'::jsonb END
      ) k), '') AS keys,
      COUNT(*)::text AS rows
    FROM sampled_entities e
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(e.officers) = 'array' THEN e.officers ELSE '[]'::jsonb END
    ) officer
    GROUP BY 1, 2
    ORDER BY COUNT(*) DESC
  `);
  console.log(`officer_shapes=${JSON.stringify(shapes.rows)}`);

  const fixtures = await client.query<{
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
    WITH requested(city, occupation_code) AS (
      VALUES ('MIAMI', 'CCC'), ('TAMPA', 'CAC'), ('ORLANDO', 'CGC')
    ), picked AS (
      SELECT DISTINCT ON (r.city, r.occupation_code)
        r.city, r.occupation_code, c.id, c.slug
      FROM requested r
      JOIN licenses l ON upper(l.city) = r.city AND l.occupation_code = r.occupation_code
      JOIN contractors c ON c.id = l.contractor_id AND c.is_thin_profile = false
      ORDER BY r.city, r.occupation_code, c.slug
    )
    SELECT p.slug, e.id, e.external_key, e.legal_name, e.status, e.entity_type,
           e.formation_date, e.officers, e.last_verified_at, ce.match_method, ce.confidence
    FROM picked p
    JOIN contractor_entities ce ON ce.contractor_id = p.id
    JOIN entities e ON e.id = ce.entity_id
    WHERE ce.role IN ('sunbiz_entity', 'linked', 'entity')
      AND e.source_system = 'fl_sunbiz'
      AND ce.confidence >= 0.90
    ORDER BY p.slug, ce.confidence DESC NULLS LAST
  `);

  const bySlug = new Map<string, EntityDetail[]>();
  for (const row of fixtures.rows) {
    const list = bySlug.get(row.slug) || [];
    list.push({
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
    });
    bySlug.set(row.slug, list);
  }

  for (const [slug, entities] of bySlug) {
    const keys = principalKeysFromEntities(entities).map((p) => p.key);
    if (!keys.length) continue;
    const ids = entities.map((e) => e.id);
    try {
      await client.query("SET LOCAL statement_timeout = '30s'");
      const explain = await client.query<{
      "QUERY PLAN": [{ Plan: PlanNode; "Planning Time": number; "Execution Time": number }];
      }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT DISTINCT ON (e.id, matched_key)
         e.id, e.external_key, e.legal_name, e.status, e.entity_type,
         e.formation_date, e.officers, e.last_verified_at, matched_key
       FROM contractor_entities ce
       JOIN entities e ON e.id = ce.entity_id
       CROSS JOIN LATERAL (
         SELECT upper(trim(regexp_replace(
           regexp_replace(COALESCE(o->>'name', ''), '[.,''"/\\-]+', ' ', 'g'),
           '\\s+', ' ', 'g'
         ))) AS matched_key
         FROM jsonb_array_elements(COALESCE(e.officers, '[]'::jsonb)) AS o
       ) keys
       WHERE e.source_system = 'fl_sunbiz'
         AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
         AND ce.confidence IS NOT NULL
         AND ce.confidence >= 0.90
         AND NOT (e.id = ANY($1::uuid[]))
         AND keys.matched_key = ANY($2::text[])
       ORDER BY e.id, matched_key
       LIMIT 40`,
      [ids, keys]
    );
      const plan = explain.rows[0]["QUERY PLAN"][0];
      console.log(
        `baseline slug=${slug} keys=${keys.length} planning_ms=${plan["Planning Time"]} execution_ms=${plan["Execution Time"]} summary=${JSON.stringify(summarizePlan(plan.Plan))}`
      );
    } catch (error) {
      console.log(
        `baseline slug=${slug} keys=${keys.length} timeout=${error instanceof Error && error.message.includes("statement timeout") ? "yes" : "no"}`
      );
      await client.query("ROLLBACK");
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL lock_timeout = '2s'");
    }
  }

  const normalizationFixtures = [
    " Jane  Doe ",
    "JANE.DOE",
    "Jane O'Neil, Jr.",
    "ACME SERVICES LLC",
    "Dr. John Smith III",
  ];
  console.log(
    `normalization=${JSON.stringify(normalizationFixtures.map((value) => normalizeOfficerKey(value)))}`
  );
  await client.query("ROLLBACK");
} finally {
  client.release();
  await pool.end();
}
