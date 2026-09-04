"""Download Tarrant Appraisal District PropertyData full set (no-charge official export)."""
from __future__ import annotations

import hashlib
import ssl
import urllib.request
from pathlib import Path

URL = "https://www.tad.org/content/data-download/PropertyData(Delimited).ZIP"
DEST = Path(r"S:\ath-raw\tx-con-local-001a\fort-worth-tarrant\PropertyData_Delimited.zip")
LAYOUT = Path(r"S:\ath-raw\tx-con-local-001a\fort-worth-tarrant\PropertyData_layout.pdf")
LAYOUT_URL = "https://www.tad.org/content/forms/PropertyData&PropertyLocationLayouts.pdf"
TP = Path(r"S:\ath-raw\tx-con-local-001a\fort-worth-tarrant\000_Tarrant_All_Taxing_Units.zip")
TP_URL = "https://www.tad.org/content/data-download/000_Tarrant_All_Taxing_Units.zip"
CTX = ssl.create_default_context()
UA = "ContractorTrustHub/TX-CON-LOCAL-001A"


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    print("GET", url, flush=True)
    with urllib.request.urlopen(req, context=CTX, timeout=1800) as res, dest.open("wb") as out:
        n = 0
        h = hashlib.sha256()
        while True:
            chunk = res.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
            h.update(chunk)
            n += len(chunk)
            if n % (20 * 1024 * 1024) < 1024 * 1024:
                print(f"  {dest.name}: {n/1e6:.1f} MB", flush=True)
    (dest.parent / f"{dest.name}.sha256").write_text(h.hexdigest() + "\n", encoding="utf-8")
    print("OK", dest.name, dest.stat().st_size, h.hexdigest(), flush=True)


if __name__ == "__main__":
    download(LAYOUT_URL, LAYOUT)
    download(URL, DEST)
    try:
        download(TP_URL, TP)
    except Exception as exc:
        print("True Prodigy extract skipped/failed:", exc, flush=True)
