#!/usr/bin/env python3
"""
Download Washington L&I contractor license open data (Socrata).

Dataset: data.wa.gov m8qx-ubtq
https://data.wa.gov/Labor/L-I-Contractor-License-Data-General/m8qx-ubtq

Usage:
  python scripts/download_wa_lni.py
  python scripts/download_wa_lni.py --limit 2000
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
DATASET_ID = "m8qx-ubtq"
SODA_JSON = f"https://data.wa.gov/resource/{DATASET_ID}.json"
PORTAL_URL = f"https://data.wa.gov/Labor/L-I-Contractor-License-Data-General/{DATASET_ID}"
VERIFY_URL = "https://secure.lni.wa.gov/verify/"

KEEP_FIELDS = [
    "businessname",
    "contractorlicensenumber",
    "contractorlicensetypecode",
    "contractorlicensetypecodedesc",
    "address1",
    "address2",
    "city",
    "state",
    "zip",
    "phonenumber",
    "licenseeffectivedate",
    "licenseexpirationdate",
    "businesstypecode",
    "businesstypecodedesc",
    "specialtycode1",
    "specialtycode1desc",
    "specialtycode2",
    "specialtycode2desc",
    "ubi",
    "primaryprincipalname",
    "statuscode",
    "contractorlicensestatus",
    "contractorlicensesuspenddate",
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
            "$order": "contractorlicensenumber",
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
    p = argparse.ArgumentParser(description="Download Washington L&I contractor licenses")
    p.add_argument("--out-dir", type=Path, default=Path("data/raw/wa_lni"))
    p.add_argument("--page-size", type=int, default=50000)
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    print(f"Washington L&I open data {DATASET_ID}")
    print(f"Portal: {PORTAL_URL}")
    rows = download_pages(page_size=args.page_size, limit=args.limit)
    dest = args.out_dir / "lni_contractor_licenses.csv"
    info = write_csv(dest, rows)
    print(f"Wrote {len(rows)} rows → {dest}")

    manifest = {
        "source_system": "wa_lni",
        "dataset_id": DATASET_ID,
        "portal_url": PORTAL_URL,
        "soda_endpoint": SODA_JSON,
        "verify_url": VERIFY_URL,
        "row_count": len(rows),
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "file": info,
        "coverage_note": (
            "Washington L&I contractor license open data (statewide). "
            "Status/type/specialty/UBI as published. No bond or insurance fields in this feed."
        ),
    }
    mpath = args.out_dir / "download_manifest.json"
    mpath.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {mpath}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
