"""PA-CON-001 publication assert."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/pennsylvania-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/pennsylvania-intelligence/publication.ts").read_text(encoding="utf-8")
page = (ROOT / "app/pennsylvania/page.tsx").read_text(encoding="utf-8")
ui = (ROOT / "components/pennsylvania/pa-state-intel-page.tsx").read_text(encoding="utf-8")
metrics = json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))
sitemap = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
assert (ROOT / "app/pennsylvania/page.tsx").exists()
assert not (ROOT / "app/pennsylvania/philadelphia").exists()
assert not (ROOT / "app/pennsylvania/pittsburgh").exists()
assert not (ROOT / "app/pennsylvania/allegheny").exists()
assert snap["version"] == "contractor-pa-state-intel-v1"
assert snap["fingerprint"] == "ad8e95e11e486c9c124b7da270d6fa38808fa4ab0be5d2008167283728324e9a"
assert snap["fingerprint"] in pub
assert "loadPennsylvaniaContractorView" in page
assert "Pennsylvania Contractor" in ui
assert "universal statewide general-contractor license" in ui.lower()
assert "AggregateRating" not in ui
assert "Trust Score" in ui
assert snap["hicpa"]["PA_HICPA_ROSTER_STATUS"] == "OPEN_SEARCH_ONLY"
assert snap["hicpa"]["PA_HICPA_ROWS"] is None
assert snap["asbestos"]["PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS"] == 283
assert snap["lead"]["PA_LEAD_CONTRACTOR_DISTINCT_IDS"] == 148
assert snap["debarment"]["PA_PREVAILING_WAGE_DEBARMENT_ROWS"] == 6
assert snap["identity"]["EXACT_SOURCE_NATIVE_CROSSWALKS"] == 0
assert snap["identity"]["NAME_ONLY_UNSAFE"] == 0
assert snap["adverse_publication"]["EXACT_PROFILE_ATTACHMENTS"] == 0
assert snap["expansion_ledger"]["GRAPH_WRITES"] == 0
assert snap["expansion_ledger"]["CLAIM_ELIGIBILITY_BROADENED"] is False
assert snap["gate"]["live_cohort_not_inflated"] is True
assert sitemap.count('"/pennsylvania"') == 1
assert "/pennsylvania/philadelphia" not in sitemap
assert "/pennsylvania/pittsburgh" not in sitemap
assert any(c.get("state") == "PA" and c.get("route") == "/pennsylvania" for c in metrics["stateCapabilities"])
print("assert_pa_con_001 PASS", snap["fingerprint"])
