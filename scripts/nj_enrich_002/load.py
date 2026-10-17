#!/usr/bin/env python3
"""NJ-ENRICH-002 loader: Morris County business-website enrichment.

Sibling of scripts/nj_enrich_001/load.py. Imports that module and does not change
Bergen, Middlesex, Monmouth, or Union pins, tests, or rollback.

DRY RUN BY DEFAULT. Pre-GO work is BEGIN READ ONLY … ROLLBACK.
--apply requires the exact Founder phrase GO CONTRACTOR MORRIS ENRICH LOAD.
Rollback accepts only ^mo-enrich-001-2026-10-17$.

The package directory must sit outside every git working tree. Receipts hold
counts, contractor ids, and license keys only.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

_NJ_PATH = ROOT / "scripts" / "nj_enrich_001" / "load.py"
_spec = importlib.util.spec_from_file_location("nj_enrich_001_load", _NJ_PATH)
if _spec is None or _spec.loader is None:
    raise SystemExit("HARD STOP: nj_enrich_001 loader is missing")
nj = importlib.util.module_from_spec(_spec)
sys.modules["nj_enrich_001_load"] = nj
_spec.loader.exec_module(nj)

TICKET = "NJ-ENRICH-002"
TICKET_REF = "NJ-ENRICH-002 (mo-enrich-001-2026-10-17)"
GO_PHRASE = "GO CONTRACTOR MORRIS ENRICH LOAD"
PROMPT_NAME = "BUILDER-PROMPT-nj-morris-enrich-2026-10-17.md"
ROLLBACK_BATCH_RE = re.compile(r"^mo-enrich-001-2026-10-17$")
EXPECTED_OBS = {
    "website": 571,
    "phone": 626,
    "email": 398,
    "address_location": 188,
    "specialty": 3079,
}
EXPECTED_TOTAL = 4862

COUNTY = nj.County(
    "mo",
    "morris",
    "dot-publish-ready-nj-morris-batch1-2026-10-17",
    "241aa1828e7c82b31303c0f9ce55839dbd2e102cbf8ad4b3b4bdf508a235afdf",
    571,
    0,
    "",
    0,
    "mo-enrich-001-2026-10-17",
    "dot_web_enrich_mo_2026_10",
    "2026-10-17T00:00:00-04:00",
    {"website": 571, "phone": 546, "email": 365, "address_location": 181, "specialty": 549},
    {"load": 239, "load_flagged": 332},
)

ROLLBACK_SQL_LITERAL = (
    "DELETE FROM contractor_enrichment_observations "
    "WHERE source_system = 'dot_web_enrich_mo_2026_10' "
    "AND batch_id = 'mo-enrich-001-2026-10-17';"
)


def assert_package_outside_git(path: Path) -> None:
    """Refuse a package inside this repo or any other git working tree."""
    nj.assert_outside_git(path)


def stamp_action(row: dict) -> dict:
    """Morris has no action column. Empty review_flags is load; any flag is load_flagged."""
    flags = nj.split_flags(row.get("review_flags"))
    email = (row.get("email") or "").strip()
    if email and any(f.startswith("email_undeliverable") or f == "email_cannot_receive_mail" for f in flags):
        raise SystemExit("HARD STOP: ready email carries an undeliverable flag")
    out = dict(row)
    out["package_default_action"] = "load_flagged" if flags else "load"
    return out


def check_ready_rows(rows: list[dict]) -> list[dict]:
    errors: list[str] = []
    if not rows or list(rows[0].keys()) != nj.HEADER16:
        errors.append("ready header differs")
    if len(rows) != COUNTY.rows:
        errors.append(f"ready rows {len(rows)}")
    ids = [r.get("contractor_id", "") for r in rows]
    keys = [(r.get("license_key") or "").strip().upper() for r in rows]
    if len(ids) != len(set(ids)) or not all(ids):
        errors.append("contractor_id not unique / blank")
    if len(keys) != len(set(keys)) or not all(keys):
        errors.append("license_key not unique / blank")
    stamped: list[dict] = []
    if not errors:
        stamped = [stamp_action(r) for r in rows]
        actions = Counter(r["package_default_action"] for r in stamped)
        if {a: actions.get(a, 0) for a in nj.LOAD_ACTIONS} != COUNTY.actions:
            errors.append(f"actions {dict(actions)}")
        fill = {f: sum(1 for r in stamped if (r.get(nj.COLUMN[f]) or "").strip()) for f in nj.FIELDS}
        if fill != COUNTY.fill:
            errors.append(f"field fill {fill}")
    if errors:
        raise SystemExit("HARD STOP (morris): " + "; ".join(errors))
    return stamped


def verify_package(pkg: Path) -> dict:
    assert_package_outside_git(pkg)
    errors: list[str] = []
    sums_path = pkg / "SHA256SUMS"
    if not sums_path.is_file():
        errors.append("SHA256SUMS missing")
        raise SystemExit("HARD STOP: " + "; ".join(errors))
    seen: set[str] = set()
    for line in sums_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        if "  " not in line:
            errors.append("bad SHA256SUMS line")
            continue
        want, name = line.split("  ", 1)
        seen.add(name)
        path = pkg / name
        if not path.is_file():
            errors.append(f"missing {name}")
        elif nj.sha256(path) != want.strip().lower():
            errors.append(f"sha256 mismatch {name}")
    ready_name = COUNTY.ready + ".csv"
    ready_path = pkg / ready_name
    if not ready_path.is_file() or nj.sha256(ready_path) != COUNTY.sha:
        errors.append("ready csv pin mismatch")
    if ready_name not in seen or PROMPT_NAME not in seen:
        errors.append("SHA256SUMS does not cover the ready CSV and the prompt")
    allowed = {ready_name, PROMPT_NAME, "SHA256SUMS"}
    for path in pkg.iterdir():
        if path.name not in allowed:
            errors.append(f"extra package entry {path.name}")
    if errors:
        raise SystemExit("HARD STOP: " + "; ".join(errors))
    rows = check_ready_rows(nj.read_csv(ready_path))
    return {"ready_sha256": COUNTY.sha, "ready_rows": len(rows), "sha256sums_files": len(seen)}


def build_observations(rows: list[dict], plan: nj.Plan, ok_ids: set[str], file_sha: str) -> None:
    saved = nj.TICKET_REF
    nj.TICKET_REF = TICKET_REF
    try:
        nj.build_observations(rows, plan, ok_ids, file_sha)
    finally:
        nj.TICKET_REF = saved
    csv_ids = {r["contractor_id"] for r in rows}
    if any(o.contractor_id not in csv_ids for o in plan.obs):
        raise SystemExit("HARD STOP: observation for an id outside the ready CSV")


def outside_csv_observation_count(plan: nj.Plan, csv_ids: set[str]) -> int:
    return sum(1 for o in plan.obs if o.contractor_id not in csv_ids)


def require_go(apply: bool, phrase: str) -> None:
    if apply and phrase != GO_PHRASE:
        raise SystemExit("HARD STOP: apply refused without the exact Founder GO phrase")


def transaction_name(apply: bool) -> str:
    return "COMMIT" if apply else "ROLLBACK"


def rollback_guard(batch_id: str) -> None:
    if (
        ROLLBACK_BATCH_RE.fullmatch(batch_id or "") is None
        or batch_id != COUNTY.batch_id
        or batch_id in nj.EXISTING_BATCHES
        or nj.ROLLBACK_BATCH_RE.fullmatch(batch_id or "") is not None
    ):
        raise SystemExit(f"HARD STOP: rollback refused for batch_id {batch_id!r}")


def rollback_sql() -> str:
    return "DELETE FROM contractor_enrichment_observations WHERE source_system = %s AND batch_id = %s"


def observation_variance(planned: dict) -> dict:
    out: dict = {}
    flagged = False
    for field_name, expected in EXPECTED_OBS.items():
        actual = planned[field_name]["total"]
        pct = abs(actual - expected) / expected
        item = {"expected": expected, "actual": actual, "abs_pct": round(pct, 6)}
        if pct > 0.01:
            item["flag"] = "OVER_1_PERCENT"
            flagged = True
        out[field_name] = item
    total = sum(planned[f]["total"] for f in EXPECTED_OBS)
    pct = abs(total - EXPECTED_TOTAL) / EXPECTED_TOTAL
    item = {"expected": EXPECTED_TOTAL, "actual": total, "abs_pct": round(pct, 6)}
    if pct > 0.01:
        item["flag"] = "OVER_1_PERCENT"
        flagged = True
    out["total"] = item
    out["flagged"] = flagged
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--package-dir", required=True, type=Path)
    ap.add_argument("--county", default="mo", choices=["mo"])
    ap.add_argument("--database-url-env", default="DATABASE_URL")
    ap.add_argument("--env-file", type=Path)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--production", action="store_true")
    ap.add_argument("--rollback", action="store_true")
    ap.add_argument("--authorize", default="", help="exact Founder GO phrase; required with --apply")
    ap.add_argument("--receipt", type=Path)
    args = ap.parse_args()

    require_go(args.apply, args.authorize)
    assert_package_outside_git(args.package_dir)
    if args.receipt:
        parent = args.receipt.parent
        assert_package_outside_git(parent if parent.exists() else parent.parent)

    if args.env_file:
        from ingest.env import load_dotenv_files
        load_dotenv_files(args.env_file)
    url = os.environ.get(args.database_url_env)
    if not url:
        raise SystemExit(f"{args.database_url_env} not set")
    host = urlparse(url).hostname or ""
    local = host in ("localhost", "127.0.0.1", "::1")
    writes = args.apply or args.rollback
    if writes and not local and not args.production:
        raise SystemExit("refusing to write to a non-local database without --production")
    if args.county != "mo":
        raise SystemExit("HARD STOP: Morris loader accepts only --county mo")

    if args.rollback:
        rollback_guard(COUNTY.batch_id)
        with nj.connect(url, read_only=False) as conn, conn.transaction():
            cur = conn.execute(rollback_sql(), (COUNTY.source_system, COUNTY.batch_id))
            print(json.dumps({"rollback": {"batch_id": COUNTY.batch_id, "deleted": cur.rowcount}}))
        return 0

    package = verify_package(args.package_dir)
    rows = check_ready_rows(nj.read_csv(args.package_dir / (COUNTY.ready + ".csv")))
    csv_ids = {r["contractor_id"] for r in rows}
    receipt: dict = {
        "ticket": TICKET,
        "mode": "apply" if args.apply else "dry_run",
        "target": "local" if local else ("supabase:jhjztnisugdsuliriajp" if "jhjztnisugdsuliriajp" in url else "other"),
        "package": package,
        "county": COUNTY.name,
        "batch_id": COUNTY.batch_id,
        "source_system": COUNTY.source_system,
    }
    with nj.connect(url, read_only=not args.apply) as conn:
        ctx = conn.transaction() if args.apply else nj.ReadOnlyBlock(conn)
        with ctx:
            read_only = conn.execute("SHOW transaction_read_only").fetchone()[0]
            if not args.apply and read_only != "on":
                raise SystemExit("HARD STOP: transaction is not read-only")
            preflight = nj.preflight(conn)
            batches_before = [(b["source_system"], b["batch_id"], b["rows"]) for b in preflight["batches"]]
            plan = nj.Plan(county=COUNTY, rows=rows)
            ok = nj.identity_gate(conn, rows, plan)
            build_observations(rows, plan, ok, COUNTY.sha)
            if outside_csv_observation_count(plan, csv_ids):
                raise SystemExit("HARD STOP: observation for an id outside the ready CSV")
            planned = nj.counts(plan.obs)
            for field_name, expected_profiles in COUNTY.fill.items():
                if planned[field_name]["profiles"] != expected_profiles:
                    raise SystemExit(
                        f"HARD STOP: profile count {field_name} {planned[field_name]['profiles']} != {expected_profiles}"
                    )
            variance = observation_variance(planned)
            if variance["flagged"]:
                raise SystemExit("HARD STOP: observation count differs from the Morris estimate by more than 1%")
            batch_rows = sum(v["total"] for v in nj.db_counts(conn, COUNTY).values())
            existing_obs = nj.existing_for(conn, sorted(csv_ids))
            already = nj.already_present(conn, plan)
            reasons = Counter(e["reason"] for e in plan.excluded)
            batches_after = conn.execute(
                """SELECT source_system, batch_id, count(*)
                   FROM contractor_enrichment_observations GROUP BY 1, 2 ORDER BY 2"""
            ).fetchall()
            before_map = {(s, b): n for s, b, n in batches_before}
            after_map = {(s, b): n for s, b, n in batches_after}
            for key, count in before_map.items():
                if after_map.get(key, 0) != count:
                    raise SystemExit("HARD STOP: existing batch counts changed")
            if not args.apply and after_map != before_map:
                raise SystemExit("HARD STOP: batch set changed inside the dry run")
            if args.apply:
                if plan.excluded or existing_obs or batch_rows:
                    raise SystemExit("HARD STOP: identity exclusions or pre-existing rows before apply")
                with conn.cursor() as cur:
                    cur.executemany(
                        """INSERT INTO contractor_enrichment_observations
                             (contractor_id, license_external_key, field, value, value_normalized, ordinal, source_refs,
                              source_system, confidence, review_flags, decision_ref, batch_id, observed_at,
                              is_suppressed, suppression_reason)
                           VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::timestamptz, false, NULL)
                           ON CONFLICT ON CONSTRAINT contractor_enrichment_observations_idem DO NOTHING""",
                        [(o.contractor_id, o.license_key, o.field, o.value, o.value_normalized, o.ordinal, o.source_refs,
                          COUNTY.source_system, o.confidence, o.review_flags, o.decision_ref, COUNTY.batch_id,
                          COUNTY.observed_at) for o in plan.obs])
                actual = nj.db_counts(conn, COUNTY)
                stray = conn.execute(
                    """SELECT count(*) FROM contractor_enrichment_observations
                       WHERE source_system = %s AND batch_id = %s AND NOT (contractor_id = ANY(%s::uuid[]))""",
                    (COUNTY.source_system, COUNTY.batch_id, sorted(ok))).fetchone()[0]
                if actual != planned or stray:
                    raise SystemExit(f"HARD STOP: post-insert counts differ from plan (stray={stray}); rolled back")
                receipt["applied"] = {"inserted": sum(v["total"] for v in actual.values()), "db_counts": actual}
                batches_after = conn.execute(
                    """SELECT source_system, batch_id, count(*)
                       FROM contractor_enrichment_observations GROUP BY 1, 2 ORDER BY 2"""
                ).fetchall()
                post_map = {(s, b): n for s, b, n in batches_after}
                for key, count in before_map.items():
                    if post_map.get(key, 0) != count:
                        raise SystemExit("HARD STOP: existing batch counts changed during apply; rolled back")
            receipt.update({
                "transaction_read_only": read_only,
                "transaction": transaction_name(args.apply),
                "input_ready_rows": len(rows),
                "exact_identity_matches": len(ok),
                "identity_failures": {
                    "contractor_not_found": reasons.get("contractor_id_missing", 0),
                    "state_mismatches": reasons.get("not_nj", 0),
                    "license_key_mismatches": reasons.get("license_key_mismatch", 0),
                    "multiple_owners": reasons.get("license_key_owned_by_other_contractor", 0),
                },
                "identity_failure_ids": [e["contractor_id"] for e in plan.excluded],
                "existing_observations_for_load_ids": existing_obs,
                "existing_batch_rows": batch_rows,
                "canonical_conflicts": len(plan.conflicts),
                "phone_conflicts": sum(1 for c in plan.conflicts if c["column"] == "contractors.phone"),
                "website_conflicts": sum(1 for c in plan.conflicts if c["column"] == "contractors.website"),
                "planned_total": len(plan.obs),
                "planned": planned,
                "variance": {k: v for k, v in variance.items() if k != "flagged"},
                "outside_csv_proposed_rows": 0,
                "planned_keys_already_present": already,
                "duplicates_collapsed": dict(plan.duplicates_collapsed),
                "international_phones": sum(1 for o in plan.obs if o.field == "phone" and o.value_normalized.startswith("+")),
                "phone_hard_stops": 0,
                "skipped_empty_cells": dict(plan.skipped_empty),
                "review_flags": dict(sorted(Counter(
                    f for r in rows for f in set(nj.split_flags(r.get("review_flags")))
                ).items())),
                "actions": dict(Counter(r["package_default_action"] for r in rows)),
                "batches": [{"source_system": s, "batch_id": b, "rows": n} for s, b, n in batches_after],
                "observation_total": preflight["total_rows"],
            })

    text = json.dumps(receipt, indent=2, sort_keys=True)
    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(text + "\n", encoding="utf-8")
    print(text)
    print(f"{'APPLY' if args.apply else 'DRY_RUN'}_TRANSACTION={transaction_name(args.apply)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
