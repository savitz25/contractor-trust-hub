"""NYC-CON-002A publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/new-york-city-dob-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
dcwp = json.loads((ROOT / "lib/new-york-city-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
by_key = {m["key"]: m for m in metrics["metrics"]}
assert snap["fingerprint"] == "d45b0d0492634786b9669a07988d228037f7b162e7a837ba605d4666c4f2a80f"
assert dcwp["fingerprint"] == "f2eeebd447fef501c4ebfd8dd74273a68be76e7d213ac18c6bf64e152a4a5bc2"
assert snap["not_a_second_nyc_page"] is True
assert by_key["published_nyc_local_intelligence_pages"]["value"] == 1
assert "NY" not in metrics["liveCohort"]["liveStateCodes"]
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["no_acris"] is True
print("assert_nyc_con_002 PASS", snap["fingerprint"])
