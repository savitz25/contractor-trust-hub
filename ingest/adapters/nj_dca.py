"""
New Jersey DCA / home-improvement contractor registration adapter (Stage 7 spike).

Normalizes official-style registration extracts into the shared Trust Hub license schema.
Does NOT force Florida DBPR field semantics.

NJ reality:
  - Home Improvement Contractor (HIC) registration is a core consumer-facing credential
  - Other trade boards / municipal cards may exist separately
  - Business entity linkage is a separate high-confidence join (not name-only)

Usage:
  python -m ingest.adapters.nj_dca --input data/samples/nj_dca_hic_sample.csv
  python -m ingest.adapters.nj_dca --input data/raw/nj_dca/registrations.csv --out-dir data/staging/nj_dca

Source matrix (ops):
  - Primary: NJ Division of Consumer Affairs contractor / HIC registration extracts
  - Entity: NJ business records (optional high-confidence only)
  - Enforcement: flag fields when present; full case files may lag
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

SOURCE_SYSTEM = "nj_dca"
SOURCE_BOARD = "NJ_DCA"
SOURCE_URL = "https://www.njconsumeraffairs.gov/"
SOURCE_DATASET = "contractor_hic_registration"

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

OCCUPATION_MAP = {
    "HIC": ("HIC", "Home Improvement Contractor"),
    "HOME IMPROVEMENT CONTRACTOR": ("HIC", "Home Improvement Contractor"),
    "HOME IMPROVEMENT": ("HIC", "Home Improvement Contractor"),
    "ELE": ("ELE", "Electrical Contractor (NJ)"),
    "ELECTRICAL": ("ELE", "Electrical Contractor (NJ)"),
    "PLB": ("PLB", "Plumbing Contractor (NJ)"),
    "PLUMBING": ("PLB", "Plumbing Contractor (NJ)"),
    "HVAC": ("HVAC", "HVAC / Mechanical Contractor (NJ)"),
    "MECHANICAL": ("HVAC", "HVAC / Mechanical Contractor (NJ)"),
    "GEN": ("GEN", "General contractor registration (NJ)"),
    "GENERAL": ("GEN", "General contractor registration (NJ)"),
}


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


def slugify(*parts: str) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return s[:120] if s else "unknown"


def normalize_status(raw: str) -> str:
    h = _clean(raw).lower()
    if not h:
        return "unknown"
    if any(x in h for x in ("active", "current", "valid", "registered")):
        return "active"
    if any(x in h for x in ("inactive", "expired", "lapsed", "suspended", "revoked", "cancelled")):
        return "inactive"
    return "unknown"


def occupation_for(credential_type: str) -> tuple[str, str]:
    key = _clean(credential_type).upper()
    if key in OCCUPATION_MAP:
        return OCCUPATION_MAP[key]
    # free text contains
    for k, v in OCCUPATION_MAP.items():
        if k in key:
            return v
    return ("GEN", credential_type or "New Jersey contractor registration")


def compose_external_key(registration_number: str, occupation_code: str) -> str | None:
    num = re.sub(r"[^A-Za-z0-9-]", "", _clean(registration_number).upper())
    if not num:
        return None
    if num.startswith("NJ-"):
        return num
    return f"NJ-{occupation_code}:{num}"


def transform_row(raw: dict[str, str]) -> dict[str, Any] | None:
    reg = (
        _clean(raw.get("registration_number"))
        or _clean(raw.get("license_number"))
        or _clean(raw.get("external_key"))
    )
    credential_type = _clean(raw.get("credential_type")) or _clean(raw.get("license_type")) or "HIC"
    occ_code, occ_desc = occupation_for(credential_type)
    external_key = compose_external_key(reg, occ_code)
    if not external_key:
        return None

    business = _clean(raw.get("business_name"))
    owner = _clean(raw.get("owner_name"))
    licensee = business or owner
    if not licensee:
        return None

    status_raw = _clean(raw.get("status"))
    status = normalize_status(status_raw)
    city = _clean(raw.get("city"))
    county = _clean(raw.get("county"))
    display = business or owner
    slug = slugify("nj", external_key, display)

    exp = _clean(raw.get("expiration_date"))
    # normalize M/D/Y if needed
    if exp and "/" in exp:
        for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
            try:
                exp = datetime.strptime(exp, fmt).date().isoformat()
                break
            except ValueError:
                continue

    enforcement = _clean(raw.get("enforcement_flag")).upper() in {"Y", "YES", "1", "TRUE"}

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": occ_code,
        "occupation_description": occ_desc,
        "license_number": reg,
        "class_code": credential_type,
        "licensee_name_raw": licensee,
        "dba_name_raw": business if business and business != owner else "",
        "display_name": display,
        "slug": slug,
        "primary_status": status_raw or status,
        "secondary_status": "enforcement_flag" if enforcement else "",
        "status_normalized": status,
        "original_licensure_date": "",
        "effective_date": "",
        "expiration_date": exp,
        "address_line_1": _clean(raw.get("address_line1") or raw.get("address_line_1")),
        "address_line_2": _clean(raw.get("address_line2") or raw.get("address_line_2")),
        "address_line_3": "",
        "city": city,
        "state": (_clean(raw.get("state")) or "NJ")[:2].upper(),
        "postal_code": _clean(raw.get("postal_code") or raw.get("zip"))[:10],
        "county_code": "",
        "county_name": county,
        "board_number": SOURCE_BOARD,
        "raw_payload_json": json.dumps(raw, ensure_ascii=False),
        "enforcement_flag": enforcement,
        "home_state": "NJ",
        "primary_city": city,
        "primary_county": county,
        "license_external_key": external_key,
        "legal_name": business or owner,
        "dba_name": business if business and business != owner else "",
    }


def iter_csv(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield {k: (v or "").strip() if isinstance(v, str) else "" for k, v in row.items()}


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def run(input_path: Path, out_dir: Path, limit: int | None = None) -> dict[str, Any]:
    rows_in = list(iter_csv(input_path))
    if limit:
        rows_in = rows_in[:limit]

    licenses: list[dict[str, Any]] = []
    seeds: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for raw in rows_in:
        t = transform_row(raw)
        if not t:
            continue
        key = t["external_key"]
        if key in seen_keys:
            continue
        seen_keys.add(key)
        licenses.append(t)
        seeds.append({k: t.get(k, "") for k in CONTRACTOR_SEED_FIELDS})

    out_dir.mkdir(parents=True, exist_ok=True)
    lic_path = out_dir / "licenses_normalized.csv"
    seed_path = out_dir / "contractor_seeds.csv"
    write_csv(lic_path, LICENSE_OUT_FIELDS, licenses)
    write_csv(seed_path, CONTRACTOR_SEED_FIELDS, seeds)

    manifest = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": SOURCE_DATASET,
        "source_url": SOURCE_URL,
        "source_file": str(input_path),
        "checksum_sha256": _sha256_file(input_path),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(licenses),
        "notes": "Stage 7 NJ Verify pilot — HIC/registration-first; not FL DBPR parity",
        "field_gaps": [
            "Entity linkage not produced by this adapter (separate high-confidence pass)",
            "Enforcement is flag-level only when present — not full case narratives",
            "Municipal-only credentials may be absent",
            "Permit/activity history out of scope for Stage 7",
        ],
        "matching_strategy": "exact registration/license key first; no name-only auto-join",
    }
    (out_dir / "batch_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    return manifest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize NJ DCA / HIC registration extracts")
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/nj_dca"))
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    if not args.input.exists():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 1

    manifest = run(args.input, args.out_dir, args.limit)
    print(f"Wrote {manifest['row_count']} licenses → {args.out_dir}")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
