#!/usr/bin/env python3
"""Qualifier-graph architecture + parser tests (no live portal required)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.adapters.fl_dbpr_relations import (  # noqa: E402
    canonical_rel_type,
    currentness,
    extract_licid_from_license_detail,
    holder_key_for_credential,
    names_compatible,
    parse_relation_table,
    portal_business_key,
)

failed = 0


def assert_(cond: bool, msg: str) -> None:
    global failed
    if not cond:
        print("FAIL:", msg)
        failed += 1
    else:
        print("PASS:", msg)


def main() -> int:
    spa = (ROOT / "docs/intelligence/spa-detail.html").read_text(encoding="utf-8")
    assert_(extract_licid_from_license_detail(spa) == "6402354", "SPA hidden ID = licid 6402354")
    assert_("business tracking record only" in spa.lower(), "CBI page discloses tracking record")
    assert_("487.1395" in spa, "page footer is agency contact, not licensee")
    assert_(
        "tel:" not in spa.lower() or "487.1395" in spa,
        "no distinct licensee phone field on sampled CBI detail",
    )

    schema = (ROOT / "schema/migrations/010_qualifier_graph.sql").read_text(encoding="utf-8")
    assert_("fl_dbpr_business_licid_uidx" in schema, "unique licid index")
    assert_("Never inferred from missing expiration" in schema, "no invented end dates in schema")
    assert_("Do not fuzzy-merge people by name" in schema, "no person merge")
    assert_("current | historical | unknown" in schema, "currentness enum documented")

    rel = (ROOT / "lib/intelligence/relationship-types.ts").read_text(encoding="utf-8")
    assert_("ADVERSE_HISTORY_DOES_NOT_INHERIT_ACROSS_QUALIFIER_EDGES = true" in rel, "no adverse inherit")
    assert_("LISTED_NAME_IS_NOT_QUALIFYING_AGENT = true" in rel, "listed name != QA")
    assert_("primary_qualifying_agent" in rel and "secondary_qualifying_agent" in rel, "P/S distinct")

    intel = (ROOT / "docs/intelligence/INTEL-004-qualifier-graph.md").read_text(encoding="utf-8")
    assert_("current_or_historical" in intel, "INTEL-004 currentness")
    assert_("does not inherit" in intel.lower() or "not inherit" in intel.lower(), "INTEL-004 adverse")

    assert_(canonical_rel_type("Primary Qualifying Agent for Business") == "primary_qualifying_agent", "primary")
    assert_(canonical_rel_type("Second Qualifying Agent for Business") == "secondary_qualifying_agent", "secondary")
    assert_(canonical_rel_type("Secondary Qualifying Agent for Business") == "secondary_qualifying_agent", "secondary syn")
    assert_(canonical_rel_type("Financially Responsible Officer") == "financially_responsible_officer", "FRO")
    assert_(
        canonical_rel_type("Primary Qualifying Agent for Business")
        != canonical_rel_type("Second Qualifying Agent for Business"),
        "primary != secondary",
    )
    assert_(currentness("Current, Active", None) == "current", "current from status")
    assert_(currentness("Null and Void", None) == "historical", "void is historical")
    assert_(currentness("Current, Active", None) == "current", "missing end date is not historical")
    assert_(currentness("", None) == "unknown", "blank status unknown")
    assert_(portal_business_key("6402354") == "fl_dbpr:portal_licid:6402354", "business key")
    assert_(holder_key_for_credential("CCC1336585") == "fl_dbpr:credential:CCC1336585", "holder key")
    try:
        holder_key_for_credential("1336585")
        assert_(False, "numeric core holder rejected")
    except ValueError:
        assert_(True, "numeric core holder rejected")
    assert_(names_compatible("AMF BUILD AND REHAB LLC", "AMF BUILD AND REHAB"), "name compat")
    assert_(not names_compatible("AMF BUILD AND REHAB LLC", "MOSS & ASSOCIATES LLC"), "name reject")

    sample = """
Related License Information
CCC1336585
Current, Active
BETANCOR, ARIEL FERNANDO DBA:AMF BUILD AND REHAB LLC
Primary Qualifying Agent for Business
04/30/2025
Certified Roofing Contractor
08/31/2028
Related License Search
"""
    rows = parse_relation_table(sample)
    assert_(len(rows) == 1, f"parse one row got {len(rows)}")
    if rows:
        assert_(rows[0].license_number == "CCC1336585", "full license key")
        assert_(rows[0].relationship_type_canonical == "primary_qualifying_agent", "canon")
        assert_(rows[0].effective_on == "2025-04-30", "effective iso")
        assert_(rows[0].ended_on is None, "no invented end")
        assert_(rows[0].expiration_on == "2028-08-31", "credential expiration retained separately")
        assert_(rows[0].current_or_historical == "current", "current from Current, Active")

    if failed:
        print(f"\n{failed} assertion(s) failed")
        return 1
    print("\nQualifier graph assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
