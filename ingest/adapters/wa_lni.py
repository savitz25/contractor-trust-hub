"""
Washington L&I contractor license adapter.

Source: data.wa.gov dataset m8qx-ubtq.

Usage:
  python -m ingest.adapters.wa_lni --input data/raw/wa_lni/lni_contractor_licenses.csv
  python -m ingest.adapters.wa_lni --input data/samples/wa_lni_contractor_sample.csv --limit 100
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

SOURCE_SYSTEM = "wa_lni"
SOURCE_BOARD = "LNI"
SOURCE_URL = "https://data.wa.gov/Labor/L-I-Contractor-License-Data-General/m8qx-ubtq"

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
    "ACTIVE": "active",
    "EXPIRED": "expired",
    "SUSPENDED": "suspended",
    "INACTIVE": "inactive",
    "OUT OF BUSINESS": "inactive",
    "PASSED AWAY": "inactive",
    "REVOKED DUE DEPT ERR": "inactive",
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


def _coverage_signal(row: dict[str, str]) -> str:
    parts: list[str] = []
    spec = _clean(row.get("specialtycode1desc")) or _clean(row.get("specialtycode1"))
    spec2 = _clean(row.get("specialtycode2desc")) or _clean(row.get("specialtycode2"))
    if spec:
        parts.append(spec.title() if spec.isupper() else spec)
    if spec2:
        parts.append(spec2.title() if spec2.isupper() else spec2)
    biz = _clean(row.get("businesstypecodedesc"))
    if biz:
        parts.append(biz)
    ubi = _clean(row.get("ubi"))
    if ubi:
        parts.append(f"UBI {ubi}")
    principal = _clean(row.get("primaryprincipalname"))
    if principal:
        parts.append(f"Principal {principal}")
    suspend = _parse_date(row.get("contractorlicensesuspenddate"))
    if suspend:
        parts.append(f"Suspend date {suspend}")
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


def _occupation_description(row: dict[str, str], type_desc: str) -> str:
    spec = _clean(row.get("specialtycode1desc")) or _clean(row.get("specialtycode1"))
    if spec and spec.upper() not in type_desc.upper():
        pretty = spec.title() if spec.isupper() else spec
        return f"{type_desc} · {pretty}"
    return type_desc


def normalize_row(row: dict[str, str]) -> dict[str, str] | None:
    lic = _clean(row.get("contractorlicensenumber"))
    name = _clean(row.get("businessname"))
    if not lic or not name:
        return None
    type_code = (_clean(row.get("contractorlicensetypecode")) or "CC").upper()
    type_desc = _clean(row.get("contractorlicensetypecodedesc")) or "Construction contractor"
    type_desc = type_desc.title() if type_desc.isupper() else type_desc
    mailing_state = (_clean(row.get("state")) or "WA")[:2].upper()
    published_status = _clean(row.get("contractorlicensestatus")) or "UNKNOWN"
    external_key = f"WA-LNI:{lic.upper()}"
    payload = {k: v for k, v in row.items() if v}

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": type_code,
        "occupation_description": _occupation_description(row, type_desc),
        "license_number": lic.upper(),
        "class_code": _clean(row.get("specialtycode1")) or type_code,
        "licensee_name_raw": name,
        "dba_name_raw": _clean(row.get("primaryprincipalname")),
        "primary_status": published_status.title() if published_status.isupper() else published_status,
        "secondary_status": _coverage_signal(row),
        "status_normalized": _normalize_status(published_status),
        "original_licensure_date": "",
        "effective_date": _parse_date(row.get("licenseeffectivedate")),
        "expiration_date": _parse_date(row.get("licenseexpirationdate")),
        "address_line_1": _clean(row.get("address1")),
        "address_line_2": _clean(row.get("address2")),
        "address_line_3": "",
        "city": _clean(row.get("city")),
        "state": mailing_state,
        "postal_code": _clean(row.get("zip")),
        "county_code": "",
        "county_name": mailing_state if mailing_state and mailing_state != "WA" else "",
        "board_number": "LNI",
        "raw_payload_json": json.dumps(payload, ensure_ascii=False),
        "_display": name,
        "_slug": _slugify(external_key, name),
        "_mailing_state": mailing_state,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize Washington L&I contractor licenses")
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/wa_lni"))
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    if not args.input.exists():
        raise SystemExit(f"Missing input: {args.input}")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    skipped = 0
    seen: set[str] = set()
    for raw in _iter_csv(args.input):
        row = normalize_row(raw)
        if row is None:
            skipped += 1
            continue
        if row["external_key"] in seen:
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
            mailing = row.get("_mailing_state") or ""
            w.writerow(
                {
                    "slug": row["_slug"],
                    "display_name": row["_display"],
                    "legal_name": row["licensee_name_raw"],
                    "dba_name": row.get("dba_name_raw") or "",
                    "home_state": "WA",
                    "primary_city": row.get("city") or "",
                    "primary_county": mailing if mailing and mailing != "WA" else "",
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
        "source_dataset": "lni_contractor_licenses",
        "source_url": SOURCE_URL,
        "source_file": str(args.input).replace("\\", "/"),
        "source_sha256": _sha256_file(args.input),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "row_count_licenses": len(rows),
        "skipped": skipped,
        "by_type": dict(sorted(by_type.items(), key=lambda kv: -kv[1])),
        "by_status": dict(sorted(by_status.items(), key=lambda kv: -kv[1])),
        "coverage_note": (
            "Washington L&I contractor licenses (statewide). "
            "Status/type/specialty/UBI as published. No bond or insurance in this feed."
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
    print(f"OK: {len(rows)} licenses (skipped={skipped})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
