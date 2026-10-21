#!/usr/bin/env python3
"""CON-OSHA-001B detail loader. Dry-run by default; production writes require Founder GO.

The raw DOL files must remain outside Git. This loader accepts only the two
source snapshots pinned in the B2 receipt and never writes aggregate match rows.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

INSPECTION_SHA256 = "5867164b0c00c651eb6379cc9a9aa8242917d410d54b9ac48ab98632ec010552"
VIOLATION_SHA256 = "7ab8b7edb91075ae356baf2093d884f037a73feb1e235123485acf1864dd40ff"
COMBINED_SOURCE_SHA256 = "3e67b48e201a8c8a43f1661b167409517f8e4af5a21316fe5f7b1d3d4f5fc63d"
EXPECTED_ACTIVITIES = 17_534
EXPECTED_INSPECTIONS = 17_534
EXPECTED_PUBLIC_CITATIONS = 29_559
HELD_LICENSES = {"CCC1329816", "CGC1519699"}
HOLD_REASON = "SOURCE_CITATIONS_ABSENT_FROM_AGGREGATE_EXTRACT"
ACCEPTANCE_PROFILE_EXPECTATIONS = {
    "Latite": (73, 66, 36, None),
    "Haskell FRO": (38, 6, 1, None),
    "Haskell CBC": (78, 58, 11, None),
    "Power Electric": (87, 108, 57, None),
    "Vollers": (36, 11, 7, Decimal("4450.00")),
    "Calvi": (22, 29, 15, None),
}
DELETE_MARKER = "X"
GO_PHRASE = "CON-OSHA-001B-DETAIL-LOAD-GO"
SUPPORTED_VIOLATION_TYPES = {"S", "W", "R", "O", "U"}
PUBLIC_TYPE_LABELS = {"S": "Serious", "W": "Willful", "R": "Repeat", "O": "Other", "U": "Unclassified"}


class LoadError(ValueError):
    pass


def citation_is_public(delete_flag: str) -> bool:
    marker = delete_flag.strip().upper()
    if marker not in {"", DELETE_MARKER}:
        raise LoadError(f"unexpected DELETE_FLAG value {marker!r}")
    return marker != DELETE_MARKER


def public_citation_type(source_code: str) -> str:
    try:
        return PUBLIC_TYPE_LABELS[source_code]
    except KeyError as exc:
        raise LoadError(f"unsupported violation type {source_code!r}") from exc


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_source(path: Path, expected: str) -> None:
    actual = sha256_file(path)
    if actual != expected:
        raise LoadError(f"source SHA mismatch for {path.name}: expected {expected}, got {actual}")


def _rows(path: Path, required: set[str]) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames is None:
            raise LoadError(f"missing CSV header: {path.name}")
        names = {name.strip().casefold(): name for name in reader.fieldnames if name}
        missing = required - names.keys()
        if missing:
            raise LoadError(f"{path.name} missing required source columns: {', '.join(sorted(missing))}")
        result = []
        for raw in reader:
            result.append({key: (raw.get(names[key]) or "").strip() for key in required})
        return result


def _parse_date(value: str, field: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError as exc:
        raise LoadError(f"invalid {field}: {value!r}") from exc


def _money(value: str, field: str) -> Decimal:
    try:
        result = Decimal(value.strip() or "0")
    except InvalidOperation as exc:
        raise LoadError(f"invalid {field}: {value!r}") from exc
    if not result.is_finite() or result < 0 or result.as_tuple().exponent < -2:
        raise LoadError(f"invalid {field}: {value!r}")
    return result.quantize(Decimal("0.01"))


@dataclass(frozen=True)
class Match:
    match_id: str
    contractor_id: str
    state: str
    license_key: str
    tier: str
    activities: frozenset[str]
    n_inspections: int
    n_citation_items: int
    n_serious: int
    n_willful_repeat: int
    current_penalty_amount: int
    n_with_final_order: int
    n_contested: int
    first_open: date | None
    last_open: date | None


@dataclass(frozen=True)
class SourceSet:
    inspections: tuple[dict[str, str], ...]
    citations: tuple[dict[str, str], ...]
    deleted_count: int
    unique_activities: frozenset[str]


def read_sources(inspection_path: Path, violation_path: Path) -> SourceSet:
    # Hash both complete files before parsing or making any database connection.
    verify_source(inspection_path, INSPECTION_SHA256)
    verify_source(violation_path, VIOLATION_SHA256)
    inspection_rows = _rows(inspection_path, {
        "activity_nr", "open_date", "site_city", "site_state", "inspection_type",
        "close_date", "closing_conference_date",
    })
    violation_rows = _rows(violation_path, {
        "activity_nr", "citation_id", "standard", "viol_type", "current_penalty",
        "initial_penalty", "contest_date", "final_order_date", "delete_flag",
    })
    inspection_by_activity: dict[str, dict[str, str]] = {}
    for row in inspection_rows:
        activity = row["activity_nr"]
        if not activity or activity in inspection_by_activity:
            raise LoadError("blank or duplicate source inspection activity number")
        _parse_date(row["open_date"], "open_date")
        _parse_date(row["close_date"], "close_date")
        _parse_date(row["closing_conference_date"], "closing_conference_date")
        inspection_by_activity[activity] = row
    if len(inspection_by_activity) != EXPECTED_INSPECTIONS:
        raise LoadError(f"inspection row count mismatch: {len(inspection_by_activity)}")

    citations: list[dict[str, str]] = []
    citation_keys: set[tuple[str, str]] = set()
    deleted_count = 0
    for row in violation_rows:
        activity = row["activity_nr"]
        if not citation_is_public(row["delete_flag"]):
            deleted_count += 1
            continue
        key = (activity, row["citation_id"])
        if not activity or not row["citation_id"] or key in citation_keys:
            raise LoadError("blank or duplicate public citation key")
        citation_keys.add(key)
        if activity not in inspection_by_activity:
            raise LoadError(f"public citation has no allow-listed inspection: {activity}")
        public_citation_type(row["viol_type"])
        row["current_penalty"] = str(_money(row["current_penalty"], "current_penalty"))
        row["initial_penalty"] = str(_money(row["initial_penalty"], "initial_penalty"))
        _parse_date(row["contest_date"], "contest_date")
        _parse_date(row["final_order_date"], "final_order_date")
        citations.append(row)
    if len(citations) != EXPECTED_PUBLIC_CITATIONS or deleted_count != 1_552:
        raise LoadError(f"citation/deletion count mismatch: public={len(citations)}, deleted={deleted_count}")
    activities = frozenset(inspection_by_activity)
    if len(activities) != EXPECTED_ACTIVITIES:
        raise LoadError(f"allowlist activity count mismatch: {len(activities)}")
    return SourceSet(tuple(inspection_by_activity.values()), tuple(citations), deleted_count, activities)


def _activity_list(value: str | None) -> frozenset[str]:
    return frozenset(item.strip() for item in (value or "").split(";") if item.strip())


def _expected_metrics(match: Match, source: SourceSet) -> dict[str, object]:
    inspections = [row for row in source.inspections if row["activity_nr"] in match.activities]
    citations = [row for row in source.citations if row["activity_nr"] in match.activities]
    dates = [_parse_date(row["open_date"], "open_date") for row in inspections]
    dates = [item for item in dates if item is not None]
    current_penalty = sum((_money(row["current_penalty"], "current_penalty") for row in citations), Decimal("0.00"))
    return {
        "n_inspections": len(inspections),
        "n_citation_items": len(citations),
        "n_serious": sum(row["viol_type"] == "S" for row in citations),
        "n_willful_repeat": sum(row["viol_type"] in {"W", "R"} for row in citations),
        "current_penalty_amount": int(current_penalty.quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
        "n_with_final_order": sum(bool(row["final_order_date"]) for row in citations),
        "n_contested": sum(bool(row["contest_date"]) for row in citations),
        "first_open": min(dates) if dates else None,
        "last_open": max(dates) if dates else None,
    }


def verify_held_match(match: Match, source: SourceSet) -> None:
    if match.state != "FL" or match.tier != "exact" or len(match.activities) != 1:
        raise LoadError(f"held match does not match B2 hold contract: {match.license_key}")
    if (match.n_citation_items, match.n_serious, match.current_penalty_amount) != (0, 0, 0):
        raise LoadError(f"held aggregate values changed: {match.license_key}")
    detail = _expected_metrics(match, source)
    if (detail["n_citation_items"], detail["n_serious"], detail["current_penalty_amount"]) != (3, 3, 12_058):
        raise LoadError(f"held source mismatch no longer matches the receipt: {match.license_key}")


def validate_matches(matches: list[Match], source: SourceSet) -> tuple[list[Match], dict[str, int]]:
    by_key = {match.license_key: match for match in matches}
    if len(by_key) != len(matches) or len(matches) != 10_578:
        raise LoadError(f"published match count or license-key uniqueness mismatch: {len(matches)}")
    if not HELD_LICENSES.issubset(by_key):
        raise LoadError("required held license keys are missing")
    for key in HELD_LICENSES:
        held = by_key[key]
        verify_held_match(held, source)
    eligible: list[Match] = []
    all_public_activities: set[str] = set()
    for match in matches:
        if match.tier not in {"exact", "strong"}:
            raise LoadError("non-exact/strong row found in public match table")
        if not match.activities or not match.activities.issubset(source.unique_activities):
            raise LoadError(f"missing allow-listed activity for {match.license_key}")
        all_public_activities.update(match.activities)
        if match.license_key in HELD_LICENSES:
            continue
        actual = _expected_metrics(match, source)
        expected = {name: getattr(match, name) for name in actual}
        if actual != expected:
            raise LoadError(f"aggregate reconciliation failed for {match.state}/{match.license_key}: {actual} != {expected}")
        eligible.append(match)
    if len(eligible) != 10_576:
        raise LoadError(f"detail eligible match count mismatch: {len(eligible)}")
    if all_public_activities != set(source.unique_activities):
        raise LoadError("source activity set does not exactly match the published match allowlist")
    attachment_inspections = sum(sum(row["activity_nr"] in match.activities for row in source.inspections) for match in eligible)
    attachment_citations = sum(sum(row["activity_nr"] in match.activities for row in source.citations) for match in eligible)
    return eligible, {
        "unique_source_inspections": len(source.inspections),
        "public_match_inspection_attachments": attachment_inspections,
        "unique_source_citations": len(source.citations),
        "public_match_citation_attachments": attachment_citations,
    }


def _db_matches(conn) -> list[Match]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id::text, contractor_id::text, state, license_key, match_tier,
                   osha_activity_nrs, n_inspections, n_citation_items, n_serious,
                   n_willful_repeat, current_penalty_amount, n_with_final_order,
                   n_contested, first_open, last_open
            FROM contractor_osha_license_matches
            ORDER BY state, license_key, id
        """)
        records = cur.fetchall()
    return [Match(
        match_id=r[0], contractor_id=r[1], state=r[2].strip(), license_key=r[3], tier=r[4],
        activities=_activity_list(r[5]), n_inspections=r[6], n_citation_items=r[7],
        n_serious=r[8], n_willful_repeat=r[9], current_penalty_amount=r[10],
        n_with_final_order=r[11], n_contested=r[12], first_open=r[13], last_open=r[14],
    ) for r in records]


def run_loader(args: argparse.Namespace) -> dict[str, object]:
    source = read_sources(args.inspections, args.violations)
    if not args.execute:
        return {"mode": "source-validated-dry-run", "unique_source_inspections": len(source.inspections),
                "unique_source_citations": len(source.citations), "deleted_excluded": source.deleted_count,
                "eligible_match_attachments": "requires read-only target DB reconciliation"}
    if args.confirm_production_load != GO_PHRASE:
        raise LoadError("database writes require the exact Founder GO phrase")
    if not args.database_url or not args.expected_db_host or not args.expected_db_name:
        raise LoadError("--execute requires an explicit database URL, expected Production host, and database name")
    parsed = urlparse(args.database_url)
    if not parsed.hostname or parsed.hostname.casefold() != args.expected_db_host.casefold():
        raise LoadError("target DB host does not match --expected-db-host")
    try:
        import psycopg
    except ImportError as exc:
        raise LoadError("psycopg is required only for an explicitly authorized load") from exc
    conn = psycopg.connect(args.database_url, connect_timeout=10)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_database(), current_setting('server_version_num')::int")
                database_name, server_version = cur.fetchone()
                if database_name.casefold() != args.expected_db_name.casefold():
                    raise LoadError("target DB name does not match --expected-db-name")
                if server_version < 150000:
                    raise LoadError("target database must be PostgreSQL 15 or newer")
                cur.execute("""
                    SELECT to_regclass('public.contractor_osha_inspections'),
                           to_regclass('public.contractor_osha_citations'),
                           to_regclass('public.osha_detail_load_receipts'),
                           to_regclass('public.contractor_osha_license_matches')
                """)
                if any(value is None for value in cur.fetchone()):
                    raise LoadError("migration 019 tables are not all present")
                cur.execute("""
                    SELECT EXISTS (
                      SELECT 1 FROM pg_constraint
                       WHERE conrelid = 'public.contractor_osha_citations'::regclass
                         AND contype = 'c'
                         AND pg_get_constraintdef(oid) ILIKE '%viol_type%'
                         AND pg_get_constraintdef(oid) ILIKE '%U%'
                    )
                """)
                if not cur.fetchone()[0]:
                    raise LoadError("migration 019 citation type constraint does not accept source type U")

                # Serialize same-source runs; a rerun reuses the original batch and receipts.
                combined_hash = COMBINED_SOURCE_SHA256
                cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ("con-osha-001b:" + combined_hash,))
                matches = _db_matches(conn)
                eligible, shape = validate_matches(matches, source)

                cur.execute("SELECT id FROM ingest_batches WHERE source_system = %s AND checksum_sha256 = %s",
                            ("us_dol_osha_detail", combined_hash))
                batch_row = cur.fetchone()
                if batch_row:
                    batch_id = batch_row[0]
                else:
                    cur.execute("""
                        INSERT INTO ingest_batches
                          (source_system, source_dataset, source_file, row_count, checksum_sha256, notes)
                        VALUES ('us_dol_osha_detail', 'osha_inspections+osha_violations',
                                'B2 external scoped package', %s, %s, %s)
                        RETURNING id
                    """, (EXPECTED_INSPECTIONS + EXPECTED_PUBLIC_CITATIONS, combined_hash,
                          "Pinned B2 source SHAs; held aggregate mismatches excluded from detail."))
                    batch_id = cur.fetchone()[0]

                receipt_ids: dict[str, object] = {}
                for dataset, source_hash, row_count in (
                    ("osha_inspections", INSPECTION_SHA256, EXPECTED_INSPECTIONS),
                    ("osha_violations", VIOLATION_SHA256, EXPECTED_PUBLIC_CITATIONS),
                ):
                    cur.execute("""
                        SELECT id FROM osha_detail_load_receipts
                        WHERE source_batch_id = %s AND source_dataset = %s AND source_hash = %s
                    """, (batch_id, dataset, source_hash))
                    receipt = cur.fetchone()
                    if receipt:
                        receipt_ids[dataset] = receipt[0]
                    else:
                        cur.execute("""
                            INSERT INTO osha_detail_load_receipts
                              (source_batch_id, source_dataset, source_hash, inspection_rows, citation_rows,
                               held_license_keys, hold_reason)
                            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
                        """, (batch_id, dataset, source_hash,
                              EXPECTED_INSPECTIONS if dataset == "osha_inspections" else 0,
                              EXPECTED_PUBLIC_CITATIONS if dataset == "osha_violations" else 0,
                              sorted(HELD_LICENSES), HOLD_REASON))
                        receipt_ids[dataset] = cur.fetchone()[0]

                inspections_by_activity = {row["activity_nr"]: row for row in source.inspections}
                citations_by_activity: dict[str, list[dict[str, str]]] = defaultdict(list)
                for citation in source.citations:
                    citations_by_activity[citation["activity_nr"]].append(citation)
                inserted_inspections = inserted_citations = 0
                for match in eligible:
                    for activity in sorted(match.activities):
                        inspection = inspections_by_activity[activity]
                        cur.execute("""
                            INSERT INTO contractor_osha_inspections
                              (public_match_id, contractor_id, state, license_key, activity_nr,
                               open_date, site_city, site_state, inspection_type, close_date,
                               closing_conference_date, citations_verified, source_batch_id, receipt_id, source_hash)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s, %s)
                            ON CONFLICT (public_match_id, activity_nr) DO NOTHING
                            RETURNING id
                        """, (match.match_id, match.contractor_id, match.state, match.license_key, activity,
                              _parse_date(inspection["open_date"], "open_date"), inspection["site_city"] or None,
                              inspection["site_state"] or None, inspection["inspection_type"] or None,
                              _parse_date(inspection["close_date"], "close_date"),
                              _parse_date(inspection["closing_conference_date"], "closing_conference_date"),
                              batch_id, receipt_ids["osha_inspections"], INSPECTION_SHA256))
                        inserted = cur.fetchone()
                        if inserted:
                            inserted_inspections += 1
                            inspection_id = inserted[0]
                        else:
                            cur.execute("""
                                SELECT id, source_hash FROM contractor_osha_inspections
                                WHERE public_match_id = %s AND activity_nr = %s
                            """, (match.match_id, activity))
                            existing = cur.fetchone()
                            if not existing or existing[1].strip() != INSPECTION_SHA256:
                                raise LoadError("existing inspection key has different provenance; stopping")
                            inspection_id = existing[0]
                        for citation in citations_by_activity.get(activity, []):
                            cur.execute("""
                                INSERT INTO contractor_osha_citations
                                  (inspection_id, activity_nr, citation_id, standard, viol_type,
                                   current_penalty, initial_penalty, contest_date, final_order_date,
                                   delete_flag, source_batch_id, receipt_id, source_hash)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (inspection_id, citation_id) DO NOTHING
                                RETURNING id
                            """, (inspection_id, activity, citation["citation_id"], citation["standard"],
                                  citation["viol_type"], _money(citation["current_penalty"], "current_penalty"),
                                  _money(citation["initial_penalty"], "initial_penalty"),
                                  _parse_date(citation["contest_date"], "contest_date"),
                                  _parse_date(citation["final_order_date"], "final_order_date"),
                                  citation["delete_flag"] or None, batch_id, receipt_ids["osha_violations"],
                                  VIOLATION_SHA256))
                            inserted_citation = cur.fetchone()
                            inserted_citations += inserted_citation is not None
                            if inserted_citation is None:
                                cur.execute("""
                                    SELECT source_hash FROM contractor_osha_citations
                                    WHERE inspection_id = %s AND citation_id = %s
                                """, (inspection_id, citation["citation_id"]))
                                existing_citation = cur.fetchone()
                                if not existing_citation or existing_citation[0].strip() != VIOLATION_SHA256:
                                    raise LoadError("existing citation key has different provenance; stopping")
        return {"mode": "loaded", "database": database_name,
                "inserted_inspection_attachments": inserted_inspections,
                "inserted_citation_attachments": inserted_citations, **shape}
    finally:
        conn.close()


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inspections", type=Path, required=True, help="B2 inspection CSV outside Git")
    parser.add_argument("--violations", type=Path, required=True, help="B2 violation CSV outside Git")
    parser.add_argument("--execute", action="store_true", help="Request a gated future database load")
    parser.add_argument("--confirm-production-load", default="")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    parser.add_argument("--expected-db-host", default="")
    parser.add_argument("--expected-db-name", default="")
    args = parser.parse_args(argv)
    try:
        result = run_loader(args)
    except (LoadError, OSError) as exc:
        print(f"STOP: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
