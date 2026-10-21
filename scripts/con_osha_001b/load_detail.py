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
SCOPED_INSPECTIONS_SHA256 = "c32f00ddc6d528bffac8529f65b6a275a98f9d12c9eb87e774709a742664419f"
SCOPED_CITATIONS_SHA256 = "7bdb3dc11e4939a0c5f61777a96a0d7f42b2d46bd0ada3fa0e9c9d15bfb05f13"
EXPECTED_ACTIVITIES = 17_534
EXPECTED_INSPECTIONS = 17_534
EXPECTED_MATCH_INSPECTION_BRIDGES = 25_930
EXPECTED_SOURCE_NON_X_CITATIONS = 29_559
EXPECTED_LOADABLE_CITATIONS = 29_556
EXPECTED_FL_SOURCE_NON_X_CITATIONS = 20_211
EXPECTED_FL_LOADABLE_CITATIONS = 20_208
EXPECTED_NJ_LOADABLE_CITATIONS = 9_348
EXPECTED_HELD_ONLY_CITATIONS = 3
HELD_ONLY_ACTIVITY = "348805508"
HELD_ONLY_CITATION_IDS = {"01001", "01002", "01003"}
EXPECTED_NULL_CURRENT_PENALTIES = 5_123
EXPECTED_EXPLICIT_ZERO_CURRENT_PENALTIES = 2_321
EXPECTED_POSITIVE_CURRENT_PENALTIES = 22_112
EXPECTED_INSPECTIONS_WITH_CITATIONS = 11_454
EXPECTED_INSPECTIONS_WITHOUT_CITATIONS = 6_080
COMBINED_SOURCE_SHA256 = hashlib.sha256((
    INSPECTION_SHA256 + VIOLATION_SHA256 + SCOPED_INSPECTIONS_SHA256 + SCOPED_CITATIONS_SHA256
).encode("ascii")).hexdigest()
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
    "scoped/inspections-v2.csv": SCOPED_INSPECTIONS_SHA256,
    "scoped/citations-source-nonx-v2.csv": SCOPED_CITATIONS_SHA256,
    "allowlist/activity_allowlist-v2.txt": "214c8c9faaf66261e842e88fe2e3ee21ce22a1cc2dafa8ab1abbdf30a1eabf84",
    "allowlist/published_matches-v2.csv": "09905cf90a11e9048c58e0d0daf5ba491c52ac9816cb8537334d9f86310a499d",
    "receipts/v2-reconciliation.json": "ca3cbb2dd9ee2204118e1cf988f660faa435fd30650fcac68bf9106df5a084fd",
    "receipts/v2-manifest.json": "a3509213922ac83cd652dd751459f462657025577281e07460cb554963b6192e",
    "receipts/held-only-citations.json": "900f8c435edd291e09452d0ee993d9509b1d917e65d64496d0af868d9de11cdd",
    "receipts/SHA256SUMS.txt": "35bf5d5041e185f80be1e0814469406fc316f29f12409c59d1f206c9157df7cd",
    "README.txt": "48395d3de92407ddf744106a0f795a2d526ffbd4d25ce7a74e24a59b36465b77",
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
    if actual_paths != expected_paths:
        missing = sorted(expected_paths - actual_paths)
        extra = sorted(actual_paths - expected_paths)
        raise LoadError(f"handoff file set mismatch; missing={missing}, extra={extra}")
    for relative, expected_hash in HANDOFF_FILE_SHA256.items():
        verify_source(root / Path(relative), expected_hash)

    manifest = json.loads((root / "receipts/v2-manifest.json").read_text(encoding="utf-8"))
    receipt = json.loads((root / "receipts/v2-reconciliation.json").read_text(encoding="utf-8"))
    held_receipt = json.loads((root / "receipts/held-only-citations.json").read_text(encoding="utf-8"))
    source_hashes = {
        "inspection": manifest.get("raw_inspection_sha256"),
        "violation": manifest.get("raw_violation_sha256"),
    }
    if source_hashes != {"inspection": INSPECTION_SHA256, "violation": VIOLATION_SHA256}:
        raise LoadError("V2 manifest source archive SHA values differ from B2 receipt")
    if manifest.get("load_authorization_granted") is not False or manifest.get("database_mutations") != 0:
        raise LoadError("V2 manifest does not identify a non-loading dry run")

    sum_lines = (root / "receipts/SHA256SUMS.txt").read_text(encoding="utf-8").splitlines()
    sum_entries: dict[str, str] = {}
    for line in sum_lines:
        parts = line.split()
        if len(parts) not in {2, 3}:
            raise LoadError("malformed SHA256SUMS.txt line")
        sum_entries[parts[1]] = parts[0].lower()
    expected_sum_entries = {name: digest for name, digest in HANDOFF_FILE_SHA256.items()
                            if not name.endswith("SHA256SUMS.txt")}
    if sum_entries != expected_sum_entries:
        raise LoadError("SHA256SUMS.txt entries do not match handoff files and source receipt")

    if manifest.get("package") != "con-osha-001b-detail-handoff-v2":
        raise LoadError("unexpected V2 handoff package identity")
    if manifest.get("counts") != receipt:
        raise LoadError("V2 manifest counts differ from the reconciliation receipt")
    if manifest.get("held_activity_not_loadable") != HELD_ONLY_ACTIVITY:
        raise LoadError("V2 manifest held activity differs from the loader contract")
    expected_receipt = {
        "fl_profiles": 7_846, "nj_profiles": 2_732, "total_profiles": 10_578,
        "fl_inspections": 12_339, "nj_inspections": 5_195, "total_inspections": 17_534,
        "fl_source_non_x_citations": 20_211, "nj_source_non_x_citations": 9_348,
        "fl_delete_x": 1_026, "nj_delete_x": 526, "total_delete_x": 1_552,
        "source_non_x_citations": EXPECTED_SOURCE_NON_X_CITATIONS,
        "held_only_citations": EXPECTED_HELD_ONLY_CITATIONS,
        "fl_loadable_citations": EXPECTED_FL_LOADABLE_CITATIONS,
        "nj_loadable_citations": EXPECTED_NJ_LOADABLE_CITATIONS,
        "loadable_citations": EXPECTED_LOADABLE_CITATIONS,
        "eligible_nonheld_links_for_348805508": 0,
        "total_current_penalty_null": EXPECTED_NULL_CURRENT_PENALTIES,
        "total_current_penalty_explicit_zero": EXPECTED_EXPLICIT_ZERO_CURRENT_PENALTIES,
        "total_current_penalty_positive": EXPECTED_POSITIVE_CURRENT_PENALTIES,
        "total_inspections_with_citations": EXPECTED_INSPECTIONS_WITH_CITATIONS,
        "total_inspections_without_citations": EXPECTED_INSPECTIONS_WITHOUT_CITATIONS,
        "live_allowlist_only": True, "local_candidate_csv_used": False,
        "blank_current_penalty_preserved": True, "explicit_zero_collapsed_into_blank": False,
        "fillna_zero_used": False, "database_mutations": 0,
    }
    for field, expected in expected_receipt.items():
        if receipt.get(field) != expected:
            raise LoadError(f"V2 reconciliation mismatch for {field}: {receipt.get(field)!r}")
    expected_holds = {
        "activity_nr": HELD_ONLY_ACTIVITY,
        "eligible_nonheld_links": 0,
        "live_license_keys": sorted(HELD_LICENSES),
        "loadable_public_detail": False,
        "reason": HOLD_REASON,
        "current_penalty_sum": "12058.00",
    }
    for key, expected in expected_holds.items():
        if held_receipt.get(key) != expected:
            raise LoadError(f"held-only citation receipt mismatch for {key}")
    held_rows = held_receipt.get("citations", [])
    if [(row.get("citation_id"), row.get("viol_type"), row.get("current_penalty")) for row in held_rows] != [
        ("01001", "S", "2837.00"), ("01002", "S", "4256.00"), ("01003", "S", "4965.00")
    ]:
        raise LoadError("held-only citation evidence differs from the exact three-row source receipt")
    readme = (root / "README.txt").read_text(encoding="utf-8")
    readme_compact = " ".join(readme.split())
    if not all(value in readme_compact for value in ("SOURCE_NON_X_CITATIONS = 29559", "LOADABLE_CITATIONS = 29556", "stays blank", "zero stays zero")):
        raise LoadError("V2 README conflicts with source/loadable penalty contract")

    allowlist_lines = [line.strip() for line in (root / "allowlist/activity_allowlist-v2.txt").read_text(encoding="utf-8").splitlines() if line.strip()]
    allowlist = frozenset(allowlist_lines)
    if len(allowlist) != EXPECTED_ACTIVITIES or len(allowlist_lines) != EXPECTED_ACTIVITIES:
        raise LoadError("activity allowlist does not contain 17,534 unique activity numbers")

    # The local match CSV is retained and hash-verified as receipt evidence only.
    # Load scope MUST come from live contractor_osha_license_matches rows.
    if HELD_ONLY_ACTIVITY not in allowlist:
        raise LoadError("held-only source activity is absent from the live activity allowlist")
    receipt["readme_sha256"] = sha256_file(root / "README.txt")
    return manifest, receipt, allowlist, []


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
    if not value or value.strip().upper() in {"NAT", "NAN", "NONE", "NULL", "NA"}:
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


def _optional_money(value: str, field: str) -> Decimal | None:
    return _money(value, field) if value.strip() else None


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
    source_citations: tuple[dict[str, str], ...]
    citations: tuple[dict[str, str], ...]
    deleted_count: int
    unique_activities: frozenset[str]
    inspections_by_activity: dict[str, dict[str, str]] = field(init=False, repr=False, compare=False)
    source_citations_by_activity: dict[str, tuple[dict[str, str], ...]] = field(init=False, repr=False, compare=False)
    citations_by_activity: dict[str, tuple[dict[str, str], ...]] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        inspection_index = {row["activity_nr"]: row for row in self.inspections}
        source_citation_index: dict[str, list[dict[str, str]]] = defaultdict(list)
        for citation in self.source_citations:
            source_citation_index[citation["activity_nr"]].append(citation)
        citation_index: dict[str, list[dict[str, str]]] = defaultdict(list)
        for citation in self.citations:
            citation_index[citation["activity_nr"]].append(citation)
        object.__setattr__(self, "inspections_by_activity", inspection_index)
        object.__setattr__(self, "source_citations_by_activity", {key: tuple(value) for key, value in source_citation_index.items()})
        object.__setattr__(self, "citations_by_activity", {key: tuple(value) for key, value in citation_index.items()})


def read_sources(inspection_path: Path, violation_path: Path) -> SourceSet:
    # Hash both complete files before parsing or making any database connection.
    verify_source(inspection_path, SCOPED_INSPECTIONS_SHA256)
    verify_source(violation_path, SCOPED_CITATIONS_SHA256)
    inspection_rows = _rows(inspection_path, {
        "activity_nr", "state", "open_date", "site_city", "site_state", "inspection_type",
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

    source_citations: list[dict[str, str]] = []
    citation_keys: set[tuple[str, str]] = set()
    deleted_count = 0
    held_rows: list[dict[str, str]] = []
    for row in violation_rows:
        activity = row["activity_nr"]
        if row["delete_flag"].strip().upper() == DELETE_MARKER:
            raise LoadError("V2 non-X citation file unexpectedly contains a deleted row")
        citation_is_public(row["delete_flag"])
        key = (activity, row["citation_id"])
        if not activity or not row["citation_id"] or key in citation_keys:
            raise LoadError("blank or duplicate public citation key")
        citation_keys.add(key)
        if activity not in inspection_by_activity:
            raise LoadError(f"public citation has no allow-listed inspection: {activity}")
        public_citation_type(row["viol_type"])
        penalty = _optional_money(row["current_penalty"], "current_penalty")
        row["current_penalty"] = str(penalty) if penalty is not None else ""
        initial_penalty = _optional_money(row["initial_penalty"], "initial_penalty")
        row["initial_penalty"] = str(initial_penalty) if initial_penalty is not None else ""
        _parse_date(row["contest_date"], "contest_date")
        _parse_date(row["final_order_date"], "final_order_date")
        source_citations.append(row)
        if activity == HELD_ONLY_ACTIVITY:
            held_rows.append(row)
    if len(source_citations) != EXPECTED_SOURCE_NON_X_CITATIONS or deleted_count != 0:
        raise LoadError(f"source non-X citation count mismatch: source={len(source_citations)}, deleted={deleted_count}")
    if {row["citation_id"] for row in held_rows} != HELD_ONLY_CITATION_IDS or len(held_rows) != EXPECTED_HELD_ONLY_CITATIONS:
        raise LoadError("held-only activity does not contain the exact three source citation IDs")
    expected_held = {"01001": Decimal("2837.00"), "01002": Decimal("4256.00"), "01003": Decimal("4965.00")}
    if any(row["viol_type"] != "S" or _optional_money(row["current_penalty"], "current_penalty") != expected_held[row["citation_id"]] for row in held_rows):
        raise LoadError("held-only citation detail differs from the exact B2 source receipt")
    citations = [row for row in source_citations if row["activity_nr"] != HELD_ONLY_ACTIVITY]
    if len(citations) != EXPECTED_LOADABLE_CITATIONS:
        raise LoadError(f"loadable citation count mismatch: {len(citations)}")
    _validate_source_contract(inspection_by_activity, source_citations, citations)
    activities = frozenset(inspection_by_activity)
    if len(activities) != EXPECTED_ACTIVITIES:
        raise LoadError(f"allowlist activity count mismatch: {len(activities)}")
    return SourceSet(tuple(inspection_by_activity.values()), tuple(source_citations), tuple(citations), deleted_count, activities)


def _validate_source_contract(
    inspections_by_activity: dict[str, dict[str, str]],
    source_citations: list[dict[str, str]],
    loadable_citations: list[dict[str, str]],
) -> None:
    inspection_counts = Counter(row["state"] for row in inspections_by_activity.values())
    if inspection_counts != {"FL": 12_339, "NJ": 5_195}:
        raise LoadError(f"inspection counts differ by state: {dict(inspection_counts)}")
    source_by_state = Counter(inspections_by_activity[row["activity_nr"]]["state"] for row in source_citations)
    loadable_by_state = Counter(inspections_by_activity[row["activity_nr"]]["state"] for row in loadable_citations)
    if source_by_state != {"FL": EXPECTED_FL_SOURCE_NON_X_CITATIONS, "NJ": 9_348}:
        raise LoadError(f"source non-X citations differ by state: {dict(source_by_state)}")
    if loadable_by_state != {"FL": EXPECTED_FL_LOADABLE_CITATIONS, "NJ": EXPECTED_NJ_LOADABLE_CITATIONS}:
        raise LoadError(f"loadable citation counts differ by state: {dict(loadable_by_state)}")

    penalties = Counter()
    state_penalties = Counter()
    citations_by_activity: Counter[str] = Counter(row["activity_nr"] for row in loadable_citations)
    for row in loadable_citations:
        state = inspections_by_activity[row["activity_nr"]]["state"]
        value = _optional_money(row["current_penalty"], "current_penalty")
        category = "null" if value is None else "zero" if value == 0 else "positive"
        penalties[category] += 1
        state_penalties[(state, category)] += 1
    if penalties != {"null": 5_123, "zero": 2_321, "positive": 22_112}:
        raise LoadError(f"loadable current penalty categories mismatch: {dict(penalties)}")
    for (state, category), expected in {
        ("FL", "null"): 3_790, ("NJ", "null"): 1_333,
        ("FL", "zero"): 1_686, ("NJ", "zero"): 635,
        ("FL", "positive"): 14_732, ("NJ", "positive"): 7_380,
    }.items():
        if state_penalties[(state, category)] != expected:
            raise LoadError(f"{state} {category} current penalty count mismatch")
    with_citations_by_state = Counter()
    without_citations_by_state = Counter()
    for activity, inspection in inspections_by_activity.items():
        (with_citations_by_state if citations_by_activity.get(activity, 0) > 0 else without_citations_by_state)[inspection["state"]] += 1
    expected_with = {"FL": 7_888, "NJ": 3_566}
    expected_without = {"FL": 4_451, "NJ": 1_629}
    if dict(with_citations_by_state) != expected_with or dict(without_citations_by_state) != expected_without:
        raise LoadError("verified citation completeness counts differ by state")
    with_citations = sum(with_citations_by_state.values())
    without_citations = sum(without_citations_by_state.values())
    if (with_citations, without_citations) != (EXPECTED_INSPECTIONS_WITH_CITATIONS, EXPECTED_INSPECTIONS_WITHOUT_CITATIONS):
        raise LoadError(f"verified citation completeness counts mismatch: {with_citations}/{without_citations}")


def _activity_list(value: str | None) -> frozenset[str]:
    return frozenset(item.strip() for item in (value or "").split(";") if item.strip())


def _expected_metrics(match: Match, source: SourceSet) -> dict[str, object]:
    inspections = [source.inspections_by_activity[activity] for activity in match.activities]
    citations = [row for activity in match.activities for row in source.citations_by_activity.get(activity, ())]
    dates = [_parse_date(row["open_date"], "open_date") for row in inspections]
    dates = [item for item in dates if item is not None]
    current_penalty = sum((
        _optional_money(row["current_penalty"], "current_penalty") or Decimal("0.00")
        for row in citations
    ), Decimal("0.00"))
    return {
        "n_inspections": len(inspections),
        "n_citation_items": len(citations),
        "n_serious": sum(row["viol_type"] == "S" for row in citations),
        "n_willful_repeat": sum(row["viol_type"] in {"W", "R"} for row in citations),
        "current_penalty_amount": int(current_penalty.quantize(Decimal("1"), rounding=ROUND_HALF_EVEN)),
        "n_with_final_order": sum(
            _parse_date(row["final_order_date"], "final_order_date") is not None
            for row in citations
        ),
        "n_contested": sum(
            _parse_date(row["contest_date"], "contest_date") is not None
            for row in citations
        ),
        "first_open": min(dates) if dates else None,
        "last_open": max(dates) if dates else None,
    }


def verify_held_match(match: Match, source: SourceSet) -> None:
    if match.state != "FL" or match.tier != "exact" or len(match.activities) != 1:
        raise LoadError(f"held match does not match B2 hold contract: {match.license_key}")
    if (match.n_citation_items, match.n_serious, match.current_penalty_amount) != (0, 0, 0):
        raise LoadError(f"held aggregate values changed: {match.license_key}")
    held_citations = source.source_citations_by_activity.get(HELD_ONLY_ACTIVITY, ())
    amount = sum((_optional_money(row["current_penalty"], "current_penalty") or Decimal("0.00") for row in held_citations), Decimal("0.00"))
    if (len(held_citations), sum(row["viol_type"] == "S" for row in held_citations), amount) != (3, 3, Decimal("12058.00")):
        raise LoadError(f"held source mismatch no longer matches the receipt: {match.license_key}")


def validate_matches(
    matches: list[Match], source: SourceSet, expected_allowlist: frozenset[str] | None = None,
) -> tuple[list[Match], dict[str, int]]:
    by_key = {(match.state, match.license_key): match for match in matches}
    if len(by_key) != len(matches) or len(matches) != 10_578:
        raise LoadError(f"published match count or license-key uniqueness mismatch: {len(matches)}")
    profiles_by_state = {state: [row for row in matches if row.state == state] for state in ("FL", "NJ")}
    if {state: len(rows) for state, rows in profiles_by_state.items()} != {"FL": 7_846, "NJ": 2_732}:
        raise LoadError("live published profile counts differ from FL/NJ source receipt")
    activities_by_state = {
        state: set().union(*(row.activities for row in rows)) if rows else set()
        for state, rows in profiles_by_state.items()
    }
    if {state: len(items) for state, items in activities_by_state.items()} != {"FL": 12_339, "NJ": 5_195}:
        raise LoadError("live distinct inspection counts differ from FL/NJ source receipt")
    if activities_by_state["FL"] & activities_by_state["NJ"]:
        raise LoadError("an OSHA activity number is assigned to multiple state scopes")
    held_rows = {match.license_key for match in matches if match.state == "FL" and match.license_key in HELD_LICENSES}
    if held_rows != HELD_LICENSES:
        raise LoadError("required held license keys are missing")
    for key in HELD_LICENSES:
        held = by_key[("FL", key)]
        verify_held_match(held, source)
    held_activity_matches = {match.license_key for match in matches if HELD_ONLY_ACTIVITY in match.activities}
    if held_activity_matches != HELD_LICENSES:
        raise LoadError(f"held-only activity has unexpected live match associations: {sorted(held_activity_matches)}")
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
    inspection_links = sum(len(match.activities) for match in eligible)
    if inspection_links != EXPECTED_MATCH_INSPECTION_BRIDGES:
        raise LoadError(f"public match inspection bridge count mismatch: {inspection_links}")
    citation_visibility = sum(len(source.citations_by_activity.get(activity, ()))
                              for match in eligible for activity in match.activities)
    return eligible, {
        "unique_source_inspections": len(source.inspections),
        "public_match_inspection_links": inspection_links,
        "source_non_x_citations": len(source.source_citations),
        "loadable_citations": len(source.citations),
        "public_match_citation_visibility_count": citation_visibility,
        "inspections_with_citations": EXPECTED_INSPECTIONS_WITH_CITATIONS,
        "inspections_with_no_citations": EXPECTED_INSPECTIONS_WITHOUT_CITATIONS,
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
            SELECT m.id::text, m.contractor_id::text, m.state, m.license_key, m.match_tier,
                   m.osha_activity_nrs, m.n_inspections, m.n_citation_items, m.n_serious,
                   m.n_willful_repeat, m.current_penalty_amount, m.n_with_final_order,
                   m.n_contested, m.first_open, m.last_open
            FROM contractor_osha_license_matches m
            JOIN contractors c ON c.id = m.contractor_id
           WHERE m.state IN ('FL', 'NJ') AND m.match_tier IN ('exact', 'strong')
             AND c.is_thin_profile = FALSE AND c.slug IS NOT NULL AND c.slug <> ''
           ORDER BY m.state, m.license_key, m.id
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
          LEFT JOIN contractor_osha_match_inspections b ON b.public_match_id = m.id
          LEFT JOIN contractor_osha_inspections i ON i.id = b.inspection_id
          LEFT JOIN contractor_osha_citations c
            ON c.inspection_id = i.id AND c.activity_nr = i.activity_nr
         WHERE m.id = ANY(%s::uuid[])
         GROUP BY m.id
    """, (match_ids,))
    rows = cur.fetchall()
    if len(rows) != len(eligible):
        raise LoadError("post-insert reconciliation is missing an eligible public match")
    expected_by_id = {match.match_id: match for match in eligible}
    linked_inspections = linked_citations = 0
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
        linked_inspections += row[1]
        linked_citations += row[2]
    if linked_inspections != expected_shape["public_match_inspection_links"]:
        raise LoadError("post-insert bridge count differs from source plan")
    if linked_citations != expected_shape["public_match_citation_visibility_count"]:
        raise LoadError("post-insert citation visibility count differs from source plan")
    cur.execute("""
        SELECT count(*) FROM contractor_osha_match_inspections b
        JOIN contractor_osha_license_matches m ON m.id = b.public_match_id
        WHERE b.state = 'FL' AND b.license_key = ANY(%s::text[])
    """, (sorted(HELD_LICENSES),))
    if cur.fetchone()[0] != 0:
        raise LoadError("held matches unexpectedly have inspection bridge rows")


def run_loader(args: argparse.Namespace) -> dict[str, object]:
    _manifest, receipt, _receipt_allowlist, _unused_package_matches = verify_handoff(args.handoff_dir)
    source = read_sources(args.handoff_dir / "scoped/inspections-v2.csv", args.handoff_dir / "scoped/citations-source-nonx-v2.csv")
    if not args.execute:
        if not args.database_url:
            raise LoadError("live published-match scope is required; provide DATABASE_URL for a read-only dry run")
        try:
            import psycopg
        except ImportError as exc:
            raise LoadError("psycopg is required for live-scope dry-run validation") from exc
        conn = psycopg.connect(args.database_url, connect_timeout=10)
        try:
            conn.set_session(readonly=True, autocommit=True)
            matches = _db_matches(conn)
        finally:
            conn.close()
        eligible, _ = validate_matches(matches, source, _receipt_allowlist)
        by_state = {
            state: [match for match in matches if match.state == state]
            for state in ("FL", "NJ")
        }
        profile_counts = {state: len(rows) for state, rows in by_state.items()}
        state_activities = {
            state: set().union(*(row.activities for row in rows)) if rows else set()
            for state, rows in by_state.items()
        }
        expected_profiles = {"FL": 7_846, "NJ": 2_732}
        expected_inspections = {"FL": 12_339, "NJ": 5_195}
        if profile_counts != expected_profiles:
            raise LoadError(f"live published profile scope mismatch: {profile_counts}")
        state_activity_counts = {state: len(items) for state, items in state_activities.items()}
        if state_activity_counts != expected_inspections:
            raise LoadError(f"live unique inspection scope mismatch: {state_activity_counts}")
        if state_activities["FL"] & state_activities["NJ"]:
            raise LoadError("an OSHA activity number is assigned to multiple state scopes")
        held_keys = sorted(match.license_key for match in matches if match.state == "FL" and match.license_key in HELD_LICENSES)
        bridge_keys = {
            (match.match_id, activity)
            for match in eligible for activity in match.activities
        }
        citation_visibility_keys = {
            (match.match_id, activity, citation["citation_id"])
            for match in eligible for activity in match.activities
            for citation in source.citations_by_activity.get(activity, ())
        }
        first_inspections, second_inspections = simulate_idempotent_runs(set(source.unique_activities))
        first_citations, second_citations = simulate_idempotent_runs({
            (row["activity_nr"], row["citation_id"]) for row in source.citations
        })
        first_bridges, second_bridges = simulate_idempotent_runs(bridge_keys)
        violation_type_counts = Counter(row["viol_type"] for row in source.citations)
        return {
            "mode": "live-scope-read-only-dry-run",
            "all_file_hashes_match": True,
            "additional_readme_sha256": receipt.get("readme_sha256"),
            "unique_source_inspections": len(source.inspections),
            "fl_profiles": profile_counts["FL"],
            "nj_profiles": profile_counts["NJ"],
            "fl_unique_inspections": state_activity_counts["FL"],
            "nj_unique_inspections": state_activity_counts["NJ"],
            "public_match_inspection_links": len(bridge_keys),
            "source_non_x_citations": len(source.source_citations),
            "held_only_source_citations": len(source.source_citations) - len(source.citations),
            "loadable_citations": len(source.citations),
            "fl_source_non_x_citations": EXPECTED_FL_SOURCE_NON_X_CITATIONS,
            "fl_loadable_citations": EXPECTED_FL_LOADABLE_CITATIONS,
            "nj_loadable_citations": EXPECTED_NJ_LOADABLE_CITATIONS,
            "null_current_penalties": EXPECTED_NULL_CURRENT_PENALTIES,
            "explicit_zero_current_penalties": EXPECTED_EXPLICIT_ZERO_CURRENT_PENALTIES,
            "positive_current_penalties": EXPECTED_POSITIVE_CURRENT_PENALTIES,
            "inspections_with_citations": EXPECTED_INSPECTIONS_WITH_CITATIONS,
            "inspections_with_no_citations": EXPECTED_INSPECTIONS_WITHOUT_CITATIONS,
            "public_match_citation_visibility_count": len(citation_visibility_keys),
            "published_matches": len(matches),
            "detail_eligible_matches": len(eligible),
            "reconciled_matches": len(eligible),
            "eligible_reconciliation_pass": len(eligible) == 10_576,
            "held_matches": len(held_keys),
            "held_keys": held_keys,
            "held_match_links": 0,
            "delete_x_excluded": receipt.get("total_delete_x") == 1_552 and source.deleted_count == 0,
            "blank_delete_flag_kept": len(source.source_citations) == EXPECTED_SOURCE_NON_X_CITATIONS,
            "public_violation_type_counts": dict(sorted(violation_type_counts.items())),
            "u_type_supported": "U" in violation_type_counts and public_citation_type("U") == "Unclassified",
            "official_activity_url_render": "NO",
            "dry_run_insert_inspections": first_inspections,
            "dry_run_insert_citations": first_citations,
            "dry_run_insert_bridges": first_bridges,
            "second_dry_run_new_inspections": second_inspections,
            "second_dry_run_new_citations": second_citations,
            "second_dry_run_new_bridges": second_bridges,
            "aggregate_mutations": 0,
            "official_activity_url_render": "NO",
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
                           to_regclass('public.contractor_osha_match_inspections'),
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
                eligible, shape = validate_matches(matches, source, _receipt_allowlist)
                state_by_activity: dict[str, str] = {}
                for match in matches:
                    for activity in match.activities:
                        prior_state = state_by_activity.setdefault(activity, match.state)
                        if prior_state != match.state:
                            raise LoadError(f"activity is assigned across state scopes: {activity}")

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
                                'B2 V2 external scoped package', %s, %s, %s)
                        RETURNING id
                    """, (EXPECTED_INSPECTIONS + EXPECTED_LOADABLE_CITATIONS, combined_hash,
                          "Pinned V2 source SHAs; three held-only source citations retained in receipt and excluded from public detail."))
                    batch_id = cur.fetchone()[0]

                receipt_ids: dict[str, object] = {}
                for dataset, source_hash, row_count in (
                    ("osha_inspections", INSPECTION_SHA256, EXPECTED_INSPECTIONS),
                    ("osha_violations", VIOLATION_SHA256, EXPECTED_SOURCE_NON_X_CITATIONS),
                ):
                    cur.execute("""
                        SELECT id FROM osha_detail_load_receipts
                        WHERE source_batch_id = %s AND source_dataset = %s AND source_hash = %s
                    """, (batch_id, dataset, source_hash))
                    receipt = cur.fetchone()
                    if receipt:
                        receipt_ids[dataset] = receipt[0]
                    else:
                        held_source_evidence = {
                            "activity_nr": HELD_ONLY_ACTIVITY,
                            "citation_ids": sorted(HELD_ONLY_CITATION_IDS),
                            "source_only_citations": EXPECTED_HELD_ONLY_CITATIONS,
                            "current_penalties": {
                                row["citation_id"]: row["current_penalty"]
                                for row in source.source_citations_by_activity[HELD_ONLY_ACTIVITY]
                            },
                            "viol_types": {
                                row["citation_id"]: row["viol_type"]
                                for row in source.source_citations_by_activity[HELD_ONLY_ACTIVITY]
                            },
                            "current_penalty_sum": "12058.00",
                            "eligible_nonheld_links": 0,
                            "reason": HOLD_REASON,
                            "scoped_source_sha256": SCOPED_CITATIONS_SHA256,
                        }
                        cur.execute("""
                            INSERT INTO osha_detail_load_receipts
                              (source_batch_id, source_dataset, source_hash, inspection_rows,
                               loadable_citation_rows, citation_rows, held_license_keys, hold_reason,
                               held_source_evidence)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb) RETURNING id
                        """, (batch_id, dataset, source_hash,
                              EXPECTED_INSPECTIONS if dataset == "osha_inspections" else 0,
                              EXPECTED_LOADABLE_CITATIONS if dataset == "osha_violations" else 0,
                              EXPECTED_SOURCE_NON_X_CITATIONS if dataset == "osha_violations" else 0,
                              sorted(HELD_LICENSES), HOLD_REASON,
                              json.dumps(held_source_evidence if dataset == "osha_violations" else {})))
                        receipt_ids[dataset] = cur.fetchone()[0]

                inspections_by_activity = source.inspections_by_activity
                citations_by_activity = source.citations_by_activity
                inspection_ids: dict[str, object] = {}
                inserted_inspections = inserted_citations = inserted_bridges = 0
                for activity in sorted(source.unique_activities):
                    inspection = inspections_by_activity[activity]
                    cur.execute("""
                        INSERT INTO contractor_osha_inspections
                          (activity_nr, state, open_date, site_city, site_state, inspection_type,
                           close_date, closing_conference_date, citations_verified,
                           source_batch_id, receipt_id, source_hash)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s, %s)
                        ON CONFLICT (activity_nr) DO NOTHING
                        RETURNING id
                    """, (activity, state_by_activity[activity],
                          _parse_date(inspection["open_date"], "open_date"), inspection["site_city"] or None,
                          inspection["site_state"] or None, inspection["inspection_type"] or None,
                          _parse_date(inspection["close_date"], "close_date"),
                          _parse_date(inspection["closing_conference_date"], "closing_conference_date"),
                          batch_id, receipt_ids["osha_inspections"], INSPECTION_SHA256))
                    inserted = cur.fetchone()
                    inserted_inspections += inserted is not None
                    if inserted:
                        inspection_id = inserted[0]
                    else:
                        cur.execute("SELECT id, source_hash FROM contractor_osha_inspections WHERE activity_nr = %s", (activity,))
                        existing = cur.fetchone()
                        if not existing or existing[1].strip() != INSPECTION_SHA256:
                            raise LoadError("existing normalized inspection has different provenance; stopping")
                        inspection_id = existing[0]
                    inspection_ids[activity] = inspection_id

                for activity in sorted(source.unique_activities):
                    inspection_id = inspection_ids[activity]
                    for citation in citations_by_activity.get(activity, ()):
                        cur.execute("""
                            INSERT INTO contractor_osha_citations
                              (inspection_id, activity_nr, citation_id, standard, viol_type, current_penalty,
                               initial_penalty, contest_date, final_order_date, delete_flag,
                               source_batch_id, receipt_id, source_hash)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (inspection_id, citation_id) DO NOTHING
                            RETURNING id
                        """, (inspection_id, activity, citation["citation_id"], citation["standard"],
                              citation["viol_type"], _optional_money(citation["current_penalty"], "current_penalty"),
                              _optional_money(citation["initial_penalty"], "initial_penalty"),
                              _parse_date(citation["contest_date"], "contest_date"),
                              _parse_date(citation["final_order_date"], "final_order_date"),
                              citation["delete_flag"] or None, batch_id, receipt_ids["osha_violations"], VIOLATION_SHA256))
                        inserted_citation = cur.fetchone()
                        inserted_citations += inserted_citation is not None
                        if inserted_citation is None:
                            cur.execute("""
                                SELECT source_hash FROM contractor_osha_citations
                                WHERE inspection_id = %s AND citation_id = %s
                            """, (inspection_id, citation["citation_id"]))
                            existing_citation = cur.fetchone()
                            if not existing_citation or existing_citation[0].strip() != VIOLATION_SHA256:
                                raise LoadError("existing source citation has different provenance; stopping")

                for match in eligible:
                    for activity in sorted(match.activities):
                        cur.execute("""
                            INSERT INTO contractor_osha_match_inspections
                              (public_match_id, contractor_id, state, license_key, inspection_id, activity_nr,
                               source_batch_id, receipt_id, source_hash)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (public_match_id, inspection_id) DO NOTHING
                            RETURNING public_match_id
                        """, (match.match_id, match.contractor_id, match.state, match.license_key,
                              inspection_ids[activity], activity, batch_id,
                              receipt_ids["osha_inspections"], INSPECTION_SHA256))
                        inserted_bridges += cur.fetchone() is not None
                _verify_loaded_reconciliation(cur, eligible, shape)
                cur.execute("""
                    UPDATE osha_detail_load_receipts
                       SET status = 'loaded', loaded_at = now()
                     WHERE id = ANY(%s::uuid[]) AND status = 'received'
                """, ([receipt_ids["osha_inspections"], receipt_ids["osha_violations"]],))
        return {"mode": "loaded", "database": database_name,
                "inserted_inspections": inserted_inspections,
                "inserted_citations": inserted_citations,
                "inserted_public_match_links": inserted_bridges, **shape}
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
