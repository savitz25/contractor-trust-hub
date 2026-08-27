#!/usr/bin/env python3
"""City of Miami AHJ Stage A (+ light B/C). Distinct from Miami-Dade RER. No Stage E."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.city_of_miami_permits import parse_city_row  # noqa: E402
from ingest.enhanced_county import sha256_bytes  # noqa: E402
from ingest.mdc_opendata import iter_jsonl, parse_issued_date  # noqa: E402

JSONL = ROOT / "data/raw/city_of_miami_permits/permits.jsonl"
OUT = ROOT / "data/raw/city_of_miami_permits/stage_ad_report.json"


def main() -> int:
    if not JSONL.is_file():
        print("missing", JSONL, file=sys.stderr)
        return 2
    sha = sha256_bytes(JSONL.read_bytes())
    rows = 0
    cols: set[str] = set()
    statuses: Counter[str] = Counter()
    ns: Counter[str] = Counter()
    ident: Counter[str] = Counter()
    blank_company = 0
    val_present = 0
    keys: list[str] = []
    dates: list[str] = []
    sample = None
    for rec in iter_jsonl(JSONL):
        rows += 1
        if sample is None:
            sample = rec
        cols.update(rec.keys())
        p = parse_city_row(rec)
        ns[p["contractor_namespace"]] += 1
        ident[p["identity_state"]] += 1
        statuses[str(p["status_raw"])[:40]] += 1
        if not p.get("contractor_name_raw"):
            blank_company += 1
        if p.get("valuation") is not None:
            val_present += 1
        if p.get("permit_number"):
            keys.append(p["permit_number"])
        for k in ("PermitIssuedDate", "IssuedDate", "APPLICATIONDATE", "ApplicationDate"):
            if rec.get(k) not in (None, ""):
                d = parse_issued_date(rec.get(k))
                if d:
                    dates.append(d)
                break
    report = {
        "coverage": "CITY OF MIAMI AHJ ONLY — not Miami-Dade County permits",
        "sha256": sha,
        "row_count": rows,
        "column_count": len(cols),
        "fields": sorted(cols),
        "unique_permit_numbers": len(set(keys)),
        "duplicate_permit_numbers": len(keys) - len(set(keys)),
        "blank_company_name": blank_company,
        "valuation_coverage": val_present,
        "date_min": min(dates) if dates else None,
        "date_max": max(dates) if dates else None,
        "status_top": statuses.most_common(12),
        "namespace": dict(ns),
        "identity": dict(ident),
        "license_fields_present": [c for c in cols if "license" in c.lower() or "contractornumber" in c.lower()],
        "phone_fields_present": [c for c in cols if "phone" in c.lower()],
        "sample_keys": list(sample.keys()) if sample else [],
        "stage_e": "NOT_LOADED",
        "stage_d_note": "Name-only company fields cannot be CONFIRMED. No license number field in this layer.",
    }
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in report if k != "fields"}, indent=2)[:3500])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
