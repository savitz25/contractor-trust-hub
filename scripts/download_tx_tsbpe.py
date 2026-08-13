#!/usr/bin/env python3
"""
Download official TSBPE free licensee CSVs (updated daily).

Source: https://tsbpe.texas.gov/free-licensee-list/

Default (consumer-relevant):
  - Responsible Master Plumber (RMP) — can contract with the public
  - Master Plumber (MP)

Optional (--include-secondary):
  - Journeyman Plumber (JP)
  - Tradesman Plumber-Limited (TP)

Usage:
  python scripts/download_tx_tsbpe.py
  python scripts/download_tx_tsbpe.py --include-secondary
"""

from __future__ import annotations

import argparse
import hashlib
import json
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

USER_AGENT = "ContractorTrustHub/0.1 (research; https://github.com/savitz25/contractor-trust-hub)"
PORTAL_URL = "https://tsbpe.texas.gov/free-licensee-list/"

# Official download endpoints from the TSBPE free-licensee-list page.
DATASETS: dict[str, dict[str, str]] = {
    "rmp": {
        "label": "Responsible Master Plumber",
        "url": "https://tsbpe.texas.gov/download-csv/RMP/",
        "fallback": "https://tsbpe.texas.gov/wp-content/uploads/2015/03/RMP.csv",
        "filename": "tsbpe_rmp.csv",
        "tier": "primary",
    },
    "mp": {
        "label": "Master Plumber",
        "url": "https://tsbpe.texas.gov/download-csv/MP/",
        "fallback": "",
        "filename": "tsbpe_mp.csv",
        "tier": "primary",
    },
    "jp": {
        "label": "Journeyman Plumber",
        "url": "https://tsbpe.texas.gov/wp-content/uploads/2015/03/JP.csv.zip",
        "fallback": "",
        "filename": "tsbpe_jp.csv",
        "tier": "secondary",
    },
    "tp": {
        "label": "Tradesman Plumber-Limited",
        "url": "https://tsbpe.texas.gov/download-csv/TP/",
        "fallback": "",
        "filename": "tsbpe_tp.csv",
        "tier": "secondary",
    },
}


def _fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read()


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _maybe_unzip(payload: bytes, url: str) -> bytes:
    if url.lower().endswith(".zip") or payload[:2] == b"PK":
        with zipfile.ZipFile(BytesIO(payload)) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
            if not names:
                raise RuntimeError(f"No CSV inside zip from {url}")
            return zf.read(names[0])
    return payload


def download_one(key: str, out_dir: Path) -> dict:
    meta = DATASETS[key]
    urls = [meta["url"]]
    if meta.get("fallback"):
        urls.append(meta["fallback"])
    last_err: Exception | None = None
    payload = b""
    used = urls[0]
    for url in urls:
        try:
            print(f"  GET {url}")
            payload = _maybe_unzip(_fetch(url), url)
            used = url
            last_err = None
            break
        except (urllib.error.URLError, urllib.error.HTTPError, RuntimeError) as exc:
            last_err = exc
            print(f"    failed: {exc}")
    if last_err and not payload:
        raise RuntimeError(f"Could not download {key}: {last_err}") from last_err

    dest = out_dir / meta["filename"]
    dest.write_bytes(payload)
    # Count data rows (not header)
    text = payload.decode("utf-8", errors="replace")
    rows = max(0, text.count("\n") - 1)
    print(f"  wrote {dest} ({len(payload):,} bytes, ~{rows} rows)")
    return {
        "key": key,
        "label": meta["label"],
        "url": used,
        "file": str(dest).replace("\\", "/"),
        "bytes": len(payload),
        "approx_rows": rows,
        "sha256": _sha256_bytes(payload),
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Download official TSBPE licensee CSVs")
    p.add_argument("--out-dir", type=Path, default=Path("data/raw/tx_tsbpe"))
    p.add_argument(
        "--include-secondary",
        action="store_true",
        help="Also download Journeyman and Tradesman lists",
    )
    p.add_argument(
        "--only",
        nargs="*",
        choices=list(DATASETS),
        help="Download only these keys (rmp mp jp tp)",
    )
    args = p.parse_args(argv)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    if args.only:
        keys = list(args.only)
    else:
        keys = [k for k, v in DATASETS.items() if v["tier"] == "primary"]
        if args.include_secondary:
            keys.extend(k for k, v in DATASETS.items() if v["tier"] == "secondary")

    print("TSBPE free licensee lists")
    print(f"Portal: {PORTAL_URL}")
    print(f"Sets: {', '.join(keys)}")

    files = []
    for key in keys:
        files.append(download_one(key, args.out_dir))

    manifest = {
        "source_system": "tx_tsbpe",
        "source_board": "TSBPE",
        "source_url": PORTAL_URL,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "coverage_note": (
            "Texas plumbing is licensed by TSBPE, not TDLR. "
            "Responsible Master Plumbers may contract with the public. "
            "Not a statewide general contractor directory."
        ),
        "files": files,
    }
    man_path = args.out_dir / "download_manifest.json"
    man_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {man_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
