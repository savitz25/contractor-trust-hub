#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402


def get(url: str, key: str, path: str) -> object:
    req = urllib.request.Request(url + "/rest/v1/" + path, method="GET")
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> int:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    import os

    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    # Use RPC-less: sample via permit_attributions join is hard in PostgREST.
    # Confirmed last-12 via issue_date filter on source + we cannot join easily.
    # Fetch issue_date for confirmed by embedding.
    # Confirmed subset metrics via embed (inner join).
    def cnt(path: str) -> int:
        req = urllib.request.Request(url + "/rest/v1/" + path, method="GET")
        req.add_header("apikey", key)
        req.add_header("Authorization", "Bearer " + key)
        req.add_header("Prefer", "count=exact")
        req.add_header("Range", "0-0")
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                cr = r.headers.get("Content-Range", "")
        except Exception as e:
            cr = e.headers.get("Content-Range", "") if getattr(e, "headers", None) else ""
        tail = cr.split("/")[-1] if cr and "/" in cr else ""
        return int(tail) if tail.isdigit() else -1

    q = (
        "permit_source_records?source_system=eq.mdc_opendata_issued"
        "&select=id,permit_attributions!inner(identity_state)"
        "&permit_attributions.identity_state=eq.CONFIRMED"
    )
    print("confirmed_join", cnt(q))
    print(
        "confirmed_last12",
        cnt(q + "&issue_date=gte.2025-08-26"),
    )
    print(
        "confirmed_uninc",
        cnt(q + "&source_jurisdiction=eq.unincorporated"),
    )
    print(
        "confirmed_assoc",
        cnt(q + "&source_jurisdiction=eq.associated_county_review"),
    )
    print(
        "confirmed_valuation",
        cnt(q + "&valuation=not.is.null"),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
