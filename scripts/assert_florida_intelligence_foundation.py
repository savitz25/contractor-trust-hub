#!/usr/bin/env python3
"""Source-level INTEL-001/002/003 assertions (no Node required)."""
from __future__ import annotations

import json
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
    occ = read("lib/intelligence/occupations.ts")
    attr = read("lib/intelligence/attribution.ts")
    metrics = read("lib/intelligence/metric-dictionary.ts")
    trades = read("lib/discovery/trades.ts")
    ui_occ = read("lib/contractors/occupations.ts")
    queries = read("lib/contractors/queries.ts")
    landing = read("lib/discovery/landing-cache.ts")
    counties = read("lib/intelligence/florida-county-codes.ts")
    contacts = read("lib/intelligence/contacts.ts")
    agg = read("lib/intelligence/aggregation.ts")
    fl_list = read("lib/discovery/florida-list.ts")

    assert_("Registered Residential Contractor" in occ, "RR official residential")
    assert_("Registered Roofing Contractor" in occ, "RC official roofing")
    assert_('RR_is_not_roofing' in occ, "RR not roofing invariant")
    assert_('"RR"' not in occ.split("roofing:")[1].split("]")[0], "RR excluded from roofing bucket")
    assert_('solar: ["CVC", "RV"]' in occ, "solar bucket CVC/RV")
    assert_('roofing: ["CCC", "RC"]' in occ, "roofing bucket CCC/RC")
    assert_("occupationCodes: [\"CCC\", \"RC\"]" in trades, "browse roofers CCC/RC")
    assert_("occupationCodes: [\"CVC\", \"RV\"]" in trades, "browse solar CVC/RV")
    assert_('label: "Registered Residential Contractor"' in ui_occ, "UI RR label")
    assert_('label: "Registered Roofing Contractor"' in ui_occ, "UI RC label")

    assert_("PUBLIC_SUNBIZ_MIN_CONFIDENCE = 0.95" in attr, "Sunbiz public 0.95")
    assert_('exact_name_city: {' in attr and "REVIEW_REQUIRED" in attr, "city-only review required")
    assert_("inheritAcrossSharedQualifier: false" in attr, "no guilt by association")
    assert_("PUBLIC_FL_DISCIPLINE_PREDICATE" in queries, "profile/search gated")
    assert_("PUBLIC_FL_DISCIPLINE_PREDICATE" in fl_list, "florida browse gated")
    assert_("104444" not in landing, "landing does not hard-code 104444")
    assert_("COUNT(*)" in landing, "landing queries DB")

    assert_('id: "active_license"' in metrics and 'entityCounted: "credential"' in metrics, "active license = credential")
    assert_('id: "active_contractor"' in metrics and "not_yet_calculable" in metrics, "active contractor not yet calculable")
    assert_("do not have to equal" in agg, "statewide ≠ county operating sum")
    assert_('"16": "Broward"' in counties, "county 16 Broward")
    assert_('"74": "Volusia"' in counties, "county 74 Volusia")
    assert_("701" in counties and "out_of_state" in counties, "701-799 out of state")
    assert_("allowMultiplePerKind: true" in contacts, "multiple contacts")
    assert_("never_overwrite_different_value" in contacts, "contacts do not overwrite")

    extract = json.loads(read("docs/intelligence/extract-csv-baseline.json"))
    assert_(extract["status"]["active"] == 104444, "extract active credentials = 104444")
    assert_(extract["license_rows"] == 143516, "extract credential rows = 143516")
    assert_(extract["qb_rows"] == 126666, "QB shells = 126666")
    assert_(extract["numeric_cores_colliding"] == 16088, "numeric core collisions documented")

    snap = json.loads(read("docs/intelligence/baseline-snapshot.json"))
    disc = snap["discipline"]
    assert_(disc["publication_state_all"]["PUBLIC"] == 0, "zero PUBLIC discipline rows")
    assert_(disc["by_dataset"]["fl_dfs_workers_comp_stop_work"]["raw_rows"] == 48254, "DFS rows")
    assert_(disc["by_dataset"]["contractor_disc_ula"]["contractor_id_present"] == 0, "ULA not attached to contractors")
    assert_(snap["contractor_entities"]["qualifier_role"] == 0, "qualifier graph empty")
    assert_(snap["contractor_shells"]["fl_not_thin_with_phone"] == 0, "no FL phones")
    assert_(snap["licensing"]["by_status"]["active"] == 104444, "live active = 104444")

    if failed:
        print(f"\n{failed} assertion(s) failed")
        return 1
    print("\nFlorida intelligence foundation assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
