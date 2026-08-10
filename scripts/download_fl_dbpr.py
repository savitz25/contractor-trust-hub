#!/usr/bin/env python3
"""Download official Florida DBPR construction public-record extracts."""

from __future__ import annotations

import argparse
import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "ContractorTrustHub/0.1 (research; https://github.com/savitz25/contractor-trust-hub)"

DEFAULTS = {
    "licensees": {
        "url": "https://www2.myfloridalicense.com/sto/file_download/extracts//CONSTRUCTIONLICENSE_1.csv",
        "filename": "CONSTRUCTIONLICENSE_1.csv",
    },
    "discipline_2425": {
        "url": "https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2425.csv",
        "filename": "contractor_disc_lic_2425.csv",
    },
}


def download(url: str, dest: Path) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=300) as resp, dest.open("wb") as out:
        h = hashlib.sha256()
        total = 0
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
            h.update(chunk)
            total += len(chunk)
    return {
        "url": url,
        "path": str(dest).replace("\\", "/"),
        "bytes": total,
        "sha256": h.hexdigest(),
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--out-dir",
        type=Path,
        default=Path("data/raw/fl_dbpr"),
    )
    p.add_argument(
        "--only",
        choices=list(DEFAULTS.keys()) + ["all"],
        default="all",
    )
    args = p.parse_args()

    keys = list(DEFAULTS.keys()) if args.only == "all" else [args.only]
    results = []
    for key in keys:
        meta = DEFAULTS[key]
        dest = args.out_dir / meta["filename"]
        print(f"Downloading {key} → {dest}")
        info = download(meta["url"], dest)
        results.append({"dataset": key, **info})
        print(f"  {info['bytes']} bytes  sha256={info['sha256'][:16]}...")

    manifest = args.out_dir / "download_manifest.json"
    manifest.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"Wrote {manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
