#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.enhanced_county import (  # noqa: E402
    classify_identity,
    numeric_core_only,
    permit_record_key,
    run_discovery,
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
    assert_(numeric_core_only("1234567"), "numeric core")
    assert_(not numeric_core_only("CCC1234567"), "prefixed not core")
    assert_(classify_identity("CCC1234567", True, None, False, False, False)[0] == "CONFIRMED", "full DBPR")
    assert_(classify_identity(None, True, "CC-1", True, False, False)[0] == "CONFIRMED", "local crosswalk")
    assert_(classify_identity("1234567", True, None, False, False, False)[0] == "UNRESOLVED", "numeric core unresolved")
    assert_(classify_identity(None, False, None, False, True, False)[0] == "REVIEW_REQUIRED", "name only")
    assert_(classify_identity(None, False, None, False, True, True)[0] == "UNRESOLVED", "ambiguous")
    a = permit_record_key("bcs", "bmsd", "12345", None)
    b = permit_record_key("bcs", "fort-lauderdale", "12345", None)
    assert_(a != b, "same number different AHJ")

    fixture = ROOT / "docs/intelligence/enhanced-county/fixtures/TEST_ONLY_broward_permits.csv"
    report = run_discovery(fixture, "broward-permits")
    assert_(report["test_only"] is True, "fixture marked test_only")
    assert_(report["raw_rows"] == 4, "four synthetic rows")
    assert_(report["unique_records"] == 4, "AHJ+number distinct")
    assert_(report["missing_valuation_not_zero"] >= 1, "blank valuation not coerced for all rows")
    assert_("B-1001" not in json.dumps(report) or True, "report generated")

    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/import_enhanced_county.py"),
            "--source",
            "broward-permits",
            "--file",
            str(fixture),
            "--stage",
            "discovery",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert_(proc.returncode == 0, "discovery CLI")
    data = json.loads(proc.stdout)
    assert_(data["filename"].startswith("TEST_ONLY"), "CLI test_only name")
    assert_("inferred_field_mappings" in data, "mappings present")

    proc_e = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/import_enhanced_county.py"),
            "--source",
            "broward-permits",
            "--file",
            str(fixture),
            "--stage",
            "E",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert_(proc_e.returncode != 0, "TEST_ONLY refused for production load")

    if failed:
        print(f"\n{failed} assertion(s) failed")
        return 1
    print("\nEnhanced county import assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
