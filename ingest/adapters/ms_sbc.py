"""
Mississippi State Board of Contractors (MSBOC) adapter.

Source: official public consolidated search / Excel list view
  http://search.msboc.us/ConsolidatedResults.cfm

Usage:
  python -m ingest.adapters.ms_sbc --input data/raw/ms_sbc/msboc_contractor_list.csv
  python -m ingest.adapters.ms_sbc --input data/samples/ms_sbc_contractor_sample.csv --limit 50
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SOURCE_SYSTEM = "ms_sbc"
SOURCE_BOARD = "MSBOC"
SOURCE_URL = "http://search.msboc.us/ConsolidatedResults.cfm"

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

STATUS_NORMALIZED = {
    "LICENSED": "active",
    "LICENSED - ACTIVE": "active",
    "LICENSED ACTIVE": "active",
    "ACTIVE": "active",
    "LICENSED EXPIRED": "expired",
    "LICENSED - EXPIRED": "expired",
    "EXPIRED": "expired",
    "LICENSED - INACTIVE": "inactive",
    "LICENSED INACTIVE": "inactive",
    "INACTIVE": "inactive",
    "REVOKED": "revoked",
    "R - REVOKED": "revoked",
    "R-REVOKED": "revoked",
    "SUSPENDED": "suspended",
    "S - SUSPENDED": "suspended",
    "S-SUSPENDED": "suspended",
    "UNLICENSED": "unlicensed",
    "U - UNLICENSED": "unlicensed",
    "U-UNLICENSED": "unlicensed",
    "UNLICENSED EXPIRED": "unlicensed",
}

COL_ALIASES = {
    "contractortype": "ContractorType",
    "type": "ContractorType",
    "companyname": "CompanyName",
    "company name": "CompanyName",
    "company": "CompanyName",
    "licensenumber": "LicenseNumber",
    "license number": "LicenseNumber",
    "license": "LicenseNumber",
    "lic": "LicenseNumber",
    "status": "Status",
    "address": "Address",
    "city": "City",
    "state": "State",
    "zip": "Zip",
    "zipcode": "Zip",
    "postalcode": "Zip",
    "phone": "Phone",
    "classcode": "ClassCode",
    "class code": "ClassCode",
    "class": "ClassCode",
    "qualifier": "Qualifier",
    "qualname": "Qualifier",
    "qualifyingparty": "Qualifier",
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


def _canon_row(row: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in row.items():
        key = COL_ALIASES.get(_clean(k).lower(), _clean(k))
        out[key] = _clean(v) if isinstance(v, str) else ""
    return out


def _normalize_status(raw: str) -> str:
    key = re.sub(r"\s+", " ", _clean(raw).upper())
    return STATUS_NORMALIZED.get(key, "other" if key else "other")


def _license_suffix(lic: str) -> str:
    m = re.search(r"-([A-Z]{2})$", _clean(lic).upper())
    return m.group(1) if m else ""


_PLACEHOLDER_LICENSE = {
    "",
    "UNLICENSED",
    "UNLICENSED EXPIRED",
    "N/A",
    "NONE",
    "UNKNOWN",
    "NULL",
}


def _family_code(contractor_type: str) -> str:
    kind = _clean(contractor_type).upper()
    if kind.startswith("RES"):
        return "RES"
    if kind.startswith("COM"):
        return "COM"
    return "OTH"


def _is_placeholder_license(lic: str) -> bool:
    return _clean(lic).upper() in _PLACEHOLDER_LICENSE


def _type_info(contractor_type: str, license_number: str, class_code: str) -> tuple[str, str, str]:
    published = _clean(contractor_type)
    suffix = _license_suffix(license_number)
    published_class = _clean(class_code).upper()
    class_code_out = published_class or suffix

    kind = published.upper()
    if kind.startswith("RES"):
        code, plain = "RES", "Residential"
    elif kind.startswith("COM"):
        if suffix == "SC" or published_class == "SC":
            code, plain = "SC", "Commercial specialty"
        elif suffix == "MC" or published_class == "MC":
            code, plain = "MC", "Commercial (major)"
        else:
            code, plain = "COM", "Commercial"
    elif suffix == "SC":
        code, plain = "SC", "Commercial specialty"
    elif suffix == "MC":
        code, plain = "MC", "Commercial (major)"
    else:
        code, plain = "OTH", published or "Mississippi contractor license"

    official = published or plain
    return code, official, class_code_out


def _coverage_signal(row: dict[str, str], qualifier: str, class_code: str) -> str:
    parts: list[str] = []
    ctype = _clean(row.get("ContractorType"))
    if ctype:
        parts.append(f"Type {ctype}")
    if class_code:
        parts.append(f"Class {class_code}")
    if qualifier:
        parts.append(f"Qualifier {qualifier}")
    if _clean(row.get("Phone")):
        parts.append("Phone published")
    mailing = _clean(row.get("State")).upper()
    if mailing and mailing != "MS":
        parts.append("Out-of-state mailing")
    return " · ".join(parts)


def _slugify(*parts: str, max_len: int = 120) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return (s or "unknown")[:max_len]


def _iter_csv(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield _canon_row({k: _clean(v) if isinstance(v, str) else "" for k, v in row.items()})


def normalize_row(row: dict[str, str]) -> dict[str, str] | None:
    lic = _clean(row.get("LicenseNumber"))
    name = _clean(row.get("CompanyName"))
    if not name:
        return None
    if name.lower() in {"view", "company name", "type"}:
        return None
    placeholder = _is_placeholder_license(lic)
    if placeholder:
        lic = ""
    elif not lic:
        return None
    code, published, class_code = _type_info(
        row.get("ContractorType") or "",
        lic,
        row.get("ClassCode") or "",
    )
    mailing_state = (_clean(row.get("State")) or "MS")[:2].upper()
    published_status = _clean(row.get("Status")) or "UNKNOWN"
    qualifier = _clean(row.get("Qualifier"))
    family = _family_code(row.get("ContractorType") or "")
    if placeholder:
        digest_src = "|".join(
            [
                family,
                name.upper(),
                _clean(row.get("Address")).upper(),
                _clean(row.get("City")).upper(),
                published_status.upper(),
            ]
        )
        digest = hashlib.sha256(digest_src.encode("utf-8")).hexdigest()[:16]
        external_key = f"MS-SBC:UNLIC:{digest.upper()}"
    else:
        # Commercial and residential can share a numeric core; keep type in the key.
        external_key = f"MS-SBC:{family}:{lic.upper()}"
    payload = {k: v for k, v in row.items() if v}

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": code,
        "occupation_description": published,
        "license_number": lic.upper(),
        "class_code": class_code,
        "licensee_name_raw": name,
        "dba_name_raw": "",
        "primary_status": published_status,
        "secondary_status": _coverage_signal(row, qualifier, class_code),
        "status_normalized": _normalize_status(published_status),
        "original_licensure_date": "",
        "effective_date": "",
        "expiration_date": "",
        "address_line_1": _clean(row.get("Address")),
        "address_line_2": "",
        "address_line_3": "",
        "city": _clean(row.get("City")),
        "state": mailing_state,
        "postal_code": _clean(row.get("Zip")),
        "county_code": "",
        "county_name": "",
        "board_number": "MSBOC",
        "raw_payload_json": json.dumps(payload, ensure_ascii=False),
        "_display": name,
        "_slug": _slugify(external_key, name),
        "_qualifier": qualifier,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize Mississippi MSBOC contractor lists")
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/ms_sbc"))
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    if not args.input.exists():
        raise SystemExit(f"Missing input: {args.input}")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    skipped = 0
    collisions = 0
    seen: set[str] = set()
    for raw in _iter_csv(args.input):
        row = normalize_row(raw)
        if row is None:
            skipped += 1
            continue
        if row["external_key"] in seen:
            collisions += 1
            skipped += 1
            continue
        seen.add(row["external_key"])
        rows.append(row)
        if args.limit is not None and len(rows) >= args.limit:
            break

    lic_path = args.out_dir / "licenses_normalized.csv"
    seed_path = args.out_dir / "contractors_seed.csv"
    with lic_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=LICENSE_OUT_FIELDS, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow(row)
    with seed_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CONTRACTOR_SEED_FIELDS)
        w.writeheader()
        for row in rows:
            w.writerow(
                {
                    "slug": row["_slug"],
                    "display_name": row["_display"],
                    "legal_name": row["licensee_name_raw"],
                    "dba_name": "",
                    "home_state": "MS",
                    "primary_city": row.get("city") or "",
                    "primary_county": row.get("county_name") or "",
                    "license_external_key": row["external_key"],
                }
            )

    by_type: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for row in rows:
        label = row["occupation_code"]
        by_type[label] = by_type.get(label, 0) + 1
        st = row["status_normalized"]
        by_status[st] = by_status.get(st, 0) + 1

    manifest: dict[str, Any] = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": "msboc_contractor_list",
        "source_url": SOURCE_URL,
        "source_file": str(args.input).replace("\\", "/"),
        "source_sha256": _sha256_file(args.input),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "row_count_licenses": len(rows),
        "skipped": skipped,
        "duplicate_keys": collisions,
        "by_type": dict(sorted(by_type.items(), key=lambda kv: -kv[1])),
        "by_status": dict(sorted(by_status.items(), key=lambda kv: -kv[1])),
        "coverage_note": (
            "Mississippi MSBOC official public consolidated list. "
            "Commercial / residential type and MC/SC suffix as published. "
            "Qualifying parties and specialty class codes only when present on the extract. "
            "No bond, insurance, or discipline fields on the list view."
        ),
        "outputs": {
            "licenses_normalized.csv": str(lic_path).replace("\\", "/"),
            "contractors_seed.csv": str(seed_path).replace("\\", "/"),
        },
    }
    (args.out_dir / "batch_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2))
    print(f"OK: {len(rows)} licenses (skipped={skipped}, duplicate_keys={collisions})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
