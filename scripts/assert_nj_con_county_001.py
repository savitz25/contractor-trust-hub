#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUB = (ROOT / "lib/new-jersey-intelligence/counties/publication.ts").read_text(encoding="utf-8")
PAGE = (ROOT / "app/new-jersey/[county]/page.tsx").read_text(encoding="utf-8")
for stem in ("monmouth", "middlesex", "somerset", "union"):
    snap = json.loads((ROOT / f"lib/new-jersey-intelligence/counties/{stem}.json").read_text(encoding="utf-8"))
    assert snap["fingerprint"] in PUB
    assert snap["publication_gate"]["indexable"]
    assert "noIndex: !gate.robotsIndex" in PAGE or "robotsIndex" in PAGE
assert not (ROOT / ".vercel/project.json").exists()
print("assert_nj_con_county_001 PASS")
