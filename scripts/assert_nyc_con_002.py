"""NYC-CON-002A publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/new-york-city-dob-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
dcwp = json.loads((ROOT / "lib/new-york-city-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
by_key = {m["key"]: m for m in metrics["metrics"]}
assert snap["fingerprint"] == "67618b431526d91ae33ffe36b717469a44ae386b611afa6980d9011068d08dc9"
assert snap["expansion_ledger"]["REVIEW_REQUIRED_DOB_ACTOR_ASSOCIATIONS"] != snap["dob_now"]["parsed_rows"]
assert snap["expansion_ledger"]["NET_NEW_LOCAL_BBL_IDENTITIES"] == 66923
assert snap["expansion_ledger"]["PLUTO_MATCHED_BBL_IDENTITIES"] == 66525
assert snap["expansion_ledger"]["NET_NEW_DOBNOW_PERMIT_IDENTITIES"] == 228515
assert snap["expansion_ledger"]["NET_NEW_LEGACY_BIS_PERMIT_IDENTITIES"] == 18858
assert "EXACT_DOB_BIN_ASSOCIATIONS" not in snap["expansion_ledger"]
assert dcwp["fingerprint"] == "f2eeebd447fef501c4ebfd8dd74273a68be76e7d213ac18c6bf64e152a4a5bc2"
assert snap["not_a_second_nyc_page"] is True
assert by_key["published_nyc_local_intelligence_pages"]["value"] == 1
assert "NY" not in metrics["liveCohort"]["liveStateCodes"]
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["no_acris"] is True
print("assert_nyc_con_002 PASS", snap["fingerprint"])
