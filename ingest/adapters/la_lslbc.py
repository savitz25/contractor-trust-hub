"""
Louisiana LSLBC contractor roster adapter.

Source: official public Request Roster CSVs
  https://arlspublic.lslbc.louisiana.gov/Public/RequestRoster

Usage:
  python -m ingest.adapters.la_lslbc --input data/raw/la_lslbc/lslbc_contractor_roster.csv
  python -m ingest.adapters.la_lslbc --input data/samples/la_lslbc_contractor_sample.csv --limit 50
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

SOURCE_SYSTEM = "la_lslbc"
SOURCE_BOARD = "LSLBC"
SOURCE_URL = "https://arlspublic.lslbc.louisiana.gov/Public/RequestRoster"

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

TYPE_CODES = {
    "COMMERCIAL LICENSE CERTIFICATE": ("CLC", "Commercial license"),
    "RESIDENTIAL LICENSE CERTIFICATE": ("RLC", "Residential license"),
    "HOME IMPROVEMENT REGISTRATION": ("HIR", "Home improvement registration"),
    "MOLD REMEDIATION LICENSE CERTIFICATE": ("MRL", "Mold remediation license"),
}

STATUS_NORMALIZED = {
    "ACTIVE": "active",
    "EXPIRED": "expired",
    "INACTIVE": "inactive",
    "SUSPENDED": "suspended",
    "REVOKED": "revoked",
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


def _parse_date(value: str | None) -> str:
    v = _clean(value)
    if not v:
        return ""
    if "T" in v:
        v = v.split("T", 1)[0]
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def _normalize_status(raw: str) -> str:
    key = _clean(raw).upper()
    return STATUS_NORMALIZED.get(key, "other")


def _type_info(credential_type: str) -> tuple[str, str, str]:
    published = _clean(credential_type)
    code, plain = TYPE_CODES.get(published.upper(), ("OTH", published or "Louisiana contractor license"))
    return code, published or plain, plain


def _coverage_signal(row: dict[str, str], parish: str, out_flag: str) -> str:
    parts: list[str] = []
    if parish:
        parts.append(f"Parish {parish}")
    if out_flag.upper() in {"Y", "YES", "TRUE", "1"}:
        parts.append("Out-of-state mailing")
    if _clean(row.get("Phone")):
        parts.append("Phone published")
    if _clean(row.get("Email")):
        parts.append("Email published")
    return " · ".join(parts)


def _slugify(*parts: str, max_len: int = 120) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return (s or "unknown")[:max_len]


def _iter_csv(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield {k: _clean(v) if isinstance(v, str) else "" for k, v in row.items()}


def normalize_row(row: dict[str, str]) -> dict[str, str] | None:
    lic = _clean(row.get("LicenseNumber"))
    name = _clean(row.get("CompanyName"))
    if not lic or not name:
        return None
    code, published, _plain = _type_info(row.get("Credential Type") or "")
    mailing_state = (_clean(row.get("StateCode")) or "LA")[:2].upper()
    published_status = _clean(row.get("Status")) or "UNKNOWN"
    parish = _clean(row.get("Parish"))
    out_flag = _clean(row.get("OutOfStateFlag"))
    external_key = f"LA-LSLBC:{lic.upper()}"
    payload = {k: v for k, v in row.items() if v}

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": code,
        "occupation_description": published,
        "license_number": lic.upper(),
        "class_code": code,
        "licensee_name_raw": name,
        "dba_name_raw": "",
        "primary_status": published_status.title() if published_status.isupper() else published_status,
        "secondary_status": _coverage_signal(row, parish, out_flag),
        "status_normalized": _normalize_status(published_status),
        "original_licensure_date": _parse_date(row.get("FirstEffectiveDate")),
        "effective_date": _parse_date(row.get("EffectiveDate")),
        "expiration_date": _parse_date(row.get("ExpirationDate")),
        "address_line_1": _clean(row.get("MailingAddress1")),
        "address_line_2": _clean(row.get("MailingAddress2")),
        "address_line_3": "",
        "city": _clean(row.get("City")),
        "state": mailing_state,
        "postal_code": _clean(row.get("ZipCode")),
        "county_code": "",
        "county_name": parish,
        "board_number": "LSLBC",
        "raw_payload_json": json.dumps(payload, ensure_ascii=False),
        "_display": name,
        "_slug": _slugify(external_key, name),
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize Louisiana LSLBC contractor rosters")
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/la_lslbc"))
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
                    "home_state": "LA",
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
        "source_dataset": "lslbc_contractor_roster",
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
            "Louisiana LSLBC official public roster (Active). "
            "Commercial / residential / home improvement / mold as published. "
            "No trade classifications, qualifying parties, bond, insurance, or discipline on this export."
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
