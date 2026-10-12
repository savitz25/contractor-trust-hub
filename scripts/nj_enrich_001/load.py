#!/usr/bin/env python3
"""NJ-ENRICH-001 loader: Bergen / Middlesex / Monmouth / Union business-website
enrichment -> contractor_enrichment_observations.

Derived from scripts/md_enrich_001/load.py (same table, same semantics). NJ changes:
  * per-county config (pinned file, sha256, rows, fill, batch_id, source_system)
  * identity gate on nj_dca licenses + contractors.home_state = 'NJ'
  * never-load guard read from the package held file (incl. Union ready row 1401)
  * NJ split rules (` | ` joined phones / emails / locations / specialties)
  * no suppression list (is_suppressed = false for every row)
  * rollback locked to ^(bg|mx|mn|un)-enrich-001-2026-10-12$ and its source_system

DRY RUN BY DEFAULT. Every pre-GO session is read-only twice over: the session is
set READ ONLY and verified, and each work block runs inside BEGIN READ ONLY and
ends with ROLLBACK (the Supabase session pooler ignores the startup option).

  --county bg|mx|mn|un|all   counties to plan (apply/rollback: exactly one)
  --apply --production       write one county (one transaction, ON CONFLICT DO NOTHING)
  --rollback --production    delete exactly one county batch and exit

Receipts and reports hold counts, contractor_ids and license keys only — never
phone numbers, emails, websites or addresses. The package directory must live
outside every git working tree.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

TICKET = "NJ-ENRICH-001"
TICKET_REF = "NJ-ENRICH-001 (nj-4-county-enrich-2026-10-12)"
FIELDS = ("website", "phone", "email", "address_location", "specialty")
COLUMN = {"website": "website_url", "phone": "phone", "email": "email",
          "address_location": "additional_locations", "specialty": "specialties"}
HEADER16 = ["contractor_id", "license_key", "display_name", "website_url", "phone", "email", "primary_address",
            "additional_locations", "specialties", "source_refs", "scout_confidence", "scout_confidence_source",
            "review_flags", "original_label", "decision_ref", "check_status"]
LOAD_ACTIONS = ("load", "load_flagged")
HELD_ACTION = "held_founder_decision_pending:union_rosenfeld_dimatic"
ROLLBACK_BATCH_RE = re.compile(r"^(bg|mx|mn|un)-enrich-001-2026-10-12$")
EXISTING_BATCHES = ("md-enrich-001-2026-10-06", "md-enrich-002-2026-10-07", "bw-enrich-001-2026-10-08",
                    "pb-enrich-001-2026-10-08", "pn-enrich-001-2026-10-08")

COMBINED = ("combined/nj-4-county-publish-ready-2026-10-12.csv",
            "a15b1720e0aa5e26a5cd7eb73759f5bffecbac1858499e2a11ba4219cc8f0f66", 2743)
HELD = ("held/nj-4-county-held-excluded-2026-10-12.csv",
        "bafb528af8d97657e6fa95d4a19a67165b299b8602914626f145e95223b15246", 22510)


@dataclass(frozen=True)
class County:
    code: str
    name: str
    ready: str
    sha: str
    rows: int
    held: int
    excluded: str
    excluded_rows: int
    batch_id: str
    source_system: str
    observed_at: str
    fill: dict
    actions: dict


COUNTIES = {
    "bg": County("bg", "bergen", "bergen/dot-publish-ready-nj-bergen-complete-2026-10-09",
                 "51845c3ec27f4bcef9341393c1d60e4b4c957d96f3d4bd0b7f2b9076c0c40bc2", 921, 0,
                 "bergen/dot-publish-excluded-nj-bergen-complete-2026-10-09.csv", 7748,
                 "bg-enrich-001-2026-10-12", "dot_web_enrich_bg_2026_10", "2026-10-09T00:00:00-04:00",
                 {"website": 921, "phone": 914, "email": 677, "address_location": 227, "specialty": 919},
                 {"load": 358, "load_flagged": 563}),
    "mx": County("mx", "middlesex", "middlesex/dot-publish-ready-nj-middlesex-complete-2026-10-09",
                 "a8d91cddf8c616c5f909aab8d46c8b31a87d60de59e5f0f5158f261b4af3660c", 527, 0,
                 "middlesex/dot-publish-excluded-nj-middlesex-complete-2026-10-09.csv", 4854,
                 "mx-enrich-001-2026-10-12", "dot_web_enrich_mx_2026_10", "2026-10-09T00:00:00-04:00",
                 {"website": 527, "phone": 522, "email": 366, "address_location": 127, "specialty": 527},
                 {"load": 222, "load_flagged": 305}),
    "mn": County("mn", "monmouth", "monmouth/dot-publish-ready-nj-monmouth-complete-2026-10-09",
                 "42ed3194df3e47c3917c8d90af5a5a7a19bc984c9f56bc804dffcb5a66e9d812", 884, 0,
                 "monmouth/dot-publish-excluded-nj-monmouth-complete-2026-10-09.csv", 6172,
                 "mn-enrich-001-2026-10-12", "dot_web_enrich_mn_2026_10", "2026-10-09T00:00:00-04:00",
                 {"website": 884, "phone": 880, "email": 608, "address_location": 239, "specialty": 881},
                 {"load": 313, "load_flagged": 571}),
    "un": County("un", "union", "union/dot-publish-ready-nj-union-complete-2026-10-10",
                 "b5b3293510c89044c28c173077fd8ce565f6fe146864c1a7ff984622659e169f", 411, 1,
                 "union/dot-publish-excluded-nj-union-complete-2026-10-10.csv", 3735,
                 "un-enrich-001-2026-10-12", "dot_web_enrich_un_2026_10", "2026-10-10T00:00:00-04:00",
                 {"website": 410, "phone": 409, "email": 304, "address_location": 93, "specialty": 409},
                 {"load": 184, "load_flagged": 226}),
}
LOAD_ORDER = ("un", "mx", "mn", "bg")

VANITY = {c: d for d, letters in {"2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL", "6": "MNO",
                                  "7": "PQRS", "8": "TUV", "9": "WXYZ"}.items() for c in letters}


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


@dataclass
class Plan:
    county: County
    rows: list[dict]
    obs: list[Obs] = field(default_factory=list)
    excluded: list[dict] = field(default_factory=list)
    conflicts: list[dict] = field(default_factory=list)
    skipped_empty: Counter = field(default_factory=Counter)
    duplicates_collapsed: Counter = field(default_factory=Counter)
    international_phones: list[dict] = field(default_factory=list)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def collapse(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def normalize(field_name: str, value: str) -> str:
    v = collapse(value)
    if field_name == "website":
        return v.lower().rstrip("/")
    if field_name == "phone":
        return normalize_phone(v)
    return v.lower()


NANP = re.compile(r"(?<!\d)(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})(?!\d)")


def normalize_phone(v: str) -> str:
    """10-digit NANP number. Labels ("Office:", "(Toms River)") and extensions stay only in the display value.
    Vanity letters are mapped only when the cell has no plain 10-digit number (e.g. 800-PLUMBER)."""
    body = re.sub(r"^[A-Za-z][^:\d]*:\s*", "", collapse(v))
    if re.match(r"\+(?!1)\d", body):  # non-NANP international number: keep every digit, never truncate
        return "+" + re.sub(r"\D", "", re.split(r"\(", body)[0])
    m = NANP.search(body)
    if m:
        return "".join(m.groups())
    body = re.sub(r"\([^)]*[A-Za-z][^)]*\)", " ", body)
    body = re.sub(r"(?:ext|x)\.?\s*\d+\s*$", "", body, flags=re.I)
    digits = re.sub(r"\D", "", "".join(VANITY.get(ch, ch) for ch in body.upper()))
    if digits.startswith("1") and len(digits) >= 11:
        digits = digits[1:]
    return digits[:10] if len(digits) >= 10 else digits


def split_values(field_name: str, raw: str) -> list[str]:
    raw = raw or ""
    if not raw.strip():
        return []
    if field_name == "phone":
        parts = [q for p in raw.split(" | ") for q in re.split(r";(?![^()]*\))", p)]  # not inside (...)
    elif field_name == "specialty":
        parts = [q for p in raw.split(" | ") for q in p.split("; ")]
    elif field_name in ("email", "address_location"):  # never split locations on commas
        parts = raw.split(" | ")
    else:  # website: one value
        parts = [raw]
    return [collapse(p) for p in parts if collapse(p)]


def split_refs(raw: str) -> list[str]:
    parts = [q for p in (raw or "").split(" | ") for q in re.split(r"; (?=http)", p)]
    return [collapse(p) for p in parts if collapse(p)]


def split_flags(raw: str) -> list[str]:
    return [collapse(x) for x in (raw or "").split(";") if collapse(x)]


def assert_outside_git(path: Path) -> None:
    resolved = path.resolve()
    if ROOT == resolved or ROOT in resolved.parents:
        raise SystemExit("HARD STOP: package dir is inside the public repository")
    r = subprocess.run(["git", "-C", str(resolved), "rev-parse", "--show-toplevel"],
                       capture_output=True, text=True)
    if r.returncode == 0:
        raise SystemExit("HARD STOP: package dir is inside a git working tree")


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def verify_package(pkg: Path) -> dict:
    """SHA256SUMS (every file), combined/held pins, structural guards. Hard stop on any deviation."""
    errors: list[str] = []
    sums = (pkg / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines()
    matched = 0
    for line in sums:
        if not line.strip():
            continue
        want, name = line.split("  ", 1)
        p = pkg / name
        if not p.is_file():
            errors.append(f"missing {name}")
        elif sha256(p) != want:
            errors.append(f"sha256 mismatch {name}")
        else:
            matched += 1
    for name, want, _ in (COMBINED, HELD):
        if sha256(pkg / name) != want:
            errors.append(f"pin mismatch {name}")
    for c in COUNTIES.values():
        if sha256(pkg / (c.ready + ".csv")) != c.sha:
            errors.append(f"pin mismatch {c.ready}.csv")
    if errors:
        raise SystemExit("HARD STOP: " + "; ".join(errors))
    return {"sha256sums_files": len([s for s in sums if s.strip()]), "sha256_matched": matched}


def loadable(rows: list[dict], held_ids: set[str], held_keys: set[str]) -> list[dict]:
    """Rows whose package action is load/load_flagged. Any of them in the held file is a hard stop."""
    load = [r for r in rows if r["package_default_action"] in LOAD_ACTIONS]
    bad = [r for r in load if r["contractor_id"] in held_ids or r["license_key"].strip().upper() in held_keys]
    if bad:
        raise ValueError(f"{len(bad)} load rows are in the held file")
    return load


def load_county(pkg: Path, c: County) -> tuple[list[dict], dict]:
    """Rows of the combined file for this county that are loadable, after every structural check."""
    errors: list[str] = []
    combined = read_csv(pkg / COMBINED[0])
    held = read_csv(pkg / HELD[0])
    if len(combined) != COMBINED[2] or len(held) != HELD[2]:
        errors.append(f"combined/held rows {len(combined)}/{len(held)}")
    held_ids = {r["contractor_id"] for r in held}
    held_keys = {r["license_key"].strip().upper() for r in held if r.get("license_key")}

    ready = read_csv(pkg / (c.ready + ".csv"))
    doc = json.loads((pkg / (c.ready + ".json")).read_text(encoding="utf-8"))
    recs = doc["records"]
    recs = list(recs.values()) if isinstance(recs, dict) else recs
    if list(ready[0].keys()) != HEADER16:
        errors.append("ready header differs")
    if len(ready) != c.rows or len(recs) != c.rows or doc.get("row_count") != c.rows:
        errors.append(f"ready rows {len(ready)} json {len(recs)}/{doc.get('row_count')}")
    ids = [r["contractor_id"] for r in ready]
    if len(set(ids)) != len(ids) or not all(ids):
        errors.append("contractor_id not unique / blank")
    if {r["contractor_id"] for r in recs} != set(ids):
        errors.append("csv and json contractor_id sets differ")
    excluded = read_csv(pkg / c.excluded)
    if len(excluded) != c.excluded_rows:
        errors.append(f"excluded rows {len(excluded)}")
    if {r.get("contractor_id") for r in excluded} & set(ids):
        errors.append("ready/excluded overlap")

    mine = [r for r in combined if r["county"].lower() == c.name]
    if len(mine) != len(ready) or any({k: a[k] for k in HEADER16} != {k: b[k] for k in HEADER16}
                                      for a, b in zip(mine, ready)):
        errors.append("combined 16 columns differ from county file")
    if any(r["proposed_batch_id"] != c.batch_id or r["proposed_source_system"] != c.source_system for r in mine):
        errors.append("combined batch_id/source_system differ from config")
    actions = Counter(r["package_default_action"] for r in mine)
    if set(actions) - set(LOAD_ACTIONS) - {HELD_ACTION}:
        errors.append(f"unknown actions {sorted(set(actions))}")
    try:
        load = loadable(mine, held_ids, held_keys)
    except ValueError as e:
        errors.append(str(e))
        load = []
    not_loaded_held = [r for r in mine if r["package_default_action"] == HELD_ACTION]
    if len(not_loaded_held) != c.held or any(r["contractor_id"] not in held_ids for r in not_loaded_held):
        errors.append("held ready rows not as expected")
    if {a: actions.get(a, 0) for a in LOAD_ACTIONS} != c.actions:
        errors.append(f"actions {dict(actions)}")
    fill = {f: sum(1 for r in load if (r.get(COLUMN[f]) or "").strip()) for f in FIELDS}
    if fill != c.fill:
        errors.append(f"field fill {fill}")
    for r in load:
        flags = split_flags(r.get("review_flags"))
        if (r.get("email") or "").strip() and any(f.startswith("email_undeliverable") or f == "email_cannot_receive_mail"
                                                  for f in flags):
            errors.append("ready email carries an undeliverable flag")
            break
    if errors:
        raise SystemExit(f"HARD STOP ({c.name}): " + "; ".join(errors))
    flags = Counter(f for r in load for f in set(split_flags(r.get("review_flags"))))
    return load, {
        "ready_rows": len(ready), "load_rows": len(load), "held_rows_not_loaded": len(not_loaded_held),
        "held_not_loaded": [{"contractor_id": r["contractor_id"], "license_key": r["license_key"]} for r in not_loaded_held],
        "excluded_rows": len(excluded), "actions": dict(actions), "field_fill": fill,
        "held_file_overlap": 0, "ready_excluded_overlap": 0, "review_flags": dict(sorted(flags.items())),
        "held_ids": held_ids,
    }


def value_hash(field_name: str, value_normalized: str) -> str:
    """Contact-free identifier of an observation value (holds files never carry the value itself)."""
    return hashlib.sha256(f"{field_name}|{value_normalized}".encode("utf-8")).hexdigest()


def read_holds(path: Path | None) -> list[dict]:
    """Founder observation holds: {decision, county, contractor_id, field, value_sha256}. Profiles stay eligible."""
    if not path:
        return []
    holds = json.loads(path.read_text(encoding="utf-8"))["holds"]
    keys = [(h["contractor_id"], h["field"], h["value_sha256"]) for h in holds]
    if len(keys) != len(set(keys)) or any(h["field"] not in FIELDS for h in holds):
        raise SystemExit("HARD STOP: holds file has duplicate or invalid entries")
    return holds


def apply_holds(plan: Plan, holds: list[dict]) -> dict:
    """Remove held observations from the plan. Every hold for this county must match exactly one observation."""
    mine = {(h["contractor_id"], h["field"], h["value_sha256"]): h["decision"] for h in holds
            if h["county"] == plan.county.name}
    kept, held = [], Counter()
    for o in plan.obs:
        d = mine.pop((o.contractor_id, o.field, value_hash(o.field, o.value_normalized)), None)
        if d is None:
            kept.append(o)
        else:
            held[d] += 1
    if mine:
        raise SystemExit(f"HARD STOP: {len(mine)} founder holds did not match a planned observation in {plan.county.name}")
    plan.obs = kept
    return dict(held)


def build_observations(rows: list[dict], plan: Plan, ok_ids: set[str], file_sha: str) -> None:
    c = plan.county
    for r in rows:
        if r["contractor_id"] not in ok_ids:
            continue
        lic = r["license_key"].strip().upper()
        refs = split_refs(r.get("source_refs"))
        flags = split_flags(r.get("review_flags"))
        decision = (f"{TICKET_REF} | county: {c.name} | file sha256: {file_sha} | "
                    f"file: {collapse(r.get('decision_ref') or '')} | label: {r.get('original_label')} | "
                    f"action: {r.get('package_default_action')}")
        for fname in FIELDS:
            values = split_values(fname, r.get(COLUMN[fname]) or "")
            if not values:
                plan.skipped_empty[fname] += 1
                continue
            seen: set[str] = set()
            for v in values:
                n = normalize(fname, v)
                if not n:
                    plan.skipped_empty[fname] += 1
                    continue
                if fname == "website" and urlparse(v).scheme not in ("http", "https"):
                    raise SystemExit(f"HARD STOP: non-http website for {lic}")
                if fname == "phone" and len(n) != 10:
                    if not n.startswith("+"):
                        raise SystemExit(f"HARD STOP: phone does not normalize to 10 digits for {lic}")
                    plan.international_phones.append({"contractor_id": r["contractor_id"], "license_key": lic})
                if n in seen:
                    plan.duplicates_collapsed[fname] += 1
                    continue
                seen.add(n)
                plan.obs.append(Obs(r["contractor_id"], lic, fname, v, n, len(seen) - 1, refs,
                                    r.get("scout_confidence") or "", flags, decision))


# ---------- database ----------

def connect(url: str, read_only: bool):
    import psycopg
    from ingest.env import normalize_database_url

    conn = psycopg.connect(normalize_database_url(url), autocommit=True)
    conn.execute("SET statement_timeout = '120s'")
    conn.execute("SET lock_timeout = '5s'")
    if read_only:
        conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
        if conn.execute("SHOW transaction_read_only").fetchone()[0] != "on":
            conn.close()
            raise SystemExit("HARD STOP: session did not become read-only")
    return conn


class ReadOnlyBlock:
    """BEGIN READ ONLY … verify … ROLLBACK (never COMMIT) around every pre-GO work block."""

    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        self.conn.execute("BEGIN READ ONLY")
        if self.conn.execute("SHOW transaction_read_only").fetchone()[0] != "on":
            self.conn.execute("ROLLBACK")
            raise SystemExit("HARD STOP: transaction is not read-only")
        return self.conn

    def __exit__(self, *exc):
        self.conn.execute("ROLLBACK")
        return False


def preflight(conn) -> dict:
    """Schema, constraints, RLS, grants, existing batches. Read-only."""
    q = lambda sql, *a: conn.execute(sql, a).fetchall()  # noqa: E731
    cols = q("""SELECT column_name, data_type, is_nullable FROM information_schema.columns
                WHERE table_schema='public' AND table_name='contractor_enrichment_observations' ORDER BY ordinal_position""")
    cons = q("""SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint
                WHERE conrelid='public.contractor_enrichment_observations'::regclass ORDER BY conname""")
    rls = q("""SELECT relrowsecurity, relforcerowsecurity FROM pg_class
               WHERE oid='public.contractor_enrichment_observations'::regclass""")[0]
    policies = q("""SELECT policyname, cmd, roles::text FROM pg_policies
                    WHERE schemaname='public' AND tablename='contractor_enrichment_observations'""")
    grants = q("""SELECT grantee, privilege_type FROM information_schema.role_table_grants
                  WHERE table_schema='public' AND table_name='contractor_enrichment_observations'
                    AND grantee IN ('anon','authenticated') ORDER BY 1,2""")
    triggers = q("""SELECT tgname FROM pg_trigger WHERE tgrelid='public.contractor_enrichment_observations'::regclass
                    AND NOT tgisinternal""")
    batches = q("""SELECT source_system, batch_id, count(*), count(DISTINCT contractor_id)
                   FROM contractor_enrichment_observations GROUP BY 1,2 ORDER BY 2""")
    total = q("SELECT count(*) FROM contractor_enrichment_observations")[0][0]
    nj_present = conn.execute(
        """SELECT count(*) FROM contractor_enrichment_observations
           WHERE batch_id ~ '^(bg|mx|mn|un)-enrich-' OR source_system = ANY(%s) OR batch_id = ANY(%s)""",
        ([c.source_system for c in COUNTIES.values()], [c.batch_id for c in COUNTIES.values()])).fetchone()[0]
    rollback_reach = conn.execute(
        """SELECT count(*) FROM contractor_enrichment_observations
           WHERE (source_system, batch_id) IN (SELECT * FROM unnest(%s::text[], %s::text[]))""",
        ([c.source_system for c in COUNTIES.values()], [c.batch_id for c in COUNTIES.values()])).fetchone()[0]
    return {
        "columns": [{"name": n, "type": t, "nullable": nn} for n, t, nn in cols],
        "constraints": [{"name": n, "type": t, "def": d} for n, t, d in cons],
        "rls": {"enabled": rls[0], "forced": rls[1]},
        "policies": [{"name": n, "cmd": c, "roles": r} for n, c, r in policies],
        "anon_authenticated_grants": [f"{g}:{p}" for g, p in grants],
        "triggers": [t for (t,) in triggers],
        "batches": [{"source_system": s, "batch_id": b, "rows": n, "profiles": p} for s, b, n, p in batches],
        "total_rows": total,
        "nj_rows_present": nj_present,
        "rows_matched_by_nj_rollback_predicates_now": rollback_reach,
        "existing_batch_rows": {b: n for _, b, n, _ in batches if b in EXISTING_BATCHES},
    }


def identity_gate(conn, rows: list[dict], plan: Plan) -> set[str]:
    ids = [r["contractor_id"] for r in rows]
    contractors = {cid: (phone, website, st) for cid, phone, website, st in conn.execute(
        "SELECT id::text, phone, website, home_state FROM contractors WHERE id = ANY(%s::uuid[])", (ids,)).fetchall()}
    lic: dict[str, set[str]] = {}
    for cid, key in conn.execute(
            """SELECT contractor_id::text, upper(external_key) FROM licenses
               WHERE source_system = 'nj_dca' AND contractor_id = ANY(%s::uuid[])""", (ids,)).fetchall():
        lic.setdefault(cid, set()).add(key)
    owners: dict[str, set[str]] = {}
    for key, cid in conn.execute(
            """SELECT upper(external_key), contractor_id::text FROM licenses
               WHERE source_system = 'nj_dca' AND upper(external_key) = ANY(%s)""",
            ([r["license_key"].strip().upper() for r in rows],)).fetchall():
        owners.setdefault(key, set()).add(cid)

    ok: set[str] = set()
    for r in rows:
        cid, key = r["contractor_id"], r["license_key"].strip().upper()
        reason = None
        if cid not in contractors:
            reason = "contractor_id_missing"
        elif contractors[cid][2] != "NJ":
            reason = "not_nj"
        elif key not in lic.get(cid, set()):
            reason = "license_key_mismatch"
        elif owners.get(key, set()) - {cid}:
            reason = "license_key_owned_by_other_contractor"
        if reason:
            plan.excluded.append({"contractor_id": cid, "license_key": key, "reason": reason})
            continue
        ok.add(cid)
        phone, website, _ = contractors[cid]
        for col, val in (("phone", phone), ("website", website)):
            if (val or "").strip():
                plan.conflicts.append({"contractor_id": cid, "license_key": key, "column": f"contractors.{col}",
                                       "action": "retained_existing_canonical; enrichment stored as observation"})
    return ok


def existing_for(conn, ids: list[str]) -> int:
    return conn.execute("SELECT count(*) FROM contractor_enrichment_observations WHERE contractor_id = ANY(%s::uuid[])",
                        (ids,)).fetchone()[0]


def already_present(conn, plan: Plan) -> int:
    """Planned idempotency keys already in the table (a rerun after load must make this == planned)."""
    if not plan.obs:
        return 0
    return conn.execute(
        """SELECT count(*) FROM contractor_enrichment_observations e
           JOIN unnest(%s::uuid[], %s::text[], %s::text[]) AS p(cid, f, v)
             ON e.contractor_id = p.cid AND e.field = p.f AND e.value_normalized = p.v AND e.batch_id = %s""",
        ([o.contractor_id for o in plan.obs], [o.field for o in plan.obs], [o.value_normalized for o in plan.obs],
         plan.county.batch_id)).fetchone()[0]


def counts(obs: list[Obs]) -> dict:
    return {f: {"total": sum(1 for o in obs if o.field == f),
                "profiles": len({o.contractor_id for o in obs if o.field == f})} for f in FIELDS}


def db_counts(conn, c: County) -> dict:
    out = {f: {"total": 0, "profiles": 0} for f in FIELDS}
    for f, t, n in conn.execute(
            """SELECT field, count(*), count(DISTINCT contractor_id) FROM contractor_enrichment_observations
               WHERE source_system = %s AND batch_id = %s GROUP BY field""", (c.source_system, c.batch_id)).fetchall():
        out[f] = {"total": t, "profiles": n}
    return out


def shared_values(obs: list[Obs]) -> dict:
    """Normalized contact values attached to more than one contractor_id inside the plan (counts only)."""
    out = {}
    for f in ("website", "phone", "email"):
        owners: dict[str, set[str]] = {}
        for o in obs:
            if o.field == f:
                owners.setdefault(o.value_normalized, set()).add(o.contractor_id)
        multi = [s for s in owners.values() if len(s) > 1]
        out[f] = {"values_on_multiple_profiles": len(multi), "profiles_involved": len(set().union(*multi)) if multi else 0}
    return out


def rollback_guard(c: County, batch_id: str) -> None:
    if not ROLLBACK_BATCH_RE.match(batch_id) or batch_id != c.batch_id or batch_id in EXISTING_BATCHES:
        raise SystemExit(f"HARD STOP: rollback refused for batch_id {batch_id!r}")


def rollback_sql() -> str:
    return "DELETE FROM contractor_enrichment_observations WHERE source_system = %s AND batch_id = %s"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--package-dir", required=True, type=Path)
    ap.add_argument("--county", default="all", choices=["all", *COUNTIES])
    ap.add_argument("--database-url-env", default="DATABASE_URL")
    ap.add_argument("--env-file", type=Path, help="git-ignored .env.local to read the URL from (never printed)")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--production", action="store_true")
    ap.add_argument("--rollback", action="store_true")
    ap.add_argument("--holds", type=Path, help="founder observation holds JSON (outside the repo; hashes, no values)")
    ap.add_argument("--receipt", type=Path, help="full JSON receipt (outside the repo); no contact values")
    args = ap.parse_args()

    assert_outside_git(args.package_dir)
    if args.receipt:
        assert_outside_git(args.receipt.parent if args.receipt.parent.exists() else args.receipt.parent.parent)

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
    if writes and args.county == "all":
        raise SystemExit("apply/rollback take exactly one --county")
    codes = [k for k in LOAD_ORDER if args.county in ("all", k)]

    if args.rollback:
        c = COUNTIES[args.county]
        rollback_guard(c, c.batch_id)
        with connect(url, read_only=False) as conn, conn.transaction():
            cur = conn.execute(rollback_sql(), (c.source_system, c.batch_id))
            print(json.dumps({"rollback": {"source_system": c.source_system, "batch_id": c.batch_id, "deleted": cur.rowcount}}))
        return 0

    pkg = verify_package(args.package_dir)
    holds = read_holds(args.holds)
    receipt: dict = {"ticket": TICKET, "mode": "apply" if args.apply else "dry_run",
                     "target": "local" if local else ("supabase:jhjztnisugdsuliriajp" if "jhjztnisugdsuliriajp" in url else "other"),
                     "package": pkg, "counties": {}}
    with connect(url, read_only=not args.apply) as conn:
        if not args.apply:
            with ReadOnlyBlock(conn):
                receipt["preflight"] = preflight(conn)
        for code in codes:
            c = COUNTIES[code]
            rows, inputs = load_county(args.package_dir, c)
            held_ids = inputs.pop("held_ids")
            plan = Plan(county=c, rows=rows)
            if args.apply:
                ctx = conn.transaction()
            else:
                ctx = ReadOnlyBlock(conn)
            with ctx:
                ok = identity_gate(conn, rows, plan)
                build_observations(rows, plan, ok, c.sha)
                if any(o.contractor_id in held_ids for o in plan.obs):
                    raise SystemExit("HARD STOP: held contractor_id in plan")
                pre_holds = len(plan.obs)
                founder_held = apply_holds(plan, holds)
                planned = counts(plan.obs)
                ids = sorted({r["contractor_id"] for r in rows})
                cr = {
                    "batch_id": c.batch_id, "source_system": c.source_system, "observed_at": c.observed_at,
                    "inputs": inputs,
                    "identity": {"rows": len(rows), "gate_pass": len(ok), "excluded": plan.excluded},
                    "existing_observations_for_load_ids": existing_for(conn, ids),
                    "existing_observations_for_held_ids": existing_for(conn, sorted(held_ids)) if code == codes[0] else None,
                    "canonical_conflicts": plan.conflicts,
                    "batch_rows_before": sum(v["total"] for v in db_counts(conn, c).values()),
                    "pre_decision_total": pre_holds, "founder_held": founder_held,
                    "planned": planned, "planned_total": len(plan.obs),
                    "planned_keys_already_present": already_present(conn, plan),
                    "planned_duplicate_keys": len(plan.obs) - len({(o.contractor_id, o.field, o.value_normalized) for o in plan.obs}),
                    "skipped_empty_cells": dict(plan.skipped_empty),
                    "duplicates_collapsed_within_profile": dict(plan.duplicates_collapsed),
                    "shared_values_across_profiles": shared_values(plan.obs),
                    "international_phones_planned": sum(1 for o in plan.obs if o.field == "phone" and o.value_normalized.startswith("+")),
                }
                if args.apply:
                    if plan.excluded or cr["existing_observations_for_load_ids"] or cr["batch_rows_before"]:
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
                              c.source_system, o.confidence, o.review_flags, o.decision_ref, c.batch_id, c.observed_at)
                             for o in plan.obs])
                    actual = db_counts(conn, c)
                    stray = conn.execute(
                        """SELECT count(*) FROM contractor_enrichment_observations
                           WHERE source_system = %s AND batch_id = %s AND NOT (contractor_id = ANY(%s::uuid[]))""",
                        (c.source_system, c.batch_id, sorted(ok))).fetchone()[0]
                    if actual != planned or stray:
                        raise SystemExit(f"HARD STOP: post-insert counts differ from plan (stray={stray}); rolled back")
                    inserted = sum(v["total"] for v in actual.values())
                    cr["applied"] = {"inserted": inserted, "skipped_on_conflict": len(plan.obs) - inserted, "db_counts": actual}
            receipt["counties"][c.name] = cr

    text = json.dumps(receipt, indent=2, ensure_ascii=False)
    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(text + "\n", encoding="utf-8")
    summary = {"mode": receipt["mode"], "target": receipt["target"], "package": pkg, "counties": {}}
    for name, cr in receipt["counties"].items():
        summary["counties"][name] = {
            "batch_id": cr["batch_id"], "load_rows": cr["inputs"]["load_rows"], "gate_pass": cr["identity"]["gate_pass"],
            "gate_excluded": len(cr["identity"]["excluded"]), "planned_total": cr["planned_total"],
            "planned": {f: f"{v['total']}/{v['profiles']}" for f, v in cr["planned"].items()},
            "conflicts": len(cr["canonical_conflicts"]), "pre_decision_total": cr["pre_decision_total"], "founder_held": cr["founder_held"], "international_phones_planned": cr["international_phones_planned"], **({"applied": cr["applied"]["inserted"]} if "applied" in cr else {})}
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
