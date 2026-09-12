"""NYC-CON-001A publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/new-york-city-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/new-york-city-intelligence/publication.ts").read_text(encoding="utf-8")
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
assert (ROOT / "app/new-york/new-york-city/page.tsx").exists()
assert snap["version"] == "contractor-nyc-dcwp-intel-v1"
assert snap["fingerprint"] == "f2eeebd447fef501c4ebfd8dd74273a68be76e7d213ac18c6bf64e152a4a5bc2"
assert snap["fingerprint"] in pub
assert snap["licenses"]["active_distinct_license_ids"] == 13385
assert snap["licenses"]["parsed_rows"] == 18931
assert snap["not_statewide_nysdol_public_work"] is True
assert snap["expansion_ledger"]["EXACT_PROFILE_ATTACHMENTS"] == 0
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"] == 0
assert snap["gate"]["passed"] is True
assert snap["gate"]["live_cohort_not_inflated"] is True
assert "NY" not in metrics["liveCohort"]["liveStateCodes"]
assert "nyc_dcwp" not in metrics["liveCohort"]["liveSourceSystems"]
print("assert_nyc_con_001 PASS", snap["fingerprint"])
