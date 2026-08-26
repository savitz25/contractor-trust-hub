#!/usr/bin/env python3
"""Prompt 7 foundation architecture tests — no live ingest required."""
from __future__ import annotations

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
    ident = read("lib/intelligence/enhanced-county-identity.ts")
    geo = read("lib/intelligence/enhanced-county-jurisdiction.ts")
    cov = read("lib/intelligence/coverage.ts")
    mig = read("schema/migrations/011_enhanced_county_foundation.sql")
    matrix = read("docs/intelligence/enhanced-county/source-matrix.json")
    pra_b = read("docs/intelligence/enhanced-county/pra-broward-permits.md")
    pra_p = read("docs/intelligence/enhanced-county/pra-pbc-permits.md")

    assert_("numericCoreOnly" in ident, "numeric core rejected")
    assert_("FULL_DBPR_LICENSE" in ident, "full DBPR method")
    assert_("mayPublishPermitVolume" in ident, "volume gated")
    assert_("Permit number alone is never unique" in ident, "permit number not global key")
    assert_("HQ/base county is the DBPR mailing county" in ident, "HQ vs activity")
    assert_("Missing value is null, never zero" in ident, "missing valuation not zero")
    assert_("Permit expired is not contractor discipline" in ident, "expired ≠ discipline")

    assert_("Unincorporated Palm Beach County Building permits" in geo, "PBC unincorporated disclosure")
    assert_("isCountywidePermitDataset" in geo and "return false" in geo, "no silent countywide")
    assert_("OneStop participation" in geo and "not complete countywide" in geo, "OneStop ≠ countywide")
    assert_("enhancedCountyReady" in geo, "enhanced gate")
    assert_('return "statewide"' in cov, "coverage still statewide until ingest")
    assert_("Broward / Palm Beach must not be marked enhanced" in cov, "Broward/PBC not hard-coded enhanced")

    assert_("permit_source_records" in mig, "permit source table")
    assert_("UNIQUE (source_system, source_jurisdiction, permit_number)" in mig, "jurisdiction+number unique")
    assert_("local_credentials" in mig, "local credentials table")
    assert_("PREEMPTED_CLASS" in mig, "preempted currentness")
    assert_("permit_lifecycle_events" in mig, "lifecycle events")
    assert_("permit_attributions" in mig, "attribution table")
    assert_("public_contact_observations" in mig, "contact observations")
    assert_("is_agency_number" in mig, "agency phone flag")
    assert_("Never store missing as 0" in mig, "valuation null")
    assert_("Does not alter licenses" in mig, "statewide identity untouched")

    assert_('"pbc_epzb_open_permits"' in matrix, "PBC open permits source")
    assert_("Unincorporated Palm Beach County" in matrix, "PBC coverage geography")
    assert_('"broward_bcs_contractor"' in matrix, "Broward BCS source")
    assert_('"epermits_onestop"' in matrix, "OneStop source")
    assert_("portal_only" in matrix, "portal-only flagged")

    assert_("Do not submit" in pra_b, "Broward PRA not auto-submit")
    assert_("machine-readable" in pra_b.lower(), "native export requested")
    assert_("Unincorporated" in pra_p, "PBC PRA jurisdiction")
    assert_("2023-01-01" in pra_b and "2023-01-01" in pra_p, "date window")

    if failed:
        print(f"\n{failed} assertion(s) failed")
        return 1
    print("\nEnhanced county foundation assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
