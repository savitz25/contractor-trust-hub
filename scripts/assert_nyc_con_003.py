"""NYC-CON-003A publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/new-york-city-acris-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
dob = json.loads((ROOT / "lib/new-york-city-dob-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
dcwp = json.loads((ROOT / "lib/new-york-city-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
by_key = {m["key"]: m for m in metrics["metrics"]}
assert snap["fingerprint"] == "d02fa51c886bbe434703cd0bd0fe5446c08f27c10e9f540c062cb54c37a85135"
assert dcwp["fingerprint"] == "f2eeebd447fef501c4ebfd8dd74273a68be76e7d213ac18c6bf64e152a4a5bc2"
assert dob["fingerprint"] == "67618b431526d91ae33ffe36b717469a44ae386b611afa6980d9011068d08dc9"
assert snap["not_a_second_nyc_page"] is True
assert by_key["published_nyc_local_intelligence_pages"]["value"] == 1
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["coverage"]["state"] == "PARTIAL"
print("assert_nyc_con_003 PASS", snap["fingerprint"])
