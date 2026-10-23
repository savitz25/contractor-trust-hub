"""Publish B2 package rows that the certified matcher already marked eligible.

Matching stays in scripts/osha (PR #167, commit 67127bac). This module checks
the package contract and keeps only published_activity_nrs on a public row.
An ambiguous activity is removed. The license stays public when another
published activity remains. A license with no published activity is held.
The original matched list is retained only as private provenance.
"""

from __future__ import annotations

import csv
import hashlib
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from uuid import UUID

from scripts.con_osha_001b.load_detail import LoadError as DetailLoadError
from scripts.con_osha_001b.load_detail import _parse_date
from scripts.con_osha_002.contract import (
    B2_PACKAGE_FIELDS,
    B2_SOURCE_SYSTEMS,
    CA_NAME_SOURCE,
    EXCLUDED_STATES,
    EXPANSION_STATES,
    PUBLIC_TIERS,
    PUBLICATION_STATUSES,
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
    matched_activities: tuple[str, ...]
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

    @property
    def public_activity_nrs(self) -> str:
        return ";".join(self.activities)

    @property
    def provenance_activity_nrs(self) -> str:
        return ";".join(self.matched_activities)


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
    def distinct_contractor_ids(self) -> set[str]:
        return {row.contractor_id for row in self.public_matches}

    @property
    def published_activities(self) -> set[str]:
        found: set[str] = set()
        for row in self.public_matches:
            found.update(row.activities)
        return found

    @property
    def citation_count(self) -> int:
        return sum(row.n_citation_items for row in self.public_matches)


def _split(value: str) -> list[str]:
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
    try:
        parsed = _parse_date(value, "package_date")
    except DetailLoadError as exc:
        raise LoadError(str(exc)) from exc
    return parsed.isoformat() if parsed else None


def _uuid(value: str) -> str:
    try:
        return str(UUID(value))
    except ValueError as exc:
        raise LoadError("contractor_id is not a UUID") from exc


def _optional_uuid(value: str) -> str | None:
    text = (value or "").strip()
    if not text:
        return None
    return _uuid(text)


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
        rows.append({name: (raw.get(name) or "").strip() for name in B2_PACKAGE_FIELDS})
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


def verify_identities(eligibility: Eligibility, identities: dict[tuple[str, str], str]) -> None:
    """Stop when a public package identity disagrees with the license map."""
    if eligibility.source_system is None:
        raise LoadError("eligibility has no source system")
    for match in eligibility.public_matches:
        found = identities.get((eligibility.source_system, match.license_key))
        if found is None:
            raise LoadError("public license has no verified identity")
        if found != match.contractor_id:
            raise LoadError("public license contractor_id does not match the identity map")


def _held_metrics_are_clear(row: dict[str, str]) -> None:
    names = (
        "n_inspections",
        "n_citation_items",
        "n_serious",
        "n_willful_repeat",
        "current_penalty_amount",
        "initial_penalty_amount",
        "n_with_final_order",
        "n_contested",
    )
    for name in names:
        if _whole(row[name] or "0", name) != 0:
            raise LoadError(f"held row kept a public {name}")
    if _split(row["published_activity_nrs"]):
        raise LoadError("held row kept published activities")


def classify_rows(
    rows: list[dict[str, str]],
    identities: dict[tuple[str, str], str] | None = None,
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
    if B2_SOURCE_SYSTEMS.get(state) != source_system:
        raise LoadError(f"{state} source system is not the certified matcher contract")
    if state == "CA":
        name_source = (receipt or {}).get("ca_name_source")
        if name_source != CA_NAME_SOURCE:
            raise LoadError("CA package requires ca_name_source licensee_name_raw")
    result = Eligibility(state=state, source_system=source_system, package_sha256=package_sha256)
    owners: dict[str, set[str]] = defaultdict(set)
    prepared: list[tuple[dict[str, str], list[str], list[str], list[str]]] = []
    for row in rows:
        status = row["publication_status"]
        if status not in PUBLICATION_STATUSES:
            raise LoadError("package publication_status is not in the B2 contract")
        eligible_flag = row["profile_eligible"]
        if eligible_flag not in {"yes", "no"}:
            raise LoadError("package profile_eligible must be yes or no")
        published = _split(row["published_activity_nrs"])
        ambiguous = _split(row["ambiguous_activity_nrs"])
        matched = _split(row["osha_activity_nrs"])
        if eligible_flag == "yes":
            if status != "eligible":
                raise LoadError("profile_eligible yes requires publication_status eligible")
            _accept_eligible_shape(row, published, ambiguous, matched)
            contractor_id = _uuid(row["contractor_id"])
            if identities is not None:
                found = identities.get((source_system, row["license_key"]))
                if found is None:
                    result.holds.append(Hold(state, row["license_key"], None, None, None, "no_verified_license"))
                    continue
                if found != contractor_id:
                    raise LoadError("public license contractor_id does not match the identity map")
            for activity in published:
                owners[activity].add(contractor_id)
            prepared.append((row, published, ambiguous, matched))
            continue
        if status == "eligible":
            raise LoadError("publication_status eligible requires profile_eligible yes")
        _held_metrics_are_clear(row)
        _hold_private_row(result, row, ambiguous, matched)
    for activity, contractors in owners.items():
        if len(contractors) > 1:
            raise LoadError("published activity is shared by more than one contractor")
    for row, published, ambiguous, matched in prepared:
        result.ambiguous_activities.update(ambiguous)
        for activity in ambiguous:
            result.holds.append(Hold(
                state, row["license_key"], _uuid(row["contractor_id"]), activity, None, "ambiguous_activity",
            ))
        result.public_matches.append(_public_match(state, row, published, matched))
    return result


def _accept_eligible_shape(
    row: dict[str, str],
    published: list[str],
    ambiguous: list[str],
    matched: list[str],
) -> None:
    if row["match_tier"] not in PUBLIC_TIERS:
        raise LoadError("eligible row is not exact or strong")
    if row["person_name_licensee"] != "no":
        raise LoadError("eligible row is not a business-name match")
    if not published:
        raise LoadError("eligible row has no published activity")
    if _whole(row["n_inspections"], "n_inspections") != len(published):
        raise LoadError("n_inspections does not equal published activities")
    if not set(published).isdisjoint(ambiguous):
        raise LoadError("published activity is also marked ambiguous")
    if not set(published).issubset(matched) or not set(ambiguous).issubset(matched):
        raise LoadError("published or ambiguous activities are outside the matched list")
    if not row["postal_code"] and not row["county_name"]:
        raise LoadError("eligible row has no postal code or county")


def _hold_private_row(
    result: Eligibility,
    row: dict[str, str],
    ambiguous: list[str],
    matched: list[str],
) -> None:
    state = result.state
    license_key = row["license_key"] or "unknown"
    contractor_id = _optional_uuid(row["contractor_id"])
    status = row["publication_status"]
    if status == "weak_held":
        result.holds.append(Hold(state, license_key, contractor_id, None, None, "weak"))
    elif status == "ambiguous_held":
        activities = ambiguous or matched
        if not activities:
            result.holds.append(Hold(state, license_key, contractor_id, None, None, "ambiguous_activity"))
        for activity in activities:
            result.ambiguous_activities.add(activity)
            result.holds.append(Hold(state, license_key, contractor_id, activity, None, "ambiguous_activity"))
    elif status == "no_profile":
        result.holds.append(Hold(state, license_key, None, None, None, "no_verified_license"))
    elif status == "unproven_held":
        result.holds.append(Hold(state, license_key, contractor_id, None, None, "missing_inspection"))
    if row["person_name_licensee"] == "yes":
        result.holds.append(Hold(state, license_key, contractor_id, None, None, "person_name"))
    if not row["postal_code"] and not row["county_name"] and status != "weak_held":
        result.holds.append(Hold(state, license_key, contractor_id, None, None, "name_only"))


def _public_match(
    state: str,
    row: dict[str, str],
    published: list[str],
    matched: list[str],
) -> PublicMatch:
    return PublicMatch(
        state=state,
        source_system=MATCH_SOURCE,
        license_key=row["license_key"],
        contractor_id=_uuid(row["contractor_id"]),
        match_tier=row["match_tier"],
        activities=tuple(published),
        matched_activities=tuple(matched),
        n_inspections=len(published),
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
