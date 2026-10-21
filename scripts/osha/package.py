"""Deterministic package bytes and SHA-256 for matcher output."""

from __future__ import annotations

import csv
import hashlib
import io

PACKAGE_FIELDS = (
    "state",
    "source_system",
    "license_key",
    "match_tier",
    "person_name_licensee",
    "norm_name",
    "postal_code",
    "county_name",
    "n_inspections",
    "osha_activity_nrs",
    "first_open",
    "last_open",
    "n_citation_items",
    "n_serious",
    "n_willful_repeat",
    "current_penalty_amount",
    "initial_penalty_amount",
    "n_with_final_order",
    "n_contested",
)

SPOT_FIELDS = (
    "state",
    "source_system",
    "license_key",
    "display_name",
    "norm_name",
    "postal_code",
    "county_name",
    "match_tier",
    "person_name_licensee",
    "n_inspections",
    "n_citation_items",
    "n_serious",
)


def package_bytes(matches: list[dict]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=PACKAGE_FIELDS, lineterminator="\n", extrasaction="ignore")
    writer.writeheader()
    ordered = sorted(matches, key=lambda row: (row["state"], row["license_key"], row["match_tier"]))
    for row in ordered:
        writer.writerow({field: row.get(field, "") for field in PACKAGE_FIELDS})
    return buffer.getvalue().encode("utf-8")


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def spot_rows(matches: list[dict], tier: str, limit: int = 25) -> list[dict]:
    chosen = [row for row in matches if row["match_tier"] == tier]
    chosen.sort(key=lambda row: (row["license_key"], row["osha_activity_nrs"]))
    return chosen[:limit]


def spot_bytes(rows: list[dict]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=SPOT_FIELDS, lineterminator="\n", extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({field: row.get(field, "") for field in SPOT_FIELDS})
    return buffer.getvalue().encode("utf-8")
