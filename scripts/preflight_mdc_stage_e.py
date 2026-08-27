#!/usr/bin/env python3
"""Prompt 3 pre-Stage-E checks. No writes."""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402
from ingest.mdc_opendata import folio_jurisdiction, iter_jsonl, process_kind  # noqa: E402

EXPECTED_SHA = "9e9fe2d711dd8c2ec13d4832b70fe41ae9440c7a3be0b51910c22f8eb6c3effa"
EXPECTED_ROWS = 139586
JSONL = ROOT / "data/raw/mdc_opendata_permits/permits.jsonl"


def cnt(url: str, key: str, path: str, query: str = "?select=id") -> int:
    req = urllib.request.Request(url + path + query, method="GET")
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Prefer", "count=exact")
    req.add_header("Range", "0-0")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            cr = r.headers.get("Content-Range", "")
    except Exception as e:
        headers = getattr(e, "headers", None)
        cr = headers.get("Content-Range", "") if headers else ""
        if not cr:
            raise
    tail = cr.split("/")[-1]
    if not tail.isdigit():
        raise SystemExit(f"count failed {path}: {cr}")
    return int(tail)


def main() -> int:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    import os

    url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not key:
        return 2
    if not JSONL.is_file():
        print("MISSING", JSONL)
        return 2
    sha = hashlib.sha256(JSONL.read_bytes()).hexdigest()
    n = 0
    subsets = {"unincorporated": 0, "associated_county_review": 0, "county_issued_other": 0}
    for rec in iter_jsonl(JSONL):
        n += 1
        kind = process_kind(rec.get("ProcessNumber"), rec.get("PermitType"))
        if kind == "associated_county_review":
            subsets["associated_county_review"] += 1
        elif folio_jurisdiction(rec.get("FolioNumber")) == "unincorporated":
            subsets["unincorporated"] += 1
        else:
            subsets["county_issued_other"] += 1
    tables = {
        "enhanced_jurisdictions": cnt(url, key, "/rest/v1/enhanced_jurisdictions"),
        "permit_source_records": cnt(url, key, "/rest/v1/permit_source_records"),
        "permit_attributions": cnt(url, key, "/rest/v1/permit_attributions"),
        "public_contact_observations": cnt(url, key, "/rest/v1/public_contact_observations"),
        "local_credentials": cnt(url, key, "/rest/v1/local_credentials"),
    }
    out = {
        "sha256": sha,
        "sha_ok": sha == EXPECTED_SHA,
        "rows": n,
        "rows_ok": n == EXPECTED_ROWS,
        "subsets": subsets,
        "subset_ok": subsets == {
            "unincorporated": 112824,
            "associated_county_review": 23686,
            "county_issued_other": 3076,
        },
        "tables": tables,
        "stop": not (sha == EXPECTED_SHA and n == EXPECTED_ROWS),
    }
    print(json.dumps(out, indent=2))
    return 3 if out["stop"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
