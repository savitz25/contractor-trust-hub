"""Download CSLB statewide public master files (License Master, WC, Personnel).

Official free CSV extracts from
https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList

Universe: currently renewed OR expired-but-renewable (BPC 7141, 5-year window).
Cancelled, revoked, and expired-nonrenewable licenses are NOT included.
Emails are not provided (BPC 27).
"""
from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path

import requests

PORTAL = "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.cslb.ca.gov",
    "Referer": PORTAL,
}
KIND_EVENT = {
    "M": "ctl00$MainContent$lbMasterCSV",
    "W": "ctl00$MainContent$lbWorkerCompcsv",
    "P": "ctl00$MainContent$lbPersonnelCSV",
}
KIND_LABEL = {"M": "license_master", "W": "workers_comp", "P": "personnel"}


def hidden(name: str, html: str) -> str:
    m = re.search(rf'id="{re.escape(name)}"[^>]*value="([^"]*)"', html)
    return m.group(1) if m else ""


def form(html: str, extra: dict[str, str]) -> dict[str, str]:
    fields = {
        "__EVENTTARGET": extra.get("__EVENTTARGET", ""),
        "__EVENTARGUMENT": extra.get("__EVENTARGUMENT", ""),
        "__LASTFOCUS": "",
        "__VIEWSTATE": hidden("__VIEWSTATE", html),
        "__VIEWSTATEGENERATOR": hidden("__VIEWSTATEGENERATOR", html),
        "__EVENTVALIDATION": hidden("__EVENTVALIDATION", html),
    }
    fields.update(extra)
    return fields


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def stream_post(sess: requests.Session, fields: dict[str, str], dest: Path) -> requests.Response:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with sess.post(PORTAL, data=fields, headers=HEADERS, stream=True, timeout=600) as resp:
        resp.raise_for_status()
        written = 0
        with dest.open("wb") as fh:
            for chunk in resp.iter_content(chunk_size=256 * 1024):
                if not chunk:
                    continue
                fh.write(chunk)
                written += len(chunk)
                if written and written % (5 * 1024 * 1024) < 256 * 1024:
                    print(f"    ... {written:,} bytes")
        print("    headers ctype", resp.headers.get("Content-Type"), "disp", resp.headers.get("Content-Disposition"))
        return resp


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data/raw/ca_cslb_master")
    ap.add_argument("--kinds", default="M,W,P")
    args = ap.parse_args()
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    sess = requests.Session()
    landing = sess.get(PORTAL, headers=HEADERS, timeout=60)
    landing.raise_for_status()
    print("landing", landing.status_code, len(landing.text))

    for kind in [k.strip() for k in args.kinds.split(",") if k.strip()]:
        label = KIND_LABEL[kind]
        html = sess.get(PORTAL, headers=HEADERS, timeout=60).text
        select = sess.post(
            PORTAL,
            data=form(html, {"__EVENTTARGET": "ctl00$MainContent$ddlStatus", "ctl00$MainContent$ddlStatus": kind}),
            headers=HEADERS,
            timeout=60,
        )
        select.raise_for_status()
        page = select.text
        (out / f"{label}_select.html").write_text(page, encoding="utf-8")
        as_of_m = re.search(r"Updated as of ([0-9/]+)", page)
        as_of = as_of_m.group(1) if as_of_m else ""
        event = KIND_EVENT[kind]
        if event not in page:
            found = re.findall(r"__doPostBack\('([^']+)'", page)
            print(kind, "events", found)
            csv_events = [e for e in found if "csv" in e.lower() or "CSV" in e]
            if csv_events:
                event = csv_events[0]
        print(kind, label, "as_of", as_of, "event", event)
        dest = out / f"{label}.csv"
        tmp = out / f"{label}.part"
        stream_post(
            sess,
            form(
                page,
                {
                    "__EVENTTARGET": event,
                    "ctl00$MainContent$ddlStatus": kind,
                },
            ),
            tmp,
        )
        head = tmp.read_bytes()[:80]
        print("  head", head)
        if head.lstrip().startswith(b"<") or tmp.stat().st_size < 1000:
            tmp.replace(out / f"{label}_download.html")
            print("  got HTML / tiny payload")
            continue
        tmp.replace(dest)
        print("  saved", dest.name, dest.stat().st_size, sha256(dest))


if __name__ == "__main__":
    main()
