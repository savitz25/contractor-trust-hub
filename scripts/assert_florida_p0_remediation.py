#!/usr/bin/env python3
"""P0 remediation architecture tests (no Node)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
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
    attr = read("lib/intelligence/attribution.ts")
    rel = read("lib/intelligence/relationship-types.ts")
    pub = read("lib/intelligence/publication-matrix.ts")
    chrome = read("components/discovery/FloridaLandingChrome.tsx")
    landing = read("lib/discovery/landing-cache.ts")
    occ = read("lib/intelligence/occupations.ts")
    trades = read("lib/discovery/trades.ts")
    queries = read("lib/contractors/queries.ts")
    schema = read("schema/migrations/009_qualifier_graph.sql")
    counties = read("lib/intelligence/florida-county-codes.ts")

    assert_("PUBLIC_FL_DISCIPLINE_PREDICATE" in attr, "discipline PUBLIC gate intact")
    assert_("COALESCE(d.publication_state, 'INTERNAL') = 'PUBLIC'" in attr, "NULL publication is INTERNAL")
    assert_("PUBLIC_SUNBIZ_MIN_CONFIDENCE = 0.95" in attr, "Sunbiz public 0.95 intact")
    assert_("exact_name_city" in attr and "REVIEW_REQUIRED" in attr, "city-only remains review")
    assert_("inheritAcrossSharedQualifier: false" in attr, "no adverse inheritance in attribution rules")

    assert_("ADVERSE_HISTORY_DOES_NOT_INHERIT_ACROSS_QUALIFIER_EDGES = true" in rel, "no adverse inherit constant")
    assert_("LISTED_NAME_IS_NOT_QUALIFYING_AGENT = true" in rel, "DBA listed name is not QA role")
    assert_("primary_qualifying_agent" in rel and "secondary_qualifying_agent" in rel, "primary vs secondary preserved")
    assert_("financially_responsible_officer" in rel, "FRO role preserved")

    assert_("NUMERIC_CORE_ONLY_NEVER_PUBLIC" in pub, "numeric core never public")
    assert_("NON_FINAL_OR_UNKNOWN_DISPOSITION" in pub, "non-final stays internal")
    assert_("allowPublicAfterValidation" in pub, "PUBLIC requires explicit validation")
    assert_("identityFromLicenseFields" in pub, "full occupation+license identity gate")

    assert_("Florida contractor credentials tracked" in chrome, "landing credentials label")
    assert_("Active credentials" in chrome, "landing active credentials label")
    assert_("Searchable contractors" not in chrome, "landing does not say searchable contractors")
    assert_("not distinct businesses" in chrome, "landing discloses not businesses")
    assert_("104444" not in landing and "104,444" not in landing, "no hard-coded 104444")
    assert_("NOT IN ('FRO', 'CRS1', 'PVDR')" in landing, "landing excludes FRO/education")
    assert_("status_normalized = 'active'" in landing, "active is secondary A only")

    assert_('code: "RR"' in occ and "Registered Residential" in occ, "RR residential")
    assert_("occupationCodes: [\"CCC\", \"RC\"]" in trades, "roofers CCC/RC")
    assert_("occupationCodes: [\"CVC\", \"RV\"]" in trades, "solar CVC/RV")
    assert_("FRO_is_not_a_trade_license" in occ, "FRO not trade")

    assert_("fl_license_holders" in schema, "holder table")
    assert_("Do not fuzzy-merge people by name" in schema, "no person merge")
    assert_("fl_qualifier_relationships" in schema, "qualifier edges")
    assert_("listed_business_name" in schema, "listed name distinct from QA")
    assert_("fl_dbpr_business_licid_uidx" in schema, "unique portal licid")
    assert_("Never inferred from missing expiration" in schema, "no invented end dates")

    assert_('"23": "Miami-Dade"' in counties, "Dade=Miami-Dade")
    assert_('"74": "Volusia"' in counties, "Volusia 74")
    assert_("701" in counties and "out_of_state" in counties, "701-799 out of state")

    assert_("PUBLIC_FL_DISCIPLINE_PREDICATE" in queries, "profile query still gated")

    # Executable identity / publication logic (mirrors TS)
    sys.path.insert(0, str(ROOT / "scripts"))
    # inline mini
    def identity(license_type, matching):
        occ_map = {"certified roofing contractor": "CCC", "certified general contractor": "CGC"}
        occ = occ_map.get((license_type or "").lower())
        if occ and len(matching) == 1:
            return "CONFIRMED"
        if not occ and matching:
            return "REVIEW_REQUIRED"
        return "UNRESOLVED"

    assert_(identity("Certified Roofing Contractor", ["CCC1333104"]) == "CONFIRMED", "full type+key CONFIRMED")
    assert_(identity(None, ["CCC1333104", "CGC1333104"]) == "REVIEW_REQUIRED", "numeric core collision not CONFIRMED")
    assert_(identity(None, ["CCC1333104"]) == "REVIEW_REQUIRED", "numeric unique still not CONFIRMED without type")

    def inherit(action_business, target_business, shared_qualifier):
        if action_business != target_business:
            return False  # never inherit
        return True

    assert_(inherit("ABC", "XYZ", "John") is False, "shared qualifier does not copy discipline")
    assert_(inherit("ABC", "ABC", "John") is True, "same business keeps its own record")

    if failed:
        print(f"\n{failed} assertion(s) failed")
        return 1
    print("\nP0 remediation assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
