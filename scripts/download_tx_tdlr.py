#!/usr/bin/env python3
"""
Download construction-relevant TDLR licenses from Texas Open Data (Socrata).

Preferred official path: data.texas.gov dataset 7358-krk7 (TDLR - All Licenses).
We filter to specialty contractor types — not the full multi-industry dump.

Usage:
  python scripts/download_tx_tdlr.py
  python scripts/download_tx_tdlr.py --limit 5000
  python scripts/download_tx_tdlr.py --all-types   # full dataset pages (large)
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "ContractorTrustHub/0.1 (research; https://github.com/savitz25/contractor-trust-hub)"
DATASET_ID = "7358-krk7"
SODA_JSON = f"https://data.texas.gov/resource/{DATASET_ID}.json"
PORTAL_URL = f"https://data.texas.gov/dataset/TDLR-All-Licenses/{DATASET_ID}"

# Business-oriented construction specialty types for TX Verify v1
DEFAULT_LICENSE_TYPES = [
    "Electrical Contractor",
    "A/C Contractor",
    "Electrical Sign Contractor",
    "Appliance Installation Contractor",
    "Elevator Contractor",
    "Water Well Driller/Pump Installer",
]

# Fields we keep from the open dataset
KEEP_FIELDS = [
    "license_type",
    "license_number",
    "license_subtype",
    "license_expiration_date_mmddccyy",
    "business_name",
    "owner_name",
    "business_county",
    "business_address_line1",
    "business_address_line2",
    "business_city_state_zip",
    "business_telephone",
    "mailing_address_line1",
    "mailing_address_line2",
    "mailing_address_city_state_zip",
    "mailing_address_county",
    "owner_telephone",
    "continuing_education_flag",
]


def _request_json(url: str) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.load(resp)
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected SODA response: {type(data)}")
    return data


def build_where(license_types: list[str]) -> str:
    parts = []
    for t in license_types:
        safe = t.replace("'", "''")
        parts.append(f"license_type='{safe}'")
    return " OR ".join(parts)


def download_filtered(
    *,
    license_types: list[str],
    page_size: int,
    limit: int | None,
) -> list[dict]:
    where = build_where(license_types)
    rows: list[dict] = []
    offset = 0
    while True:
        if limit is not None and len(rows) >= limit:
            rows = rows[:limit]
            break
        page_limit = page_size
        if limit is not None:
            page_limit = min(page_size, limit - len(rows))
        params = {
            "$where": where,
            "$limit": str(page_limit),
            "$offset": str(offset),
            "$order": "license_type,license_number",
        }
        url = f"{SODA_JSON}?{urllib.parse.urlencode(params)}"
        print(f"  GET offset={offset} limit={page_limit} …")
        try:
            batch = _request_json(url)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"SODA HTTP {e.code}: {e.read()[:300]!r}") from e
        if not batch:
            break
        rows.extend(batch)
        offset += len(batch)
        if len(batch) < page_limit:
            break
    return rows


def write_csv(path: Path, rows: list[dict]) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=KEEP_FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: (r.get(k) or "") for k in KEEP_FIELDS})
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return {"path": str(path).replace("\\", "/"), "bytes": path.stat().st_size, "sha256": h.hexdigest()}


def main() -> int:
    p = argparse.ArgumentParser(description="Download TDLR licenses from Texas Open Data")
    p.add_argument("--out-dir", type=Path, default=Path("data/raw/tx_tdlr"))
    p.add_argument("--page-size", type=int, default=50000)
    p.add_argument("--limit", type=int, default=None, help="Max rows (for samples/tests)")
    p.add_argument(
        "--all-types",
        action="store_true",
        help="Do not filter license_type (very large; not recommended for v1)",
    )
    p.add_argument(
        "--types",
        nargs="*",
        default=None,
        help="Override license_type list",
    )
    args = p.parse_args()

    types = args.types if args.types else (None if args.all_types else DEFAULT_LICENSE_TYPES)
    print(f"TDLR open data {DATASET_ID}")
    print(f"Portal: {PORTAL_URL}")
    if types:
        print(f"Filter types ({len(types)}): {', '.join(types[:6])}{'…' if len(types) > 6 else ''}")
    else:
        print("WARNING: downloading all license types (large)")

    if types:
        rows = download_filtered(
            license_types=types, page_size=args.page_size, limit=args.limit
        )
    else:
        # Full dump via paging without where
        rows = []
        offset = 0
        while True:
            if args.limit is not None and len(rows) >= args.limit:
                rows = rows[: args.limit]
                break
            page_limit = args.page_size
            if args.limit is not None:
                page_limit = min(args.page_size, args.limit - len(rows))
            params = {
                "$limit": str(page_limit),
                "$offset": str(offset),
                "$order": ":id",
            }
            url = f"{SODA_JSON}?{urllib.parse.urlencode(params)}"
            print(f"  GET offset={offset} …")
            batch = _request_json(url)
            if not batch:
                break
            rows.extend(batch)
            offset += len(batch)
            if len(batch) < page_limit:
                break

    dest = args.out_dir / "tdlr_licenses_specialty.csv"
    file_info = write_csv(dest, rows)
    print(f"Wrote {len(rows)} rows → {dest}")

    manifest = {
        "source_system": "tx_tdlr",
        "dataset_id": DATASET_ID,
        "portal_url": PORTAL_URL,
        "soda_endpoint": SODA_JSON,
        "license_types": types,
        "row_count": len(rows),
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "file": file_info,
        "coverage_note": (
            "Texas has no statewide general contractor license. "
            "This extract is TDLR specialty trades only."
        ),
    }
    mpath = args.out_dir / "download_manifest.json"
    mpath.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {mpath}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
