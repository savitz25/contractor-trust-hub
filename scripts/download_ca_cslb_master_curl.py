"""Download CSLB master files using curl.exe (more reliable for large ASP.NET posts)."""
from __future__ import annotations

import hashlib
import re
import subprocess
import urllib.parse
from pathlib import Path

PORTAL = "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList"
OUT = Path("data/raw/ca_cslb_master")
COOKIE = OUT / "cookies.txt"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

KIND_EVENT = {
    "M": "ctl00$MainContent$lbMasterCSV",
    "W": "ctl00$MainContent$lbWCCSV",
    "P": "ctl00$MainContent$lbPersonnelCSV",
}
KIND_LABEL = {"M": "license_master", "W": "workers_comp", "P": "personnel"}


def curl(args: list[str]) -> subprocess.CompletedProcess:
    cmd = ["curl.exe", "-sS", "-L", "--http1.1", "-A", UA, "-c", str(COOKIE), "-b", str(COOKIE), *args]
    return subprocess.run(cmd, check=True, capture_output=True)


def hidden(name: str, html: str) -> str:
    m = re.search(rf'id="{re.escape(name)}"[^>]*value="([^"]*)"', html)
    return m.group(1) if m else ""


def post_form(fields: dict[str, str], dest: Path) -> None:
    body = urllib.parse.urlencode(fields)
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "curl.exe",
            "-sS",
            "-L",
            "--http1.1",
            "-A",
            UA,
            "-c",
            str(COOKIE),
            "-b",
            str(COOKIE),
            "-H",
            "Content-Type: application/x-www-form-urlencoded",
            "--data-raw",
            body,
            "-o",
            str(dest),
            "-D",
            str(dest) + ".headers",
            PORTAL,
        ],
        check=True,
    )


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if COOKIE.exists():
        COOKIE.unlink()
    landing = OUT / "landing.html"
    subprocess.run(
        ["curl.exe", "-sS", "-L", "--http1.1", "-A", UA, "-c", str(COOKIE), "-b", str(COOKIE), "-o", str(landing), PORTAL],
        check=True,
    )
    print("landing", landing.stat().st_size)

    for kind, label in KIND_LABEL.items():
        html = landing.read_text(encoding="utf-8", errors="replace")
        select_page = OUT / f"{label}_select.html"
        post_form(
            {
                "__EVENTTARGET": "ctl00$MainContent$ddlStatus",
                "__EVENTARGUMENT": "",
                "__LASTFOCUS": "",
                "__VIEWSTATE": hidden("__VIEWSTATE", html),
                "__VIEWSTATEGENERATOR": hidden("__VIEWSTATEGENERATOR", html),
                "__EVENTVALIDATION": hidden("__EVENTVALIDATION", html),
                "ctl00$MainContent$ddlStatus": kind,
            },
            select_page,
        )
        page = select_page.read_text(encoding="utf-8", errors="replace")
        as_of = ""
        m = re.search(r"Updated as of ([0-9/]+)", page)
        if m:
            as_of = m.group(1)
        event = KIND_EVENT[kind]
        if event not in page:
            found = re.findall(r"__doPostBack\('([^']+CSV[^']*)'", page)
            print(kind, "csv events", found)
            if found:
                event = found[0]
        dest = OUT / f"{label}.csv"
        print(kind, label, "as_of", as_of, "event", event, "posting download")
        post_form(
            {
                "__EVENTTARGET": event,
                "__EVENTARGUMENT": "",
                "__LASTFOCUS": "",
                "__VIEWSTATE": hidden("__VIEWSTATE", page),
                "__VIEWSTATEGENERATOR": hidden("__VIEWSTATEGENERATOR", page),
                "__EVENTVALIDATION": hidden("__EVENTVALIDATION", page),
                "ctl00$MainContent$ddlStatus": kind,
            },
            dest,
        )
        print("  size", dest.stat().st_size, "sha", sha256(dest), "head", dest.read_bytes()[:60])
        # refresh landing for next kind
        subprocess.run(
            ["curl.exe", "-sS", "-L", "--http1.1", "-A", UA, "-c", str(COOKIE), "-b", str(COOKIE), "-o", str(landing), PORTAL],
            check=True,
        )


if __name__ == "__main__":
    main()
