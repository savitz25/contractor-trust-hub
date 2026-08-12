"""
Texas TDLR specialty license adapter (Phase 0).

Source: Texas Open Data Portal — TDLR All Licenses (Socrata 7358-krk7).
Prefer filtered bulk/SODA export of construction specialty types.

Texas has NO statewide general contractor license. This adapter only normalizes
TDLR specialty trades (electrical, A/C, appliance, water well, elevator, etc.).

Usage:
  python -m ingest.adapters.tx_tdlr --input data/raw/tx_tdlr/tdlr_licenses_specialty.csv
  python -m ingest.adapters.tx_tdlr --input data/samples/tx_tdlr_specialty_sample.csv --limit 100
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SOURCE_SYSTEM = "tx_tdlr"
SOURCE_BOARD = "TDLR"
SOURCE_URL = "https://data.texas.gov/dataset/TDLR-All-Licenses/7358-krk7"
SODA_URL = "https://data.texas.gov/resource/7358-krk7.json"

# Business-level specialty contractor types for Verify v1 (default ingest)
DEFAULT_LICENSE_TYPES = frozenset(
    {
        "Electrical Contractor",
        "A/C Contractor",
        "Electrical Sign Contractor",
        "Appliance Installation Contractor",
        "Elevator Contractor",
        "Water Well Driller/Pump Installer",
    }
)

# Map free-text license_type → short occupation code for product columns
OCCUPATION_CODE_MAP: dict[str, str] = {
    "ELECTRICAL CONTRACTOR": "TEC",
    "A/C CONTRACTOR": "TAC",
    "AIR CONDITIONING CONTRACTOR": "TAC",
    "ELECTRICAL SIGN CONTRACTOR": "TES",
    "APPLIANCE INSTALLATION CONTRACTOR": "TAP",
    "ELEVATOR CONTRACTOR": "TEL",
    "WATER WELL DRILLER/PUMP INSTALLER": "TWW",
    "MASTER ELECTRICIAN": "TME",
    "JOURNEYMAN ELECTRICIAN": "TJE",
    "APPRENTICE ELECTRICIAN": "TAE",
    "APPLIANCE INSTALLER": "TAI",
}

LICENSE_OUT_FIELDS = [
    "source_system",
    "source_board",
    "external_key",
    "occupation_code",
    "occupation_description",
    "license_number",
    "class_code",
    "licensee_name_raw",
    "dba_name_raw",
    "primary_status",
    "secondary_status",
    "status_normalized",
    "original_licensure_date",
    "effective_date",
    "expiration_date",
    "address_line_1",
    "address_line_2",
    "address_line_3",
    "city",
    "state",
    "postal_code",
    "county_code",
    "county_name",
    "board_number",
    "raw_payload_json",
]

CONTRACTOR_SEED_FIELDS = [
    "slug",
    "display_name",
    "legal_name",
    "dba_name",
    "home_state",
    "primary_city",
    "primary_county",
    "license_external_key",
]


def _clean(value: str | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _parse_expiration(value: str | None) -> str:
    """TDLR field is often MM/DD/YYYY (name says MMDDCCYY)."""
    v = _clean(value)
    if not v:
        return ""
    for fmt in ("%m/%d/%Y", "%m%d%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def parse_city_state_zip(blob: str | None) -> tuple[str, str, str]:
    """
    Parse 'CITY, ST ZIP' or 'CITY ST ZIP' style strings.
    Returns (city, state, zip5).
    """
    s = _clean(blob)
    if not s:
        return "", "TX", ""
    # Prefer ", TX 78701" pattern
    m = re.search(r",\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$", s, re.I)
    if m:
        state = m.group(1).upper()
        z = m.group(2)
        city = s[: m.start()].strip().rstrip(",").strip()
        return city, state, z
    m2 = re.search(r"\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$", s, re.I)
    if m2:
        state = m2.group(1).upper()
        z = m2.group(2)
        city = s[: m2.start()].strip().rstrip(",").strip()
        return city, state, z
    return s, "TX", ""


def slugify(*parts: str) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return s[:120] if s else ""


def occupation_code_for(license_type: str, subtype: str) -> str:
    key = _clean(license_type).upper()
    if key in OCCUPATION_CODE_MAP:
        return OCCUPATION_CODE_MAP[key]
    sub = _clean(subtype).upper()
    if sub:
        return f"TX-{sub}"[:16]
    # Deterministic short code from type
    letters = re.sub(r"[^A-Z]", "", key)[:6] or "TX"
    return f"TX-{letters}"[:16]


def compose_external_key(license_type: str, license_number: str, subtype: str) -> str | None:
    num = _clean(license_number).upper().replace(" ", "")
    if not num:
        return None
    type_slug = re.sub(r"[^A-Z0-9]+", "-", _clean(license_type).upper()).strip("-")
    if not type_slug:
        type_slug = "LICENSE"
    sub = _clean(subtype).upper().replace(" ", "")
    if sub:
        return f"TX-TDLR:{type_slug}:{num}:{sub}"
    return f"TX-TDLR:{type_slug}:{num}"


def normalize_status(expiration_iso: str) -> str:
    """Derive product status from expiration when TDLR does not publish active flags."""
    if not expiration_iso:
        return "unknown"
    try:
        exp = datetime.strptime(expiration_iso, "%Y-%m-%d").date()
    except ValueError:
        return "unknown"
    today = datetime.now(timezone.utc).date()
    if exp >= today:
        return "active"
    return "inactive"


def transform_row(raw: dict[str, str]) -> dict[str, Any] | None:
    license_type = _clean(raw.get("license_type"))
    license_number = _clean(raw.get("license_number"))
    subtype = _clean(raw.get("license_subtype"))

    external_key = compose_external_key(license_type, license_number, subtype)
    if not external_key:
        return None

    business = _clean(raw.get("business_name"))
    owner = _clean(raw.get("owner_name"))
    licensee_name = business or owner
    if not licensee_name:
        return None

    # Prefer business address; fall back to mailing
    addr1 = _clean(raw.get("business_address_line1")) or _clean(raw.get("mailing_address_line1"))
    addr2 = _clean(raw.get("business_address_line2")) or _clean(raw.get("mailing_address_line2"))
    csz = _clean(raw.get("business_city_state_zip")) or _clean(
        raw.get("mailing_address_city_state_zip")
    )
    city, state, postal = parse_city_state_zip(csz)
    if not state:
        state = "TX"
    county = _clean(raw.get("business_county")) or _clean(raw.get("mailing_address_county"))

    expiration = _parse_expiration(raw.get("license_expiration_date_mmddccyy"))
    status = normalize_status(expiration)
    occ = occupation_code_for(license_type, subtype)
    display = business or owner
    slug = slugify(external_key, display)

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": occ,
        "occupation_description": license_type,
        "license_number": license_number,
        "class_code": subtype,
        "licensee_name_raw": licensee_name,
        "dba_name_raw": business if business and business != owner else "",
        "display_name": display,
        "slug": slug,
        "primary_status": status,
        "secondary_status": "",
        "status_normalized": status,
        "original_licensure_date": "",
        "effective_date": "",
        "expiration_date": expiration,
        "address_line_1": addr1,
        "address_line_2": addr2,
        "address_line_3": "",
        "city": city,
        "state": state[:2] if state else "TX",
        "postal_code": postal,
        "county_code": "",
        "county_name": county.title() if county else "",
        "board_number": SOURCE_BOARD,
        "legal_name": owner or business,
        "dba_name": business if business and owner and business != owner else "",
        "home_state": "TX",
        "primary_city": city,
        "primary_county": county.title() if county else "",
        "license_external_key": external_key,
        "raw_payload_json": json.dumps(raw, ensure_ascii=False),
    }


def iter_rows(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return
        for row in reader:
            if not row:
                continue
            yield {k: _clean(v) for k, v in row.items() if k is not None}


def run(
    input_path: Path,
    out_dir: Path,
    *,
    limit: int | None = None,
    only_default_types: bool = True,
) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    licenses_path = out_dir / "licenses_normalized.csv"
    contractors_path = out_dir / "contractors_seed.csv"
    manifest_path = out_dir / "batch_manifest.json"

    seen: set[str] = set()
    kept = 0
    skipped_no_key = 0
    skipped_type = 0
    skipped_dup = 0
    total_in = 0

    with licenses_path.open("w", encoding="utf-8", newline="") as lf, contractors_path.open(
        "w", encoding="utf-8", newline=""
    ) as cf:
        lw = csv.DictWriter(lf, fieldnames=LICENSE_OUT_FIELDS, extrasaction="ignore")
        cw = csv.DictWriter(cf, fieldnames=CONTRACTOR_SEED_FIELDS, extrasaction="ignore")
        lw.writeheader()
        cw.writeheader()

        for raw in iter_rows(input_path):
            total_in += 1
            if limit is not None and kept >= limit:
                break

            lt = _clean(raw.get("license_type"))
            if only_default_types and lt not in DEFAULT_LICENSE_TYPES:
                skipped_type += 1
                continue

            row = transform_row(raw)
            if not row:
                skipped_no_key += 1
                continue
            key = row["external_key"]
            if key in seen:
                skipped_dup += 1
                continue
            seen.add(key)

            lw.writerow(row)
            cw.writerow(
                {
                    "slug": row["slug"],
                    "display_name": row["display_name"],
                    "legal_name": row["legal_name"],
                    "dba_name": row["dba_name"],
                    "home_state": "TX",
                    "primary_city": row["primary_city"],
                    "primary_county": row["primary_county"],
                    "license_external_key": row["license_external_key"],
                }
            )
            kept += 1

    manifest = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": "tdlr_specialty_licenses",
        "source_url": SOURCE_URL,
        "soda_url": SODA_URL,
        "source_file": str(input_path).replace("\\", "/"),
        "source_sha256": _sha256_file(input_path) if input_path.is_file() else None,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "row_count_in": total_in,
        "row_count_licenses": kept,
        "skipped_no_key": skipped_no_key,
        "skipped_type_filter": skipped_type,
        "skipped_duplicate": skipped_dup,
        "only_default_types": only_default_types,
        "default_license_types": sorted(DEFAULT_LICENSE_TYPES),
        "coverage_note": (
            "Texas has no statewide general contractor license. "
            "Staging contains TDLR specialty contractor types only."
        ),
        "outputs": {
            "licenses_normalized.csv": str(licenses_path).replace("\\", "/"),
            "contractors_seed.csv": str(contractors_path).replace("\\", "/"),
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize Texas TDLR specialty licenses")
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/tx_tdlr"))
    p.add_argument("--limit", type=int, default=None)
    p.add_argument(
        "--include-all-types",
        action="store_true",
        help="Do not filter to DEFAULT_LICENSE_TYPES (use only if input is pre-filtered)",
    )
    args = p.parse_args(argv)

    if not args.input.is_file():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 1

    manifest = run(
        args.input,
        args.out_dir,
        limit=args.limit,
        only_default_types=not args.include_all_types,
    )
    print(json.dumps(manifest, indent=2))
    print(
        f"OK: {manifest['row_count_licenses']} licenses "
        f"(skipped type={manifest['skipped_type_filter']}, "
        f"no_key={manifest['skipped_no_key']}, dup={manifest['skipped_duplicate']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
