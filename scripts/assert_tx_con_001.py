"""TX-CON-001 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/texas-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/texas-intelligence/publication.ts").read_text(encoding="utf-8")
page = ROOT / "app/texas/page.tsx"
assert page.exists(), "missing /texas page"
assert snap["publication"]["indexable"] is True
assert snap["publication"]["robots"] == "index,follow"
assert snap["publication"]["canonical"] == "https://www.contractortrusthub.com/texas"
assert snap["fingerprint"] in pub
assert snap["version"] == "contractor-tx-state-intel-v1"
assert snap["gate"]["passed"] is True
assert snap["no_statewide_general_contractor_license"] is True
assert snap["tdlr"]["business_contractor"]["distinct_keys"] == 38915
assert snap["tsbpe"]["responsible_master_plumber"]["distinct_keys"] == 9360
assert snap["cmbl"]["match"]["EXACT"] == 0
print("assert_tx_con_001 PASS", snap["fingerprint"])
