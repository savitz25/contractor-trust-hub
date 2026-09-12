#!/usr/bin/env python3
from __future__ import annotations

import json
import urllib.parse
import urllib.request

UA = "ContractorTrustHub-NYC-CON-002A/1.0"
BASE = "https://data.cityofnewyork.us"
START = "2024-09-12"


def get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def soda(dataset: str, params: dict):
    return get(f"{BASE}/resource/{dataset}.json?" + urllib.parse.urlencode(params))


def main() -> None:
    out = {}
    out["dobnow_issued_ge"] = soda("rbx6-tga4", {"$select": "count(*)", "$where": f"issued_date >= '{START}T00:00:00.000'"})
    out["dobnow_issued_lt"] = soda("rbx6-tga4", {"$select": "count(*)", "$where": f"issued_date < '{START}T00:00:00.000'"})
    out["dobnow_issued_null"] = soda("rbx6-tga4", {"$select": "count(*)", "$where": "issued_date IS NULL"})
    out["dobnow_work_types"] = soda(
        "rbx6-tga4",
        {
            "$select": "work_type,count(*) as n",
            "$group": "work_type",
            "$order": "n DESC",
            "$limit": "40",
            "$where": f"issued_date >= '{START}T00:00:00.000'",
        },
    )
    out["dobnow_permit_status"] = soda(
        "rbx6-tga4",
        {
            "$select": "permit_status,count(*) as n",
            "$group": "permit_status",
            "$order": "n DESC",
            "$limit": "20",
            "$where": f"issued_date >= '{START}T00:00:00.000'",
        },
    )
    for where in [f"issuance_date >= '{START}'", f"issuance_date >= '{START}T00:00:00.000'"]:
        try:
            out[f"legacy_{where}"] = soda("ipu4-2q9a", {"$select": "count(*)", "$where": where})
        except Exception as exc:
            out[f"legacy_{where}"] = str(exc)
    out["pluto_version"] = soda("64uk-42ks", {"$select": "version,count(*) as n", "$group": "version", "$limit": "10"})
    print(json.dumps(out, indent=2)[:8000])


if __name__ == "__main__":
    main()
