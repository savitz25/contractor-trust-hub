"""Publish only B2 package rows that already belong to one verified profile.

Matching stays in scripts/osha (PR #167). Rows are classified from the package
columns plus an existing license identity map. Nothing here creates a contractor.
A license that shares any exact or strong activity with another contractor is
held in full, so package citation totals are not republished after a partial cut.
"""

from __future__ import annotations

import csv
import hashlib
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from scripts.con_osha_001b.load_detail import LoadError as DetailLoadError
from scripts.con_osha_001b.load_detail import _parse_date
from scripts.con_osha_002.contract import (
    B2_PACKAGE_FIELDS,
    B2_SOURCE_SYSTEMS,
    CA_NAME_SOURCE,
    EXCLUDED_STATES,
    EXPANSION_STATES,
    PUBLIC_TIERS,
    VERIFIED_B2_PACKAGE_SHA256,
)

MATCH_SOURCE = "us_dol_osha"


class LoadError(Exception):
    pass


@dataclass(frozen=True)
class Hold:
    state: str
    license_key: str
    contractor_id: str | None
    activity_nr: str | None
    citation_id: str | None
    reason: str


@dataclass(frozen=True)
class PublicMatch:
    state: str
    source_system: str
    license_key: str
    contractor_id: str
    match_tier: str
    activities: tuple[str, ...]
    n_inspections: int
    first_open: str | None
    last_open: str | None
    n_citation_items: int
    n_serious: int
    n_willful_repeat: int
    current_penalty_amount: int
    initial_penalty_amount: int
    n_with_final_order: int
    n_contested: int


@dataclass
class Eligibility:
    state: str
    source_system: str | None
    public_matches: list[PublicMatch] = field(default_factory=list)
    holds: list[Hold] = field(default_factory=list)
    ambiguous_activities: set[str] = field(default_factory=set)
    package_sha256: str = ""

    @property
    def public_profile_count(self) -> int:
        return len(self.public_matches)

    @property
    def published_activities(self) -> set[str]:
        found: set[str] = set()
        for row in self.public_matches:
            found.update(row.activities)
        return found


def _activities(value: str) -> list[str]:
    return [part for part in (value or "").split(";") if part]


def _whole(value: str, field_name: str) -> int:
    text = (value or "").strip()
    if not text or not text.lstrip("-").isdigit():
        raise LoadError(f"invalid {field_name}")
    number = int(text)
    if number < 0:
        raise LoadError(f"invalid {field_name}")
    return number


def _optional_date(value: str) -> str | None:
    """Blank and NaT stay NULL. Other values must be ISO dates."""
    try:
        parsed = _parse_date(value, "package_date")
    except DetailLoadError as exc:
        raise LoadError(str(exc)) from exc
    return parsed.isoformat() if parsed else None


def read_package(path: Path, *, expect_known_hash: bool = False) -> tuple[str, list[dict[str, str]]]:
    payload = path.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    text = payload.decode("utf-8-sig")
    reader = csv.DictReader(text.splitlines())
    header = tuple(reader.fieldnames or ())
    if header != B2_PACKAGE_FIELDS:
        raise LoadError("package header is not the B2 PACKAGE_FIELDS contract")
    rows = []
    for raw in reader:
        rows.append({field: (raw.get(field) or "").strip() for field in B2_PACKAGE_FIELDS})
    if expect_known_hash:
        state = rows[0]["state"] if rows else ""
        expected = VERIFIED_B2_PACKAGE_SHA256.get(state)
        if expected != digest:
            raise LoadError(f"package sha256 does not match the verified B2 pin for {state}")
    return digest, rows


def load_identities(path: Path) -> dict[tuple[str, str], str]:
    """Existing license identities. A key with two contractor ids is not verified."""
    grouped: dict[tuple[str, str], set[str]] = defaultdict(set)
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"source_system", "external_key", "contractor_id"}
        if reader.fieldnames is None or not required <= set(reader.fieldnames):
            raise LoadError("identity file is missing source_system, external_key, or contractor_id")
        for row in reader:
            source = (row.get("source_system") or "").strip()
            key = (row.get("external_key") or "").strip()
            contractor = (row.get("contractor_id") or "").strip()
            if source and key and contractor:
                grouped[(source, key)].add(contractor)
    return {key: next(iter(contractors)) for key, contractors in grouped.items() if len(contractors) == 1}


def classify_rows(
    rows: list[dict[str, str]],
    identities: dict[tuple[str, str], str],
    *,
    receipt: dict | None = None,
    package_sha256: str = "",
) -> Eligibility:
    if not rows:
        raise LoadError("package has no rows")
    states = {row["state"] for row in rows}
    if len(states) != 1:
        raise LoadError("a package must contain one state")
    state = next(iter(states))
    if state in EXCLUDED_STATES or state not in EXPANSION_STATES:
        raise LoadError(f"{state} is excluded from CON-OSHA-002")
    source_systems = {row["source_system"] for row in rows}
    if len(source_systems) != 1:
        raise LoadError("a package must contain one source_system")
    source_system = next(iter(source_systems))
    result = Eligibility(state=state, source_system=source_system, package_sha256=package_sha256)
    if state not in B2_SOURCE_SYSTEMS or B2_SOURCE_SYSTEMS[state] != source_system:
        for row in rows:
            result.holds.append(Hold(state, row["license_key"] or "unknown", None, None, None, "matcher_unauthorized"))
        result.source_system = None
        return result
    if state == "CA":
        name_source = (receipt or {}).get("ca_name_source")
        if name_source != CA_NAME_SOURCE:
            raise LoadError("CA package requires ca_name_source licensee_name_raw")

    pending: list[tuple[dict[str, str], str, list[str]]] = []
    for row in rows:
        license_key = row["license_key"]
        tier = row["match_tier"]
        person = row["person_name_licensee"]
        activities = _activities(row["osha_activity_nrs"])
        contractor_id = identities.get((source_system, license_key))
        reasons: list[str] = []
        if tier == "weak":
            reasons.append("weak")
        elif tier not in PUBLIC_TIERS:
            reasons.append("unsupported_tier")
        if person == "yes" or (tier in PUBLIC_TIERS and person != "no"):
            reasons.append("person_name")
        if contractor_id is None:
            reasons.append("no_verified_license")
        if tier in PUBLIC_TIERS and not row["postal_code"] and not row["county_name"]:
            reasons.append("name_only")
        if not activities:
            reasons.append("no_activities")
        if reasons:
            for reason in reasons:
                result.holds.append(Hold(state, license_key, contractor_id, None, None, reason))
            continue
        pending.append((row, contractor_id or "", activities))

    owners: dict[str, set[str]] = defaultdict(set)
    for _row, contractor_id, activities in pending:
        for activity in activities:
            owners[activity].add(contractor_id)
    ambiguous = {activity for activity, contractors in owners.items() if len(contractors) > 1}
    result.ambiguous_activities = ambiguous
    for row, contractor_id, activities in pending:
        held = [activity for activity in activities if activity in ambiguous]
        if held:
            for activity in held:
                result.holds.append(Hold(state, row["license_key"], contractor_id, activity, None, "ambiguous_activity"))
            continue
        result.public_matches.append(
            PublicMatch(
                state=state,
                source_system=MATCH_SOURCE,
                license_key=row["license_key"],
                contractor_id=contractor_id,
                match_tier=row["match_tier"],
                activities=tuple(activities),
                n_inspections=_whole(row["n_inspections"], "n_inspections"),
                first_open=_optional_date(row["first_open"]),
                last_open=_optional_date(row["last_open"]),
                n_citation_items=_whole(row["n_citation_items"], "n_citation_items"),
                n_serious=_whole(row["n_serious"], "n_serious"),
                n_willful_repeat=_whole(row["n_willful_repeat"], "n_willful_repeat"),
                current_penalty_amount=_whole(row["current_penalty_amount"], "current_penalty_amount"),
                initial_penalty_amount=_whole(row["initial_penalty_amount"], "initial_penalty_amount"),
                n_with_final_order=_whole(row["n_with_final_order"], "n_with_final_order"),
                n_contested=_whole(row["n_contested"], "n_contested"),
            )
        )
    return result
