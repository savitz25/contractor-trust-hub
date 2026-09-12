#!/usr/bin/env python3
from __future__ import annotations

import json
import urllib.parse
import urllib.request

UA = "ContractorTrustHub-NYC-CON-002A/1.0"
BASE = "https://data.cityofnewyork.us"


def soda(params: dict):
    req = urllib.request.Request(
        f"{BASE}/resource/ipu4-2q9a.json?" + urllib.parse.urlencode(params),
        headers={"User-Agent": UA},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    sample = soda({"$select": "issuance_date", "$limit": "8", "$where": "issuance_date IS NOT NULL"})
    print("dates", sample)
    for year in ["2022", "2023", "2024", "2025", "2026"]:
        print(year, soda({"$select": "count(*)", "$where": f"issuance_date like '%/{year}'"}))


if __name__ == "__main__":
    main()
