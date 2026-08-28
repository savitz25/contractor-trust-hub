#!/usr/bin/env python3
"""INTEL-003 OS architecture tests (no live DB)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
failed = 0


def assert_(cond: bool, msg: str) -> None:
    global failed
    if not cond:
        print("FAIL:", msg)
        failed += 1
    else:
        print("PASS:", msg)


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def main() -> int:
    fl = read("components/intelligence/FloridaStateIntelligence.tsx")
    hero = read("components/intelligence/IntelligenceHero.tsx")
    ossec = read("components/intelligence/IntelligenceOsSections.tsx")
    county = read("components/intelligence/CountyIntelligence.tsx")
    snap = read("lib/intelligence/florida-snapshot.ts")
    cp = read("lib/intelligence/county-payload.ts")
    layer = read("lib/intelligence/os-layer.ts")
    seg = read("app/florida/[segment]/page.tsx")

    assert_("Florida Contractor Intelligence" in hero, "I003 hero H1")
    assert_("contractor-state-intel-v1" in snap, "I003 state contract")
    assert_("contractor-county-intel-v1" in cp, "I003 county contract")
    assert_("Trace this number" in ossec, "I003 trace")
    assert_("Compare this market" in ossec, "I003 compare")
    assert_("Ask the market" in ossec, "I003 ask")
    assert_("What we don’t know" in ossec or "What we don't know" in ossec, "I003 gaps")
    assert_("Research checklist" in ossec, "I003 checklist")
    assert_("How this research was assembled" in ossec, "I003 journey")
    assert_("FeaturedFindings" in fl and "TraceNumber" in fl, "I003 florida wires OS")
    assert_("Broward Contractor Intelligence" in county, "I003 Broward H1")
    assert_("MarketCompare" in county, "I003 Broward vs Florida")
    assert_("directory" in seg.lower(), "I003 county directory secondary")
    assert_("Trust Score" not in ossec and "Best Contractor" not in ossec, "I003 no ranking copy")
    assert_("places.googleapis" not in layer.lower(), "I003 no Google Places")
    assert_("service area" in layer.lower() or "not service area" in county.lower() or "not operating" in cp.lower(), "I003 geography safety")
    fp = read("lib/intelligence/fingerprint.ts")
    assert_("generatedAt" in fp and "CANONICAL_EXCLUDED_KEYS" in fp, "I003B fingerprint excludes generatedAt")
    assert_("c?.roofing" in fl or "c.roofing" in fl, "I003B florida compare uses county roofing")
    assert_("IN ('CCC', 'RC')" in snap or "CCC', 'RC'" in snap, "I003B roofing CCC+RC not RR")
    print("INTEL003_OS", "PASS" if failed == 0 else "FAIL", "fails", failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
