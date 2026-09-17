"""NC-CON-001 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/north-carolina-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/north-carolina-intelligence/publication.ts").read_text(encoding="utf-8")
page = (ROOT / "app/north-carolina/page.tsx").read_text(encoding="utf-8")
ui = (ROOT / "components/north-carolina/nc-state-intel-page.tsx").read_text(encoding="utf-8")
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
sitemap = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
ask = (ROOT / "lib/ask/north-carolina-nclbgc.ts").read_text(encoding="utf-8")
assert (ROOT / "app/north-carolina/page.tsx").exists()
assert not (ROOT / "app/north-carolina/charlotte").exists()
assert not (ROOT / "app/north-carolina/raleigh").exists()
assert not (ROOT / "app/north-carolina/mecklenburg").exists()
assert snap["version"] == "contractor-nc-state-intel-v1"
assert snap["fingerprint"] == "17bd03c18651bcb88ba52d54aeba3297d5ced19ae29190159c833d01774eb297"
assert snap["fingerprint"] in pub
assert "loadNorthCarolinaContractorView" in page
assert "North Carolina Contractor Licensing" in ui
assert "40,000" in ui
assert "qualifier" in ui.lower()
assert "38,523" in ui or "38,523" in ui.replace(",", "")
assert "AggregateRating" not in ui
assert "Trust Score" in ui
assert "HICPA" not in ui
assert "Oregon" not in ui
assert "CCB" not in ui
assert snap["nclbgc"]["NC_NCLBGC_ROSTER_STATUS"] == "OPEN_SEARCH_ONLY"
assert snap["nclbgc"]["NC_NCLBGC_ROWS"] is None
assert snap["hero"]["universe_value"] is None
assert snap["doa_debarment"]["NC_DOA_DEBARRED_VENDOR_ROWS"] == 236
assert snap["licensed_summaries"]["NC_NCLBGC_LICENSED_CASE_SUMMARY_ROWS"] == 49
assert snap["unlicensed"]["NC_NCLBGC_UNLICENSED_UNIQUE_CASES"] == 43
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["expansion_ledger"]["CLAIM_ELIGIBILITY_BROADENED"] is False
assert sitemap.count('"/north-carolina"') == 1
assert "/north-carolina/charlotte" not in sitemap
assert "/north-carolina/raleigh" not in sitemap
assert "S(Roofing)" in ask or "s(roofing)" in ask.lower()
assert any(c.get("state") == "NC" and c.get("route") == "/north-carolina" for c in metrics["stateCapabilities"])
print("assert_nc_con_001 PASS", snap["fingerprint"])
