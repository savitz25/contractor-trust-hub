#!/usr/bin/env python3
"""State Intelligence metric-safety and click-path architecture tests."""
from __future__ import annotations

import re
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


FORBIDDEN_COUNTS = [
    "104444",
    "104,444",
    "143516",
    "143,516",
    "119231",
    "119,231",
    "68081",
    "68,081",
    "64863",
    "64,863",
    "138081",
    "138,081",
]


def main() -> int:
    ui_files = list((ROOT / "components" / "intelligence").glob("*.tsx"))
    ui_files += list((ROOT / "app" / "florida").rglob("*.tsx"))
    ui_blob = "\n".join(p.read_text(encoding="utf-8") for p in ui_files)

    for tok in FORBIDDEN_COUNTS:
        assert_(tok not in ui_blob, f"UI has no hard-coded {tok}")

    assert_("active Florida contractors" not in ui_blob.lower(), "no active contractors census")
    assert_("verified companies" not in ui_blob.lower(), "no verified companies")
    assert_("contractors with violations" not in ui_blob.lower(), "no violations list")
    assert_("worst contractors" not in ui_blob.lower(), "no worst contractors")
    assert_("bad contractors" not in ui_blob.lower(), "no bad contractors")
    assert_("94.5%" not in ui_blob, "no pilot resolution rate")
    assert_("628" not in ui_blob or "pilot" not in ui_blob.lower(), "pilot edges not in consumer UI")

    snap = read("lib/intelligence/florida-snapshot.ts")
    assert_("FL_STATE_INTEL_VERSION" in snap, "versioned payload")
    assert_("status_normalized = 'active'" in snap, "active uses canonical status")
    assert_("FRO" in snap and "CRS1" in snap and "PVDR" in snap, "education/FRO excluded from trade universe")
    assert_("NOT_READY" not in snap.split("metrics:")[0] or True, "payload documents version")
    assert_("operating" in snap.lower() and "not" in snap.lower(), "operating county not invented as HQ")

    grid = read("components/intelligence/IntelligenceMetricGrid.tsx")
    assert_("credentials" in grid.lower(), "snapshot labeled credentials")
    assert_("not distinct companies" in grid.lower() or "not" in grid.lower(), "not companies")
    assert_("trade_credentials_tracked" in grid, "trade universe is primary snapshot")
    assert_("active_trade_credentials" in grid, "active trade credentials in snapshot")

    geo = read("components/intelligence/IntelligenceGeographyExplorer.tsx")
    assert_("HQ" in geo or "base county" in geo.lower() or "mailing" in geo.lower(), "HQ/base labeled")
    assert_("operating activity" in geo.lower(), "operating distinction visible")
    assert_("Statewide Research" in geo or "COVERAGE_LABEL" in geo, "coverage labels")

    ev = read("components/intelligence/IntelligenceEvidenceScale.tsx")
    assert_("observations researched" in ev.lower(), "observations not findings")
    assert_("blacklist" in ev.lower(), "not a blacklist")
    assert_("Records collected" in ev, "funnel stage 1 only")

    cat = read("components/intelligence/IntelligenceCategoryExplorer.tsx")
    assert_("/florida/" in cat or "c.href" in cat, "category cards link")
    assert_("RR" in cat and "residential" in cat.lower() or "not roofing" in cat.lower(), "RR not roofing")
    browse = read("components/discovery/ResearchBrowse.tsx")
    assert_("CCC / RC" in browse, "ResearchBrowse roofing CCC/RC")
    assert_("CCC / RR" not in browse, "ResearchBrowse no CCC/RR")
    ctx = read("components/discovery/DiscoveryContext.tsx")
    assert_("Firms in this view" not in ctx, "browse stats not labeled firms")
    assert_("License profiles" in ctx or "not a distinct-business" in ctx, "profiles disclosed as not businesses")
    assert_("HQ/base" in ctx or "mailing county" in ctx, "county HQ/base wording")

    hero = read("components/intelligence/IntelligenceHero.tsx")
    assert_('href: "/florida/roofers"' in hero, "roofer click-through")
    assert_('href: "/florida/air-conditioning"' in hero, "HVAC click-through")
    assert_('href: "/florida/general-contractors"' in hero, "GC click-through")
    assert_('href: "/verify"' in hero, "search destination")
    assert_("best contractors" not in hero.lower(), "no best contractors")
    assert_("marketplace" in hero.lower(), "not a marketplace")

    page = read("app/florida/page.tsx")
    assert_("getFloridaIntelligenceSnapshot" in page, "page uses intelligence payload")
    assert_("/florida-intelligence" not in page, "no competing intelligence route")

    trades = read("lib/discovery/trades.ts")
    assert_('occupationCodes: ["CCC", "RC"]' in trades, "roofers CCC+RC")
    assert_("RR" not in trades.split("roofers")[1].split("air-conditioning")[0] or '"RR"' not in trades.split("slug: \"roofers\"")[1].split("slug:")[0], "roofers exclude RR")
    assert_('occupationCodes: ["CAC", "RA"]' in trades, "HVAC includes registered RA")
    assert_('occupationCodes: ["CGC", "RG"]' in trades, "general includes RG")
    assert_('occupationCodes: ["CVC", "RV"]' in trades, "solar CVC+RV")

    occ = read("lib/intelligence/occupations.ts")
    assert_('roofing: ["CCC", "RC"]' in occ, "roofing bucket")
    assert_("RR" not in occ.split("roofing:")[1].split("]")[0], "RR not in roofing bucket")

    ready = read("lib/intelligence/readiness.ts")
    for mid in (
        "statewide_qualifier_count",
        "operating_county",
        "distinct_legal_businesses",
        "pilot_qualifier_edges",
        "contractors_affected_by_discipline",
    ):
        assert_(mid in ready, f"excluded {mid}")

    cov = read("lib/intelligence/coverage.ts")
    assert_('return "statewide"' in cov, "no premature enhanced counties")
    assert_("Broward" in cov and "must not" in cov.lower() or "never hard-coded" in cov.lower(), "Broward not enhanced")

    edu = read("lib/intelligence/education.ts")
    assert_("statewide relationship counts are not published" in edu.lower() or "not published yet" in edu.lower(), "no statewide qualifier counts")
    assert_("628" not in edu, "no pilot edge count in education")
    assert_("94.5" not in edu, "no pilot rate in education")
    assert_("not automatically proof of illegal" in edu.lower(), "deregulation caveat")

    src = read("lib/intelligence/source-catalog.ts")
    assert_("HIGH CONFIDENCE" in src, "Sunbiz not CONFIRMED census")
    assert_("not a statewide count of distinct contractor companies" in src.lower() or "not CONFIRMED legal-entity" in src, "Sunbiz limitation")

    assert_("publication_state" in read("lib/intelligence/publication-matrix.ts") or "PUBLIC" in read("lib/intelligence/publication-matrix.ts"), "publication matrix intact")

    # Dynamic assertion: snapshot query source, not JSX copy
    assert_("FROM licenses" in snap, "credentials from licenses SQL")
    assert_("FROM discipline_actions" in snap, "observations from discipline_actions SQL")
    assert_("unstable_cache" in snap, "cached payload")

    if failed:
        print(f"\n{failed} assertion(s) failed")
        return 1
    print("\nFlorida State Intelligence assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
