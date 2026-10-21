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
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_EVEN
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

INSPECTION_SHA256 = "5867164b0c00c651eb6379cc9a9aa8242917d410d54b9ac48ab98632ec010552"
VIOLATION_SHA256 = "7ab8b7edb91075ae356baf2093d884f037a73feb1e235123485acf1864dd40ff"
SCOPED_INSPECTIONS_SHA256 = "a9ca343d1796cc649474354a740dc3b1bde011d04e9d4416f13d6072c191a56e"
SCOPED_CITATIONS_SHA256 = "a0e8cee1093534313cef49474837c0a8e7775f45a73f5b90cebe0ae512a85e72"
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
PUBLIC_TYPE_LABELS = {"S": "Serious", "W": "Willful", "R": "Repeat", "O": "Other", "U": "Unclassified"}
HANDOFF_FILE_SHA256 = {
    "scoped/inspections.csv": SCOPED_INSPECTIONS_SHA256,
    "scoped/citations.csv": SCOPED_CITATIONS_SHA256,
    "allowlist/activity_allowlist.txt": "6ffdaa081cacec773e7fc1f50e560d9df518336d0b7a4ff8150f8342f00ddc4e",
    "allowlist/published_matches.csv": "b94873dfe673df188c4846e07e6dd781d86bacedfa7d2b847c018c03f1d98ca1",
    "receipts/dry-run-receipt.json": "d7a9a2267c468ebe3342c7e271b96bd2a894b26184f0f150ef816f70ed4baca4",
    "receipts/dry-run-manifest.json": "4cf6732f3720c34fb0bd434ca9d490d094ee3c661035f994c3ce514c574224af",
    "receipts/detail-held-license-keys.txt": "15e395f26329853194ff8f4dfce951fec87626d6cdcacc889f3ca76e9b7e5ef4",
    "receipts/SHA256SUMS.txt": "d33f31ec6d57091e0e86474a6debf6d5d75f7c391f3b958e67987f31ec86b2a3",
}


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


def verify_handoff(root: Path) -> tuple[dict[str, object], dict[str, object], frozenset[str], list[Match]]:
    expected_paths = {Path(name).as_posix() for name in HANDOFF_FILE_SHA256}
    actual_paths = {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}
    allowed_unhashed = {"README.txt"}
    if (actual_paths - expected_paths) - allowed_unhashed or expected_paths - actual_paths:
        missing = sorted(expected_paths - actual_paths)
        extra = sorted((actual_paths - expected_paths) - allowed_unhashed)
        raise LoadError(f"handoff file set mismatch; missing={missing}, extra={extra}")
    for relative, expected_hash in HANDOFF_FILE_SHA256.items():
        verify_source(root / Path(relative), expected_hash)

    manifest = json.loads((root / "receipts/dry-run-manifest.json").read_text(encoding="utf-8"))
    receipt = json.loads((root / "receipts/dry-run-receipt.json").read_text(encoding="utf-8"))
    source_hashes = {item["role"]: item["sha256"] for item in manifest["sources"]}
    if source_hashes != {"inspection": INSPECTION_SHA256, "violation": VIOLATION_SHA256}:
        raise LoadError("handoff manifest source archive SHA values differ from B2 receipt")
    if manifest.get("load_authorization_granted") is not False or manifest.get("database_mutations") != 0:
        raise LoadError("handoff manifest does not identify a non-loading dry run")

    sum_lines = (root / "receipts/SHA256SUMS.txt").read_text(encoding="utf-8").splitlines()
    sum_entries: dict[str, str] = {}
    for line in sum_lines:
        parts = line.split()
        if len(parts) not in {2, 3}:
            raise LoadError("malformed SHA256SUMS.txt line")
        sum_entries[parts[1]] = parts[0].lower()
    expected_sum_entries = {
        "OSHA_inspection.zip": INSPECTION_SHA256,
        "OSHA_violation.zip": VIOLATION_SHA256,
        **{Path(name).name: digest for name, digest in HANDOFF_FILE_SHA256.items() if not name.endswith("SHA256SUMS.txt")},
    }
    if sum_entries != expected_sum_entries:
        raise LoadError("SHA256SUMS.txt entries do not match handoff files and source receipt")

    expected_receipt = {
        "allowlist_activity_numbers": EXPECTED_ACTIVITIES,
        "matched_inspection_activity_numbers": EXPECTED_ACTIVITIES,
        "missing_inspection_activity_numbers": 0,
        "extra_inspection_activity_numbers": 0,
        "total_inspection_rows": EXPECTED_INSPECTIONS,
        "duplicate_inspection_activity_rows": 0,
        "total_citation_rows_public": EXPECTED_PUBLIC_CITATIONS,
        "deleted_rows_excluded": 1_552,
        "duplicate_citation_keys": 0,
        "invalid_citation_keys": 0,
        "public_matches_tested": 10_578,
        "detail_eligible_public_matches": 10_576,
        "detail_held_mismatches": 2,
        "official_activity_url_verified": False,
    }
    for field, expected in expected_receipt.items():
        if receipt.get(field) != expected:
            raise LoadError(f"dry-run receipt mismatch for {field}: {receipt.get(field)!r}")
    if manifest.get("reconciliation", {}).get("held_license_keys") != sorted(HELD_LICENSES):
        raise LoadError("dry-run receipt held keys differ from expected pair")
    readme_path = root / "README.txt"
    if readme_path.exists():
        readme = readme_path.read_text(encoding="utf-8")
        if not all(value in readme for value in ("OFFICIAL_SOURCE_ACQUIRED = YES", "CCC1329816", "CGC1519699", "PRODUCTION LOAD NOT AUTHORIZED")):
            raise LoadError("handoff README conflicts with the B2 receipt")
        receipt["readme_sha256"] = sha256_file(readme_path)

    hold_lines = [line.strip() for line in (root / "receipts/detail-held-license-keys.txt").read_text(encoding="utf-8").splitlines() if line.strip()]
    if hold_lines != ["CCC1329816", "CGC1519699"]:
        raise LoadError(f"held license file mismatch: {hold_lines}")
    allowlist_lines = [line.strip() for line in (root / "allowlist/activity_allowlist.txt").read_text(encoding="utf-8").splitlines() if line.strip()]
    allowlist = frozenset(allowlist_lines)
    if len(allowlist) != EXPECTED_ACTIVITIES or len(allowlist_lines) != EXPECTED_ACTIVITIES:
        raise LoadError("activity allowlist does not contain 17,534 unique activity numbers")

    match_rows = _rows(root / "allowlist/published_matches.csv", {
        "match_id", "contractor_id", "license_key", "state", "match_tier", "n_inspections",
        "first_open", "last_open", "n_citation_items", "n_serious", "n_willful_repeat",
        "current_penalty_amount", "n_with_final_order", "n_contested", "osha_activity_nrs",
    })
    matches = [Match(
        match_id=row["match_id"], contractor_id=row["contractor_id"], state=row["state"],
        license_key=row["license_key"], tier=row["match_tier"], activities=_activity_list(row["osha_activity_nrs"]),
        n_inspections=int(row["n_inspections"]), n_citation_items=int(row["n_citation_items"]),
        n_serious=int(row["n_serious"]), n_willful_repeat=int(row["n_willful_repeat"]),
        current_penalty_amount=int(row["current_penalty_amount"]), n_with_final_order=int(row["n_with_final_order"]),
        n_contested=int(row["n_contested"]), first_open=_parse_date(row["first_open"], "first_open"),
        last_open=_parse_date(row["last_open"], "last_open"),
    ) for row in match_rows]
    if len(matches) != 10_578:
        raise LoadError(f"published match file row count mismatch: {len(matches)}")
    return manifest, receipt, allowlist, matches


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
    inspections_by_activity: dict[str, dict[str, str]] = field(init=False, repr=False, compare=False)
    citations_by_activity: dict[str, tuple[dict[str, str], ...]] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        inspection_index = {row["activity_nr"]: row for row in self.inspections}
        citation_index: dict[str, list[dict[str, str]]] = defaultdict(list)
        for citation in self.citations:
            citation_index[citation["activity_nr"]].append(citation)
        object.__setattr__(self, "inspections_by_activity", inspection_index)
        object.__setattr__(self, "citations_by_activity", {key: tuple(value) for key, value in citation_index.items()})


def read_sources(inspection_path: Path, violation_path: Path) -> SourceSet:
    # Hash both complete files before parsing or making any database connection.
    verify_source(inspection_path, SCOPED_INSPECTIONS_SHA256)
    verify_source(violation_path, SCOPED_CITATIONS_SHA256)
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
    inspections = [source.inspections_by_activity[activity] for activity in match.activities]
    citations = [row for activity in match.activities for row in source.citations_by_activity.get(activity, ())]
    dates = [_parse_date(row["open_date"], "open_date") for row in inspections]
    dates = [item for item in dates if item is not None]
    current_penalty = sum((_money(row["current_penalty"], "current_penalty") for row in citations), Decimal("0.00"))
    return {
        "n_inspections": len(inspections),
        "n_citation_items": len(citations),
        "n_serious": sum(row["viol_type"] == "S" for row in citations),
        "n_willful_repeat": sum(row["viol_type"] in {"W", "R"} for row in citations),
        "current_penalty_amount": int(current_penalty.quantize(Decimal("1"), rounding=ROUND_HALF_EVEN)),
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


def validate_matches(
    matches: list[Match], source: SourceSet, expected_allowlist: frozenset[str] | None = None,
) -> tuple[list[Match], dict[str, int]]:
    by_key = {(match.state, match.license_key): match for match in matches}
    if len(by_key) != len(matches) or len(matches) != 10_578:
        raise LoadError(f"published match count or license-key uniqueness mismatch: {len(matches)}")
    held_rows = {match.license_key for match in matches if match.state == "FL" and match.license_key in HELD_LICENSES}
    if held_rows != HELD_LICENSES:
        raise LoadError("required held license keys are missing")
    for key in HELD_LICENSES:
        held = by_key[("FL", key)]
        verify_held_match(held, source)
    if expected_allowlist is not None and expected_allowlist != source.unique_activities:
        raise LoadError("inspection activity set differs from explicit B2 allowlist")
    eligible: list[Match] = []
    all_public_activities: set[str] = set()
    for match in matches:
        if match.tier not in {"exact", "strong"}:
            raise LoadError("non-exact/strong row found in public match table")
        if not match.activities or not match.activities.issubset(source.unique_activities):
            raise LoadError(f"missing allow-listed activity for {match.license_key}")
        all_public_activities.update(match.activities)
        if match.state == "FL" and match.license_key in HELD_LICENSES:
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
    attachment_inspections = sum(len(match.activities) for match in eligible)
    attachment_citations = sum(
        len(source.citations_by_activity.get(activity, ()))
        for match in eligible for activity in match.activities
    )
    return eligible, {
        "unique_source_inspections": len(source.inspections),
        "public_match_inspection_attachments": attachment_inspections,
        "unique_source_citations": len(source.citations),
        "public_match_citation_attachments": attachment_citations,
    }


def simulate_idempotent_runs(planned_keys: set[tuple[str, ...]]) -> tuple[int, int]:
    first_run_inserts = len(planned_keys)
    existing_after_first_run = set(planned_keys)
    second_run_inserts = len(planned_keys - existing_after_first_run)
    return first_run_inserts, second_run_inserts


def _same_match_snapshot(left: list[Match], right: list[Match]) -> bool:
    left_by_key = {(row.state, row.license_key): row for row in left}
    right_by_key = {(row.state, row.license_key): row for row in right}
    return left_by_key == right_by_key


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


def _verify_loaded_reconciliation(cur, eligible: list[Match], expected_shape: dict[str, int]) -> None:
    match_ids = [match.match_id for match in eligible]
    cur.execute("""
        SELECT m.id::text,
               count(DISTINCT i.id)::int,
               count(c.id)::int,
               count(c.id) FILTER (WHERE c.viol_type = 'S')::int,
               count(c.id) FILTER (WHERE c.viol_type IN ('W', 'R'))::int,
               coalesce(sum(c.current_penalty), 0),
               count(c.id) FILTER (WHERE c.final_order_date IS NOT NULL)::int,
               count(c.id) FILTER (WHERE c.contest_date IS NOT NULL)::int,
               min(i.open_date), max(i.open_date)
          FROM contractor_osha_license_matches m
          LEFT JOIN contractor_osha_inspections i
            ON i.public_match_id = m.id AND i.contractor_id = m.contractor_id
           AND i.state = m.state AND i.license_key = m.license_key
          LEFT JOIN contractor_osha_citations c
            ON c.inspection_id = i.id AND c.activity_nr = i.activity_nr
         WHERE m.id = ANY(%s::uuid[])
         GROUP BY m.id
    """, (match_ids,))
    rows = cur.fetchall()
    if len(rows) != len(eligible):
        raise LoadError("post-insert reconciliation is missing an eligible public match")
    expected_by_id = {match.match_id: match for match in eligible}
    inserted_inspections = inserted_citations = 0
    for row in rows:
        match = expected_by_id[row[0]]
        rounded_penalty = Decimal(row[5]).quantize(Decimal("1"), rounding=ROUND_HALF_EVEN)
        actual = (row[1], row[2], row[3], row[4], rounded_penalty, row[6], row[7], row[8], row[9])
        expected = (
            match.n_inspections, match.n_citation_items, match.n_serious, match.n_willful_repeat,
            Decimal(match.current_penalty_amount), match.n_with_final_order, match.n_contested,
            match.first_open, match.last_open,
        )
        if actual != expected:
            raise LoadError(f"post-insert detail reconciliation failed for {match.state}/{match.license_key}")
        inserted_inspections += row[1]
        inserted_citations += row[2]
    if inserted_inspections != expected_shape["public_match_inspection_attachments"]:
        raise LoadError("post-insert inspection attachment count differs from source plan")
    if inserted_citations != expected_shape["public_match_citation_attachments"]:
        raise LoadError("post-insert citation attachment count differs from source plan")
    cur.execute("""
        SELECT count(*) FROM contractor_osha_inspections
        WHERE state = 'FL' AND license_key = ANY(%s::text[])
    """, (sorted(HELD_LICENSES),))
    if cur.fetchone()[0] != 0:
        raise LoadError("held matches unexpectedly have public inspection details")


def run_loader(args: argparse.Namespace) -> dict[str, object]:
    _manifest, receipt, allowlist, package_matches = verify_handoff(args.handoff_dir)
    source = read_sources(args.handoff_dir / "scoped/inspections.csv", args.handoff_dir / "scoped/citations.csv")
    eligible, shape = validate_matches(package_matches, source, allowlist)
    held_keys = sorted(match.license_key for match in package_matches if match.state == "FL" and match.license_key in HELD_LICENSES)
    inspection_keys = {(match.match_id, activity) for match in eligible for activity in match.activities}
    citation_keys = {
        (match.match_id, activity, citation["citation_id"])
        for match in eligible for activity in match.activities
        for citation in source.citations_by_activity.get(activity, ())
    }
    if not args.execute:
        # The first plan contains the complete parent-scoped natural-key set.
        # The simulated rerun sees that set already present and adds zero rows.
        first_inspection_inserts, second_inspection_inserts = simulate_idempotent_runs(inspection_keys)
        first_citation_inserts, second_citation_inserts = simulate_idempotent_runs(citation_keys)
        violation_type_counts = Counter(row["viol_type"] for row in source.citations)
        return {
            "mode": "source-validated-dry-run",
            "all_file_hashes_match": True,
            "additional_readme_sha256": receipt.get("readme_sha256"),
            "unique_source_inspections": len(source.inspections),
            "public_match_inspection_attachments": shape["public_match_inspection_attachments"],
            "unique_source_citations": len(source.citations),
            "public_match_citation_attachments": shape["public_match_citation_attachments"],
            "published_matches": len(package_matches),
            "detail_eligible_matches": len(eligible),
            "reconciled_matches": len(eligible),
            "eligible_reconciliation_pass": len(eligible) == 10_576,
            "held_matches": len(held_keys),
            "held_keys": held_keys,
            "delete_x_excluded": source.deleted_count == 1_552,
            "blank_delete_flag_kept": len(source.citations) == EXPECTED_PUBLIC_CITATIONS,
            "public_violation_type_counts": dict(sorted(violation_type_counts.items())),
            "u_type_supported": "U" in violation_type_counts and public_citation_type("U") == "Unclassified",
            "official_activity_url_render": "NO",
            "dry_run_insert_inspections": first_inspection_inserts,
            "dry_run_insert_citations": first_citation_inserts,
            "second_dry_run_new_inspections": second_inspection_inserts,
            "second_dry_run_new_citations": second_citation_inserts,
            "aggregate_mutations": 0,
            "overall_reconciliation_including_holds": _manifest["reconciliation"]["full_reconciliation_pass"],
        }
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
                if not _same_match_snapshot(matches, package_matches):
                    raise LoadError("current database aggregate snapshot differs from the verified B2 match file")
                eligible, shape = validate_matches(matches, source, allowlist)

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

                inspections_by_activity = source.inspections_by_activity
                citations_by_activity = source.citations_by_activity
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
                _verify_loaded_reconciliation(cur, eligible, shape)
                cur.execute("""
                    UPDATE osha_detail_load_receipts
                       SET status = 'loaded', loaded_at = now()
                     WHERE id = ANY(%s::uuid[]) AND status = 'received'
                """, ([receipt_ids["osha_inspections"], receipt_ids["osha_violations"]],))
        return {"mode": "loaded", "database": database_name,
                "inserted_inspection_attachments": inserted_inspections,
                "inserted_citation_attachments": inserted_citations, **shape}
    finally:
        conn.close()


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff-dir", type=Path, required=True, help="Verified B2 scoped handoff directory outside Git")
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
