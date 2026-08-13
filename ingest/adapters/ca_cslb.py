"""
California CSLB contractor list adapter (Phase 0 / Verify v1).

Source: CSLB Public Data Portal — county / classification list Excel downloads
(CSLBSearchData_*.xlsx). This extract covers top high-impact counties present
in data/raw/ca_contractors/ — not necessarily every CA county.

Usage:
  python -m ingest.adapters.ca_cslb --input-dir data/raw/ca_contractors
  python -m ingest.adapters.ca_cslb --input-dir data/raw/ca_contractors --out-dir data/staging/ca_cslb
  python -m ingest.adapters.ca_cslb --input data/samples/ca_cslb_sample.csv --csv

Stable key: CA-CSLB:{LicenseNumber}
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

SOURCE_SYSTEM = "ca_cslb"
SOURCE_BOARD = "CSLB"
SOURCE_URL = "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx"
SOURCE_DATASET = "cslb_public_data_portal_county_lists"

# Common CSLB classification codes → short product labels
CLASS_LABELS: dict[str, str] = {
    "A": "General Engineering",
    "B": "General Building",
    "B2": "Residential Remodeling",
    "C": "Specialty (see class)",
    "C2": "Insulation and Acoustical",
    "C4": "Boiler, Hot Water Heating and Steam Fitting",
    "C5": "Framing and Rough Carpentry",
    "C6": "Cabinet, Millwork and Finish Carpentry",
    "C7": "Low Voltage Systems",
    "C8": "Concrete",
    "C9": "Drywall",
    "C10": "Electrical",
    "C11": "Elevator",
    "C12": "Earthwork and Paving",
    "C13": "Fencing",
    "C15": "Flooring and Floor Covering",
    "C16": "Fire Protection",
    "C17": "Glazing",
    "C20": "Warm-Air Heating, Ventilating and Air-Conditioning",
    "C21": "Building Moving/Demolition",
    "C22": "Asbestos Abatement",
    "C23": "Ornamental Metal",
    "C27": "Landscaping",
    "C28": "Lock and Security Equipment",
    "C29": "Masonry",
    "C31": "Construction Zone Traffic Control",
    "C32": "Parking and Highway Improvement",
    "C33": "Painting and Decorating",
    "C34": "Pipeline",
    "C35": "Lathing and Plastering",
    "C36": "Plumbing",
    "C38": "Refrigeration",
    "C39": "Roofing",
    "C42": "Sanitation System",
    "C43": "Sheet Metal",
    "C45": "Sign",
    "C46": "Solar",
    "C47": "General Manufactured Housing",
    "C50": "Reinforcing Steel",
    "C51": "Structural Steel",
    "C53": "Swimming Pool",
    "C54": "Tile",
    "C55": "Water Conditioning",
    "C57": "Well Drilling",
    "C60": "Welding",
    "C61": "Limited Specialty",
    "ASB": "Asbestos Certification",
    "HAZ": "Hazardous Substance Removal",
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


def slugify(*parts: str) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return s[:120] if s else "unknown"


def parse_date(value: Any) -> str:
    v = _clean(value)
    if not v:
        return ""
    # Excel may already be datetime
    if isinstance(value, datetime):
        return value.date().isoformat()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(v[:10], fmt).date().isoformat()
        except ValueError:
            continue
    # openpyxl sometimes gives "2024-01-15 00:00:00"
    try:
        return datetime.fromisoformat(v.replace("Z", "")[:19]).date().isoformat()
    except ValueError:
        return v[:10]


def normalize_status(raw: str) -> str:
    h = _clean(raw).upper()
    if not h:
        return "unknown"
    if h in {"CLEAR", "ACTIVE", "CURRENT"}:
        return "active"
    if any(x in h for x in ("EXPIRED", "INACTIVE", "SUSPENDED", "REVOKED", "CANCEL", "VOID")):
        return "inactive"
    return "unknown"


def parse_classifications(raw: str) -> list[str]:
    """Return ordered unique classification codes from CSLB Classification(s) cell."""
    text = _clean(raw)
    if not text:
        return []
    parts = re.split(r"\s*\|\s*|[;,]", text)
    codes: list[str] = []
    seen: set[str] = set()
    for part in parts:
        part = part.strip()
        if not part:
            continue
        # "C-10", "C10", "B - GENERAL", "HAZ"
        m = re.match(r"^([A-Za-z]+\-?\d+|[A-Za-z]+\d*|[A-Z]{2,})", part)
        if not m:
            continue
        code = m.group(1).upper().replace("-", "")
        # Normalize C-10 → C10 already; keep ASB/HAZ
        if code not in seen:
            seen.add(code)
            codes.append(code)
    return codes


def primary_occupation(codes: list[str], raw_class: str) -> tuple[str, str]:
    if not codes:
        return ("GEN", raw_class or "California contractor license")
    primary = codes[0]
    label = CLASS_LABELS.get(primary, primary)
    if len(codes) > 1:
        label = f"{label} (+{len(codes) - 1} more)"
    return (primary, label)


def compose_external_key(license_number: str) -> str | None:
    num = re.sub(r"[^0-9A-Za-z]", "", _clean(license_number).upper())
    if not num:
        return None
    if num.startswith("CA-CSLB:"):
        return num
    return f"CA-CSLB:{num}"


def transform_row(raw: dict[str, Any], source_file: str = "") -> dict[str, Any] | None:
    lic = _clean(raw.get("LicenseNumber") or raw.get("license_number"))
    external_key = compose_external_key(lic)
    if not external_key:
        return None

    business = _clean(raw.get("BusinessName") or raw.get("business_name"))
    if not business:
        return None

    class_raw = _clean(raw.get("Classification(s)") or raw.get("classifications") or raw.get("class_code"))
    codes = parse_classifications(class_raw)
    occ_code, occ_desc = primary_occupation(codes, class_raw)

    status_raw = _clean(raw.get("Status") or raw.get("status"))
    status = normalize_status(status_raw)
    city = _clean(raw.get("City") or raw.get("city"))
    county = _clean(raw.get("County") or raw.get("county"))
    state = (_clean(raw.get("State") or raw.get("state")) or "CA")[:2].upper()
    postal = re.sub(r"[^0-9A-Za-z-]", "", _clean(raw.get("ZIP Code") or raw.get("postal_code") or raw.get("zip")))[:10]
    addr = _clean(raw.get("Address") or raw.get("address_line_1") or raw.get("address"))
    phone = _clean(raw.get("PhoneNumber") or raw.get("phone"))
    bus_type = _clean(raw.get("BusinessType") or raw.get("business_type"))

    issue = parse_date(raw.get("IssueDate") or raw.get("issue_date"))
    exp = parse_date(raw.get("ExpirationDate") or raw.get("expiration_date"))

    bond_co = _clean(raw.get("SuretyCompany"))
    bond_no = _clean(raw.get("ContractorBondNumber"))
    wc_type = _clean(raw.get("WorkersCompCoverageType"))
    wc_co = _clean(raw.get("WorkersCompInsuranceCompany"))

    secondary = " | ".join(
        p
        for p in [
            f"bond:{bond_co}" if bond_co else "",
            f"bond#:{bond_no}" if bond_no else "",
            f"wc:{wc_type}" if wc_type else "",
            f"wc_co:{wc_co}" if wc_co else "",
            f"type:{bus_type}" if bus_type else "",
            f"classes:{'|'.join(codes)}" if codes else "",
            f"phone:{phone}" if phone else "",
        ]
        if p
    )

    slug = slugify("ca", external_key, business)
    # Search blob includes business name only (no owner field in extract)
    payload = {k: _clean(v) if not isinstance(v, (dict, list)) else v for k, v in raw.items()}
    if source_file:
        payload["_source_file"] = source_file

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": occ_code,
        "occupation_description": occ_desc,
        "license_number": re.sub(r"[^0-9A-Za-z]", "", lic.upper()) or lic,
        "class_code": "|".join(codes) if codes else class_raw,
        "licensee_name_raw": business,
        "dba_name_raw": bus_type,
        "display_name": business,
        "slug": slug,
        "primary_status": status_raw or status,
        "secondary_status": secondary[:500],
        "status_normalized": status,
        "original_licensure_date": issue,
        "effective_date": "",
        "expiration_date": exp,
        "address_line_1": addr,
        "address_line_2": "",
        "address_line_3": "",
        "city": city,
        "state": state,
        "postal_code": postal,
        "county_code": "",
        "county_name": county,
        "board_number": SOURCE_BOARD,
        "raw_payload_json": json.dumps(payload, ensure_ascii=False, default=str),
        "home_state": "CA",
        "primary_city": city,
        "primary_county": county,
        "license_external_key": external_key,
        "legal_name": business,
        "dba_name": "",
    }


def iter_xlsx(path: Path) -> Iterator[dict[str, Any]]:
    try:
        import openpyxl
    except ImportError as exc:
        raise SystemExit(
            "openpyxl is required for CSLB Excel files.\n"
            "  pip install openpyxl\n"
            f"Original error: {exc}"
        ) from exc

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header_row = next(rows, None)
    if not header_row:
        wb.close()
        return
    headers = [_clean(h) for h in header_row]
    for row in rows:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue
        yield {headers[i]: row[i] if i < len(row) else None for i in range(len(headers))}
    wb.close()


def iter_csv_file(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield dict(row)


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def run(
    inputs: list[Path],
    out_dir: Path,
    limit: int | None = None,
    as_csv: bool = False,
) -> dict[str, Any]:
    licenses: list[dict[str, Any]] = []
    seeds: list[dict[str, Any]] = []
    seen: set[str] = set()
    county_counts: dict[str, int] = {}
    class_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    source_files: list[str] = []

    for path in inputs:
        source_files.append(str(path))
        iterator = iter_csv_file(path) if as_csv or path.suffix.lower() == ".csv" else iter_xlsx(path)
        for raw in iterator:
            t = transform_row(raw, source_file=path.name)
            if not t:
                continue
            key = t["external_key"]
            if key in seen:
                continue
            seen.add(key)
            licenses.append(t)
            seeds.append({k: t.get(k, "") for k in CONTRACTOR_SEED_FIELDS})
            cty = (t.get("county_name") or "UNKNOWN").upper()
            county_counts[cty] = county_counts.get(cty, 0) + 1
            status_counts[t.get("status_normalized") or "unknown"] = (
                status_counts.get(t.get("status_normalized") or "unknown", 0) + 1
            )
            for code in (t.get("class_code") or "").split("|"):
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
        "county_counts": dict(sorted(county_counts.items(), key=lambda x: -x[1])),
        "class_counts_top": dict(sorted(class_counts.items(), key=lambda x: -x[1])[:40]),
        "status_counts": status_counts,
        "notes": (
            "CSLB Public Data Portal county/classification Excel extracts. "
            "Deduped by license number. Coverage is limited to counties present in the download set. "
            "Always confirm on CSLB Instant License Check."
        ),
        "field_gaps": [
            "Extract may be CLEAR/active-only depending on portal filter",
            "Not every California county may be present",
            "Multi-class licenses use primary class as occupation_code; full set in class_code",
            "Bond/WC fields stored in secondary_status and raw_payload — not live COI verification",
            "No automatic SOS entity linkage",
        ],
        "matching_strategy": "exact license number / CA-CSLB external_key; name search on business name",
    }
    (out_dir / "batch_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    return manifest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize California CSLB contractor Excel/CSV extracts")
    p.add_argument("--input", type=Path, help="Single file (.xlsx or .csv)")
    p.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/raw/ca_contractors"),
        help="Directory of CSLBSearchData_*.xlsx files",
    )
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/ca_cslb"))
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--csv", action="store_true", help="Force CSV reader")
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
        inputs = sorted(args.input_dir.glob("CSLBSearchData_*.xlsx"))
        inputs += sorted(args.input_dir.glob("*.csv"))
        # exclude inventory etc.
        inputs = [p for p in inputs if p.suffix.lower() in {".xlsx", ".csv"} and "inventory" not in p.name.lower()]
        if not inputs:
            print(f"No CSLB files in {args.input_dir}", file=sys.stderr)
            return 1

    manifest = run(inputs, args.out_dir, args.limit, as_csv=args.csv)
    print(f"Wrote {manifest['row_count']} licenses → {args.out_dir}")
    print(json.dumps({k: manifest[k] for k in ("row_count", "status_counts", "county_counts") if k in manifest}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
