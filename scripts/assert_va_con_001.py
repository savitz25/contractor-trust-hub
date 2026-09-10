"""VA-CON-001A publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/virginia-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/virginia-intelligence/publication.ts").read_text(encoding="utf-8")
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
assert (ROOT / "app/virginia/page.tsx").exists()
assert snap["version"] == "contractor-va-state-intel-v1"
assert snap["fingerprint"] in pub
assert snap["statewide_contractor_business_licensing"] is True
assert snap["business_roster"]["distinct_class_abc_licenses"] == 53840
assert snap["business_roster"]["classes_are_disjoint"] is True
assert snap["business_roster"]["file_2705a_intersect_2701"] == 0
assert snap["business_roster"]["class_a_distinct"] == 34213
assert snap["parser_audit"]["2705a"]["unresolved_malformed_rows"] == 0
assert snap["tradesmen"]["not_added_to_contractor_business_denominator"] is True
assert snap["discipline"]["name_only"] == "UNSAFE"
assert snap["discipline"]["exact_license_linked_evidence_rows"] == 120
assert snap["expansion_ledger"]["EXACT_PROFILE_ATTACHMENTS"] == 0
assert snap["clocks"]["regulant_lists_sourceAsOf_text"] == "Tuesday, September 8, 2026"
assert snap["classifications"]["do_not_assume_examples_exhaustive"] is True
assert snap["permits"]["local_routes"] is False
assert snap["gate"]["passed"] is True
assert snap["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"] == 0
assert "VA" not in metrics["liveCohort"]["liveStateCodes"]
assert "va_dpor" not in metrics["liveCohort"]["liveSourceSystems"]
print("assert_va_con_001 PASS", snap["fingerprint"])
