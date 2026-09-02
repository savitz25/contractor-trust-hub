"""Identity matching for NJ public-works / exclusion observations.

Never auto-attach name-only. PWCR certificate ≠ DCA license number.
Treasury vendor ID is exact only against a stored vendor identifier, not an HIC number.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from ingest.normalize import normalize_address_line, normalize_city, normalize_entity_name, zip5


@dataclass
class LicenseCandidate:
    contractor_id: str | None
    external_key: str
    occupation_code: str
    license_number: str
    name: str
    address: str
    city: str
    postal: str
    state: str
    identifier_namespaces: dict[str, str] = field(default_factory=dict)


@dataclass
class LicenseIndex:
    by_pwcr: dict[str, list[LicenseCandidate]]
    by_vendor_id: dict[str, list[LicenseCandidate]]
    by_name_addr: dict[tuple[str, str], list[LicenseCandidate]]
    by_name_zip: dict[tuple[str, str], list[LicenseCandidate]]
    by_name_city: dict[tuple[str, str], list[LicenseCandidate]]
    by_name: dict[str, list[LicenseCandidate]]
    size: int


def _add(bucket: dict, key, cand: LicenseCandidate) -> None:
    if not key or (isinstance(key, tuple) and not all(key)):
        return
    bucket[key].append(cand)


def build_license_index(rows: Iterable[LicenseCandidate]) -> LicenseIndex:
    idx = LicenseIndex(
        by_pwcr=defaultdict(list),
        by_vendor_id=defaultdict(list),
        by_name_addr=defaultdict(list),
        by_name_zip=defaultdict(list),
        by_name_city=defaultdict(list),
        by_name=defaultdict(list),
        size=0,
    )
    n = 0
    for cand in rows:
        n += 1
        pwcr = cand.identifier_namespaces.get("pwcr") or cand.identifier_namespaces.get("NJ_PWCR_REGISTRATION")
        vendor = cand.identifier_namespaces.get("vendor_id") or cand.identifier_namespaces.get("NJ_TREASURY_VENDOR_ID")
        _add(idx.by_pwcr, pwcr, cand)
        _add(idx.by_vendor_id, vendor, cand)
        name = normalize_entity_name(cand.name)
        addr = normalize_address_line(cand.address)
        postal = zip5(cand.postal)
        city = normalize_city(cand.city)
        _add(idx.by_name_addr, (name, addr), cand)
        _add(idx.by_name_zip, (name, postal), cand)
        _add(idx.by_name_city, (name, city), cand)
        _add(idx.by_name, name, cand)
    idx.size = n
    return idx


def load_license_csv(path: Path) -> list[LicenseCandidate]:
    rows: list[LicenseCandidate] = []
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for rec in reader:
            name = rec.get("licensee_name_raw") or rec.get("business_name") or rec.get("legal_name") or rec.get("display_name") or ""
            addr = rec.get("address_line_1") or rec.get("address_line1") or ""
            rows.append(
                LicenseCandidate(
                    contractor_id=rec.get("contractor_id") or rec.get("slug") or None,
                    external_key=rec.get("external_key") or rec.get("registration_number") or "",
                    occupation_code=rec.get("occupation_code") or rec.get("credential_type") or "",
                    license_number=rec.get("license_number") or rec.get("registration_number") or "",
                    name=name,
                    address=addr,
                    city=rec.get("city") or rec.get("primary_city") or "",
                    postal=rec.get("postal_code") or rec.get("zip") or "",
                    state=(rec.get("state") or rec.get("home_state") or "NJ")[:2],
                    identifier_namespaces={},
                )
            )
    return rows


def _unique(cands: list[LicenseCandidate]) -> list[LicenseCandidate]:
    seen: dict[str, LicenseCandidate] = {}
    for c in cands:
        seen[c.external_key or f"{c.name}|{c.address}|{c.postal}"] = c
    return list(seen.values())


def match_observation(obs: dict[str, Any], index: LicenseIndex) -> dict[str, Any]:
    family = obs["source_family"]
    cert = (obs.get("certificate_or_vendor_id") or "").strip()
    name = normalize_entity_name(obs.get("official_business_name"))
    person = normalize_entity_name(obs.get("individual_name"))
    addr = normalize_address_line(obs.get("address_line_1"))
    postal = zip5(obs.get("postal_code"))
    city = normalize_city(obs.get("city"))

    if family == "NJ_PWCR_REGISTRATION" and cert:
        hits = _unique(index.by_pwcr.get(cert, []))
        if len(hits) == 1:
            return _hit("exact", "exact", hits[0], "PWCR certificate already stored on an existing entity")
        if len(hits) > 1:
            return _conflict(hits, "PWCR certificate matches multiple existing entities")

    if family in {"NJ_TREASURY_CONSTRUCTION_DEBARMENT", "NJ_TREASURY_VENDOR_DEBARMENT"} and cert:
        hits = _unique(index.by_vendor_id.get(cert, []))
        if len(hits) == 1:
            return _hit("exact", "exact", hits[0], "Treasury vendor ID already stored on an existing entity")
        if len(hits) > 1:
            return _conflict(hits, "Treasury vendor ID matches multiple existing entities")

    if name and addr:
        hits = _unique(index.by_name_addr.get((name, addr), []))
        if len(hits) == 1:
            return _hit("high_confidence", "high_confidence", hits[0], "exact normalized legal name plus exact normalized official address")
        if len(hits) > 1:
            return _conflict(hits, "multiple existing entities at the same name and address")

    if name and postal:
        hits = _unique(index.by_name_zip.get((name, postal), []))
        if len(hits) == 1:
            return _hit("high_confidence", "high_confidence", hits[0], "exact legal name plus exact ZIP with a unique existing organization")
        if len(hits) > 1:
            return _review(hits, "name plus ZIP matched multiple existing organizations")

    if name and city:
        hits = _unique(index.by_name_city.get((name, city), []))
        if hits:
            return _review(hits, "name plus city only")

    if person and not name:
        person_hits = _unique(index.by_name.get(person, []))
        if person_hits:
            return _review(person_hits, "individual name to business")
        return {
            "match_method": "unresolved",
            "match_confidence": "unresolved",
            "contractor_id": None,
            "license_external_key": None,
            "reason": "individual name with no existing organization candidate",
            "candidates": [],
        }

    if name:
        return {
            "match_method": "unresolved",
            "match_confidence": "unresolved",
            "contractor_id": None,
            "license_external_key": None,
            "reason": "name-only is unsafe and is never auto-attached",
            "candidates": [],
        }

    return {
        "match_method": "unresolved",
        "match_confidence": "unresolved",
        "contractor_id": None,
        "license_external_key": None,
        "reason": "no matchable official name, address, or source-specific identifier",
        "candidates": [],
    }


def _hit(method: str, confidence: str, cand: LicenseCandidate, reason: str) -> dict[str, Any]:
    return {
        "match_method": method,
        "match_confidence": confidence,
        "contractor_id": cand.contractor_id,
        "license_external_key": cand.external_key,
        "reason": reason,
        "candidates": [_cand(cand)],
    }


def _review(hits: list[LicenseCandidate], reason: str) -> dict[str, Any]:
    return {
        "match_method": "review_required",
        "match_confidence": "review_required",
        "contractor_id": None,
        "license_external_key": None,
        "reason": reason,
        "candidates": [_cand(c) for c in hits[:20]],
    }


def _conflict(hits: list[LicenseCandidate], reason: str) -> dict[str, Any]:
    return {
        "match_method": "conflict",
        "match_confidence": "conflict",
        "contractor_id": None,
        "license_external_key": None,
        "reason": reason,
        "candidates": [_cand(c) for c in hits[:20]],
    }


def _cand(c: LicenseCandidate) -> dict[str, str | None]:
    return {
        "contractor_id": c.contractor_id,
        "external_key": c.external_key,
        "occupation_code": c.occupation_code,
        "name": c.name,
    }


def apply_matches(observations: list[dict[str, Any]], index: LicenseIndex) -> dict[str, list[dict[str, Any]]]:
    ledgers = {
        "exact": [],
        "high_confidence": [],
        "review_required": [],
        "conflict": [],
        "unresolved": [],
    }
    for obs in observations:
        result = match_observation(obs, index)
        obs["match_method"] = result["match_method"]
        obs["match_confidence"] = result["match_confidence"]
        obs["contractor_id"] = result["contractor_id"] if result["match_method"] in {"exact", "high_confidence"} else None
        row = {
            "source_family": obs["source_family"],
            "source_observation_key": obs["source_observation_key"],
            "official_business_name": obs.get("official_business_name"),
            "individual_name": obs.get("individual_name"),
            "certificate_or_vendor_id": obs.get("certificate_or_vendor_id"),
            **result,
        }
        ledgers[result["match_method"]].append(row)
    return ledgers
