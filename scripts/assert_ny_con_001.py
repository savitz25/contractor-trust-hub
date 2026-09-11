"""NY-CON-001A publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/new-york-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/new-york-intelligence/publication.ts").read_text(encoding="utf-8")
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
assert (ROOT / "app/new-york/page.tsx").exists()
assert snap["version"] == "contractor-ny-state-intel-v1"
assert snap["fingerprint"] in pub
assert snap["registry"]["parsed_rows"] == 14665
assert snap["registry"]["distinct_certificate_ids"] == 14665
assert snap["not_statewide_gc_or_hic_license"] is True
assert snap["geography"]["out_of_state_mailing_address_rows"] == 2299
assert snap["debarment"]["name_only_attachment"] == "UNSAFE"
assert snap["expansion_ledger"]["EXACT_PROFILE_ATTACHMENTS"] == 0
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["gate"]["passed"] is True
assert snap["gate"]["live_cohort_not_inflated"] is True
assert "NY" not in metrics["liveCohort"]["liveStateCodes"]
assert "ny_dol_pw" not in metrics["liveCohort"]["liveSourceSystems"]
print("assert_ny_con_001 PASS", snap["fingerprint"])
