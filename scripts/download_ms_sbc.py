#!/usr/bin/env python3
"""
Download the official MSBOC public contractor list.

Source: http://search.msboc.us/ConsolidatedSearch.cfm
Results: http://search.msboc.us/ConsolidatedResults.cfm
The board publishes "View Results In Excel" on that results page.

This script:
  1) Tries the official Excel export parameter(s)
  2) Falls back to paginating the official HTML results table
     (max 250 rows/page as offered on the Advanced Search form)

Cloudflare may block datacenter IPs. Run from a normal browser network
if the download returns a challenge page.

Usage:
  python scripts/download_ms_sbc.py
  python scripts/download_ms_sbc.py --limit 100
  python scripts/download_ms_sbc.py --status active
  python scripts/download_ms_sbc.py --from-file path/to/official_excel_or_csv
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

USER_AGENT = (
    "Mozilla/5.0 (compatible; ContractorTrustHub/0.1; "
    "+https://github.com/savitz25/contractor-trust-hub)"
)
BASE = "http://search.msboc.us"
SEARCH_URL = f"{BASE}/ConsolidatedSearch.cfm"
RESULTS_PATH = f"{BASE}/ConsolidatedResults.cfm"
VERIFY_NOTE = "https://www.msboc.us/consumers/hire-a-contractor/"

FIELDS = [
    "ContractorType",
    "CompanyName",
    "LicenseNumber",
    "Status",
    "Address",
    "City",
    "State",
    "Zip",
    "Phone",
    "ClassCode",
    "Qualifier",
]


def _get(url: str, timeout: int = 90) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        ctype = resp.headers.get("Content-Type", "")
        return resp.read(), ctype


def looks_like_challenge(raw: bytes) -> bool:
    head = raw[:800].decode("utf-8", errors="replace").lower()
    return "just a moment" in head or "cf-chl" in head or "challenge-platform" in head


class ResultsTableParser(HTMLParser):
    """Parse the official ConsolidatedResults HTML table."""

    def __init__(self) -> None:
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.cell = ""
        self.row: list[str] = []
        self.rows: list[list[str]] = []
        self.total: int | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self.in_table = True
        elif self.in_table and tag == "tr":
            self.in_row = True
            self.row = []
        elif self.in_row and tag in {"td", "th"}:
            self.in_cell = True
            self.cell = ""

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.in_cell:
            self.row.append(re.sub(r"\s+", " ", self.cell).strip())
            self.in_cell = False
            self.cell = ""
        elif tag == "tr" and self.in_row:
            if self.row:
                self.rows.append(self.row)
            self.in_row = False
        elif tag == "table":
            self.in_table = False

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cell += data
        m = re.search(r"Records\s+\d+\s+through\s+\d+\s+of\s+(\d+)", data, re.I)
        if m:
            self.total = int(m.group(1))


_LICENSE_STATUS_RE = re.compile(
    r"^(?P<lic>\S+)\s+"
    r"(?P<status>Licensed(?:\s+Expired)?|Licensed\s*-\s*Active|Licensed\s*-\s*Inactive|"
    r"Revoked|Suspended|Unlicensed(?:\s+Expired)?|Inactive)\s*$",
    re.I,
)


def _split_license_status(raw: str) -> tuple[str, str]:
    """Official Excel puts '12730-SC Licensed Expired' in one License Number cell."""
    text = re.sub(r"\s+", " ", (raw or "")).strip()
    if not text:
        return "", ""
    m = _LICENSE_STATUS_RE.match(text)
    if m:
        return m.group("lic").strip(), re.sub(r"\s+", " ", m.group("status")).strip()
    return text, ""


def parse_html_rows(html: str) -> tuple[list[dict[str, str]], int | None]:
    # Official Excel export has a broken Address header: <td Address</td>
    html = re.sub(r"<td\s+Address\s*</td>", "<td>Address</td>", html, flags=re.I)
    p = ResultsTableParser()
    p.feed(html)
    out: list[dict[str, str]] = []
    header_idx = None
    for i, row in enumerate(p.rows):
        joined = " ".join(row).lower()
        if "company name" in joined and "license" in joined:
            header_idx = i
            break
    if header_idx is None:
        return out, p.total
    headers = [h.lower() for h in p.rows[header_idx]]

    def col(*names: str) -> int | None:
        for n in names:
            for i, h in enumerate(headers):
                if n in h:
                    return i
        return None

    i_type = col("type")
    i_name = col("company")
    i_lic = col("license")
    i_addr = col("address")
    # Positional fallback when the Address header cell is empty / broken.
    if i_addr is None and i_lic is not None:
        i_addr = i_lic + 1
    i_city = col("city")
    i_state = col("state")
    i_zip = col("zip")
    i_phone = col("phone")
    i_status = col("status")
    i_class = col("class")
    i_qual = col("qualif")

    for row in p.rows[header_idx + 1 :]:
        def g(idx: int | None) -> str:
            if idx is None or idx >= len(row):
                return ""
            return row[idx].strip()

        # Official Excel: "16945-MC Licensed" / "02730 Licensed Expired" in one cell.
        lic_raw, status_from_lic = _split_license_status(g(i_lic))
        status = g(i_status) or status_from_lic
        if not status:
            m = re.search(
                r"(Licensed(?:\s+Expired)?|Licensed\s*-\s*Active|Licensed\s*-\s*Inactive|"
                r"Revoked|Suspended|Unlicensed(?:\s+Expired)?|Inactive)",
                " ".join(row),
                re.I,
            )
            if m:
                status = re.sub(r"\s+", " ", m.group(1)).strip()
        name = g(i_name)
        if name.lower() in {"view", "type", ""}:
            # First cell is often a View link; company is next.
            if i_name is not None and i_name + 1 < len(row) and not name:
                name = row[i_name + 1].strip()
        if name.lower() == "view" and i_type is not None:
            # Pattern: View | Commercial | COMPANY | 12345-MC | Licensed | address
            if len(row) >= 4:
                name = row[2].strip() if row[1].lower() in {"commercial", "residential"} else name
        rec = {
            "ContractorType": g(i_type),
            "CompanyName": name,
            "LicenseNumber": lic_raw,
            "Status": status,
            "Address": g(i_addr),
            "City": g(i_city),
            "State": g(i_state),
            "Zip": g(i_zip),
            "Phone": g(i_phone),
            "ClassCode": g(i_class),
            "Qualifier": g(i_qual),
        }
        # Recover type from a leading "Commercial"/"Residential" cell.
        if not rec["ContractorType"]:
            for cell in row:
                if cell.lower() in {"commercial", "residential"} or cell.lower().startswith(
                    "residential"
                ):
                    rec["ContractorType"] = cell
                    break
        if rec["CompanyName"].lower() in {"view", "company name", ""}:
            continue
        if not rec["LicenseNumber"] and not rec["CompanyName"]:
            continue
        out.append(rec)
    return out, p.total


def results_url(*, startrow: int, maxrecords: int, status: str) -> str:
    params = {
        "ContractorType": "",
        "maxrecords": str(maxrecords),
        "varDataSource": "BOC",
        "Keyword": "",
        "ClassCode": "",
        "Co_Name": "",
        "Lic": "",
        "searchType": "",
        "Advanced": "1",
        "SearchStatus": status,
        "OrderBy": "Co_Name",
        "startrow": str(startrow),
    }
    return f"{RESULTS_PATH}?{urllib.parse.urlencode(params)}"


def _from_local_file(src: Path, out_dir: Path) -> int:
    if not src.exists():
        raise SystemExit(f"Missing official file: {src}")
    raw = src.read_bytes()
    if looks_like_challenge(raw):
        raise SystemExit("Saved file looks like a Cloudflare challenge page, not the official list.")
    text = raw.decode("utf-8", errors="replace")
    rows: list[dict[str, str]] = []
    suffix = src.suffix.lower()
    if suffix in {".csv", ".txt"}:
        import io

        reader = csv.DictReader(io.StringIO(text))
        for rec in reader:
            rows.append({k: (v or "").strip() if isinstance(v, str) else "" for k, v in rec.items()})
    else:
        # ColdFusion "Excel" is often an HTML table with an .xls extension.
        rows, _ = parse_html_rows(text)
        if not rows and suffix in {".xls", ".xlsx"}:
            raise SystemExit(
                "Could not parse that Excel as the official HTML-table export. "
                "Save the board page as CSV, or open it and export CSV, then re-run --from-file."
            )
    dest = out_dir / "msboc_contractor_list.csv"
    info = write_csv(dest, rows)
    print(f"Imported {len(rows)} official rows from {src} → {dest}")
    manifest = {
        "source_system": "ms_sbc",
        "search_url": SEARCH_URL,
        "results_url": RESULTS_PATH,
        "verify_page": VERIFY_NOTE,
        "row_count": len(rows),
        "imported_from": str(src).replace("\\", "/"),
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "file": info,
        "coverage_note": (
            "Official MSBOC public list imported from a locally saved board export. "
            "No bond, insurance, or discipline fields invented."
        ),
    }
    mpath = out_dir / "download_manifest.json"
    out_dir.mkdir(parents=True, exist_ok=True)
    mpath.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {mpath}")
    return 0


def write_csv(path: Path, rows: list[dict[str, str]]) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k) or "" for k in FIELDS})
    return {
        "path": str(path).replace("\\", "/"),
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "row_count": len(rows),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Download official MSBOC public contractor list")
    ap.add_argument("--out-dir", type=Path, default=Path("data/raw/ms_sbc"))
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--page-size", type=int, default=250, help="Official form allows up to 250")
    ap.add_argument(
        "--status",
        default="",
        help="SearchStatus value (empty=all). Active filter example: 'Licensed - Active'",
    )
    ap.add_argument("--sleep", type=float, default=0.4)
    ap.add_argument(
        "--from-file",
        type=Path,
        default=None,
        help="Official Excel / CSV / HTML table saved from the board's View Results In Excel",
    )
    args = ap.parse_args(argv)

    print("Mississippi State Board of Contractors — official public search")
    print(f"Search: {SEARCH_URL}")
    print(f"Results: {RESULTS_PATH}")

    if args.from_file:
        return _from_local_file(args.from_file, args.out_dir)

    rows: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    start = 1
    total = None
    pages = 0
    while True:
        url = results_url(startrow=start, maxrecords=args.page_size, status=args.status)
        print(f"  GET startrow={start} …")
        try:
            raw, ctype = _get(url)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"MSBOC HTTP {e.code}: {e.read()[:200]!r}") from e
        if looks_like_challenge(raw):
            raise SystemExit(
                "MSBOC search returned a Cloudflare challenge. "
                "The official list is public at search.msboc.us — re-run this script "
                "from a network that can open the search in a browser, or save the "
                "board's 'View Results In Excel' file into data/raw/ms_sbc/."
            )
        html = raw.decode("utf-8", errors="replace")
        page_rows, page_total = parse_html_rows(html)
        if page_total:
            total = page_total
        if not page_rows:
            print("  no table rows on this page — stopping")
            break
        for r in page_rows:
            key = (r.get("LicenseNumber") or "", r.get("CompanyName") or "")
            if key in seen:
                continue
            seen.add(key)
            rows.append(r)
            if args.limit is not None and len(rows) >= args.limit:
                break
        pages += 1
        if args.limit is not None and len(rows) >= args.limit:
            break
        if len(page_rows) < args.page_size:
            break
        if total is not None and start + args.page_size > total:
            break
        start += args.page_size
        time.sleep(args.sleep)

    dest = args.out_dir / "msboc_contractor_list.csv"
    info = write_csv(dest, rows)
    print(f"Wrote {len(rows)} rows → {dest}")
    manifest = {
        "source_system": "ms_sbc",
        "search_url": SEARCH_URL,
        "results_url": RESULTS_PATH,
        "verify_page": VERIFY_NOTE,
        "row_count": len(rows),
        "board_total_hint": total,
        "pages_fetched": pages,
        "status_filter": args.status or "(all statuses offered on the public search)",
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "file": info,
        "coverage_note": (
            "Official MSBOC public consolidated search list. "
            "Commercial / residential type as published. "
            "Specialty class codes and qualifying parties appear on the Advanced Search "
            "and detail views when present — not invented. "
            "No bond, insurance, or discipline fields on the list view."
        ),
    }
    mpath = args.out_dir / "download_manifest.json"
    mpath.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {mpath}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
