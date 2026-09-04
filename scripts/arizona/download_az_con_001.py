"""AZ-CON-001 download official ROC posting-list files. No search crawl."""
from __future__ import annotations

import ssl
import urllib.error
import urllib.request
from pathlib import Path

CTX = ssl.create_default_context()
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/csv,text/html,*/*",
    "Referer": "https://roc.az.gov/posting-list",
}
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "raw" / "az_roc"
FILES = {
    "all_current": "https://roc.az.gov/sites/default/files/ROC_Posting-List_2026-09-02.csv",
    "commercial": "https://roc.az.gov/sites/default/files/ROC_Posting-List_Commercial_2026-09-02.csv",
    "dual": "https://roc.az.gov/sites/default/files/ROC_Posting-List_Dual_2026-09-02.csv",
    "residential": "https://roc.az.gov/sites/default/files/ROC_Posting-List_Residential_2026-09-02.csv",
    "new_licenses": "https://roc.az.gov/sites/default/files/ROC_New-Licenses-List_2026-09-02.csv",
    "disciplinary": "https://roc.az.gov/sites/default/files/ROC_Disciplinary-Actions_2026-09-02.csv",
    "pending": "https://roc.az.gov/sites/default/files/ROC_Pending-Applications_2026-09-02.csv",
    "unlicensed_2y": "https://roc.az.gov/sites/default/files/ROC_Unlicensed-Violators-List_2026-09-02.csv",
    "unlicensed_all": "https://roc.az.gov/sites/default/files/ROC_Unlicensed-Violators-List_All-Time_2026-09-02.csv",
}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180, context=CTX) as resp:
        return resp.read()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, url in FILES.items():
        name = url.rsplit("/", 1)[-1]
        dest = OUT / name
        try:
            data = get(url)
        except urllib.error.HTTPError as e:
            print(f"FAIL {key} HTTP {e.code} {url}")
            continue
        except Exception as e:
            print(f"FAIL {key} {type(e).__name__} {e}")
            continue
        if data[:15].lower().startswith(b"<!doctype") or b"Just a moment" in data[:400]:
            print(f"FAIL {key} html/cloudflare {url}")
            continue
        dest.write_bytes(data)
        print(f"OK {key} {dest.name} {len(data)} bytes")


if __name__ == "__main__":
    main()
