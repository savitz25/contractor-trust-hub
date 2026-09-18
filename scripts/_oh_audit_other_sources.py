"""Audit Company Licensee Lookup, license-detail fields, OCILB discipline pages, PW portal, BBS designer lookup."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parents[1] / "data" / "ohio" / "audits"
OUT.mkdir(parents=True, exist_ok=True)
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36"
}


def get(url: str, timeout: int = 60) -> dict:
    try:
        r = requests.get(url, headers=UA, timeout=timeout, allow_redirects=True)
        snippet = r.text[:1500].replace("\n", " ")
        return {
            "url": url,
            "finalUrl": str(r.url),
            "status": r.status_code,
            "ctype": r.headers.get("content-type"),
            "bytes": len(r.content),
            "snippet": snippet[:800],
        }
    except Exception as exc:
        return {"url": url, "error": repr(exc)}


def main() -> None:
    urls = {
        "company_lookup": "https://apps.com.ohio.gov/dico/CompanyLicenseeLookup/",
        "company_lookup_default": "https://apps.com.ohio.gov/dico/CompanyLicenseeLookup/default.aspx",
        "license_lookup": "https://elicense4.com.ohio.gov/Lookup/LicenseLookup.aspx",
        "print_detail_sample": "https://elicense4.com.ohio.gov/Lookup/PrintLicenseDetails.aspx?cred=25589&contact=64",
        "ocilb_home": "https://com.ohio.gov/divisions-and-programs/industrial-compliance/boards/ohio-construction-industry-licensing-board",
        "ocilb_contractors": "https://com.ohio.gov/divisions-and-programs/industrial-compliance/boards/ohio-construction-industry-licensing-board/contractors-and-contracting-companies",
        "complaint": "https://com.ohio.gov/divisions-and-programs/industrial-compliance/file-a-complaint-industrial",
        "pw_portal": "https://pwr.com.ohio.gov/",
        "pw_wagehour": "https://com.ohio.gov/divisions-and-programs/industrial-compliance/wage-and-hour",
        "sfm_lookup_page": "https://com.ohio.gov/divisions-and-programs/state-fire-marshal/fireworks/guides-and-resources/state-fire-marshal-license-lookup",
        "sfm_cert": "https://com.ohio.gov/divisions-and-programs/state-fire-marshal/licensing-and-certification/guides-and-resources/fire-protection-certification",
        "bbs_certs": "https://com.ohio.gov/divisions-and-programs/industrial-compliance/boards/board-of-building-standards/certifications",
        "bbs_lpi": "https://lpi.elicense.ohio.gov/",
        "bbs_lpi_lookup": "https://elicense.lpi.ohio.gov/s/licenseshome",
        "orc_4740_13": "https://codes.ohio.gov/ohio-revised-code/section-4740.13",
        "orc_4740_01": "https://codes.ohio.gov/ohio-revised-code/section-4740.01",
        "oac_4101_7_5_01": "https://codes.ohio.gov/ohio-administrative-code/rule-4101:7-5-01",
    }
    results = {k: get(v) for k, v in urls.items()}
    (OUT / "source-probe.json").write_text(
        json.dumps({"retrievedAt": datetime.now(timezone.utc).isoformat(), "results": results}, indent=2),
        encoding="utf-8",
    )
    for k, v in results.items():
        print(k, v.get("status") or v.get("error"), v.get("finalUrl", "")[:90], (v.get("snippet") or "")[:120])


if __name__ == "__main__":
    main()
