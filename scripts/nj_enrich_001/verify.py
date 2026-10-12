#!/usr/bin/env python3
"""NJ-ENRICH-001 read-only verification (snapshot before the load, check after each county).

  verify.py snapshot  --out snap.json                     baseline counts (no contact values)
  verify.py check     --snapshot snap.json --loaded un,mx --plan final-dry-run.json [--holds holds.json]

Every session is READ ONLY and every block runs in BEGIN READ ONLY … ROLLBACK.
Output holds counts only.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import load  # noqa: E402


def snapshot(conn, load_ids: list[str]) -> dict:
    q = lambda sql, *a: conn.execute(sql, a).fetchone()[0]  # noqa: E731
    return {
        "observations_total": q("SELECT count(*) FROM contractor_enrichment_observations"),
        "existing_batches": {b: n for b, n in conn.execute(
            "SELECT batch_id, count(*) FROM contractor_enrichment_observations WHERE batch_id = ANY(%s) GROUP BY 1",
            (list(load.EXISTING_BATCHES),)).fetchall()},
        "contractors_total": q("SELECT count(*) FROM contractors"),
        "licenses_total": q("SELECT count(*) FROM licenses"),
        "licenses_nj_dca": q("SELECT count(*) FROM licenses WHERE source_system = 'nj_dca'"),
        "load_ids_with_canonical_phone_or_website": q(
            """SELECT count(*) FROM contractors WHERE id = ANY(%s::uuid[])
               AND (coalesce(btrim(phone), '') <> '' OR coalesce(btrim(website), '') <> '')""", load_ids),
    }


def check(conn, snap: dict, loaded: list[str], plan: dict, held_ids: list[str], holds: list[dict], load_ids: list[str]) -> dict:
    q = lambda sql, *a: conn.execute(sql, a).fetchone()[0]  # noqa: E731
    now = snapshot(conn, load_ids)
    out: dict = {"counties": {}, "failures": []}
    expected_new = 0
    for code in loaded:
        c = load.COUNTIES[code]
        want = plan["counties"][c.name]["planned"]
        got = {f: {"total": t, "profiles": p} for f, t, p in conn.execute(
            """SELECT field, count(*), count(DISTINCT contractor_id) FROM contractor_enrichment_observations
               WHERE source_system = %s AND batch_id = %s GROUP BY 1""", (c.source_system, c.batch_id)).fetchall()}
        got = {f: got.get(f, {"total": 0, "profiles": 0}) for f in load.FIELDS}
        batch_rows = q("SELECT count(*) FROM contractor_enrichment_observations WHERE batch_id = %s", c.batch_id)
        rollback_rows = q(load.rollback_sql().replace("DELETE", "SELECT count(*)"), c.source_system, c.batch_id)
        mine = [h for h in holds if h["county"] == c.name]
        held_present = q(
            """SELECT count(*) FROM contractor_enrichment_observations e
               JOIN unnest(%s::uuid[], %s::text[], %s::text[]) AS h(cid, f, hv)
                 ON e.contractor_id = h.cid AND e.field = h.f
                AND encode(sha256(convert_to(e.field || '|' || e.value_normalized, 'UTF8')), 'hex') = h.hv
               WHERE e.batch_id = %s""",
            [h["contractor_id"] for h in mine], [h["field"] for h in mine], [h["value_sha256"] for h in mine], c.batch_id)
        r = {
            "batch_rows": batch_rows, "planned_rows": plan["counties"][c.name]["planned_total"],
            "by_field_equals_plan": got == want, "profiles_enriched": q(
                "SELECT count(DISTINCT contractor_id) FROM contractor_enrichment_observations WHERE batch_id = %s", c.batch_id),
            "rollback_predicate_rows": rollback_rows, "founder_held_values_present": held_present,
            "suppressed_rows": q("SELECT count(*) FROM contractor_enrichment_observations WHERE batch_id = %s AND is_suppressed", c.batch_id),
            "non_nj_rows": q("""SELECT count(*) FROM contractor_enrichment_observations e JOIN contractors k ON k.id = e.contractor_id
                                WHERE e.batch_id = %s AND k.home_state <> 'NJ'""", c.batch_id),
        }
        expected_new += r["planned_rows"]
        if r["batch_rows"] != r["planned_rows"] or not r["by_field_equals_plan"] or r["rollback_predicate_rows"] != r["batch_rows"] \
                or held_present or r["suppressed_rows"] or r["non_nj_rows"]:
            out["failures"].append(c.name)
        out["counties"][c.name] = r
    nj_batches = [load.COUNTIES[k].batch_id for k in load.COUNTIES]
    out["global"] = {
        "observations_total": now["observations_total"],
        "expected_total": snap["observations_total"] + expected_new,
        "existing_batches_unchanged": now["existing_batches"] == snap["existing_batches"],
        "contractors_total_unchanged": now["contractors_total"] == snap["contractors_total"],
        "licenses_total_unchanged": now["licenses_total"] == snap["licenses_total"],
        "licenses_nj_dca_unchanged": now["licenses_nj_dca"] == snap["licenses_nj_dca"],
        "canonical_phone_website_unchanged": now["load_ids_with_canonical_phone_or_website"] == snap["load_ids_with_canonical_phone_or_website"],
        "held_file_ids_with_nj_rows": q("""SELECT count(*) FROM contractor_enrichment_observations
                                           WHERE contractor_id = ANY(%s::uuid[]) AND batch_id = ANY(%s)""", held_ids, nj_batches),
        "held_file_ids_with_any_rows": q("SELECT count(*) FROM contractor_enrichment_observations WHERE contractor_id = ANY(%s::uuid[])", held_ids),
        "nj_rows_outside_load_ids": q("""SELECT count(*) FROM contractor_enrichment_observations
                                         WHERE batch_id = ANY(%s) AND NOT (contractor_id = ANY(%s::uuid[]))""", nj_batches, load_ids),
        "duplicate_idem_keys": q("""SELECT count(*) FROM (SELECT 1 FROM contractor_enrichment_observations
                                    GROUP BY contractor_id, field, value_normalized, batch_id HAVING count(*) > 1) d"""),
        "unloaded_nj_batches_rows": q("SELECT count(*) FROM contractor_enrichment_observations WHERE batch_id = ANY(%s)",
                                      [load.COUNTIES[k].batch_id for k in load.COUNTIES if k not in loaded]),
        "nj_distinct_profiles": q("SELECT count(DISTINCT contractor_id) FROM contractor_enrichment_observations WHERE batch_id = ANY(%s)", nj_batches),
    }
    g = out["global"]
    if g["observations_total"] != g["expected_total"] or not all(g[k] for k in (
            "existing_batches_unchanged", "contractors_total_unchanged", "licenses_total_unchanged",
            "licenses_nj_dca_unchanged", "canonical_phone_website_unchanged")) or any(g[k] for k in (
            "held_file_ids_with_nj_rows", "nj_rows_outside_load_ids", "duplicate_idem_keys", "unloaded_nj_batches_rows")):
        out["failures"].append("global")
    out["pass"] = not out["failures"]
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["snapshot", "check"])
    ap.add_argument("--package-dir", required=True, type=Path)
    ap.add_argument("--env-file", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--snapshot", type=Path)
    ap.add_argument("--loaded", default="")
    ap.add_argument("--plan", type=Path)
    ap.add_argument("--holds", type=Path)
    args = ap.parse_args()
    load.assert_outside_git(args.package_dir)
    if args.env_file:
        from ingest.env import load_dotenv_files
        load_dotenv_files(args.env_file)
    sys.path.insert(0, str(load.ROOT))
    with (args.package_dir / load.COMBINED[0]).open(encoding="utf-8-sig", newline="") as f:
        load_ids = sorted(r["contractor_id"] for r in csv.DictReader(f) if r["package_default_action"] in load.LOAD_ACTIONS)
    with (args.package_dir / load.HELD[0]).open(encoding="utf-8-sig", newline="") as f:
        held_ids = sorted({r["contractor_id"] for r in csv.DictReader(f) if r["contractor_id"]})
    conn = load.connect(os.environ["DATABASE_URL"], read_only=True)
    with load.ReadOnlyBlock(conn):
        if args.mode == "snapshot":
            res = snapshot(conn, load_ids)
        else:
            res = check(conn, json.loads(args.snapshot.read_text(encoding="utf-8")),
                        [c for c in args.loaded.split(",") if c], json.loads(args.plan.read_text(encoding="utf-8")),
                        held_ids, load.read_holds(args.holds), load_ids)
    conn.close()
    text = json.dumps(res, indent=2)
    if args.out:
        args.out.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0 if args.mode == "snapshot" or res["pass"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
