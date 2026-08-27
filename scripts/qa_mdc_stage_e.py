#!/usr/bin/env python3
"""Post-Stage-E reconciliation. No writes."""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402


def cnt(url: str, key: str, path: str, query: str) -> int:
    req = urllib.request.Request(url + path + query, method="GET")
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Prefer", "count=exact")
    req.add_header("Range", "0-0")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            cr = r.headers.get("Content-Range", "")
    except Exception as e:
        cr = getattr(e, "headers", {}).get("Content-Range", "") if getattr(e, "headers", None) else ""
    tail = cr.split("/")[-1] if cr and "/" in cr else ""
    return int(tail) if tail.isdigit() else -1


def main() -> int:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    import os

    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    out = {
        "permit_source_records": cnt(url, key, "/rest/v1/permit_source_records", "?select=id"),
        "mdc_source": cnt(
            url, key, "/rest/v1/permit_source_records", "?county_slug=eq.miami-dade&source_system=eq.mdc_opendata_issued&select=id"
        ),
        "attributions": cnt(url, key, "/rest/v1/permit_attributions", "?select=id"),
        "confirmed": cnt(url, key, "/rest/v1/permit_attributions", "?identity_state=eq.CONFIRMED&select=id"),
        "review": cnt(url, key, "/rest/v1/permit_attributions", "?identity_state=eq.REVIEW_REQUIRED&select=id"),
        "unresolved": cnt(url, key, "/rest/v1/permit_attributions", "?identity_state=eq.UNRESOLVED&select=id"),
        "high": cnt(url, key, "/rest/v1/permit_attributions", "?identity_state=eq.HIGH_CONFIDENCE&select=id"),
        "contacts": cnt(url, key, "/rest/v1/public_contact_observations", "?source_system=eq.mdc_opendata_issued&select=id"),
        "phones": cnt(
            url, key, "/rest/v1/public_contact_observations", "?source_system=eq.mdc_opendata_issued&kind=eq.phone&select=id"
        ),
        "addresses": cnt(
            url,
            key,
            "/rest/v1/public_contact_observations",
            "?source_system=eq.mdc_opendata_issued&kind=eq.mailing_address&select=id",
        ),
        "city_of_miami_source": cnt(
            url, key, "/rest/v1/permit_source_records", "?source_system=eq.city_of_miami_ibuild&select=id"
        ),
        "local_credentials": cnt(url, key, "/rest/v1/local_credentials", "?select=id"),
        "jurisdictions": cnt(url, key, "/rest/v1/enhanced_jurisdictions", "?select=id"),
        "unincorporated": cnt(
            url,
            key,
            "/rest/v1/permit_source_records",
            "?source_system=eq.mdc_opendata_issued&source_jurisdiction=eq.unincorporated&select=id",
        ),
        "associated": cnt(
            url,
            key,
            "/rest/v1/permit_source_records",
            "?source_system=eq.mdc_opendata_issued&source_jurisdiction=eq.associated_county_review&select=id",
        ),
    }
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
