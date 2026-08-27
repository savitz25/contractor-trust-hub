#!/usr/bin/env python3
"""Stage A–D for Miami-Dade Open Data. Refuses Stage E. No production writes."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402
from ingest.mdc_opendata import (  # noqa: E402
    contact_observations,
    stage_a,
    stage_b,
    stage_c,
    stage_d,
)

JSONL = ROOT / "data/raw/mdc_opendata_permits/permits.jsonl"
OUT = ROOT / "data/raw/mdc_opendata_permits/stage_ad_report.json"


def rest_in(url: str, key: str, values: list[str]) -> set[str]:
    found: set[str] = set()
    # PostgREST URL length: batches of 80.
    for i in range(0, len(values), 80):
        chunk = values[i : i + 80]
        quoted = ",".join(urllib.parse.quote(v, safe="") for v in chunk)
        q = f"/rest/v1/licenses?select=external_key&source_system=eq.fl_dbpr&external_key=in.({quoted})"
        req = urllib.request.Request(url + q, method="GET")
        req.add_header("apikey", key)
        req.add_header("Authorization", "Bearer " + key)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                rows = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print("lookup HTTP", e.code, e.read()[:200], file=sys.stderr)
            continue
        for r in rows:
            if r.get("external_key"):
                found.add(r["external_key"].upper())
    return found


def main() -> int:
    if not JSONL.is_file():
        print(f"missing {JSONL}", file=sys.stderr)
        return 2
    audit = stage_a(JSONL)
    print("stage A rows", audit["row_count"], "sha", audit["sha256"][:16], flush=True)
    parsed = stage_b(JSONL)
    print("stage B parsed", len(parsed), flush=True)
    dbpr_ids = sorted(
        {
            p["contractor_license_normalized"]
            for p in parsed
            if p.get("contractor_namespace") == "DBPR_FULL_PREFIXED" and p.get("contractor_license_normalized")
        }
    )
    known: set[str] = set()
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    import os

    url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if url and key and dbpr_ids:
        print("looking up", len(dbpr_ids), "distinct DBPR-prefixed ids", flush=True)
        known = rest_in(url, key, dbpr_ids)
        print("warehouse hits", len(known), flush=True)
    parsed = stage_c(parsed, known_dbpr=known)
    contacts = contact_observations(parsed)
    report = stage_d(parsed, audit, contacts)
    report["audit"] = audit
    report["distinct_dbpr_prefixed"] = len(dbpr_ids)
    report["warehouse_hits"] = len(known)
    report["examples"] = {
        ns: next((p["contractor_license_normalized"] for p in parsed if p["contractor_namespace"] == ns), None)
        for ns in report["namespace"]
    }
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in report if k != "audit"}, indent=2)[:4000])
    print("wrote", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
