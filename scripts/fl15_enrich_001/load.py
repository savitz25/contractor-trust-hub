#!/usr/bin/env python3
"""FL15-ENRICH-001 loader: FL 15-county workbook contact enrichment (config of the OR-ENRICH-001 loader) -> contractor_enrichment_observations.

Isolated from scripts/md_enrich_001 and scripts/nj_enrich_001. Those loaders are not imported.
Miami-Dade reaches this module only when scripts/md_enrich_001/load.py is invoked with --county or.

DRY RUN BY DEFAULT. Every pre-GO session sets the session read-only, checks
SHOW transaction_read_only = on, and runs inside BEGIN READ ONLY ... ROLLBACK.
The Supabase session pooler ignores a startup read-only option.

  --county fl15
  --package-dir PATH         publish-ready package outside every git working tree
  --apply --production       refused unless CONTRACTOR_FL15_GO is the Founder phrase
  --rollback --production    same phrase; deletes only fl15-enrich-001-2026-10-22

Receipts hold counts, contractor_ids and license keys. They do not hold phones,
emails, websites or addresses.
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
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

TICKET = "FL15-ENRICH-001"
COUNTY = "fl15"
BATCH_ID = "fl15-enrich-001-2026-10-22"
SOURCE_SYSTEM = "workbook_contact_enrich_fl15_2026_10"
OBSERVED_AT = "2026-10-22T00:00:00-04:00"
READY_NAME = "fl-contact-enrich-include-2026-10-22.csv"
READY_SHA = "329bf2d545cdd210a672da9fc5883261bf571a11a1b2ad9972512647d48e3f41"
READY_ROWS = 2732
GO_PHRASE = "FL-CONTACT-ENRICH-15CO-LOAD-GO"
GO_ENV = "CONTRACTOR_FL15_GO"

FIELDS = ("website", "phone", "email", "address_location")
COLUMN = {"website": "website", "phone": "phone", "email": "email", "address_location": "address_location"}
HEADER16 = ["contractor_id", "license_key", "county", "website", "phone", "email", "address_location"]
EXPECTED_FILL = {"website": 2732, "phone": 2653, "email": 1694, "address_location": 1780}
EXPECTED_OBS = {"website": 2732, "phone": 2855, "email": 1770, "address_location": 1886}
EXPECTED_OBS_TOTAL = 9243
EXPECTED_ACTIONS = {"load": 2732, "load_flagged": 0, "load_suppress_email": 0}
EMAIL_SUPPRESS_FLAGS = (
    "email_undeliverable:nxdomain",
    "email_undeliverable:null_mx",
    "field_check_failed:email_not_on_live_site",
)
TRANSIENT_FLAG = "website:down_at_check_transient"
ROLLBACK_BATCH_RE = re.compile(r"^fl15-enrich-001-2026-10-22$")
PROTECTED_BATCHES = (
    "md-enrich-001-2026-10-06",
    "md-enrich-002-2026-10-07",
    "bw-enrich-001-2026-10-08",
    "pb-enrich-001-2026-10-08",
    "pn-enrich-001-2026-10-08",
    "hb-enrich-001-2026-10-17",
    "le-enrich-001-2026-10-17",
    "bg-enrich-001-2026-10-12",
    "mx-enrich-001-2026-10-12",
    "mn-enrich-001-2026-10-12",
    "un-enrich-001-2026-10-12",
    "mo-enrich-001-2026-10-17",
    "ps-enrich-001-2026-10-17",
    "bu-enrich-001-2026-10-17",
    "or-enrich-001-2026-10-17",
    "br-enrich-001-2026-10-20",
    "pa-enrich-001-2026-10-20",
    "pk-enrich-001-2026-10-20",
    "at-enrich-001-2026-10-19",
    "gl-enrich-001-2026-10-19",
    "hn-enrich-001-2026-10-19",
    "sx-enrich-001-2026-10-19",
    "me-enrich-001-2026-10-18",
)
PROTECTED_SOURCE_SYSTEMS = (
    "scout_web_enrich_md_2026_10",
    "dot_web_enrich_md_2026_10",
    "dot_web_enrich_bw_2026_10",
    "dot_web_enrich_pb_2026_10",
    "dot_web_enrich_pn_2026_10",
    "dot_web_enrich_hb_2026_10",
    "dot_web_enrich_le_2026_10",
    "dot_web_enrich_bg_2026_10",
    "dot_web_enrich_mx_2026_10",
    "dot_web_enrich_mn_2026_10",
    "dot_web_enrich_un_2026_10",
    "dot_web_enrich_mo_2026_10",
    "dot_web_enrich_ps_2026_10",
    "dot_web_enrich_bu_2026_10",
    "dot_web_enrich_or_2026_10",
    "dot_web_enrich_br_2026_10",
    "dot_web_enrich_pa_2026_10",
    "dot_web_enrich_pk_2026_10",
    "dot_web_enrich_at_2026_10",
    "dot_web_enrich_gl_2026_10",
    "dot_web_enrich_hn_2026_10",
    "dot_web_enrich_sx_2026_10",
    "dot_web_enrich_me_2026_10",
)
LEE_BATCH_ID = "le-enrich-001-2026-10-17"
ROLLBACK_SQL = (
    "DELETE FROM contractor_enrichment_observations "
    "WHERE source_system = 'workbook_contact_enrich_fl15_2026_10' "
    "AND batch_id = 'fl15-enrich-001-2026-10-22';"
)

VANITY = {c: d for d, letters in {"2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL", "6": "MNO",
                                  "7": "PQRS", "8": "TUV", "9": "WXYZ"}.items() for c in letters}
NANP = re.compile(r"(?<!\d)(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})(?!\d)")


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
    return re.sub(r"\s+", " ", s or "").strip()


def normalize_phone(v: str) -> str:
    """10-digit NANP. The display value keeps labels. Vanity letters map when no plain 10-digit number is present."""
    body = re.sub(r"^[A-Za-z][^:\d]*:\s*", "", collapse(v))
    if re.match(r"\+(?!1)\d", body):
        return "+" + re.sub(r"\D", "", re.split(r"\(", body)[0])
    m = NANP.search(body)
    if m:
        return "".join(m.groups())
    body = re.sub(r"\([^)]*[A-Za-z][^)]*\)", " ", body)
    body = re.sub(r"\b(?:ext|x)\.?\s*\d+\s*$", "", body, flags=re.I)
    digits = re.sub(r"\D", "", "".join(VANITY.get(ch, ch) for ch in body.upper()))
    if digits.startswith("1") and len(digits) >= 11:
        digits = digits[1:]
    return digits[:10] if len(digits) >= 10 else digits


def normalize(field_name: str, value: str) -> str:
    v = collapse(value)
    if field_name == "website":
        return v.lower().rstrip("/")
    if field_name == "phone":
        return normalize_phone(v)
    return v.lower()


def split_values(field_name: str, raw: str) -> list[str]:
    raw = raw or ""
    if not raw.strip():
        return []
    if field_name == "phone":
        parts = [q for p in raw.split(" | ") for q in re.split(r";(?![^()]*\))", p)]
    elif field_name == "specialty":
        parts = [q for p in raw.split(" | ") for q in p.split("; ")]
    elif field_name in ("email", "address_location"):
        parts = raw.split(" | ")
    else:
        parts = [raw]
    return [collapse(p) for p in parts if collapse(p)]


def split_refs(raw: str) -> list[str]:
    parts = [q for p in (raw or "").split(" | ") for q in re.split(r"; (?=http)", p)]
    return [collapse(p) for p in parts if collapse(p)]


def split_flags(raw: str) -> list[str]:
    return [collapse(x) for x in (raw or "").split(";") if collapse(x)]


def classify_row(row: dict) -> str:
    flags = split_flags(row.get("review_flags"))
    has_email = bool((row.get("email") or "").strip())
    if has_email and any(flag in EMAIL_SUPPRESS_FLAGS for flag in flags):
        return "load_suppress_email"
    if flags:
        return "load_flagged"
    return "load"


def suppression_for(field_name: str, flags: list[str], has_email: bool) -> tuple[bool, str | None]:
    if field_name != "email" or not has_email:
        return False, None
    hit = [flag for flag in flags if flag in EMAIL_SUPPRESS_FLAGS]
    if not hit:
        return False, None
    return True, f"email_cannot_receive_mail:{hit[0]}"


def assert_outside_git(path: Path) -> None:
    resolved = path.resolve()
    if ROOT == resolved or ROOT in resolved.parents:
        raise SystemExit("HARD STOP: package dir is inside the contractor-trust-hub working tree")
    probe = resolved if resolved.exists() else resolved.parent
    result = subprocess.run(["git", "-C", str(probe), "rev-parse", "--show-toplevel"],
                            capture_output=True, text=True)
    if result.returncode == 0:
        raise SystemExit("HARD STOP: package dir is inside a git working tree")


def rollback_guard(batch_id: str = BATCH_ID, source_system: str = SOURCE_SYSTEM) -> None:
    if batch_id != BATCH_ID or source_system != SOURCE_SYSTEM:
        raise SystemExit("HARD STOP: rollback refused for a different batch")
    if not ROLLBACK_BATCH_RE.match(batch_id or ""):
        raise SystemExit("HARD STOP: rollback regex refused this batch_id")
    if batch_id in PROTECTED_BATCHES or source_system in PROTECTED_SOURCE_SYSTEMS:
        raise SystemExit("HARD STOP: rollback refused for a protected batch")
    for protected in PROTECTED_BATCHES:
        if ROLLBACK_BATCH_RE.match(protected):
            raise SystemExit("HARD STOP: rollback regex matches a protected batch")


def rollback_sql() -> str:
    rollback_guard()
    return ROLLBACK_SQL


def require_go() -> None:
    if os.environ.get(GO_ENV) != GO_PHRASE:
        raise SystemExit("HARD STOP: production write requires the Founder GO phrase")


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def verify_package(pkg: Path) -> dict:
    errors: list[str] = []
    sums_path = pkg / "SHA256SUMS"
    if not sums_path.is_file():
        raise SystemExit("HARD STOP: SHA256SUMS missing")
    listed: dict[str, str] = {}
    for line in sums_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        want, name = line.split("  ", 1)
        listed[name.strip()] = want.strip()
        target = pkg / name.strip()
        if not target.is_file():
            errors.append(f"missing {name.strip()}")
        elif sha256(target) != want.strip():
            errors.append(f"sha256 mismatch {name.strip()}")
    extra = sorted(p.name for p in pkg.iterdir() if p.name != "SHA256SUMS" and p.name not in listed)
    if extra:
        errors.append("extra data file")
    if listed.get(READY_NAME) != READY_SHA:
        errors.append("ready csv pin mismatch")
    if errors:
        raise SystemExit("HARD STOP: " + "; ".join(errors))

    rows = read_csv(pkg / READY_NAME)
    if sha256(pkg / READY_NAME) != READY_SHA:
        raise SystemExit("HARD STOP: ready csv sha256 mismatch")
    if not rows or list(rows[0].keys()) != HEADER16:
        raise SystemExit("HARD STOP: ready header differs")
    if len(rows) != READY_ROWS:
        raise SystemExit(f"HARD STOP: ready rows {len(rows)}")
    ids = [row["contractor_id"].strip() for row in rows]
    keys = [row["license_key"].strip().upper() for row in rows]
    if len(set(ids)) != len(ids) or not all(ids):
        raise SystemExit("HARD STOP: contractor_id not unique")
    if len(set(keys)) != len(keys) or not all(keys):
        raise SystemExit("HARD STOP: license_key not unique")
    fill = {field_name: sum(1 for row in rows if (row.get(COLUMN[field_name]) or "").strip()) for field_name in FIELDS}
    if fill != EXPECTED_FILL:
        raise SystemExit("HARD STOP: field fill differs")
    actions = Counter(classify_row(row) for row in rows)
    if {name: actions.get(name, 0) for name in EXPECTED_ACTIONS} != EXPECTED_ACTIONS:
        raise SystemExit("HARD STOP: load classification differs")
    flags = Counter(flag for row in rows for flag in set(split_flags(row.get("review_flags"))))
    return {
        "ready_rows": len(rows),
        "ready_sha256": READY_SHA,
        "field_fill": fill,
        "actions": dict(actions),
        "suppressed_email_rows": actions["load_suppress_email"],
        "review_flags": dict(sorted(flags.items())),
        "rows": rows,
    }


def rows_for_ready(rows: list[dict], ready_ids: set[str]) -> list[dict]:
    """Ids outside the pinned ready file produce no observations."""
    return [row for row in rows if row["contractor_id"] in ready_ids]


def build_observations(rows: list[dict], plan: Plan, ok_ids: set[str], file_sha: str) -> None:
    for row in rows:
        if row["contractor_id"] not in ok_ids:
            continue
        lic = row["license_key"].strip().upper()
        refs = split_refs(row.get("source_refs"))
        flags = split_flags(row.get("review_flags"))
        has_email = bool((row.get("email") or "").strip())
        action = classify_row(row)
        decision = (f"{TICKET} | county: fl15 | file sha256: {file_sha} | "
                    f"label: {row.get('original_label') or ''} | action: {action}")
        for fname in FIELDS:
            values = split_values(fname, row.get(COLUMN[fname]) or "")
            if not values:
                plan.skipped_empty[fname] += 1
                continue
            seen: set[str] = set()
            suppressed, reason = suppression_for(fname, flags, has_email)
            for value in values:
                normalized = normalize(fname, value)
                if not normalized:
                    plan.skipped_empty[fname] += 1
                    continue
                if fname == "website" and urlparse(value).scheme not in ("http", "https"):
                    raise SystemExit("HARD STOP: non-http website")
                if fname == "phone" and len(normalized) != 10 and not normalized.startswith("+"):
                    raise SystemExit(f"HARD STOP: phone does not normalize to 10 digits for {lic}")
                if normalized in seen:
                    plan.duplicates_collapsed[fname] += 1
                    continue
                seen.add(normalized)
                plan.obs.append(Obs(
                    row["contractor_id"], lic, fname, value, normalized, len(seen) - 1, refs,
                    row.get("scout_confidence") or "", flags, decision, suppressed, reason,
                ))


def counts(obs: list[Obs]) -> dict:
    out = {}
    for fname in FIELDS:
        selected = [obs_row for obs_row in obs if obs_row.field == fname]
        out[fname] = {
            "total": len(selected),
            "public": sum(1 for obs_row in selected if not obs_row.is_suppressed),
            "suppressed": sum(1 for obs_row in selected if obs_row.is_suppressed),
            "profiles": len({obs_row.contractor_id for obs_row in selected}),
        }
    return out


def proposed_inserts(obs: list[Obs], already_present: set[tuple]) -> list[Obs]:
    """Observations whose idempotency key is not already stored.

    A second planner run against a complete batch proposes nothing. The key is
    (contractor_id, field, value_normalized, batch_id).
    """
    return [
        item for item in obs
        if (item.contractor_id, item.field, item.value_normalized, BATCH_ID) not in already_present
    ]


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
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        self.conn.execute("BEGIN READ ONLY")
        if self.conn.execute("SHOW transaction_read_only").fetchone()[0] != "on":
            self.conn.execute("ROLLBACK")
            print("ROLLBACK")
            raise SystemExit("HARD STOP: transaction is not read-only")
        return self.conn

    def __exit__(self, *exc):
        self.conn.execute("ROLLBACK")
        print("ROLLBACK")
        return False


def batch_counts(conn) -> list[dict]:
    rows = conn.execute(
        """SELECT source_system, batch_id, count(*)
           FROM contractor_enrichment_observations
           GROUP BY 1, 2 ORDER BY 2, 1"""
    ).fetchall()
    return [{"source_system": source, "batch_id": batch, "rows": count} for source, batch, count in rows]


def identity_gate(conn, rows: list[dict], plan: Plan) -> set[str]:
    ids = [row["contractor_id"] for row in rows]
    contractors = {cid: (phone, website, state) for cid, phone, website, state in conn.execute(
        "SELECT id::text, phone, website, home_state FROM contractors WHERE id = ANY(%s::uuid[])", (ids,)).fetchall()}
    lic: dict[str, set[str]] = {}
    for cid, key in conn.execute(
            """SELECT contractor_id::text, upper(external_key) FROM licenses
               WHERE source_system = 'fl_dbpr' AND contractor_id = ANY(%s::uuid[])""", (ids,)).fetchall():
        lic.setdefault(cid, set()).add(key)
    owners: dict[str, set[str]] = {}
    for key, cid in conn.execute(
            """SELECT upper(external_key), contractor_id::text FROM licenses
               WHERE source_system = 'fl_dbpr' AND upper(external_key) = ANY(%s)""",
            ([row["license_key"].strip().upper() for row in rows],)).fetchall():
        owners.setdefault(key, set()).add(cid)

    ok: set[str] = set()
    for row in rows:
        cid, key = row["contractor_id"], row["license_key"].strip().upper()
        reason = None
        if cid not in contractors:
            reason = "contractor_id_missing"
        elif contractors[cid][2] != "FL":
            reason = "not_fl"
        elif key not in lic.get(cid, set()):
            reason = "license_key_mismatch"
        elif owners.get(key, set()) - {cid}:
            reason = "license_key_owned_by_other_contractor"
        if reason:
            plan.excluded.append({"contractor_id": cid, "license_key": key, "reason": reason})
            continue
        ok.add(cid)
        phone, website, _state = contractors[cid]
        for column, value in (("phone", phone), ("website", website)):
            if (value or "").strip():
                plan.conflicts.append({"contractor_id": cid, "license_key": key, "column": f"contractors.{column}",
                                       "action": "retained_existing_canonical"})
    return ok


def existing_for(conn, ids: list[str]) -> int:
    if not ids:
        return 0
    return conn.execute(
        "SELECT count(*) FROM contractor_enrichment_observations WHERE contractor_id = ANY(%s::uuid[])",
        (ids,)).fetchone()[0]


def batch_exists(conn) -> int:
    return conn.execute(
        """SELECT count(*) FROM contractor_enrichment_observations
           WHERE source_system = %s AND batch_id = %s""",
        (SOURCE_SYSTEM, BATCH_ID)).fetchone()[0]


def _orange_groups(batches: list[dict]) -> list[dict]:
    return [row for row in batches if row["batch_id"] == BATCH_ID]


def _protected_counts(batches: list[dict]) -> dict[tuple, int]:
    protected = set(PROTECTED_BATCHES)
    return {
        (row["source_system"], row["batch_id"]): row["rows"]
        for row in batches
        if row["batch_id"] in protected
    }


def assert_post_commit_counts(*, apply: bool, before: list[dict], after: list[dict], or_before: int, or_after: int) -> None:
    """Check the read-only recount after the first session closes.

    Dry-run requires every batch count, including Orange, to match the
    pre-run snapshot. Any difference stops the run.

    Apply requires the committed Orange count to equal EXPECTED_OBS_TOTAL
    and that batch to contain only SOURCE_SYSTEM and BATCH_ID. Every protected
    batch must still equal its before count. The new Orange count is not
    compared with its pre-insert value.
    """
    def stable(rows: list[dict]) -> dict:
        """Lee may be loading in another session. Every other batch must stay put."""
        return {
            (row["source_system"], row["batch_id"]): row["rows"]
            for row in rows
            if row["batch_id"] != LEE_BATCH_ID
        }

    if not apply:
        if stable(after) != stable(before):
            raise SystemExit("HARD STOP: enrichment batch counts changed during the read-only dry run")
        if or_after != or_before:
            raise SystemExit("HARD STOP: Orange batch count changed during the read-only dry run")
        return
    if or_after != EXPECTED_OBS_TOTAL:
        raise SystemExit("HARD STOP: Orange post-commit count differs from EXPECTED_OBS_TOTAL")
    expected_group = {"source_system": SOURCE_SYSTEM, "batch_id": BATCH_ID, "rows": EXPECTED_OBS_TOTAL}
    if _orange_groups(after) != [expected_group]:
        raise SystemExit("HARD STOP: Orange batch is not limited to its source_system and batch_id")
    before_stable = stable(before)
    after_stable = stable(after)
    for key, count in before_stable.items():
        if after_stable.get(key, 0) != count:
            raise SystemExit("HARD STOP: a protected enrichment batch count changed")


def nonempty_canonical(conn, ids: list[str]) -> dict:
    phone, website = conn.execute(
        """SELECT count(*) FILTER (WHERE btrim(coalesce(phone, '')) <> ''),
                  count(*) FILTER (WHERE btrim(coalesce(website, '')) <> '')
           FROM contractors WHERE id = ANY(%s::uuid[])""",
        (ids,)).fetchone()
    return {"phone": phone, "website": website}


def schema_guard(conn) -> dict:
    role = conn.execute("SELECT current_user").fetchone()[0]
    if role in ("supabase_admin", "service_role"):
        raise SystemExit("HARD STOP: refusing supabase_admin or service_role")
    constraint = conn.execute(
        """SELECT pg_get_constraintdef(oid) FROM pg_constraint
           WHERE conrelid = 'public.contractor_enrichment_observations'::regclass
             AND conname = 'contractor_enrichment_observations_idem'"""
    ).fetchone()
    if not constraint:
        raise SystemExit("HARD STOP: idempotency constraint missing")
    return {"current_user": role, "idempotency": constraint[0]}


def classify_site(url: str) -> str:
    try:
        request = Request(url, headers={"User-Agent": "TrustHubDotCheck/1.0"}, method="GET")
        with urlopen(request, timeout=25) as response:
            code = getattr(response, "status", 200)
            header_text = str(response.headers).lower()
            sample = response.read(4096).decode("utf-8", "replace").lower()
    except HTTPError as exc:
        code = exc.code
        header_text = str(exc.headers).lower() if exc.headers else ""
        sample = ""
    except URLError as exc:
        reason = getattr(exc, "reason", exc)
        if getattr(reason, "__class__", type(reason)).__name__ == "gaierror":
            return "NXDOMAIN"
        return "down"
    except Exception as exc:
        if exc.__class__.__name__ == "gaierror":
            return "NXDOMAIN"
        return "down"
    challenge = code in (401, 403, 429) or "just a moment" in sample or "cf-mitigated" in header_text or "captcha" in sample
    if challenge:
        return "challenge"
    if 200 <= code < 400:
        return "up"
    return "down"


def recheck_transient(rows: list[dict]) -> dict:
    targets = []
    for row in rows:
        if TRANSIENT_FLAG not in split_flags(row.get("review_flags")):
            continue
        url = (row.get("website_url") or "").strip()
        targets.append((row["contractor_id"], row["license_key"].strip().upper(), url))
    classes: list[str] = []

    def one(item):
        _cid, _key, url = item
        if urlparse(url).scheme not in ("http", "https"):
            return "down"
        return classify_site(url)

    with ThreadPoolExecutor(max_workers=6) as pool:
        classes.extend(pool.map(one, targets))
    summary = Counter(classes)
    return {
        "checked": len(targets),
        "up": summary.get("up", 0),
        "challenge": summary.get("challenge", 0),
        "down": summary.get("down", 0),
        "NXDOMAIN": summary.get("NXDOMAIN", 0),
        "rows_excluded": 0,
    }


def contact_free(document: dict) -> None:
    banned = ("phone", "email", "website", "address", "display_name", "value")
    blob = json.dumps(document)
    if "@" in blob:
        raise SystemExit("HARD STOP: evidence contains contact text")
    for key in banned:
        if f'"{key}"' in blob:
            raise SystemExit("HARD STOP: evidence contains a contact field")


def write_evidence(directory: Path, prestate: dict) -> dict:
    assert_outside_git(directory)
    directory.mkdir(parents=True, exist_ok=True)
    contact_free(prestate)
    pre_path = directory / "pre-state-or.json"
    sql_path = directory / "rollback-or.sql"
    sums_path = directory / "SHA256SUMS-prestate.txt"
    pre_path.write_text(json.dumps(prestate, indent=2) + "\n", encoding="utf-8")
    sql_path.write_text(rollback_sql() + "\n", encoding="utf-8")
    lines = [f"{sha256(pre_path)}  pre-state-or.json", f"{sha256(sql_path)}  rollback-or.sql"]
    sums_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"prestate": str(pre_path), "rollback_sql": str(sql_path), "sha256sums": str(sums_path),
            "prestate_sha256": sha256(pre_path), "rollback_sql_sha256": sha256(sql_path)}


def serving_commit() -> str:
    result = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"], capture_output=True, text=True)
    return (result.stdout or "").strip()


def load_database_url(env_name: str, env_file: Path | None) -> str:
    os.environ.pop(env_name, None)
    if env_file:
        from ingest.env import load_dotenv_files
        load_dotenv_files(env_file)
    url = os.environ.get(env_name, "")
    if not url:
        raise SystemExit(f"{env_name} not set")
    return url


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--county", default=COUNTY, choices=[COUNTY])
    parser.add_argument("--package-dir", required=True, type=Path)
    parser.add_argument("--database-url-env", default="DATABASE_URL")
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--production", action="store_true")
    parser.add_argument("--rollback", action="store_true")
    parser.add_argument("--evidence-dir", type=Path)
    parser.add_argument("--receipt", type=Path)
    args = parser.parse_args()

    assert_outside_git(args.package_dir)
    if args.evidence_dir:
        assert_outside_git(args.evidence_dir)
    if args.receipt:
        assert_outside_git(args.receipt.parent if args.receipt.parent.exists() else args.receipt.parent)

    writes = args.apply or args.rollback
    if writes:
        require_go()
    url = load_database_url(args.database_url_env, args.env_file)
    host = urlparse(url).hostname or ""
    local = host in ("localhost", "127.0.0.1", "::1")
    if writes and not local and not args.production:
        raise SystemExit("refusing to write to a non-local database without --production")

    if args.rollback:
        rollback_guard()
        with connect(url, read_only=False) as conn, conn.transaction():
            cur = conn.execute(
                "DELETE FROM contractor_enrichment_observations WHERE source_system = %s AND batch_id = %s",
                (SOURCE_SYSTEM, BATCH_ID))
            print(json.dumps({"rollback": {"source_system": SOURCE_SYSTEM, "batch_id": BATCH_ID, "deleted": cur.rowcount}}))
        return 0

    verified = verify_package(args.package_dir)
    rows = verified.pop("rows")
    plan = Plan(rows=rows)
    summary: dict = {
        "ticket": TICKET,
        "mode": "apply" if args.apply else "dry_run",
        "county": COUNTY,
        "batch_id": BATCH_ID,
        "source_system": SOURCE_SYSTEM,
        "observed_at": OBSERVED_AT,
        "production_mutations": 0,
        "inputs": {key: value for key, value in verified.items() if key != "review_flags"},
        "review_flags": verified["review_flags"],
    }

    with connect(url, read_only=not args.apply) as conn:
        ctx = conn.transaction() if args.apply else ReadOnlyBlock(conn)
        with ctx:
            if not args.apply:
                print("transaction_read_only=on")
            summary["schema"] = schema_guard(conn)
            before = batch_counts(conn)
            ok = identity_gate(conn, rows, plan)
            ids = [row["contractor_id"] for row in rows]
            existing = existing_for(conn, ids)
            batch_rows = batch_exists(conn)
            canonical = nonempty_canonical(conn, ids)
            summary["batches_before"] = before
            summary["identity"] = {
                "rows": len(rows),
                "exact_matches": len(ok),
                "failures": len(plan.excluded),
                "failure_reasons": dict(Counter(item["reason"] for item in plan.excluded)),
                "failure_ids": plan.excluded,
            }
            summary["existing_batch_rows"] = batch_rows
            summary["existing_observations_for_load_ids"] = existing
            summary["canonical_nonempty"] = canonical
            summary["canonical_conflicts"] = len(plan.conflicts)
            if plan.excluded or existing or batch_rows:
                summary["identity_gate"] = "FAIL"
                if args.apply:
                    raise SystemExit("HARD STOP: identity exclusions or pre-existing rows")
            else:
                summary["identity_gate"] = "PASS"
                build_observations(rows, plan, ok, READY_SHA)
                outside = [obs for obs in plan.obs if obs.contractor_id not in set(ids)]
                if outside:
                    raise SystemExit("HARD STOP: observation for an id outside the ready file")
                planned = counts(plan.obs)
                suppressed_emails = sum(1 for obs in plan.obs if obs.field == "email" and obs.is_suppressed)
                leaked = [
                    obs for obs in plan.obs
                    if obs.field == "email" and any(flag in EMAIL_SUPPRESS_FLAGS for flag in obs.review_flags) and not obs.is_suppressed
                ]
                if leaked:
                    raise SystemExit("HARD STOP: suppressed email planned as deliverable")
                profiles = {name: planned[name]["profiles"] for name in FIELDS}
                if profiles != EXPECTED_FILL:
                    raise SystemExit("HARD STOP: profile counts differ")
                idem = [(obs.contractor_id, obs.field, obs.value_normalized, BATCH_ID) for obs in plan.obs]
                if len(idem) != len(set(idem)):
                    raise SystemExit("HARD STOP: duplicate idempotency keys")
                variance = {}
                for field_name, expected in EXPECTED_OBS.items():
                    actual = planned[field_name]["total"]
                    pct = abs(actual - expected) / expected * 100
                    variance[field_name] = {"actual": actual, "expected": expected, "abs_pct": pct}
                    if pct > 1 or actual != expected:
                        raise SystemExit("HARD STOP: observation count differs from the Orange estimate")
                if len(plan.obs) != EXPECTED_OBS_TOTAL:
                    raise SystemExit("HARD STOP: observation total differs")
                summary["variance"] = variance
                summary["planned"] = planned
                summary["planned_total"] = len(plan.obs)
                summary["suppressed_email_observations"] = suppressed_emails
                summary["suppressed_emails_loaded_as_deliverable"] = 0
                summary["duplicates_collapsed"] = dict(plan.duplicates_collapsed)
                summary["skipped_empty_cells"] = dict(plan.skipped_empty)
                summary["dry_run_transaction"] = "ROLLBACK" if not args.apply else "COMMIT"
                if args.apply:
                    with conn.cursor() as cur:
                        cur.executemany(
                            """INSERT INTO contractor_enrichment_observations
                                 (contractor_id, license_external_key, field, value, value_normalized, ordinal, source_refs,
                                  source_system, confidence, review_flags, decision_ref, batch_id, observed_at,
                                  is_suppressed, suppression_reason)
                               VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::timestamptz, %s, %s)
                               ON CONFLICT ON CONSTRAINT contractor_enrichment_observations_idem DO NOTHING""",
                            [(obs.contractor_id, obs.license_key, obs.field, obs.value, obs.value_normalized, obs.ordinal,
                              obs.source_refs, SOURCE_SYSTEM, obs.confidence, obs.review_flags, obs.decision_ref,
                              BATCH_ID, OBSERVED_AT, obs.is_suppressed, obs.suppression_reason) for obs in plan.obs])
                    inserted = batch_exists(conn)
                    if inserted != len(plan.obs):
                        raise SystemExit("HARD STOP: post-insert count differs from plan; rolled back")
                    summary["production_mutations"] = inserted
                    summary["applied"] = {"inserted": inserted}

    if summary["identity_gate"] != "PASS":
        print(json.dumps({key: summary[key] for key in ("identity_gate", "identity", "existing_batch_rows", "existing_observations_for_load_ids")}))
        return 2

    summary["transient_recheck"] = recheck_transient(rows)
    with connect(url, read_only=True) as conn:
        with ReadOnlyBlock(conn):
            print("transaction_read_only=on")
            after = batch_counts(conn)
            summary["batches_after"] = after
            assert_post_commit_counts(
                apply=args.apply,
                before=summary["batches_before"],
                after=after,
                or_before=summary["existing_batch_rows"],
                or_after=batch_exists(conn),
            )

    if args.evidence_dir:
        prestate = {
            "generated_at_et": datetime.now(ZoneInfo("America/New_York")).isoformat(timespec="seconds"),
            "serving_commit": serving_commit(),
            "project_id": "jhjztnisugdsuliriajp",
            "batch_id": BATCH_ID,
            "source_system": SOURCE_SYSTEM,
            "batches": summary["batches_before"],
            "load_id_count": READY_ROWS,
            "existing_observations_for_load_ids": summary["existing_observations_for_load_ids"],
            "nonempty_contractors_phone": summary["canonical_nonempty"]["phone"],
            "nonempty_contractors_website": summary["canonical_nonempty"]["website"],
            "transaction": "ROLLBACK",
            "production_mutations": 0,
        }
        summary["evidence"] = write_evidence(args.evidence_dir, prestate)

    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        public_summary = {key: value for key, value in summary.items() if key != "identity"}
        public_summary["identity"] = {key: value for key, value in summary["identity"].items() if key != "failure_ids"}
        args.receipt.write_text(json.dumps(public_summary, indent=2) + "\n", encoding="utf-8")

    printable = {
        "mode": summary["mode"],
        "identity_gate": summary["identity_gate"],
        "exact_matches": summary["identity"]["exact_matches"],
        "identity_failures": summary["identity"]["failures"],
        "existing_batch_rows": summary["existing_batch_rows"],
        "existing_observations_for_load_ids": summary["existing_observations_for_load_ids"],
        "canonical_nonempty": summary["canonical_nonempty"],
        "canonical_conflicts": summary["canonical_conflicts"],
        "planned_total": summary["planned_total"],
        "planned": summary["planned"],
        "suppressed_email_observations": summary["suppressed_email_observations"],
        "suppressed_emails_loaded_as_deliverable": 0,
        "duplicates_collapsed": summary["duplicates_collapsed"],
        "variance": summary.get("variance"),
        "review_flags": summary["review_flags"],
        "transient_recheck": summary["transient_recheck"],
        "batch_counts_unchanged": [
            row for row in summary["batches_before"] if row["batch_id"] != LEE_BATCH_ID
        ] == [
            row for row in summary["batches_after"] if row["batch_id"] != LEE_BATCH_ID
        ],
        "lee_rows_before": sum(row["rows"] for row in summary["batches_before"] if row["batch_id"] == LEE_BATCH_ID),
        "lee_rows_after": sum(row["rows"] for row in summary["batches_after"] if row["batch_id"] == LEE_BATCH_ID),
        "dry_run_transaction": "ROLLBACK",
        "production_mutations": summary["production_mutations"],
        "evidence": summary.get("evidence"),
    }
    print(json.dumps(printable, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
