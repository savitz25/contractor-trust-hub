"""CA-CON-COUNTY-001A harvest assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rep = json.loads((ROOT / "data/california/counties/sf-sd/harvest-report.json").read_text(encoding="utf-8"))
assert (ROOT / "app/california/san-francisco/page.tsx").exists()
assert not (ROOT / "app/california/san-francisco-county").exists()
assert not (ROOT / "app/california/san-diego-county").exists()
assert (ROOT / "app/california/page.tsx").exists()
assert rep["cslb_spine"]["rows"] == 75572
assert rep["sf_building_permits"]["rows"] == 1_294_909
assert rep["sf_permit_contacts"]["distinct_exact_match_acquired_cslb"] == 2729
assert rep["totals"]["name_only_auto_attach"] == 0
assert rep["sd_city_approvals"]["not_san_diego_county_permits"] is True
print("assert_ca_con_county_001a PASS")
