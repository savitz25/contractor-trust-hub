"""Download CSLB currently-renewed license lists by classification (max 10 per request)."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

import requests

URL = "https://www.cslb.ca.gov/onlineservices/dataportal/ListByClassification.aspx"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Origin": "https://www.cslb.ca.gov",
    "Referer": URL,
}
OUT = Path("data/raw/ca_cslb_class_lists")
BATCHES = [
    ["A"],
    ["B"],
    ["C-10"],
    ["C-36"],
    ["C-20"],
    ["C-39"],
    ["C-61"],
    ["B-2", "C-2", "C-4", "C-5", "C-6", "C-7", "C-8", "C-9", "C-11", "C-12"],
    ["C-13", "C-15", "C-16", "C-17", "C-21", "C-22", "C-23", "C-27", "C-28", "C-29"],
    ["C-31", "C-32", "C-33", "C-34", "C-35", "C-38", "C-42", "C-43", "C-45", "C-46"],
    ["C-47", "C-49", "C-50", "C-51", "C-53", "C-54", "C-55", "C-57", "C-60", "ASB"],
    ["HAZ"],
]


def hidden(name: str, html: str) -> str:
    m = re.search(rf'id="{re.escape(name)}"[^>]*value="([^"]*)"', html)
    return m.group(1) if m else ""


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sess = requests.Session()
    for i, batch in enumerate(BATCHES, start=1):
        html = sess.get(URL, headers=HEADERS, timeout=60).text
        fields: list[tuple[str, str]] = [
            ("__EVENTTARGET", "ctl00$MainContent$btnSearch"),
            ("__EVENTARGUMENT", ""),
            ("__LASTFOCUS", ""),
            ("__VIEWSTATE", hidden("__VIEWSTATE", html)),
            ("__VIEWSTATEGENERATOR", hidden("__VIEWSTATEGENERATOR", html)),
            ("__EVENTVALIDATION", hidden("__EVENTVALIDATION", html)),
            ("ctl00$MainContent$cbBondInfo", "on"),
        ]
        for cls in batch:
            fields.append(("ctl00$MainContent$lbClassification", cls))
        dest = OUT / f"batch_{i:02d}.xls"
        print("batch", i, batch)
        with sess.post(URL, data=fields, headers=HEADERS, stream=True, timeout=300) as resp:
            resp.raise_for_status()
            written = 0
            with dest.open("wb") as fh:
                for chunk in resp.iter_content(256 * 1024):
                    if not chunk:
                        continue
                    fh.write(chunk)
                    written += len(chunk)
            print("  status", resp.status_code, "ctype", resp.headers.get("Content-Type"), "bytes", written)
        head = dest.read_bytes()[:80]
        print("  head", head[:60])
        if written > 1000 and not head.lstrip().startswith(b"<"):
            print("  sha", sha256(dest))


if __name__ == "__main__":
    main()
