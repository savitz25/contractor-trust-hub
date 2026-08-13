#!/usr/bin/env python3
"""
Download Oregon CCB Active Licenses from official open data (Socrata).

Dataset: data.oregon.gov g77e-6bhs
https://data.oregon.gov/Business/CCB-Active-Licenses/g77e-6bhs

Usage:
  python scripts/download_or_ccb.py
  python scripts/download_or_ccb.py --limit 2000
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
DATASET_ID = "g77e-6bhs"
SODA_JSON = f"https://data.oregon.gov/resource/{DATASET_ID}.json"
PORTAL_URL = f"https://data.oregon.gov/Business/CCB-Active-Licenses/{DATASET_ID}"

KEEP_FIELDS = [
    "license_number",
    "license_type",
    "related_key",
    "related_type",
    "county_code",
    "county_name",
    "lic_exp_date",
    "orig_regis_date",
    "bond_company",
    "bond_amount",
    "bond_exp_date",
    "ins_company",
    "ins_amount",
    "ins_exp_date",
    "full_name",
    "address",
    "city",
    "state",
    "zip_code",
    "phone_number",
    "fax_number",
    "rmi_name",
    "exempt_text",
    "endorsement_text",
]


def _request_json(url: str) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.load(resp)
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected SODA response: {type(data)}")
    return data


def download_pages(*, page_size: int, limit: int | None) -> list[dict]:
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
            "$limit": str(page_limit),
            "$offset": str(offset),
            "$order": "license_number,license_type",
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
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return {
        "path": str(path).replace("\\", "/"),
        "bytes": path.stat().st_size,
        "sha256": digest,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Download Oregon CCB Active Licenses")
    p.add_argument("--out-dir", type=Path, default=Path("data/raw/or_ccb"))
    p.add_argument("--page-size", type=int, default=50000)
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    print(f"Oregon CCB open data {DATASET_ID}")
    print(f"Portal: {PORTAL_URL}")
    rows = download_pages(page_size=args.page_size, limit=args.limit)
    dest = args.out_dir / "ccb_active_licenses.csv"
    info = write_csv(dest, rows)
    print(f"Wrote {len(rows)} rows → {dest}")

    manifest = {
        "source_system": "or_ccb",
        "dataset_id": DATASET_ID,
        "portal_url": PORTAL_URL,
        "soda_endpoint": SODA_JSON,
        "row_count": len(rows),
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "file": info,
        "coverage_note": (
            "Oregon CCB Active Licenses open data. Statewide contractor licensing. "
            "Bond/insurance fields are as published — not a live COI check."
        ),
    }
    mpath = args.out_dir / "download_manifest.json"
    mpath.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {mpath}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
