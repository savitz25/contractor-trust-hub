#!/usr/bin/env python3
"""NJ-CON-004 extra publication asserts."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snap = json.loads((ROOT / "lib/new-jersey-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
pub = (ROOT / "lib/new-jersey-intelligence/publication.ts").read_text(encoding="utf-8")
page = (ROOT / "app/new-jersey/page.tsx").read_text(encoding="utf-8")
attach = (ROOT / "lib/new-jersey-intelligence/profile-attachment.ts").read_text(encoding="utf-8")

assert snap["fingerprint"] in pub
assert "index,follow" in snap["publication"]["robots"]
assert "noIndex: !NEW_JERSEY_INTELLIGENCE_GATE.robotsIndex" in page or "robotsIndex" in page
assert "name_only" in attach
assert "market_only_no_contractor_field" in attach
assert snap["construction"]["permit_issued_records"] + snap["construction"]["certificate_issued_records"] == snap["construction"]["total_source_records"]
assert not (ROOT / ".vercel/project.json").exists()
print("assert_nj_con_004 PASS", snap["fingerprint"])
