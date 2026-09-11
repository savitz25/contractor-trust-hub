"""IL-CON-001 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACQ = json.loads((ROOT / "data/illinois/il-con-001/acquire-report.json").read_text(encoding="utf-8"))
snap = json.loads((ROOT / "lib/illinois-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/illinois-intelligence/publication.ts").read_text(encoding="utf-8")
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
assert (ROOT / "app/illinois/page.tsx").exists()
assert not (ROOT / "app/illinois/chicago").exists()
assert not (ROOT / "app/illinois/cook").exists()
assert snap["version"] == "contractor-il-state-intel-v1"
assert snap["fingerprint"] == "a9f63e7625d25fd64e4fe95b15f558a49fc719376154be481fdd062042dd0235"
assert snap["fingerprint"] in pub
assert snap["roofing"]["source_rows"] == 33891
assert snap["roofing"]["distinct_license_ids"] == 33290
assert snap["roofing"]["source_rows"] != snap["roofing"]["distinct_license_ids"]
assert snap["business_licenses"]["active_business_y_rows"] == 4891
assert snap["business_licenses"]["active_business_y_distinct_license_ids"] == 4675
assert snap["hero"]["universe_value"] == 4675
assert snap["hero"]["universe_value"] != snap["business_licenses"]["active_business_y_rows"]
assert snap["qualifying_parties"]["not_added_to_business_denominator"] is True
assert snap["discipline"]["not_master_dataset_discipline_counts"] is True
assert snap["discipline"]["distinct_case_ids"] == 789
assert ACQ["full_professional_dataset_acquisition"] == "NOT_PERFORMED"
assert ACQ["full_professional_csv_access"] == "CONFIRMED"
assert ACQ["count_consistent"] is True
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["gate"]["live_cohort_not_inflated"] is True
assert "IL" not in metrics["liveCohort"]["liveStateCodes"]
assert "il_idfpr_roofing" not in metrics["liveCohort"]["liveSourceSystems"]
print("assert_il_con_001 PASS", snap["fingerprint"])
