#!/usr/bin/env python3
"""
Download Arizona ROC current-contractor posting list CSV.

Primary page: https://roc.az.gov/posting-list

Note: roc.az.gov is often behind Cloudflare. Automated GET may return 403.
If download fails, open the posting list in a browser, download
"All Current Contractors", and place the file in data/raw/az_roc/.

Usage:
  python scripts/download_az_roc.py
  python scripts/download_az_roc.py --url https://roc.az.gov/sites/default/files/ROC_Posting-List_YYYY-MM-DD.csv
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "raw" / "az_roc"
POSTING_LIST_URL = "https://roc.az.gov/posting-list"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


def fetch(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/csv,text/html,application/xhtml+xml,*/*",
            "Referer": POSTING_LIST_URL,
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def discover_all_current_url(html: str) -> str | None:
    # Prefer All Current Contractors (not Commercial/Residential/Dual subsets)
    patterns = [
        r'href="(https://roc\.az\.gov/sites/default/files/ROC_Posting-List_\d{4}-\d{2}-\d{2}\.csv)"',
        r'href="(/sites/default/files/ROC_Posting-List_\d{4}-\d{2}-\d{2}\.csv)"',
    ]
    for pat in patterns:
        for m in re.finditer(pat, html):
            url = m.group(1)
            if "Commercial" in url or "Residential" in url or "Dual" in url:
                continue
            if url.startswith("/"):
                return "https://roc.az.gov" + url
            return url
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Download AZ ROC posting list CSV")
    ap.add_argument("--url", type=str, default=None, help="Direct CSV URL")
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = ap.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    url = args.url

    try:
        if not url:
            print(f"Fetching posting list page: {POSTING_LIST_URL}")
            html = fetch(POSTING_LIST_URL).decode("utf-8", errors="replace")
            if "Just a moment" in html or "cf-challenge" in html.lower():
                print(
                    "Cloudflare challenge on posting list page.\n"
                    "Manual steps:\n"
                    f"  1. Open {POSTING_LIST_URL} in a browser\n"
                    "  2. Download “All Current Contractors” CSV\n"
                    f"  3. Save under {args.out_dir}\n"
                    "  4. Run: python -m ingest.adapters.az_roc --input-dir data/raw/az_roc",
                    file=sys.stderr,
                )
                return 2
            url = discover_all_current_url(html)
            if not url:
                print("Could not find All Current Contractors link on page.", file=sys.stderr)
                return 1
            print(f"Discovered: {url}")

        print(f"Downloading {url} …")
        data = fetch(url)
        if data[:20].lower().startswith(b"<!doctype") or b"Just a moment" in data[:500]:
            print(
                "Download returned HTML (likely Cloudflare). Use browser download instead.",
                file=sys.stderr,
            )
            return 2
        name = url.rstrip("/").split("/")[-1] or "ROC_Posting-List.csv"
        out = args.out_dir / name
        out.write_bytes(data)
        print(f"Wrote {out} ({len(data):,} bytes)")
        return 0
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.reason}", file=sys.stderr)
        print(
            f"Place a browser-downloaded All Current Contractors CSV in {args.out_dir}",
            file=sys.stderr,
        )
        return 2
    except Exception as e:
        print(f"Download failed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
