"""CA-CON-002 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/california-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/california-intelligence/publication.ts").read_text(encoding="utf-8")
page = ROOT / "app/california/page.tsx"
inv = ROOT / "public/california-inventory.json"
assert page.exists(), "missing /california page"
assert snap["publication"]["indexable"] is True
assert snap["publication"]["robots"] == "index,follow"
assert snap["publication"]["canonical"] == "https://www.contractortrusthub.com/california"
assert snap["fingerprint"] in pub
assert snap["version"] == "contractor-ca-state-intel-v1"
assert snap["license_master"]["license_rows"] == 75572
assert snap["coverage"]["status"] == "ACQUIRED_PARTIAL_STREAM_TRUNCATED"
assert snap["no_trust_score"] is True
assert inv.exists() and inv.stat().st_size > 1_000_000
print("assert_ca_con_002 PASS", snap["fingerprint"])
