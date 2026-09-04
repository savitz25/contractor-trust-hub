"""AZ-CON-001 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/arizona-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/arizona-intelligence/publication.ts").read_text(encoding="utf-8")
assert (ROOT / "app/arizona/page.tsx").exists()
assert snap["version"] == "contractor-az-state-intel-v1"
assert snap["fingerprint"] in pub
assert snap["current_posting"]["all_current"] == 57886
assert snap["current_posting"]["files_are_not_additive"] is True
assert snap["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"] == 0
assert snap["gate"]["passed"] is True
assert snap["no_trust_score"] is True
assert snap["identity"]["duplicate_license_rows"] == 0
print("assert_az_con_001 PASS", snap["fingerprint"])
