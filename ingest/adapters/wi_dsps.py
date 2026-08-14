"""
Wisconsin DSPS / LicensE adapter (Phase 0).

Wisconsin has NO statewide commercial general contractor license.
Dwelling Contractor is a 1-2 family permit credential, not a commercial GC.
This adapter only normalizes official DSPS / LicensE extract fields.

Usage:
  python -m ingest.adapters.wi_dsps --input data/samples/wi_dsps/contractor_sample.csv
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

SOURCE_SYSTEM = "wi_dsps"
SOURCE_BOARD = "DSPS"
SOURCE_URL = "https://license.wi.gov/s/license-lookup"

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

# Official LicensE suffixes (LicensEnumbering.pdf) plus count-table aliases.
FIRM_SUFFIXES = {
    "DC": ("DC", "Dwelling Contractor"),
    "DCFR": ("DC", "Dwelling Contractor"),
    "DCR": ("DCR", "Dwelling Contractor Restricted"),
    "DCFRR": ("DCR", "Dwelling Contractor Restricted"),
    "EC": ("EC", "Electrical Contractor"),
    "HVACCONT": ("HVACCONT", "HVAC Contractor"),
    "HVACC": ("HVACCONT", "HVAC Contractor"),
}

QUALIFIER_SUFFIXES = {
    "DCQ": ("DCQ", "Dwelling Contractor Qualifier"),
    "HVACQ": ("HVACQ", "HVAC Qualifier"),
    "ME": ("ME", "Master Electrician"),
    "PM": ("PM", "Master Plumber"),
}

TYPE_NAME_TO_SUFFIX = {
    "DWELLING CONTRACTOR": "DC",
    "DWELLING CONTRACTOR RESTRICTED": "DCR",
    "DWELLING CONTRACTOR QUALIFIER": "DCQ",
    "ELECTRICAL CONTRACTOR": "EC",
    "HVAC CONTRACTOR": "HVACCONT",
    "HVAC QUALIFIER": "HVACQ",
    "MASTER ELECTRICIAN": "ME",
    "MASTER PLUMBER": "PM",
}

STATUS_NORMALIZED = {
    "ACTIVE": "active",
    "EXPIRED": "expired",
    "INACTIVE": "inactive",
    "NOT ACTIVE": "inactive",
    "SUSPENDED": "suspended",
    "REVOKED": "revoked",
    "CANCELLED": "other",
    "CANCELED": "other",
    "CLOSED": "other",
    "PENDING": "other",
}

COL_ALIASES = {
    "licensenumber": "LicenseNumber",
    "license number": "LicenseNumber",
    "license name": "LicenseNumber",
    "credentialnumber": "LicenseNumber",
    "credential number": "LicenseNumber",
    "credentialid": "LicenseNumber",
    "credential id": "LicenseNumber",
    "credentialsuffix": "CredentialSuffix",
    "credential suffix": "CredentialSuffix",
    "suffix": "CredentialSuffix",
    "licensetypeid": "CredentialSuffix",
    "credentialtype": "CredentialType",
    "credential type": "CredentialType",
    "licensetype": "CredentialType",
    "license type": "CredentialType",
    "profession": "CredentialType",
    "licenseename": "LicenseeName",
    "licensee": "LicenseeName",
    "name": "LicenseeName",
    "organizationname": "OrganizationName",
    "organization name": "OrganizationName",
    "dbaname": "OrganizationName",
    "dba name": "OrganizationName",
    "dba": "OrganizationName",
    "status": "Status",
    "granteddate": "GrantedDate",
    "granted date": "GrantedDate",
    "issueddate": "GrantedDate",
    "issued date": "GrantedDate",
    "periodend": "PeriodEnd",
    "period end": "PeriodEnd",
    "expirationdate": "PeriodEnd",
    "expiration date": "PeriodEnd",
    "city": "City",
    "state": "State",
    "postalcode": "PostalCode",
    "postal code": "PostalCode",
    "zip": "PostalCode",
    "county": "County",
}

# Official display: "1234 - DC" (space-dash-space + suffix).
LICENS_E_RE = re.compile(
    r"^\s*(?P<num>[A-Za-z0-9]+)\s*-\s*(?P<suffix>[A-Za-z0-9]+)\s*$"
)


def _clean(value: str | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _canon_row(row: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in row.items():
        key = COL_ALIASES.get(_clean(k).lower(), _clean(k))
        out[key] = _clean(v) if isinstance(v, str) else ""
    return out


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
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def _normalize_status(raw: str) -> str:
    return STATUS_NORMALIZED.get(_clean(raw).upper(), "other" if raw else "other")


def _parse_license_id(raw: str) -> tuple[str, str]:
    """Return (number, suffix) from '1234 - DC' or a bare number."""
    v = _clean(raw)
    m = LICENS_E_RE.match(v)
    if m:
        return m.group("num"), m.group("suffix").upper()
    return v, ""


def _resolve_suffix(row: dict[str, str], parsed_suffix: str) -> str:
    explicit = _clean(row.get("CredentialSuffix")).upper()
    if explicit:
        return explicit
    if parsed_suffix:
        return parsed_suffix
    named = TYPE_NAME_TO_SUFFIX.get(_clean(row.get("CredentialType")).upper(), "")
    return named


def _type_codes(suffix: str, published_type: str) -> tuple[str, str, bool]:
    mapped = FIRM_SUFFIXES.get(suffix) or QUALIFIER_SUFFIXES.get(suffix)
    if mapped:
        occ, official = mapped
        return occ, published_type or official, suffix in FIRM_SUFFIXES
    return suffix or "OTH", published_type or "Wisconsin DSPS credential", False


def _slugify(*parts: str, max_len: int = 120) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return (s or "unknown")[:max_len]


def _iter_csv(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield _canon_row({k: _clean(v) if isinstance(v, str) else "" for k, v in row.items()})


def normalize_row(row: dict[str, str], *, firm_only: bool = True) -> dict[str, str] | None:
    raw_id = _clean(row.get("LicenseNumber"))
    name = _clean(row.get("LicenseeName")) or _clean(row.get("OrganizationName"))
    if not raw_id or not name:
        return None

    number, parsed_suffix = _parse_license_id(raw_id)
    suffix = _resolve_suffix(row, parsed_suffix)
    if not number:
        return None

    occ, published, is_firm = _type_codes(suffix, _clean(row.get("CredentialType")))
    if firm_only and not is_firm:
        return None

    status = _clean(row.get("Status")) or "UNKNOWN"
    org = _clean(row.get("OrganizationName"))
    display_number = f"{number} - {occ}" if occ and occ != "OTH" else number
    if suffix:
        external_key = f"WI-DSPS:{occ}:{number.upper()}"
    else:
        external_key = f"WI-DSPS:{number.upper()}"

    payload = {k: v for k, v in row.items() if v}
    display = org or name

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": occ,
        "occupation_description": published,
        "license_number": display_number,
        "class_code": occ,
        "licensee_name_raw": name,
        "dba_name_raw": org if org and org != name else "",
        "primary_status": status,
        "secondary_status": f"Type {published}" if published else "",
        "status_normalized": _normalize_status(status),
        "original_licensure_date": _parse_date(row.get("GrantedDate")),
        "effective_date": _parse_date(row.get("GrantedDate")),
        "expiration_date": _parse_date(row.get("PeriodEnd")),
        "address_line_1": "",
        "address_line_2": "",
        "address_line_3": "",
        "city": _clean(row.get("City")),
        "state": _clean(row.get("State")) or "WI",
        "postal_code": _clean(row.get("PostalCode")),
        "county_code": "",
        "county_name": _clean(row.get("County")),
        "board_number": "DSPS",
        "raw_payload_json": json.dumps(payload, ensure_ascii=False),
        "_display": display,
        "_slug": _slugify(external_key, display),
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize Wisconsin DSPS / LicensE extracts")
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/wi_dsps"))
    p.add_argument("--limit", type=int, default=None)
    p.add_argument(
        "--include-qualifiers",
        action="store_true",
        help="Keep DCQ / HVACQ / ME / PM rows (still skip apprentices/helpers)",
    )
    args = p.parse_args(argv)

    if not args.input.exists():
        raise SystemExit(f"Missing input: {args.input}")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    skipped = 0
    collisions = 0
    seen: set[str] = set()
    for raw in _iter_csv(args.input):
        row = normalize_row(raw, firm_only=not args.include_qualifiers)
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
                    "dba_name": row.get("dba_name_raw") or "",
                    "home_state": "WI",
                    "primary_city": row.get("city") or "",
                    "primary_county": row.get("county_name") or "",
                    "license_external_key": row["external_key"],
                }
            )

    by_type: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for row in rows:
        by_type[row["occupation_code"]] = by_type.get(row["occupation_code"], 0) + 1
        by_status[row["status_normalized"]] = by_status.get(row["status_normalized"], 0) + 1

    manifest: dict[str, Any] = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": "dsps_license_extract_or_sample",
        "source_url": SOURCE_URL,
        "source_file": str(args.input).replace("\\", "/"),
        "source_sha256": _sha256_file(args.input),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "row_count_licenses": len(rows),
        "skipped": skipped,
        "duplicate_keys": collisions,
        "firm_only": not args.include_qualifiers,
        "by_type": dict(sorted(by_type.items(), key=lambda kv: -kv[1])),
        "by_status": dict(sorted(by_status.items(), key=lambda kv: -kv[1])),
        "coverage_note": (
            "Wisconsin DSPS dwelling + trade credentials only. "
            "No statewide commercial general contractor license. "
            "No bond, insurance, or structured discipline on Phase 0 sources."
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
