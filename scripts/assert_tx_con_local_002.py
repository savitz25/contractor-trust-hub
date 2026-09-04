"""TX-CON-LOCAL-002 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/texas-intelligence/local/accepted-snapshot.json").read_text(encoding="utf-8"))
idx = json.loads((ROOT / "lib/texas-intelligence/local/identity-index.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/texas-intelligence/local/publication.ts").read_text(encoding="utf-8")
assert (ROOT / "app/texas/austin/page.tsx").exists()
assert not (ROOT / "app/texas/fort-worth").exists()
assert not (ROOT / "app/texas/san-antonio").exists()
assert not (ROOT / "app/texas/houston").exists()
assert snap["version"] == "contractor-tx-austin-local-intel-v1"
assert snap["fingerprint"] in pub
assert snap["austin"]["rows"] == 2_373_854
assert snap["austin"]["exact_state_credential"] == 0
assert snap["austin"]["high_confidence_is_not_license_verification"] is True
assert snap["local_only"]["local_only_ne_unlicensed"] is True
assert snap["tcad"]["exact_geo_id_joins"] == 233085
assert snap["texas_fully_closed"] is True
assert snap["next_state"] == "WASHINGTON"
assert idx["fingerprint"] == snap["fingerprint"]
assert idx["match_class_not_on_public_identity"] is True
print("assert_tx_con_local_002 PASS", snap["fingerprint"])
