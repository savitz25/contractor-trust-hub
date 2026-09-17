#!/usr/bin/env python3
"""PA-CON-001 — acquire official public Pennsylvania contractor sources. Network only."""
from __future__ import annotations

import hashlib
import json
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/pennsylvania/pa-con-001/raw"
UA = "ContractorTrustHub/pa-con-001 (research; +https://www.contractortrusthub.com)"
CTX = ssl.create_default_context()

URLS = {
    "asbcontr.htm": "https://www.pa.gov/content/dam/copapwp-pagov/en/dli/documents/individuals/labor-management-relations/bois/documents/asbcontr.htm",
    "asbcert.htm": "https://www.pa.gov/content/dam/copapwp-pagov/en/dli/documents/individuals/labor-management-relations/bois/documents/asbcert.htm",
    "ledcontr.htm": "https://www.pa.gov/content/dam/copapwp-pagov/en/dli/documents/individuals/labor-management-relations/bois/documents/ledcontr.htm",
    "ledcert.htm": "https://www.pa.gov/content/dam/copapwp-pagov/en/dli/documents/individuals/labor-management-relations/bois/documents/ledcert.htm",
    "debarments.html": "https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/labor-law/prevailing-wage/debarments-and-settlements",
    "contractor-licensing.html": "https://www.pa.gov/agencies/dli/programs-services/labor-management-relations/bureau-of-occupational-and-industrial-safety/uniform-construction-code-home/contractor-licensing",
    "hicpa-registration.html": "https://www.attorneygeneral.gov/businesses-and-organizations/home-improvement-contractor-registration/",
    "hicsearch.html": "https://hicsearch.attorneygeneral.gov/",
}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    with urllib.request.urlopen(req, context=CTX, timeout=90) as resp:
        return resp.read()


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    retrieved = now()
    files = {}
    for name, url in URLS.items():
        data = get(url)
        dest = RAW / name
        dest.write_bytes(data)
        files[name] = {
            "url": url,
            "path": str(dest.relative_to(ROOT)).replace("\\", "/"),
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
        print(name, files[name]["bytes"], files[name]["sha256"][:16])
    report = {
        "ticket": "PA-CON-001",
        "retrievedAt": retrieved,
        "hicpa_bulk": {
            "status": "OPEN_SEARCH_ONLY",
            "reason": "Official HIC search requires Cloudflare Turnstile before Search/Excel export. Statewide enumeration would require CAPTCHA circumvention.",
            "search_url": "https://hicsearch.attorneygeneral.gov/",
            "active_only": True,
            "xlsx_export": "results of a completed search, not a public bulk census",
        },
        "files": files,
    }
    (RAW / "acquire-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("acquired", retrieved)


if __name__ == "__main__":
    main()
