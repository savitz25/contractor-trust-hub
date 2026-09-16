"""OR-CON-001 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/oregon-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/oregon-intelligence/publication.ts").read_text(encoding="utf-8")
page = (ROOT / "app/oregon/page.tsx").read_text(encoding="utf-8")
ui = (ROOT / "components/oregon/or-state-intel-page.tsx").read_text(encoding="utf-8")
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
assert (ROOT / "app/oregon/page.tsx").exists()
assert not (ROOT / "app/oregon/portland").exists()
assert not (ROOT / "app/oregon/multnomah").exists()
assert snap["version"] == "contractor-or-state-intel-v1"
assert snap["fingerprint"] == "b09a4da9e9566d52ad8b8ca6b2ce2f011e797dd5e6dd4ec308dfb3019c937fce"
assert snap["fingerprint"] in pub
assert "loadOregonContractorView" in page
assert "Oregon Contractor License" in ui
assert "not unique companies" in ui.lower() or "Not unique companies" in ui
assert "AggregateRating" not in ui
assert snap["ccb"]["SOURCE_ROWS"] == 56172
assert snap["ccb"]["DISTINCT_NONEMPTY_LICENSE_IDS"] == 45501
assert snap["hero"]["universe_value"] == 45501
assert snap["bcd"]["ENTITY_GRAIN_DISTINCT_IDS"]["BUSINESS"] == 5562
assert snap["bcd"]["ENTITY_GRAIN_DISTINCT_IDS"]["BUSINESS"] != snap["ccb"]["DISTINCT_NONEMPTY_LICENSE_IDS"]
assert snap["identity"]["EXACT_CCB_LICENSE"] == 45501
assert snap["identity"]["EXACT_SOURCE_NATIVE_CROSSWALK"] == 0
assert snap["identity"]["NAME_ONLY_UNSAFE"] == 0
assert snap["adverse_publication"]["EXACT_PROFILE_ATTACHMENTS"] == 0
assert snap["adverse_publication"]["REVIEW_REQUIRED"] == 0
assert snap["adverse_publication"]["UNRESOLVED"] is None
assert snap["adverse_publication"]["INTERNAL_ONLY"] == 0
assert snap["adverse_publication"]["PUBLICATION_PENDING"] == 0
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["expansion_ledger"]["CLAIM_ELIGIBILITY_BROADENED"] is False
assert snap["gate"]["live_cohort_not_inflated"] is True
assert "OR" in metrics["liveCohort"]["liveStateCodes"]
print("assert_or_con_001 PASS", snap["fingerprint"])
