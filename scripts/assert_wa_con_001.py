"""WA-CON-001 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/washington-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
with (ROOT / "lib/washington-intelligence/identity-index.json").open("r", encoding="utf-8") as _fh:
    idx_head = _fh.read(800)
pub = (ROOT / "lib/washington-intelligence/publication.ts").read_text(encoding="utf-8")
assert (ROOT / "app/washington/page.tsx").exists()
assert snap["version"] == "contractor-wa-state-intel-v1"
assert snap["fingerprint"] in pub
assert snap["general"]["rows"] == 160923
assert snap["graph"]["ids_with_both"] == 70622
assert snap["bond"]["no_row_ne_unbonded"] is True
assert snap["insurance"]["no_row_ne_uninsured"] is True
assert snap["gate"]["passed"] is True
assert snap["no_trust_score"] is True
assert snap["fingerprint"] in idx_head
print("assert_wa_con_001 PASS", snap["fingerprint"])
