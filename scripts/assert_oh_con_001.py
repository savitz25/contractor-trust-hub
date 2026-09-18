"""OH-CON-001 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/ohio-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/ohio-intelligence/publication.ts").read_text(encoding="utf-8")
page = (ROOT / "app/ohio/page.tsx").read_text(encoding="utf-8")
ui = (ROOT / "components/ohio/oh-state-intel-page.tsx").read_text(encoding="utf-8")
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
sitemap = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
ask = (ROOT / "lib/ask/ohio-ocilb.ts").read_text(encoding="utf-8")
slugs = (ROOT / "lib/seo/published-state-path.ts").read_text(encoding="utf-8")
assert (ROOT / "app/ohio/page.tsx").exists()
assert not (ROOT / "app/ohio/columbus").exists()
assert not (ROOT / "app/ohio/cleveland").exists()
assert not (ROOT / "app/ohio/cincinnati").exists()
assert not (ROOT / "app/ohio/toledo").exists()
assert not (ROOT / "app/ohio/akron").exists()
assert not (ROOT / "app/ohio/dayton").exists()
assert snap["version"] == "contractor-oh-state-intel-v1"
assert snap["fingerprint"] == "b7e441958066cc598342127e4ecc3d87ee4273d16470f5db8d148f7dfef9c03d"
assert snap["fingerprint"] in pub
assert "loadOhioContractorView" in page
assert "Ohio Contractor" in ui and "Specialty-Trade" in ui
assert "does not have one universal statewide general-contractor license" in ui
assert "ACTIVE IN RENEWAL" in ui
assert "AggregateRating" not in ui
assert "Trust Score" in ui
assert "HICPA" not in ui
assert "NCLBGC" not in ui
assert snap["hero"]["universe_value"] == 9528
assert snap["ocilb"]["OH_OCILB_ALL_TRADE_CREDENTIAL_ROWS"] == 12461
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["expansion_ledger"]["CLAIM_ELIGIBILITY_BROADENED"] is False
assert sitemap.count('"/ohio"') == 1
assert "/ohio/columbus" not in sitemap
assert '"ohio"' in slugs
assert "EL." in ask and "low-voltage" in ask
assert any(c.get("state") == "OH" and c.get("route") == "/ohio" for c in metrics["stateCapabilities"])
print("assert_oh_con_001 PASS", snap["fingerprint"])
