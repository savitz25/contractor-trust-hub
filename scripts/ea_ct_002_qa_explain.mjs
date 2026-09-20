/** EA-CT-002 QA amendment: READ-ONLY query-plan verification. No writes, no DDL, no ANALYZE/VACUUM
 * on tables, single connection, statement_timeout guarded. Compares the CURRENT code path
 * (WHERE matched_contractor_id = $1, unindexed) against a CANDIDATE path driven by the existing
 * permit_attributions_license_idx (WHERE matched_license_id = ANY(...) AND matched_contractor_id = $1). */
import fs from "node:fs";
import { Pool } from "pg";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });

const CASES = [
  { label: "zero_permit", slug: "mn-qb648229-margaret-m-karrh" },
  { label: "lennar_high_volume", slug: "cgc062343-lennar-homes-llc" },
];

async function main() {
  const c = await pool.connect();
  const out = { ranAt: new Date().toISOString(), note: "READ-ONLY. Plain EXPLAIN ANALYZE inside BEGIN READ ONLY, always ROLLBACK. No writes.", cases: {} };
  try {
    await c.query("SET statement_timeout = 15000");

    // Find a real "normal volume" contractor (a handful of confirmed permits) for the third case.
    await c.query("BEGIN READ ONLY");
    const normal = await c.query(`
      SELECT c.slug, c.id, count(*) n
      FROM permit_attributions a
      JOIN licenses l ON l.id = a.matched_license_id
      JOIN contractors c ON c.id = a.matched_contractor_id AND c.id = l.contractor_id
      WHERE a.identity_state = 'CONFIRMED' AND a.identity_method = 'FULL_DBPR_LICENSE'
      GROUP BY c.slug, c.id
      HAVING count(*) BETWEEN 2 AND 10
      ORDER BY c.slug
      LIMIT 1
    `);
    await c.query("ROLLBACK");
    if (normal.rows[0]) CASES.push({ label: "normal_volume", slug: normal.rows[0].slug });
    out.normalVolumeSlugFound = normal.rows[0] ?? null;

    for (const kase of CASES) {
      await c.query("BEGIN READ ONLY");
      const contractorRow = await c.query(`SELECT id FROM contractors WHERE slug = $1`, [kase.slug]);
      const contractorId = contractorRow.rows[0]?.id;
      if (!contractorId) { out.cases[kase.label] = { ERROR: `contractor not found for slug ${kase.slug}` }; await c.query("ROLLBACK"); continue; }

      // A. CURRENT code path: filter directly on matched_contractor_id (no supporting index).
      const currentCandidatesPlan = await c.query(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT a.id, s.id AS source_record_id
        FROM permit_attributions a
        JOIN permit_source_records s ON s.id = a.permit_source_record_id
        LEFT JOIN licenses l ON l.id = a.matched_license_id
        WHERE a.matched_contractor_id = $1
          AND a.identity_state = 'CONFIRMED'
          AND a.identity_method = 'FULL_DBPR_LICENSE'
        ORDER BY s.issue_date DESC NULLS LAST, s.permit_number DESC NULLS LAST, a.id
        LIMIT 500
      `, [contractorId]);
      const currentCountPlan = await c.query(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT count(*) AS n
        FROM permit_attributions a
        JOIN permit_source_records s ON s.id = a.permit_source_record_id
        LEFT JOIN licenses l ON l.id = a.matched_license_id
        WHERE a.matched_contractor_id = $1
          AND a.identity_state = 'CONFIRMED'
          AND a.identity_method = 'FULL_DBPR_LICENSE'
          AND l.contractor_id = a.matched_contractor_id
          AND l.external_key IS NOT NULL
          AND s.id IS NOT NULL
      `, [contractorId]);

      // B. CANDIDATE path: resolve license ids first (indexed), then drive permit_attributions off
      // the existing permit_attributions_license_idx, keeping matched_contractor_id as an exact filter.
      const licenseIds = await c.query(`SELECT id FROM licenses WHERE contractor_id = $1`, [contractorId]);
      const ids = licenseIds.rows.map((r) => r.id);
      const candidateCandidatesPlan = ids.length
        ? await c.query(`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
            SELECT a.id, s.id AS source_record_id
            FROM permit_attributions a
            JOIN permit_source_records s ON s.id = a.permit_source_record_id
            LEFT JOIN licenses l ON l.id = a.matched_license_id
            WHERE a.matched_license_id = ANY($1::uuid[])
              AND a.matched_contractor_id = $2
              AND a.identity_state = 'CONFIRMED'
              AND a.identity_method = 'FULL_DBPR_LICENSE'
            ORDER BY s.issue_date DESC NULLS LAST, s.permit_number DESC NULLS LAST, a.id
            LIMIT 500
          `, [ids, contractorId])
        : null;
      const candidateCountPlan = ids.length
        ? await c.query(`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
            SELECT count(*) AS n
            FROM permit_attributions a
            JOIN permit_source_records s ON s.id = a.permit_source_record_id
            LEFT JOIN licenses l ON l.id = a.matched_license_id
            WHERE a.matched_license_id = ANY($1::uuid[])
              AND a.matched_contractor_id = $2
              AND a.identity_state = 'CONFIRMED'
              AND a.identity_method = 'FULL_DBPR_LICENSE'
              AND l.contractor_id = a.matched_contractor_id
              AND l.external_key IS NOT NULL
              AND s.id IS NOT NULL
          `, [ids, contractorId])
        : null;

      await c.query("ROLLBACK");

      const text = (r) => r?.rows.map((row) => row["QUERY PLAN"]).join("\n") ?? null;
      const grab = (plan, re) => (plan ? (re.exec(plan) ?? [])[1] ?? null : null);
      const summarize = (plan) => plan && {
        planningTimeMs: Number(grab(plan, /Planning Time: ([\d.]+) ms/)),
        executionTimeMs: Number(grab(plan, /Execution Time: ([\d.]+) ms/)),
        usesSeqScanOnPermitAttributions: /Seq Scan on permit_attributions/.test(plan),
        usesIndexOnPermitAttributions: /Index (Only )?Scan.*permit_attributions|Bitmap.*permit_attributions/.test(plan),
        indexNames: [...plan.matchAll(/using (\S+)/g)].map((m2) => m2[1]),
      };

      out.cases[kase.label] = {
        slug: kase.slug, licenseCount: ids.length,
        currentPath: {
          candidates: { summary: summarize(text(currentCandidatesPlan)), plan: text(currentCandidatesPlan) },
          count: { summary: summarize(text(currentCountPlan)), plan: text(currentCountPlan) },
        },
        candidatePath: candidateCandidatesPlan ? {
          candidates: { summary: summarize(text(candidateCandidatesPlan)), plan: text(candidateCandidatesPlan) },
          count: { summary: summarize(text(candidateCountPlan)), plan: text(candidateCountPlan) },
        } : null,
      };
      console.log(kase.label, "done");
    }
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
    await pool.end();
  }
  fs.writeFileSync("docs/qa/ea-ct-002/query-plan-verification.local.json", JSON.stringify(out, null, 2) + "\n");
  // Print only summaries (not full plan text) to keep terminal output bounded.
  console.log(JSON.stringify(out, (k, v) => (k === "plan" ? undefined : v), 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
