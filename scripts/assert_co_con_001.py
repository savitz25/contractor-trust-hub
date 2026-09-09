"""CO-CON-001 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/colorado-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/colorado-intelligence/publication.ts").read_text(encoding="utf-8")
config = (ROOT / "lib/states/config.ts").read_text(encoding="utf-8")
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
assert (ROOT / "app/colorado/page.tsx").exists()
assert snap["version"] == "contractor-co-state-intel-v1"
assert snap["fingerprint"] in pub
assert snap["no_statewide_general_contractor_universe"] is True
assert snap["business_credentials"]["EC"]["active_exact"] == 4789
assert snap["business_credentials"]["PC"]["active_exact"] == 3147
assert snap["discipline"]["name_only"] == "UNSAFE"
assert snap["permits"]["denver_ingested"] is False
assert snap["gate"]["passed"] is True
assert "co_dora" in config
assert "CO" in metrics["liveCohort"]["liveStateCodes"]
assert metrics["liveCohort"]["licensesBySource"]["co_dora"] == (
    snap["business_credentials"]["EC"]["all_rows"] + snap["business_credentials"]["PC"]["all_rows"]
)
assert metrics["liveCohort"]["licensesBySource"]["co_dora"] != snap["source"]["master_rows"]
print("assert_co_con_001 PASS", snap["fingerprint"])
