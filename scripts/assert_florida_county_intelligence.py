#!/usr/bin/env python3
"""Contractor County Intelligence source assertions (no live DB required)."""
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


def squish(rel: str) -> str:
    return " ".join(read(rel).split())


def main() -> int:
    cov = read("lib/intelligence/coverage.ts")
    cat = read("lib/intelligence/county-catalog.ts")
    payload = read("lib/intelligence/county-payload.ts")
    snap = read("lib/intelligence/county-snapshot.ts")
    edu = read("lib/intelligence/county-education.ts")
    occ = read("lib/intelligence/occupations.ts")
    page = read("app/florida/[segment]/page.tsx")
    ui = squish("components/intelligence/CountyIntelligence.tsx")

    assert_("return \"statewide\"" in cov or "return 'statewide'" in cov, "coverage always statewide")
    assert_("evaluateEnhancedLocalResearchGate" in cov, "Enhanced gate documented")
    assert_("countyResearchCoverage() does not call this" in cov, "gate not wired")
    assert_('slug: "broward"' in cat and 'dbprCountyCode: "16"' in cat, "Broward county_code 16")
    assert_('slug: "palm-beach"' in cat and 'dbprCountyCode: "60"' in cat, "Palm Beach county_code 60")
    assert_("R002812-082626" in cat and "R002813-082626" in cat, "Broward PRA ids")
    assert_("REQ-2026-09008" in cat and "REQ-2026-09009" in cat, "PBC PRA ids")
    assert_("not all Palm Beach County permits" in cat, "PZB unincorporated disclosure")
    assert_("Westlake" in cat and "2017" in cat, "Westlake 2017")
    assert_("Loxahatchee Groves" in cat, "Loxahatchee dual coverage")
    assert_("OneStop" in cat or "ePermits" in cat, "Broward OneStop not warehouse")
    assert_("enhancedGateActivated: false" in payload, "Enhanced not activated")
    assert_("NOT_READY" in payload and "INTERNAL_ONLY" in payload, "readiness triad")
    assert_("RR is residential, not roofing" in payload, "RR not roofing")
    assert_('roofing: ["CCC", "RC"]' in occ, "roofing CCC/RC")
    assert_('residential: ["CRC", "RR"]' in occ, "residential CRC/RR")
    assert_('solar: ["CVC", "RV"]' in occ, "solar CVC/RV")
    assert_("getFloridaCountyIntelligenceSnapshot" in page, "county page wired")
    assert_("isFloridaCountyIntelSlug" in page, "only Broward/PBC intel")
    assert_("Statewide Research" in ui or "coverageLabel" in ui, "coverage chip")
    assert_("Regulatory &amp; Enforcement History" in ui or "Regulatory & Enforcement History" in ui, "exact regulatory heading")
    assert_("Permit and local credential exports are still being acquired" in ui, "hero disclosure")
    assert_("Local permit research is being expanded" in ui, "permit pending copy")
    assert_("do not display zeros" in ui.lower() or "do not display zeros" in payload.lower() or "We do not" in ui, "fail-safe no fake zero")
    assert_("/florida/broward" in cat and "/florida/palm-beach" in cat, "canonical paths")
    assert_("operatingActivityEvidence: false" in payload, "operating geography lock")
    assert_("CURRENT_LOCAL_AUTHORIZATION" in cat, "local credential statuses not collapsed")
    assert_("INSTALLER_REGISTRATION" in cat, "installer registration distinct")
    assert_("PREEMPTED_CLASS" in cat, "preempted class distinct")
    assert_("server-only" in snap, "snapshot is server-only")
    assert_("TEST_ONLY" not in snap and "TEST_ONLY" not in payload, "no TEST_ONLY production load")

    if failed:
        print(f"\n{failed} failure(s)")
        return 1
    print("\nall county intelligence source assertions passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
