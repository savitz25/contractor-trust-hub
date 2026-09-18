"""Acquire OCILB no-fee Generate Roster downloads by contractor trade.

Official flow:
  1. POST GenerateRoster.aspx with OCILB checkbox + license type
  2. Parse DownloadRoster.aspx for roster Idnt + record count
  3. GET Lookup/FileDownload.aspx?Idnt=...&Type=Comma (CSV)
Training Agency (TA / 68) is excluded.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

import requests

BASE = "https://elicense4.com.ohio.gov"
GENERATE = f"{BASE}/Lookup/GenerateRoster.aspx"
DOWNLOAD_PAGE = f"{BASE}/Lookup/DownloadRoster.aspx"
FILE_DOWNLOAD = f"{BASE}/Lookup/FileDownload.aspx"

OUT_DIR = Path(__file__).resolve().parents[1] / "data" / "ohio" / "ocilb"
RAW_DIR = OUT_DIR / "raw"

TRADES = [
    ("el", "63", "ELECTRICAL CONTRACTOR (EL)"),
    ("hv", "64", "HVAC CONTRACTOR (HV)"),
    ("hy", "65", "HYDRONICS CONTRACTOR (HY)"),
    ("pl", "66", "PLUMBING CONTRACTOR (PL)"),
    ("re", "67", "REFRIGERATION CONTRACTOR (RE)"),
]

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


class FormParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.inputs: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        d = {k: (v or "") for k, v in attrs}
        if tag != "input":
            return
        name = d.get("name")
        typ = d.get("type", "").lower()
        val = d.get("value", "")
        if not name:
            return
        if typ in {"submit", "button", "image", "checkbox", "radio"}:
            return
        self.inputs[name] = val


def hidden_fields(html: str) -> dict[str, str]:
    p = FormParser()
    p.feed(html)
    keep = {}
    for k, v in p.inputs.items():
        if k.startswith("__"):
            keep[k] = v
    return keep


def dump(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def parse_ready_rosters(html: str) -> list[dict]:
    """Parse DownloadRoster table rows: RosterIdnt, records, status."""
    rows = []
    for m in re.finditer(
        r'OpenFileDownloadWindow\((\d+),\s*document\.getElementById\(&#39;([^&]+)&#39;\)\);'
        r'.*?aria-label="Download roster ([^"]+)"'
        r'.*?<td>([^<]*)</td>'
        r'.*?(\d+)\s+records found'
        r'.*?<td[^>]*>([^<]*)</td>',
        html,
        flags=re.I | re.S,
    ):
        rows.append(
            {
                "idnt": m.group(1),
                "radioId": m.group(2),
                "aria": m.group(3).strip(),
                "name": m.group(4).strip(),
                "records": int(m.group(5)),
                "status": m.group(6).strip(),
            }
        )
    if rows:
        return rows
    # looser fallback
    for m in re.finditer(
        r'OpenFileDownloadWindow\((\d+),.*?(\d+)\s+records found.*?(Ready for Download|[^<]{0,40})',
        html,
        flags=re.I | re.S,
    ):
        rows.append(
            {
                "idnt": m.group(1),
                "records": int(m.group(2)),
                "status": m.group(3).strip(),
            }
        )
    return rows


def acquire_trade(client: requests.Session, slug: str, type_code: str, label: str) -> dict:
    print(f"\n=== GENERATE {slug.upper()} {label} code={type_code} ===", flush=True)
    r = client.get(GENERATE, timeout=90)
    r.raise_for_status()
    dump(RAW_DIR / f"{slug}_01_generate.html", r.content)
    data = hidden_fields(r.text)
    data["ctl00$MainContentPlaceHolder$ckbRoster0"] = "on"
    data["ctl00$MainContentPlaceHolder$ucSearchCriteria139$lbMultipleCredentialTypePrefix"] = type_code
    data["ctl00$MainContentPlaceHolder$ucSearchCriteria139$ddStates"] = ""
    data["ctl00$MainContentPlaceHolder$ucSearchCriteria139$ddCounty"] = ""
    data["ctl00$MainContentPlaceHolder$btnRosterContinue"] = "Continue"
    data["ctl00$MainContentPlaceHolder$cpeCriteriaExtender0_ClientState"] = "true"
    r2 = client.post(GENERATE, data=data, timeout=180, allow_redirects=True)
    r2.raise_for_status()
    dump(RAW_DIR / f"{slug}_02_download_page.html", r2.content)
    print("after continue", r2.url, "len", len(r2.content))
    rosters = parse_ready_rosters(r2.text)
    print("parsed rosters", rosters)
    if not rosters:
        rec_m = re.search(r"(\d+)\s+records found", r2.text, re.I)
        idnt_m = re.search(r"OpenFileDownloadWindow\((\d+)", r2.text)
        if not idnt_m:
            raise RuntimeError(f"no roster id for {slug}")
        rec = {
            "idnt": idnt_m.group(1),
            "records": int(rec_m.group(1)) if rec_m else None,
            "status": "unknown",
        }
        rosters = [rec]
    # newest roster is last in the table for this session
    chosen = rosters[-1]
    idnt = chosen["idnt"]
    print("downloading FileDownload Idnt", idnt, "records", chosen.get("records"))
    r3 = client.get(
        FILE_DOWNLOAD,
        params={"Idnt": idnt, "Type": "Comma"},
        timeout=300,
        allow_redirects=True,
    )
    print("file status", r3.status_code, "ctype", r3.headers.get("content-type"), "disp", r3.headers.get("content-disposition"), "len", len(r3.content))
    ctype = r3.headers.get("content-type", "")
    disp = r3.headers.get("content-disposition", "")
    if "html" in ctype.lower() or r3.content[:15].lower().startswith(b"<!doctype") or r3.content[:6].lower().startswith(b"<html"):
        dump(RAW_DIR / f"{slug}_03_file.html", r3.content)
        raise RuntimeError(f"FileDownload returned HTML for {slug} idnt={idnt}")
    ext = ".csv"
    if "excel" in ctype or "spreadsheet" in ctype or r3.content[:2] == b"PK":
        ext = ".xlsx"
    out_path = RAW_DIR / f"ocilb_{slug}_roster{ext}"
    dump(out_path, r3.content)
    digest = sha256_bytes(r3.content)
    (RAW_DIR / f"ocilb_{slug}_roster.sha256").write_text(digest + "\n", encoding="utf-8")
    head = r3.content[:400].decode("utf-8", errors="replace")
    print("head", head.replace("\n", " | ")[:300])
    return {
        "trade": slug,
        "typeCode": type_code,
        "label": label,
        "rosterIdnt": idnt,
        "sourceRecordCount": chosen.get("records"),
        "sourceStatus": chosen.get("status"),
        "path": str(out_path.relative_to(OUT_DIR.parent.parent)).replace("\\", "/"),
        "sha256": digest,
        "bytes": len(r3.content),
        "contentType": ctype,
        "disposition": disp,
        "finalUrl": r3.url,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    with requests.Session() as client:
        client.headers.update(
            {
                "User-Agent": UA,
                "Referer": GENERATE,
            }
        )
        home = client.get(BASE + "/", timeout=90)
        print("home", home.status_code, len(home.content))
        dump(RAW_DIR / "00_home.html", home.content)
        for slug, code, label in TRADES:
            rec = acquire_trade(client, slug, code, label)
            results.append(rec)
            time.sleep(1.0)
    manifest = {
        "source": GENERATE,
        "fileDownload": FILE_DOWNLOAD,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "trades": results,
    }
    (OUT_DIR / "acquire-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
