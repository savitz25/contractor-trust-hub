"""California entry point for the certified CON-OSHA-002 writer.

Default mode is a read-only preflight. A Production write requires --write,
an independently published Founder authorization, and the writer's technical
phrase. A local authorization file by itself is not Founder permission.
This module does not reimplement matching, counts, or migration 020.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import socket
import subprocess
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse
from uuid import UUID

from scripts.con_osha_002.aggregate import MemoryLedger, apply_aggregate, plan_aggregate
from scripts.con_osha_002.contract import (
    CA_NAME_SOURCE,
    CERTIFIED_CITATIONS,
    CERTIFIED_ELIGIBLE_PROFILES,
    CERTIFIED_PUBLISHED_ACTIVITIES,
    GO_PHRASE,
    OFFICIAL_INSPECTION_SHA256,
    OFFICIAL_VIOLATION_SHA256,
    SOURCE_ZIP_SHA256,
    VERIFIED_B2_PACKAGE_SHA256,
)
from scripts.con_osha_002.detail import plan_detail, reconcile_initial_penalties
from scripts.con_osha_002.eligibility import (
    LoadError,
    classify_rows,
    load_identities,
    read_package,
    verify_identities,
)
from scripts.con_osha_002.execute import _official_pins, _preflight, execute_load
from scripts.con_osha_002.rollback import rollback_sql

STATE = "CA"
PROJECT_REF = "jhjztnisugdsuliriajp"
# Approved Contractor session pooler. The direct db host is IPv6-only and is not a fallback.
SESSION_HOST = "aws-0-ca-central-1.pooler.supabase.com"
SESSION_PORT = 5432
SESSION_USER = f"postgres.{PROJECT_REF}"
SESSION_DB = "postgres"
DIRECT_HOST = f"db.{PROJECT_REF}.supabase.co"
FOUNDER_LOGIN = "savitz25"
_IPV4 = re.compile(r"^(?:\d{1,3}\.){3}\d{1,3}$")
_VERIFY_URL = re.compile(
    r"^Independent-Verification:\s*"
    r"(https://github\.com/savitz25/contractor-trust-hub/(?:issues|pull)/\d+#issuecomment-(\d+))\s*$",
    re.MULTILINE,
)
_TLS_MODES = {"require", "verify-ca", "verify-full"}
FROZEN_BATCH_ID = "18e92387-5f97-4921-835b-b5825146a909"
SOURCE_OBSERVED_ON = "2026-10-21"
FL_NJ_MATCHES_EXPECTED = 10578
FL_NJ_BRIDGES_EXPECTED = 25930
CA_OUTSIDE_LINK_GAP = 65
NIL_BATCH = "00000000-0000-0000-0000-000000000000"

REPRO = Path(r"H:\osha-con-osha-002-g1\six-state-repro")
DEFAULT_PACKAGE = REPRO / "packages" / "CA-osha-match-package.csv"
DEFAULT_RECEIPT = REPRO / "packages" / "match-receipt.json"
DEFAULT_INSPECTIONS = REPRO / "inputs" / "inspections.csv"
DEFAULT_VIOLATIONS = REPRO / "inputs" / "violations.csv"
DEFAULT_LICENSES = REPRO / "inputs" / "licenses.csv"
DEFAULT_LINKS = Path(
    r"C:\TrustHub-Work\con-osha-002-dryrun-20261022\x"
    r"\CA_OSHA_extras_2026-10-21_part2of2\citation_link_checks.csv"
)
DEFAULT_ZIPS = (
    Path(r"C:\TrustHub-Work\con-osha-002-dryrun-20261022\zips\CA_OSHA_extras_2026-10-21_part1of2.zip"),
    Path(r"C:\TrustHub-Work\con-osha-002-dryrun-20261022\zips\CA_OSHA_extras_2026-10-21_part2of2.zip"),
)
DEFAULT_ENV = Path(r"C:\Users\Michael.Savitsky\contractor-trust-hub\.env.local")
ROOT = Path(__file__).resolve().parents[2]
_DATE = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
_AUTH = re.compile(r"\bauthoriz(?:e|es|ed|ation)\b", re.IGNORECASE)

if str(UUID(FROZEN_BATCH_ID)) != FROZEN_BATCH_ID or FROZEN_BATCH_ID == NIL_BATCH:
    raise RuntimeError("frozen California batch id is not a canonical non-nil UUID")


@dataclass(frozen=True)
class CaliforniaInputs:
    package: Path
    receipt: Path
    inspections: Path
    violations: Path
    licenses: Path
    links: Path
    zips: tuple[Path, Path]


@dataclass
class CaliforniaPlans:
    eligibility: object
    detail: object
    identities: dict
    package_sha256: str
    inspection_sha256: str
    violation_sha256: str
    zip_sha256: tuple[str, str]
    blank_current: int
    zero_current: int
    blank_initial: int
    zero_initial: int
    outside_link_gap: int


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def explain_connection_failure(message: str) -> str:
    if any(token in message for token in ("getaddrinfo", "11001", "10051")):
        return (
            message
            + " The approved IPv4 session pooler was not reachable from this PC."
            + " Port 6543 and the IPv6-only direct host are not used as a fallback."
        )
    return message


def redact(text: str, secret: str = "") -> str:
    cleaned = text or ""
    if secret:
        cleaned = cleaned.replace(secret, "***")
        cleaned = cleaned.replace(quote(secret, safe=""), "***")
    cleaned = re.sub(r"postgresql://\S+", "***", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"(?i)password[=:]\s*\S+", "password=***", cleaned)
    return cleaned[:500]


def _authorization_statement_ok(text: str) -> str:
    if text.strip() in {"", GO_PHRASE}:
        raise LoadError("the technical GO phrase is not Founder authorization")
    dates = []
    for item in _DATE.findall(text):
        date.fromisoformat(item)
        dates.append(item)
    if not dates:
        raise LoadError("Founder authorization has no dated statement")
    if "CON-OSHA-002" not in text or "California" not in text:
        raise LoadError("Founder authorization must name CON-OSHA-002 and California")
    if _AUTH.search(text) is None or re.search(r"\bload\b", text, re.IGNORECASE) is None:
        raise LoadError("Founder authorization does not authorize the California load")
    return dates[0]


def fetch_github_comment(comment_id: str) -> dict[str, str]:
    """Read one GitHub comment. This does not create or edit anything."""
    if not re.fullmatch(r"\d{1,20}", comment_id):
        raise LoadError("Founder authorization comment id is invalid")
    gh = shutil.which("gh") or r"C:\Program Files\GitHub CLI\gh.exe"
    if not Path(gh).is_file():
        raise LoadError("Founder authorization could not be independently verified")
    completed = subprocess.run(
        [gh, "api", f"repos/savitz25/contractor-trust-hub/issues/comments/{comment_id}"],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if completed.returncode != 0 or not completed.stdout.strip():
        raise LoadError("Founder authorization could not be independently verified")
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise LoadError("Founder authorization could not be independently verified") from exc
    author = str((payload.get("user") or {}).get("login") or "")
    body = str(payload.get("body") or "")
    return {"author": author, "body": body}


def verify_founder_authorization(path: Path | None, *, comment_fetcher=None) -> dict[str, str]:
    """Founder permission is a published GitHub comment, not a local file alone.

    The technical GO phrase does not qualify. A file generated on this PC qualifies
    only when the repository owner has published its exact SHA-256 on GitHub.
    """
    if path is None:
        raise LoadError("Founder California load authorization file is required")
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise LoadError("Founder California load authorization file is missing")
    text = resolved.read_text(encoding="utf-8")
    located = _VERIFY_URL.search(text)
    if located is None:
        raise LoadError("a locally generated authorization file is not Founder permission")
    verification_url, comment_id = located.group(1), located.group(2)
    dated = _authorization_statement_ok(text)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    fetcher = comment_fetcher or fetch_github_comment
    comment = fetcher(comment_id)
    author = str(comment.get("author") or "")
    body = str(comment.get("body") or "")
    if author != FOUNDER_LOGIN:
        raise LoadError("Founder authorization comment is not from the repository owner")
    if body.strip() in {"", GO_PHRASE} or digest not in body:
        raise LoadError("Founder authorization comment does not verify this authorization")
    if "CON-OSHA-002" not in body or "California" not in body:
        raise LoadError("Founder authorization comment does not name CON-OSHA-002 and California")
    if _AUTH.search(body) is None or re.search(r"\bload\b", body, re.IGNORECASE) is None:
        raise LoadError("Founder authorization comment does not authorize the California load")
    return {
        "sha256": digest,
        "date": dated,
        "filename": resolved.name,
        "verification_url": verification_url,
    }


def load_app_database_url(env_file: Path) -> str:
    if not env_file.is_file():
        raise LoadError("database environment file is missing")
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise LoadError("DATABASE_URL is not set")


def _is_ipv4(value: str) -> bool:
    if not _IPV4.fullmatch(value) or ":" in value:
        return False
    return all(0 <= int(part) <= 255 for part in value.split("."))


def _sslmode(parsed) -> str:
    modes = [item.casefold() for item in (parse_qs(parsed.query).get("sslmode") or [])]
    if not modes or any(mode not in _TLS_MODES for mode in modes):
        raise LoadError("session connection must use TLS")
    return modes[0]


def resolve_ipv4(host: str, port: int) -> str:
    """Return one IPv4 address. Do not fall back to IPv6 or another host."""
    if host.casefold() != SESSION_HOST or port != SESSION_PORT:
        raise LoadError("session connection host is not the approved Contractor pooler")
    try:
        infos = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise LoadError("approved session pooler has no IPv4 address") from exc
    addresses = [item[4][0] for item in infos if item and item[4]]
    for address in addresses:
        if _is_ipv4(address):
            return address
    raise LoadError("approved session pooler has no IPv4 address")


def session_target_from_app_url(app_url: str) -> dict[str, object]:
    """Accept only the approved Contractor session-pooler URL. Never rewrite it."""
    parsed = urlparse(app_url)
    user = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    host = (parsed.hostname or "").casefold()
    if not password:
        raise LoadError("database password is missing")
    if parsed.port == 6543:
        raise LoadError("transaction pooler port 6543 is not allowed")
    if parsed.port != SESSION_PORT:
        raise LoadError("session connection must use port 5432")
    if user != SESSION_USER:
        raise LoadError("session connection requires the project tenant user")
    if host != SESSION_HOST:
        raise LoadError("session connection host is not the approved Contractor pooler")
    if parsed.path.lstrip("/") != SESSION_DB:
        raise LoadError("database name is not postgres")
    return {
        "host": SESSION_HOST,
        "port": SESSION_PORT,
        "dbname": SESSION_DB,
        "user": SESSION_USER,
        "password": password,
        "sslmode": _sslmode(parsed),
    }


def database_url_for_writer(target: dict[str, object]) -> str:
    ipv4 = str(target.get("ipv4") or "")
    if not _is_ipv4(ipv4):
        raise LoadError("session connection requires an IPv4 address")
    user = quote(str(target["user"]), safe="")
    password = quote(str(target["password"]), safe="")
    return (
        f"postgresql://{user}:{password}@{target['host']}:{target['port']}"
        f"/{target['dbname']}?sslmode={target['sslmode']}&hostaddr={ipv4}"
    )


def assert_writer_url(url: str) -> None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").casefold()
    user = unquote(parsed.username or "")
    query = parse_qs(parsed.query)
    hostaddr = (query.get("hostaddr") or [""])[0]
    if host != SESSION_HOST or host == DIRECT_HOST:
        raise LoadError("session connection host is not the approved Contractor pooler")
    if parsed.port == 6543:
        raise LoadError("transaction pooler port 6543 is not allowed")
    if parsed.port != SESSION_PORT:
        raise LoadError("session connection must use port 5432")
    if user != SESSION_USER or PROJECT_REF not in user:
        raise LoadError("session connection requires the project tenant user")
    if parsed.path.lstrip("/") != SESSION_DB:
        raise LoadError("writer URL database is not postgres")
    _sslmode(parsed)
    if not _is_ipv4(hostaddr):
        raise LoadError("session connection requires an IPv4 address")


def _folded_rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            yield {key.casefold(): (value or "").strip() for key, value in raw.items()}


def verify_source_zips(paths: tuple[Path, Path]) -> tuple[str, str]:
    hashes = tuple(sha256_file(path) for path in paths)
    if hashes != tuple(SOURCE_ZIP_SHA256[STATE]):
        raise LoadError("CA source ZIP hashes do not match the certified pins")
    return hashes


def verify_links(detail, link_path: Path) -> int:
    published = {(item.activity_nr, item.citation_id) for item in detail.citations}
    seen: dict[tuple[str, str], str] = {}
    outside = 0
    for record in _folded_rows(link_path):
        key = (record.get("activity_nr", ""), record.get("citation_id", ""))
        status = record.get("derived_link_status", "").casefold()
        if key in published:
            seen[key] = status
        elif status in {"missing", "missing_citation_context"}:
            outside += 1
    if set(seen) != published or any(status != "matched" for status in seen.values()):
        raise LoadError("CA citation link checks do not match the published citations")
    if outside != CA_OUTSIDE_LINK_GAP:
        raise LoadError("CA outside citation-link gap does not match the certified count")
    return outside


def publication_default_is_pilot_only() -> None:
    flag = (ROOT / "lib" / "osha" / "flag.ts").read_text(encoding="utf-8")
    if 'const DEFAULT_PUBLISHED_STATES = ["FL", "NJ"] as const;' not in flag:
        raise LoadError("default OSHA publication is not limited to FL,NJ")


def build_plans(inputs: CaliforniaInputs) -> CaliforniaPlans:
    package_sha, rows = read_package(inputs.package, expect_known_hash=True)
    if package_sha != VERIFIED_B2_PACKAGE_SHA256[STATE]:
        raise LoadError("CA package sha256 does not match the certified pin")
    receipt = json.loads(inputs.receipt.read_text(encoding="utf-8"))
    if receipt.get("ca_name_source") != CA_NAME_SOURCE:
        raise LoadError("CA package requires ca_name_source licensee_name_raw")
    inspection_sha = sha256_file(inputs.inspections)
    violation_sha = sha256_file(inputs.violations)
    if inspection_sha != OFFICIAL_INSPECTION_SHA256 or violation_sha != OFFICIAL_VIOLATION_SHA256:
        raise LoadError("official inspection or violation hash does not match the pin")
    identities = load_identities(inputs.licenses)
    eligibility = classify_rows(
        rows,
        receipt={"ca_name_source": receipt["ca_name_source"]},
        package_sha256=package_sha,
    )
    verify_identities(eligibility, identities)
    if eligibility.public_profile_count != CERTIFIED_ELIGIBLE_PROFILES[STATE]:
        raise LoadError("eligible profile count does not match the certified pin")
    if len(eligibility.distinct_contractor_ids) != CERTIFIED_ELIGIBLE_PROFILES[STATE]:
        raise LoadError("eligible contractor_id count does not match the certified pin")
    if len(eligibility.published_activities) != CERTIFIED_PUBLISHED_ACTIVITIES[STATE]:
        raise LoadError("published activity count does not match the certified pin")
    if eligibility.citation_count != CERTIFIED_CITATIONS[STATE]:
        raise LoadError("citation count does not match the certified pin")
    zip_sha = verify_source_zips(inputs.zips)
    ledger = MemoryLedger()
    aggregate = plan_aggregate(eligibility, FROZEN_BATCH_ID)
    apply_aggregate(aggregate, ledger)
    detail = plan_detail(aggregate, ledger, inputs.inspections, inputs.violations)
    profiles, activities, citations, pinned_sha = _official_pins(
        STATE,
        detail,
        CERTIFIED_ELIGIBLE_PROFILES[STATE],
        CERTIFIED_PUBLISHED_ACTIVITIES[STATE],
        CERTIFIED_CITATIONS[STATE],
        package_sha,
    )
    _preflight(eligibility, detail, profiles, activities, citations, pinned_sha)
    reconcile_initial_penalties(detail.public_matches, detail.citations)
    if not detail.ready or detail.incomplete_profiles or detail.missing_citation_context != 0:
        raise LoadError("CA detail plan is not ready")
    outside = verify_links(detail, inputs.links)
    blank_current = sum(1 for item in detail.citations if item.current_penalty is None)
    zero_current = sum(1 for item in detail.citations if item.current_penalty == Decimal("0.00"))
    blank_initial = sum(1 for item in detail.citations if item.initial_penalty is None)
    zero_initial = sum(1 for item in detail.citations if item.initial_penalty == Decimal("0.00"))
    publication_default_is_pilot_only()
    return CaliforniaPlans(
        eligibility=eligibility,
        detail=detail,
        identities=identities,
        package_sha256=package_sha,
        inspection_sha256=inspection_sha,
        violation_sha256=violation_sha,
        zip_sha256=zip_sha,
        blank_current=blank_current,
        zero_current=zero_current,
        blank_initial=blank_initial,
        zero_initial=zero_initial,
        outside_link_gap=outside,
    )


def rollback_plan() -> str:
    statement = rollback_sql(STATE, FROZEN_BATCH_ID)
    if NIL_BATCH in statement:
        raise LoadError("rollback batch id is still the placeholder")
    if "DELETE FROM contractors" in statement or "DELETE FROM licenses" in statement:
        raise LoadError("rollback plan touches contractor or license rows")
    if "DELETE FROM osha_load_receipts" in statement:
        raise LoadError("rollback plan touches the FL/NJ receipt table")
    citation = statement.index("DELETE FROM contractor_osha_citations")
    bridge = statement.index("DELETE FROM contractor_osha_match_inspections")
    inspection = statement.index("DELETE FROM contractor_osha_inspections")
    if not (citation < bridge < inspection):
        raise LoadError("rollback plan does not delete citations before bridges before inspections")
    return statement


def probe_session(target: dict[str, object]) -> dict[str, object]:
    secret = str(target["password"])
    ipv4 = str(target.get("ipv4") or "")
    stopped = "session_database_connection"
    try:
        import psycopg
    except ImportError as exc:
        return {
            stopped: "STOP",
            "secure_session_connection": "FAIL",
            "connection_error": redact(f"{type(exc).__name__}: {exc}", secret),
        }
    try:
        connection = psycopg.connect(
            host=str(target["host"]),
            hostaddr=ipv4,
            port=int(target["port"]),
            dbname=str(target["dbname"]),
            user=str(target["user"]),
            password=secret,
            sslmode=str(target["sslmode"]),
            connect_timeout=20,
        )
    except Exception as exc:
        return {
            stopped: "STOP",
            "secure_session_connection": "FAIL",
            "connection_error": explain_connection_failure(redact(f"{type(exc).__name__}: {exc}", secret)),
        }
    try:
        info = connection.info
        seen_host = (info.host or "").casefold()
        # Supavisor terminates TLS, so pg_stat_ssl on the database is not the client check.
        if seen_host not in {SESSION_HOST, ipv4} or info.port != SESSION_PORT or not connection.pgconn.ssl_in_use:
            return {
                stopped: "STOP",
                "secure_session_connection": "FAIL",
                "connection_error": "connected session is not the approved TLS session pooler",
            }
        if (info.user or "") != SESSION_USER:
            return {
                stopped: "STOP",
                "secure_session_connection": "FAIL",
                "connection_error": "connected session is not the project tenant user",
            }
        connection.autocommit = True
        with connection.cursor() as cursor:
            cursor.execute("SET statement_timeout = '20s'")
            cursor.execute("BEGIN READ ONLY")
            cursor.execute("SHOW transaction_read_only")
            read_only = cursor.fetchone()[0]
            if read_only != "on":
                cursor.execute("ROLLBACK")
                return {
                    stopped: "STOP",
                    "secure_session_connection": "FAIL",
                    "connection_error": "session is not read only",
                }
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(), current_setting('server_version_num')::int")
            database_name, version_num = cursor.fetchone()
            cursor.execute(
                """
                SELECT
                  to_regclass('public.contractor_osha_license_matches') IS NOT NULL,
                  to_regclass('public.contractor_osha_expansion_holds') IS NOT NULL,
                  to_regclass('public.osha_expansion_load_receipts') IS NOT NULL,
                  to_regclass('public.contractor_osha_inspections') IS NOT NULL,
                  to_regclass('public.contractor_osha_citations') IS NOT NULL,
                  (SELECT count(*) FROM contractor_osha_license_matches WHERE state IN ('FL','NJ')),
                  (SELECT count(*) FROM contractor_osha_match_inspections WHERE state IN ('FL','NJ')),
                  (SELECT count(*) FROM contractor_osha_license_matches WHERE state = 'CA'),
                  (SELECT count(*) FROM contractor_osha_inspections WHERE state = 'CA'),
                  (SELECT count(*) FROM contractor_osha_citations c
                     JOIN contractor_osha_inspections i ON i.id = c.inspection_id
                    WHERE i.state = 'CA'),
                  (SELECT pg_get_constraintdef(oid) FROM pg_constraint
                    WHERE conrelid = 'public.osha_load_receipts'::regclass
                      AND pg_get_constraintdef(oid) LIKE '%pilot_states%' LIMIT 1)
                """
            )
            row = cursor.fetchone()
            cursor.execute("ROLLBACK")
    except Exception as exc:
        return {
            stopped: "STOP",
            "secure_session_connection": "FAIL",
            "connection_error": redact(f"{type(exc).__name__}: {exc}", secret),
        }
    finally:
        connection.close()
    tables_ready = all(flag is True for flag in row[:5])
    matches, bridges, ca_matches, ca_inspections, ca_citations, pilot = row[5:]
    pilot_text = pilot or ""
    fl_nj_unchanged = (matches, bridges) == (FL_NJ_MATCHES_EXPECTED, FL_NJ_BRIDGES_EXPECTED)
    pilot_ok = "FL,NJ" in pilot_text and "CA" not in pilot_text
    ready = (
        database_name == SESSION_DB
        and version_num >= 170000
        and tables_ready
        and fl_nj_unchanged
        and pilot_ok
        and ca_matches == 0
        and ca_inspections == 0
        and ca_citations == 0
    )
    return {
        "session_database_connection": "READY" if ready else "STOP",
        "secure_session_connection": "PASS" if ready else "FAIL",
        "database": database_name,
        "server_version_num": version_num,
        "ssl": "on",
        "address_family": "ipv4",
        "fl_nj_matches": matches,
        "fl_nj_bridges": bridges,
        "fl_nj_unchanged": fl_nj_unchanged,
        "ca_match_rows": ca_matches,
        "ca_inspection_rows": ca_inspections,
        "ca_citation_rows": ca_citations,
        "pilot_states_fl_nj": pilot_ok,
        "migration_020_tables": tables_ready,
        "connection_error": "" if ready else "session pooler failed a read-only readiness check",
    }


def run_preflight(inputs: CaliforniaInputs, env_file: Path, founder: Path | None = None) -> dict[str, object]:
    plans = build_plans(inputs)
    statement = rollback_plan()
    founder_status = "NOT_VERIFIED"
    founder_sha = ""
    founder_date = ""
    if founder is not None:
        checked = verify_founder_authorization(founder)
        founder_status = "VERIFIED"
        founder_sha = checked["sha256"]
        founder_date = checked["date"]
    connection: dict[str, object] = {
        "session_database_connection": "STOP",
        "secure_session_connection": "FAIL",
        "connection_error": "database environment was not read",
    }
    try:
        target = session_target_from_app_url(load_app_database_url(env_file))
        target["ipv4"] = resolve_ipv4(SESSION_HOST, SESSION_PORT)
        assert_writer_url(database_url_for_writer(target))
        connection = probe_session(target)
    except LoadError as exc:
        connection = {
            "session_database_connection": "STOP",
            "secure_session_connection": "FAIL",
            "connection_error": redact(str(exc)),
        }
    ca_rows = (
        connection.get("ca_match_rows", None),
        connection.get("ca_inspection_rows", None),
        connection.get("ca_citation_rows", None),
    )
    publication = "OFF" if ca_rows == (0, 0, 0) else "UNKNOWN"
    receipt: dict[str, object] = {
        "mode": "preflight",
        "production_rows_written": 0,
        "state": STATE,
        "batch_id": FROZEN_BATCH_ID,
        "source_observed_on": SOURCE_OBSERVED_ON,
        "package_sha256": plans.package_sha256,
        "inspection_sha256": plans.inspection_sha256,
        "violation_sha256": plans.violation_sha256,
        "source_zip_sha256": list(plans.zip_sha256),
        "profiles": CERTIFIED_ELIGIBLE_PROFILES[STATE],
        "inspections": CERTIFIED_PUBLISHED_ACTIVITIES[STATE],
        "citations": CERTIFIED_CITATIONS[STATE],
        "blank_current_penalties": plans.blank_current,
        "zero_current_penalties": plans.zero_current,
        "blank_initial_penalties": plans.blank_initial,
        "zero_initial_penalties": plans.zero_initial,
        "outside_link_gap": plans.outside_link_gap,
        "session_host": SESSION_HOST,
        "session_port": SESSION_PORT,
        "session_user": SESSION_USER,
        "session_database_connection": connection["session_database_connection"],
        "secure_session_connection": connection.get("secure_session_connection", "FAIL"),
        "address_family": connection.get("address_family", ""),
        "connection_error": connection.get("connection_error", ""),
        "database": connection.get("database", SESSION_DB),
        "server_version_num": connection.get("server_version_num", ""),
        "fl_nj_matches": connection.get("fl_nj_matches"),
        "fl_nj_bridges": connection.get("fl_nj_bridges"),
        "fl_nj_unchanged": connection.get("fl_nj_unchanged"),
        "ca_match_rows": connection.get("ca_match_rows"),
        "ca_publication": publication,
        "founder_authorization": founder_status,
        "founder_authorization_sha256": founder_sha,
        "founder_authorization_date": founder_date,
        "rollback_sha256": hashlib.sha256(statement.encode("utf-8")).hexdigest(),
        "transaction": "execute_load._run_write uses one psycopg transaction and raises before commit on mismatch",
    }
    return receipt


def run_write(founder: Path, confirm: str, env_file: Path, inputs: CaliforniaInputs) -> dict[str, object]:
    if confirm != GO_PHRASE:
        raise LoadError("database writes require the exact technical confirmation phrase")
    verify_founder_authorization(founder)
    target = session_target_from_app_url(load_app_database_url(env_file))
    target["ipv4"] = resolve_ipv4(SESSION_HOST, SESSION_PORT)
    database_url = database_url_for_writer(target)
    assert_writer_url(database_url)
    plans = build_plans(inputs)
    return execute_load(
        plans.eligibility,
        plans.detail,
        confirm=GO_PHRASE,
        database_url=database_url,
        expected_db_host=SESSION_HOST,
        expected_db_name=SESSION_DB,
        identities=plans.identities,
        expected_profiles=CERTIFIED_ELIGIBLE_PROFILES[STATE],
        expected_activities=CERTIFIED_PUBLISHED_ACTIVITIES[STATE],
        expected_citations=CERTIFIED_CITATIONS[STATE],
        expected_package_sha256=plans.package_sha256,
        official=True,
        source_observed_on=SOURCE_OBSERVED_ON,
        batch_id=FROZEN_BATCH_ID,
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CON-OSHA-002 California preflight. Writes stay off unless --write is set.")
    parser.add_argument("--write", action="store_true", help="Run the certified writer after authorization checks.")
    parser.add_argument("--confirm", default="", help="Technical confirmation phrase. Not Founder authorization.")
    parser.add_argument("--founder-authorization", type=Path, default=None)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV)
    parser.add_argument("--package", type=Path, default=DEFAULT_PACKAGE)
    parser.add_argument("--receipt", type=Path, default=DEFAULT_RECEIPT)
    parser.add_argument("--inspections", type=Path, default=DEFAULT_INSPECTIONS)
    parser.add_argument("--violations", type=Path, default=DEFAULT_VIOLATIONS)
    parser.add_argument("--licenses", type=Path, default=DEFAULT_LICENSES)
    parser.add_argument("--links", type=Path, default=DEFAULT_LINKS)
    parser.add_argument("--zip", dest="zips", type=Path, action="append", default=None)
    return parser.parse_args(argv)


def inputs_from_args(args: argparse.Namespace) -> CaliforniaInputs:
    zips = tuple(args.zips) if args.zips else DEFAULT_ZIPS
    if len(zips) != 2:
        raise LoadError("California preflight requires the two certified source ZIPs")
    return CaliforniaInputs(
        package=args.package,
        receipt=args.receipt,
        inspections=args.inspections,
        violations=args.violations,
        licenses=args.licenses,
        links=args.links,
        zips=(zips[0], zips[1]),
    )


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    secret = ""
    try:
        inputs = inputs_from_args(args)
        if args.write:
            result = run_write(args.founder_authorization, args.confirm, args.env_file, inputs)
        else:
            result = run_preflight(inputs, args.env_file, args.founder_authorization)
    except LoadError as exc:
        print(json.dumps({"mode": "stop", "production_rows_written": 0, "error": redact(str(exc), secret)}))
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    if not args.write and result.get("session_database_connection") != "READY":
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
