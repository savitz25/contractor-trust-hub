"""
Oregon CCB Active Licenses adapter.

Source: data.oregon.gov dataset g77e-6bhs.

Usage:
  python -m ingest.adapters.or_ccb --input data/raw/or_ccb/ccb_active_licenses.csv
  python -m ingest.adapters.or_ccb --input data/samples/or_ccb_active_sample.csv --limit 100
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

SOURCE_SYSTEM = "or_ccb"
SOURCE_BOARD = "CCB"
SOURCE_URL = "https://data.oregon.gov/Business/CCB-Active-Licenses/g77e-6bhs"

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


def _parse_date(value: str | None) -> str:
    v = _clean(value)
    if not v:
        return ""
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def _fmt_money(raw: str) -> str:
    digits = re.sub(r"[^\d.]", "", raw)
    if not digits:
        return ""
    try:
        n = float(digits)
    except ValueError:
        return raw
    if n >= 1000 and n == int(n):
        return f"${int(n):,}"
    return f"${n:,.0f}" if n >= 1 else raw


def _coverage_signal(row: dict[str, str]) -> str:
    parts: list[str] = []
    bond_amt = _fmt_money(_clean(row.get("bond_amount")))
    ins_amt = _fmt_money(_clean(row.get("ins_amount")))
    if bond_amt or _clean(row.get("bond_company")):
        parts.append(f"Bond {bond_amt} listed".replace("Bond  listed", "Bond listed"))
    if ins_amt or _clean(row.get("ins_company")):
        parts.append(f"Liability {ins_amt} listed".replace("Liability  listed", "Liability listed"))
    exempt = _clean(row.get("exempt_text"))
    if exempt:
        parts.append(f"WC {exempt}")
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
    lic = _clean(row.get("license_number"))
    name = _clean(row.get("full_name"))
    if not lic or not name:
        return None
    lic_type = _clean(row.get("license_type")).upper() or "CCB"
    endorsement = _clean(row.get("endorsement_text")) or lic_type
    state = (_clean(row.get("state")) or "OR")[:2].upper()
    external_key = f"OR-CCB:{lic}:{lic_type}"
    payload = {k: v for k, v in row.items() if v}

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": lic_type,
        "occupation_description": endorsement,
        "license_number": lic,
        "class_code": lic_type,
        "licensee_name_raw": name,
        "dba_name_raw": _clean(row.get("rmi_name")),
        "primary_status": "Active",
        "secondary_status": _coverage_signal(row),
        "status_normalized": "active",
        "original_licensure_date": _parse_date(row.get("orig_regis_date")),
        "effective_date": "",
        "expiration_date": _parse_date(row.get("lic_exp_date")),
        "address_line_1": _clean(row.get("address")),
        "address_line_2": "",
        "address_line_3": "",
        "city": _clean(row.get("city")),
        "state": state,
        "postal_code": _clean(row.get("zip_code")),
        "county_code": _clean(row.get("county_code")),
        "county_name": _clean(row.get("county_name")),
        "board_number": "CCB",
        "raw_payload_json": json.dumps(payload, ensure_ascii=False),
        "_display": name,
        "_slug": _slugify(external_key, name),
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize Oregon CCB Active Licenses")
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/or_ccb"))
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
            w.writerow(
                {
                    "slug": row["_slug"],
                    "display_name": row["_display"],
                    "legal_name": row["licensee_name_raw"],
                    "dba_name": row.get("dba_name_raw") or "",
                    "home_state": row.get("state") or "OR",
                    "primary_city": row.get("city") or "",
                    "primary_county": row.get("county_name") or "",
                    "license_external_key": row["external_key"],
                }
            )

    by_type: dict[str, int] = {}
    for row in rows:
        label = row["occupation_description"]
        by_type[label] = by_type.get(label, 0) + 1

    manifest: dict[str, Any] = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": "ccb_active_licenses",
        "source_url": SOURCE_URL,
        "source_file": str(args.input).replace("\\", "/"),
        "source_sha256": _sha256_file(args.input),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "row_count_licenses": len(rows),
        "skipped": skipped,
        "by_type": dict(sorted(by_type.items(), key=lambda kv: -kv[1])),
        "coverage_note": (
            "Oregon CCB Active Licenses. Statewide contractor licensing. "
            "Bond/insurance fields as published — not a live COI check."
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
