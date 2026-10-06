#!/usr/bin/env python3
"""MD-ENRICH-001 loader: Miami-Dade business-website enrichment -> contractor_enrichment_observations.

DRY RUN BY DEFAULT. Reads the three Founder-reviewed input files from a private
directory OUTSIDE this (public) repository, pins their SHA-256, row counts and
field fill, then runs a read-only identity gate against the target database:

  contractor_id exists  AND  an fl_dbpr license on that contractor has
  external_key == license_key.  Never matched by name.

Rows failing the gate are excluded and reported. Nothing is ever written to
contractors or licenses; existing non-empty contractors.phone/website values are
reported as conflicts and left untouched (the observation still records the
business-site value with provenance).

  --apply                  write (one transaction, ON CONFLICT DO NOTHING)
  --production             required in addition to --apply for a non-local host
  --rollback               delete this batch (source_system + batch_id) and exit

The receipt (--receipt) holds counts, license keys and business names only —
no phone numbers, emails or addresses — so it is safe to commit.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

SOURCE_SYSTEM = "scout_web_enrich_md_2026_10"
DEFAULT_BATCH_ID = "md-enrich-001-2026-10-06"
TICKET_REF = "MD-ENRICH-001 Founder production GO 2026-10-06 (273 strict + 1,164 partial; 184 hold excluded)"
OBSERVED_AT = "2026-10-05T21:08:00-04:00"  # frozen Scout snapshot time stated in the JSON header

INPUTS = {
    "csv": ("miami-dade-publish-ready-2026-10-06.csv", "b1a2ee4497542c5be04fba98485f469e61cc244417f39afda1afcc02608a38c4", 1437),
    "json": ("miami-dade-publish-ready-2026-10-06.json", "16e09a48250005ce18233d871fba3c09c42abd213e07cc2edd8685b0ce0267c7", 1437),
    "flagged": ("miami-dade-publish-ready-flagged-2026-10-06.csv", "8965b32a799df36b354c33f718bf5ab07ad8933190a27edd0edff294b73f89ae", 528),
}
EXPECTED_FILL = {
    "website_url": 1437,
    "phone": 1381,
    "email": 1086,
    "primary_address": 1436,
    "additional_locations": 534,
    "specialties": 1430,
}
EXPECTED_LABELS = {"publishable": 273, "partial": 1164}

# Founder: contact values for these eight load with is_suppressed = true.
# Their additional location comes from the same likely-different-company site,
# so it is suppressed with them; specialties publish per the reviewed file.
SUPPRESSED_LICENSES = {
    "CFC1425917": "Florida Delta Mechanical",
    "CGC037426": "Experts Remodeling",
    "CGC1536732": "Nova Construction Mgmt",
    "CAC058159": "All Year Cooling & Heating",
    "CCC1332557": "Crown Roofing & Waterproofing",
    "CGC1534433": "Conconcreto",
    "CAC021340": "PKI Specialty Refrigeration",
    "CGC1529350": "All Florida Construction",
}
SUPPRESSED_FIELDS = {"website", "phone", "email", "address_location"}
SUPPRESSION_REASON = "founder_contact_suppression_2026_10_06:possible_wrong_company"

FIELDS = ("website", "phone", "email", "address_location", "specialty")


@dataclass
class Obs:
    contractor_id: str
    license_key: str
    field: str
    value: str
    value_normalized: str
    ordinal: int
    source_refs: list[str]
    confidence: str
    review_flags: list[str]
    decision_ref: str
    is_suppressed: bool
    suppression_reason: str | None


@dataclass
class Plan:
    rows: list[dict]
    obs: list[Obs] = field(default_factory=list)
    excluded: list[dict] = field(default_factory=list)
    conflicts: list[dict] = field(default_factory=list)
    skipped_empty: Counter = field(default_factory=Counter)
    duplicates_collapsed: Counter = field(default_factory=Counter)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def collapse(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def normalize(field_name: str, value: str) -> str:
    v = collapse(value)
    if field_name == "website":
        return v.lower().rstrip("/")
    if field_name == "phone":
        digits = re.sub(r"\D", "", v)
        return digits[1:] if len(digits) == 11 and digits.startswith("1") else digits
    return v.lower()


def split_values(field_name: str, raw: str) -> list[str]:
    raw = raw or ""
    if not raw.strip():
        return []
    if field_name == "phone":
        parts = raw.split(";")
    elif field_name == "specialty":
        parts = raw.split("|")
    else:  # website, email, address_location: one reviewed cell = one observation
        parts = [raw]
    return [collapse(p) for p in parts if collapse(p)]


def verify_inputs(input_dir: Path) -> tuple[list[dict], dict]:
    """Hard stop on any checksum / count / fill / uniqueness deviation."""
    errors: list[str] = []
    hashes = {}
    for key, (name, want, _) in INPUTS.items():
        p = input_dir / name
        if not p.is_file():
            errors.append(f"missing input {name}")
            continue
        got = sha256(p)
        hashes[name] = got
        if got != want:
            errors.append(f"sha256 mismatch {name}: {got}")
    if errors:
        raise SystemExit("HARD STOP: " + "; ".join(errors))

    def read_csv(name: str) -> list[dict]:
        with (input_dir / name).open(encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))

    rows = read_csv(INPUTS["csv"][0])
    flagged = read_csv(INPUTS["flagged"][0])
    doc = json.loads((input_dir / INPUTS["json"][0]).read_text(encoding="utf-8"))
    records = doc["records"]
    records = list(records.values()) if isinstance(records, dict) else records

    if len(rows) != INPUTS["csv"][2]:
        errors.append(f"csv rows {len(rows)}")
    if len(records) != INPUTS["json"][2] or doc.get("row_count") != INPUTS["json"][2]:
        errors.append(f"json records {len(records)} row_count {doc.get('row_count')}")
    if len(flagged) != INPUTS["flagged"][2]:
        errors.append(f"flagged rows {len(flagged)}")
    ids = [r["contractor_id"] for r in rows]
    if len(set(ids)) != len(ids) or any(not i for i in ids):
        errors.append("contractor_id not unique / blank")
    if {r["contractor_id"] for r in records} != set(ids):
        errors.append("csv and json contractor_id sets differ")
    if not {r["contractor_id"] for r in flagged} <= set(ids):
        errors.append("flagged rows outside publish set")
    fill = {f: sum(1 for r in rows if (r.get(f) or "").strip()) for f in EXPECTED_FILL}
    if fill != EXPECTED_FILL:
        errors.append(f"field fill {fill}")
    labels = Counter(r["original_label"] for r in rows)
    if dict(labels) != EXPECTED_LABELS:
        errors.append(f"labels {dict(labels)}")
    missing_sup = set(SUPPRESSED_LICENSES) - {r["license_key"] for r in rows}
    if missing_sup:
        errors.append(f"suppressed licenses absent {sorted(missing_sup)}")
    if errors:
        raise SystemExit("HARD STOP: " + "; ".join(errors))
    return rows, {"sha256": hashes, "rows": len(rows), "flagged_rows": len(flagged), "field_fill": fill, "labels": dict(labels)}


def build_observations(rows: list[dict], plan: Plan, ok_ids: set[str]) -> None:
    column = {"website": "website_url", "phone": "phone", "email": "email",
              "address_location": "additional_locations", "specialty": "specialties"}
    for r in rows:
        if r["contractor_id"] not in ok_ids:
            continue
        lic = r["license_key"].strip().upper()
        suppressed = lic in SUPPRESSED_LICENSES
        refs = [collapse(x) for x in (r.get("source_refs") or "").split("|") if collapse(x)]
        flags = [collapse(x) for x in (r.get("review_flags") or "").split(";") if collapse(x)]
        decision = f"{TICKET_REF} | file: {collapse(r.get('decision_ref') or '')} | label: {r.get('original_label')}"
        for fname in FIELDS:
            values = split_values(fname, r.get(column[fname]) or "")
            if not values:
                plan.skipped_empty[fname] += 1
                continue
            seen: set[str] = set()
            for i, v in enumerate(values):
                n = normalize(fname, v)
                if not n:
                    plan.skipped_empty[fname] += 1
                    continue
                if fname == "website" and urlparse(v).scheme not in ("http", "https"):
                    raise SystemExit(f"HARD STOP: non-http website for {lic}")
                if n in seen:
                    plan.duplicates_collapsed[fname] += 1
                    continue
                seen.add(n)
                sup = suppressed and fname in SUPPRESSED_FIELDS
                plan.obs.append(Obs(r["contractor_id"], lic, fname, v, n, i, refs, r.get("scout_confidence") or "",
                                    flags, decision, sup, SUPPRESSION_REASON if sup else None))


def connect(url: str, read_only: bool):
    import psycopg
    from ingest.env import normalize_database_url

    opts = "-c default_transaction_read_only=on" if read_only else ""
    conn = psycopg.connect(normalize_database_url(url), options=opts)
    conn.execute("SET statement_timeout = '120s'")
    conn.execute("SET lock_timeout = '5s'")
    return conn


def identity_gate(conn, rows: list[dict], plan: Plan) -> set[str]:
    ids = [r["contractor_id"] for r in rows]
    cur = conn.execute(
        "SELECT id::text, phone, website FROM contractors WHERE id = ANY(%s::uuid[])", (ids,))
    contractors = {cid: (phone, website) for cid, phone, website in cur.fetchall()}
    cur = conn.execute(
        """SELECT contractor_id::text, upper(external_key) FROM licenses
           WHERE source_system = 'fl_dbpr' AND contractor_id = ANY(%s::uuid[])""", (ids,))
    lic: dict[str, set[str]] = {}
    for cid, key in cur.fetchall():
        lic.setdefault(cid, set()).add(key)
    cur = conn.execute(
        """SELECT upper(external_key), contractor_id::text FROM licenses
           WHERE source_system = 'fl_dbpr' AND upper(external_key) = ANY(%s)""",
        ([r["license_key"].strip().upper() for r in rows],))
    owners: dict[str, set[str]] = {}
    for key, cid in cur.fetchall():
        owners.setdefault(key, set()).add(cid)

    ok: set[str] = set()
    for r in rows:
        cid, key = r["contractor_id"], r["license_key"].strip().upper()
        reason = None
        if cid not in contractors:
            reason = "contractor_id_missing"
        elif key not in lic.get(cid, set()):
            reason = "license_key_mismatch"
        elif owners.get(key, set()) - {cid}:
            reason = "license_key_owned_by_other_contractor"
        if reason:
            plan.excluded.append({"contractor_id": cid, "license_key": key, "display_name": r["display_name"], "reason": reason})
            continue
        ok.add(cid)
        phone, website = contractors[cid]
        for col, val, newval in (("phone", phone, r.get("phone")), ("website", website, r.get("website_url"))):
            if (val or "").strip() and (newval or "").strip() and normalize(col, val) != normalize(col, newval.split(";")[0]):
                plan.conflicts.append({"contractor_id": cid, "license_key": key, "display_name": r["display_name"],
                                       "column": f"contractors.{col}", "action": "retained_existing_canonical; enrichment stored as observation"})
    return ok


def counts(obs: list[Obs]) -> dict:
    out = {}
    for f in FIELDS:
        sel = [o for o in obs if o.field == f]
        out[f] = {"total": len(sel), "public": sum(1 for o in sel if not o.is_suppressed),
                  "suppressed": sum(1 for o in sel if o.is_suppressed),
                  "profiles": len({o.contractor_id for o in sel})}
    return out


def db_counts(conn, batch_id: str) -> dict:
    cur = conn.execute(
        """SELECT field, count(*), count(*) FILTER (WHERE NOT is_suppressed), count(*) FILTER (WHERE is_suppressed),
                  count(DISTINCT contractor_id)
           FROM contractor_enrichment_observations WHERE source_system = %s AND batch_id = %s GROUP BY field""",
        (SOURCE_SYSTEM, batch_id))
    out = {f: {"total": 0, "public": 0, "suppressed": 0, "profiles": 0} for f in FIELDS}
    for f, t, p, s, n in cur.fetchall():
        out[f] = {"total": t, "public": p, "suppressed": s, "profiles": n}
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input-dir", required=True, type=Path)
    ap.add_argument("--batch-id", default=DEFAULT_BATCH_ID)
    ap.add_argument("--database-url-env", default="DATABASE_URL", help="env var holding the target Postgres URL")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--production", action="store_true")
    ap.add_argument("--rollback", action="store_true")
    ap.add_argument("--receipt", type=Path)
    args = ap.parse_args()

    resolved = args.input_dir.resolve()
    if ROOT in resolved.parents or resolved == ROOT:
        raise SystemExit("HARD STOP: input dir is inside the public repository")

    url = os.environ.get(args.database_url_env)
    if not url:
        raise SystemExit(f"{args.database_url_env} not set")
    host = urlparse(url).hostname or ""
    local = host in ("localhost", "127.0.0.1", "::1")
    writes = args.apply or args.rollback
    if writes and not local and not args.production:
        raise SystemExit("refusing to write to a non-local database without --production")

    if args.rollback:
        with connect(url, read_only=False) as conn:
            cur = conn.execute(
                "DELETE FROM contractor_enrichment_observations WHERE source_system = %s AND batch_id = %s",
                (SOURCE_SYSTEM, args.batch_id))
            print(json.dumps({"rollback": {"source_system": SOURCE_SYSTEM, "batch_id": args.batch_id, "deleted": cur.rowcount}}))
        return 0

    rows, inputs = verify_inputs(args.input_dir)
    plan = Plan(rows=rows)
    with connect(url, read_only=not args.apply) as conn:
        ok_ids = identity_gate(conn, rows, plan)
        build_observations(rows, plan, ok_ids)
        planned = counts(plan.obs)
        receipt = {
            "ticket": "MD-ENRICH-001",
            "mode": "apply" if args.apply else "dry_run",
            "target_host": "local" if local else host,
            "source_system": SOURCE_SYSTEM,
            "batch_id": args.batch_id,
            "inputs": inputs,
            "identity": {"source_rows": len(rows), "matched": len(ok_ids), "excluded": len(plan.excluded),
                         "excluded_rows": plan.excluded, "new_contractor_entities": 0, "identity_merges": 0},
            "existing_value_conflicts": {"count": len(plan.conflicts), "rows": plan.conflicts},
            "suppressed_profiles": [{"license_key": k, "display_name": v, "fields": sorted(SUPPRESSED_FIELDS)}
                                    for k, v in SUPPRESSED_LICENSES.items()],
            "planned": planned,
            "planned_total": len(plan.obs),
            "skipped_empty_cells": dict(plan.skipped_empty),
            "duplicates_collapsed_within_profile": dict(plan.duplicates_collapsed),
            "primary_address": "not loaded — DBPR primary address stays authoritative",
            "hold_rows": "loader accepts only contractor_ids in the SHA-pinned 1,437-row publish file",
        }
        if args.apply:
            before = conn.execute(
                "SELECT count(*) FROM contractor_enrichment_observations WHERE source_system = %s AND batch_id = %s",
                (SOURCE_SYSTEM, args.batch_id)).fetchone()[0]
            with conn.cursor() as cur:
                cur.executemany(
                    """INSERT INTO contractor_enrichment_observations
                         (contractor_id, license_external_key, field, value, value_normalized, ordinal, source_refs,
                          source_system, confidence, review_flags, decision_ref, batch_id, observed_at,
                          is_suppressed, suppression_reason)
                       VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::timestamptz, %s, %s)
                       ON CONFLICT ON CONSTRAINT contractor_enrichment_observations_idem DO NOTHING""",
                    [(o.contractor_id, o.license_key, o.field, o.value, o.value_normalized, o.ordinal, o.source_refs,
                      SOURCE_SYSTEM, o.confidence, o.review_flags, o.decision_ref, args.batch_id, OBSERVED_AT,
                      o.is_suppressed, o.suppression_reason) for o in plan.obs])
            actual = db_counts(conn, args.batch_id)
            stray = conn.execute(
                """SELECT count(*) FROM contractor_enrichment_observations
                   WHERE source_system = %s AND batch_id = %s AND NOT (contractor_id = ANY(%s::uuid[]))""",
                (SOURCE_SYSTEM, args.batch_id, sorted(ok_ids))).fetchone()[0]
            if actual != planned or stray:
                conn.rollback()
                raise SystemExit(f"HARD STOP: post-insert counts differ from plan (stray={stray}); transaction rolled back")
            conn.commit()
            receipt["applied"] = {"rows_before": before, "rows_after": sum(v["total"] for v in actual.values()),
                                  "inserted": sum(v["total"] for v in actual.values()) - before, "db_counts": actual}
    text = json.dumps(receipt, indent=2, ensure_ascii=False)
    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(text + "\n", encoding="utf-8")
    summary = {k: receipt[k] for k in ("mode", "target_host", "batch_id", "planned", "planned_total", "skipped_empty_cells",
                                        "duplicates_collapsed_within_profile")}
    summary["identity"] = {k: v for k, v in receipt["identity"].items() if k != "excluded_rows"}
    summary["conflicts"] = len(plan.conflicts)
    if "applied" in receipt:
        summary["applied"] = {k: v for k, v in receipt["applied"].items() if k != "db_counts"}
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
