"""
Arizona ROC current-contractor posting list adapter (Verify v1).

Source: https://roc.az.gov/posting-list — All Current Contractors CSV.

Usage:
  python -m ingest.adapters.az_roc --input data/raw/az_roc/ROC_Posting-List_2026-08-13.csv
  python -m ingest.adapters.az_roc --input data/samples/az_roc_sample.csv --limit 50
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

SOURCE_SYSTEM = "az_roc"
SOURCE_BOARD = "ROC"
SOURCE_URL = "https://roc.az.gov/posting-list"
SOURCE_DATASET = "roc_current_active_contractors"

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

# Class Type → category bucket for product labels
CATEGORY_FROM_CLASS_TYPE: dict[str, str] = {
    "GENERAL RESIDENTIAL": "Residential",
    "SPECIALTY RESIDENTIAL": "Residential",
    "GENERAL COMMERCIAL": "Commercial",
    "SPECIALTY COMMERCIAL": "Commercial",
    "GENERAL DUAL": "Dual",
    "SPECIALTY DUAL": "Dual",
}


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def slugify(*parts: str, max_len: int = 120) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return (s or "unknown")[:max_len]


def parse_date(value: Any) -> str:
    v = _clean(value)
    if not v:
        return ""
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def normalize_status(raw: str) -> str:
    h = _clean(raw).upper()
    if h in {"ACTIVE", "CURRENT"}:
        return "active"
    if h in {"INACTIVE", "EXPIRED"}:
        return "inactive"
    if h in {"SUSPENDED", "REVOKED", "CANCELLED", "CANCELED"}:
        return "inactive"
    if not h:
        return "unknown"
    # Malformed rows sometimes put a date in Status
    if re.match(r"^\d{4}-\d{2}-\d{2}$", h):
        return "unknown"
    return "unknown"


def category_from_class_type(class_type: str) -> str:
    key = _clean(class_type).upper()
    if key in CATEGORY_FROM_CLASS_TYPE:
        return CATEGORY_FROM_CLASS_TYPE[key]
    # Some rare rows mis-parse; if Class Type looks like a class detail, leave blank
    if "RESIDENTIAL" in key:
        return "Residential"
    if "COMMERCIAL" in key:
        return "Commercial"
    if "DUAL" in key:
        return "Dual"
    return ""


def _field(row: dict[str, Any], *names: str) -> str:
    for n in names:
        if n in row and _clean(row.get(n)):
            return _clean(row.get(n))
        # case-insensitive
    lower = {(_clean(k).lower()): v for k, v in row.items()}
    for n in names:
        v = lower.get(n.lower())
        if v is not None and _clean(v):
            return _clean(v)
    return ""


def transform_row(raw: dict[str, Any], *, source_file: str = "") -> dict[str, Any] | None:
    lic = _field(raw, "License No", "License Number", "license_number", "LicenseNo")
    if not lic:
        return None
    # Keep leading zeros
    lic = lic.strip()
    if not re.search(r"\d", lic):
        return None

    business = _field(raw, "Business Name", "business_name")
    dba = _field(raw, "Doing Business As", "DBA", "dba_name")
    if not business and not dba:
        return None

    class_code = _field(raw, "Class", "class_code")
    class_detail = _field(raw, "Class Detail", "class_detail")
    class_type = _field(raw, "Class Type", "class_type")
    status_raw = _field(raw, "Status", "status")
    status = normalize_status(status_raw)
    if status == "unknown" and not status_raw:
        # posting list is current active; default carefully only if status blank
        status = "active"
        status_raw = "Active"

    category = category_from_class_type(class_type)
    qp = _field(raw, "Qualifying Party", "qualifying_party")

    city = _field(raw, "City", "city")
    state = (_field(raw, "State", "state") or "AZ")[:2].upper()
    # Malformed CSV rows can swap city/state — skip if state not AZ-like
    if len(state) != 2 or not state.isalpha():
        # try recovery: Zip column may hold AZ, State may hold city
        zip_maybe = _field(raw, "Zip", "zip")
        if zip_maybe.upper() == "AZ":
            city = state if len(state) > 2 else city
            state = "AZ"
        else:
            state = "AZ"

    postal = _field(raw, "Zip", "zip", "postal_code")
    if postal.upper() == "AZ":
        postal = ""

    external_key = f"AZ-ROC:{lic}"
    secondary_parts = []
    if class_type:
        secondary_parts.append(class_type)
    if category:
        secondary_parts.append(f"Category: {category}")
    if qp and qp.upper() not in {"", "COULD NOT FIND QP NAME"}:
        secondary_parts.append(f"QP: {qp}")
    secondary = " · ".join(secondary_parts)

    payload = {k: _clean(v) for k, v in raw.items() if _clean(v)}
    if source_file:
        payload["_source_file"] = source_file
    if category:
        payload["_category"] = category

    display = dba or business
    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": class_code or category or "ROC",
        "occupation_description": class_detail or class_type or "Arizona ROC contractor",
        "license_number": lic,
        "class_code": class_code,
        "licensee_name_raw": business or dba,
        "dba_name_raw": dba,
        "primary_status": status_raw or status,
        "secondary_status": secondary[:500],
        "status_normalized": status if status != "unknown" else "active",
        "original_licensure_date": parse_date(_field(raw, "Issued Date", "issued_date")),
        "effective_date": "",
        "expiration_date": parse_date(_field(raw, "Expiration Date", "expiration_date")),
        "address_line_1": _field(raw, "Address", "address"),
        "address_line_2": _field(raw, "Address 2", "address_2"),
        "address_line_3": "",
        "city": city,
        "state": state,
        "postal_code": postal,
        "county_code": "",
        "county_name": "",
        "board_number": "ROC",
        "raw_payload_json": json.dumps(payload, ensure_ascii=False),
        "_display": display,
        "_slug": slugify("az", external_key, display),
        "_category": category,
        "_class_type": class_type,
    }


def iter_roc_csv(path: Path) -> Iterator[dict[str, Any]]:
    """ROC files start with a title line before the header."""
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as f:
        first = f.readline()
        # If first line looks like a header, re-read from start
        if "License No" in first or "License Number" in first:
            f.seek(0)
        reader = csv.DictReader(f)
        for row in reader:
            # DictReader may attach overflow to None key on bad quotes
            if None in row:
                continue
            yield {k: v for k, v in row.items() if k is not None}


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def run(inputs: list[Path], out_dir: Path, limit: int | None = None) -> dict[str, Any]:
    licenses: list[dict[str, Any]] = []
    seeds: list[dict[str, Any]] = []
    seen: set[str] = set()
    status_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    class_type_counts: dict[str, int] = {}
    class_counts: dict[str, int] = {}
    source_files: list[str] = []
    skipped = 0

    for path in inputs:
        source_files.append(str(path))
        for raw in iter_roc_csv(path):
            t = transform_row(raw, source_file=path.name)
            if not t:
                skipped += 1
                continue
            key = t["external_key"]
            if key in seen:
                skipped += 1
                continue
            seen.add(key)
            licenses.append(t)
            seeds.append(
                {
                    "slug": t.get("_slug", ""),
                    "display_name": t.get("_display") or t.get("licensee_name_raw") or "",
                    "legal_name": t.get("licensee_name_raw") or "",
                    "dba_name": t.get("dba_name_raw") or "",
                    "home_state": t.get("state") or "AZ",
                    "primary_city": t.get("city") or "",
                    "primary_county": t.get("county_name") or "",
                    "license_external_key": key,
                }
            )
            sn = t.get("status_normalized") or "unknown"
            status_counts[sn] = status_counts.get(sn, 0) + 1
            cat = t.get("_category") or "Unknown"
            category_counts[cat] = category_counts.get(cat, 0) + 1
            ct = t.get("_class_type") or "Unknown"
            class_type_counts[ct] = class_type_counts.get(ct, 0) + 1
            code = t.get("class_code") or ""
            if code:
                class_counts[code] = class_counts.get(code, 0) + 1
            if limit and len(licenses) >= limit:
                break
        if limit and len(licenses) >= limit:
            break

    out_dir.mkdir(parents=True, exist_ok=True)
    lic_path = out_dir / "licenses_normalized.csv"
    seed_path = out_dir / "contractor_seeds.csv"
    write_csv(lic_path, LICENSE_OUT_FIELDS, licenses)
    write_csv(seed_path, CONTRACTOR_SEED_FIELDS, seeds)

    checksums = {}
    for p in inputs:
        if p.is_file():
            checksums[p.name] = _sha256_file(p)

    manifest = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": SOURCE_DATASET,
        "source_url": SOURCE_URL,
        "source_files": source_files,
        "checksums_sha256": checksums,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(licenses),
        "skipped": skipped,
        "status_counts": status_counts,
        "category_counts": dict(sorted(category_counts.items(), key=lambda x: -x[1])),
        "class_type_counts": dict(sorted(class_type_counts.items(), key=lambda x: -x[1])),
        "class_counts_top": dict(sorted(class_counts.items(), key=lambda x: -x[1])[:40]),
        "notes": (
            "Arizona ROC official current active contractor posting list. "
            "Dedupe by license number (AZ-ROC:{LicenseNo}). "
            "Always confirm on ROC contractor search. Discipline not loaded from this extract."
        ),
        "field_gaps": [
            "Current active posting list only — not inactive/revoked archive",
            "Disciplinary actions published separately — not invented here",
            "Bond/insurance live validity not in this file",
            "No automatic ACC/SOS entity linkage",
        ],
        "matching_strategy": "exact license number / AZ-ROC external_key; name search on business/DBA",
    }
    (out_dir / "batch_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    return manifest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize Arizona ROC posting-list CSV")
    p.add_argument("--input", type=Path, help="Single ROC CSV file")
    p.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/raw/az_roc"),
        help="Directory of ROC_Posting-List*.csv files",
    )
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/az_roc"))
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    inputs: list[Path] = []
    if args.input:
        if not args.input.exists():
            print(f"Input not found: {args.input}", file=sys.stderr)
            return 1
        inputs = [args.input]
    else:
        if not args.input_dir.is_dir():
            print(f"Input dir not found: {args.input_dir}", file=sys.stderr)
            return 1
        # Prefer full All Current over subset files
        all_files = sorted(args.input_dir.glob("ROC_Posting-List_*.csv"))
        # Exclude Commercial/Residential/Dual subsets if full list present
        full = [
            f
            for f in all_files
            if "Commercial" not in f.name
            and "Residential" not in f.name
            and "Dual" not in f.name
            and "Disciplinary" not in f.name
            and "Pending" not in f.name
            and "New-Licenses" not in f.name
        ]
        inputs = full if full else all_files
        if not inputs:
            print(f"No ROC CSV files in {args.input_dir}", file=sys.stderr)
            return 1

    # Prefer newest full file only when multiple full files
    if len(inputs) > 1:
        inputs = [max(inputs, key=lambda x: x.stat().st_mtime)]

    manifest = run(inputs, args.out_dir, args.limit)
    print(f"Wrote {manifest['row_count']} licenses → {args.out_dir} (skipped {manifest['skipped']})")
    print(
        json.dumps(
            {
                k: manifest[k]
                for k in (
                    "row_count",
                    "status_counts",
                    "category_counts",
                    "class_type_counts",
                )
                if k in manifest
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
