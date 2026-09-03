"""CA-CON-COUNTY-002 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/california-intelligence/local/accepted-snapshot.json").read_text(encoding="utf-8"))
assert (ROOT / "app/california/san-francisco/page.tsx").exists()
assert (ROOT / "app/california/los-angeles/page.tsx").exists()
assert not (ROOT / "app/california/san-diego").exists()
assert not (ROOT / "app/california/los-angeles-county").exists()
assert snap["fingerprint"] == "8bda38b1d8a365d832331b9a5168a1e7429eb7c764e0665c2a040493b8e54373"
assert snap["san_francisco"]["permits"]["rows"] == 1_294_909
assert snap["los_angeles"]["union"]["exact_acquired_cslb_licenses"] == 3708
assert snap["california_local_closeout"] is True
print("assert_ca_con_county_002 PASS", snap["fingerprint"])
