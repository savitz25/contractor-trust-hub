#!/usr/bin/env python3
from __future__ import annotations

import json
import urllib.parse
import urllib.request

UA = "ContractorTrustHub-NYC-CON-002A/1.0"
BASE = "https://data.cityofnewyork.us"


def soda(dataset: str, params: dict):
    req = urllib.request.Request(
        f"{BASE}/resource/{dataset}.json?" + urllib.parse.urlencode(params),
        headers={"User-Agent": UA},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    sample = soda("ipu4-2q9a", {"$select": "issuance_date,permit_si_no,job__,bbl,bin__", "$limit": "5", "$order": "issuance_date DESC"})
    print("sample", json.dumps(sample, indent=2))
    for where in [
        "issuance_date > '2024-01-01'",
        "issuance_date like '2024%'",
        "issuance_date like '09/%/2024'",
        "issuance_date >= '09/12/2024'",
        "issuance_date >= '2022-09-12T00:00:00.000' AND issuance_date < '2024-09-12T00:00:00.000'",
    ]:
        try:
            print(where, soda("ipu4-2q9a", {"$select": "count(*)", "$where": where}))
        except Exception as exc:
            print(where, "ERR", exc)


if __name__ == "__main__":
    main()
