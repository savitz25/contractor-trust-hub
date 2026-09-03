"""Follow official CSLB DownLoadFile.ashx redirect discovered by attempt 1.

This is not a fourth master strategy. HTTP/1.0 POST returned 302 to
/OnlineServices/DataPortal/DownLoadFile.ashx?fName=MasterLicenseData&type=C
and the first attempt saved the redirect body instead of the file.
"""
from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "ca_cslb_master"
ART = ROOT / "artifacts" / "ca-con-002"
BASE = "https://www.cslb.ca.gov/OnlineServices/DataPortal/DownLoadFile.ashx"
PORTAL = "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
FILES = [
    ("MasterLicenseData", "C", "follow_master.csv.part"),
    ("PersonnelData", "C", "follow_personnel.csv.part"),
    ("WorkerCompData", "C", "follow_workers_comp.csv.part"),
]
TIMEOUT = 240
CHUNK = 256 * 1024


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    sess = requests.Session()
    landing = sess.get(PORTAL, headers={"User-Agent": UA}, timeout=60)
    print("landing", landing.status_code, len(landing.text), flush=True)
    results = []
    for name, typ, dest_name in FILES:
        url = f"{BASE}?fName={name}&type={typ}"
        dest = OUT / dest_name
        print(f"\nGET {url}", flush=True)
        started = time.time()
        written = 0
        status = None
        headers: dict[str, str] = {}
        error = None
        try:
            with sess.get(
                url,
                headers={"User-Agent": UA, "Referer": PORTAL, "Accept": "*/*"},
                stream=True,
                timeout=TIMEOUT,
                allow_redirects=True,
            ) as resp:
                status = resp.status_code
                headers = dict(resp.headers)
                print("  status", status, "ctype", resp.headers.get("Content-Type"), "len", resp.headers.get("Content-Length"), "te", resp.headers.get("Transfer-Encoding"), "cd", resp.headers.get("Content-Disposition"), flush=True)
                resp.raise_for_status()
                with dest.open("wb") as fh:
                    for chunk in resp.iter_content(CHUNK):
                        if not chunk:
                            continue
                        fh.write(chunk)
                        written += len(chunk)
                        if written and written % (5 * 1024 * 1024) < CHUNK:
                            print(f"    ... {written:,} bytes", flush=True)
        except Exception as exc:  # noqa: BLE001
            error = f"{type(exc).__name__}: {exc}"
            print(f"  error after {written:,}: {error}", flush=True)
        head = dest.read_bytes()[:80] if dest.exists() else b""
        rec = {
            "name": name,
            "type": typ,
            "url": url,
            "status": status,
            "bytes": dest.stat().st_size if dest.exists() else 0,
            "written": written,
            "elapsed_s": round(time.time() - started, 2),
            "error": error,
            "content_type": headers.get("Content-Type"),
            "content_length": headers.get("Content-Length"),
            "transfer_encoding": headers.get("Transfer-Encoding"),
            "content_disposition": headers.get("Content-Disposition"),
            "accept_ranges": headers.get("Accept-Ranges"),
            "head": head[:60].decode("latin-1", errors="replace"),
            "htmlish": head.lstrip().startswith(b"<"),
            "sha256": sha256(dest) if dest.exists() and dest.stat().st_size else None,
        }
        results.append(rec)
        print("  saved", rec["bytes"], "sha", rec["sha256"], "htmlish", rec["htmlish"], flush=True)
    report = {
        "ticket": "CA-CON-002",
        "phase": "follow_official_downloadfile_redirect",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }
    (ART / "downloadfile-follow.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("wrote", ART / "downloadfile-follow.json", flush=True)


if __name__ == "__main__":
    main()
