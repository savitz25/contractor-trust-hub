"""Verify staged source integrity and denominator guardrails."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "docs/TH-ENRICH-2026-09-30-B1-source-manifest.json").read_text(encoding="utf-8"))
qa = {r["dataset"]: r for r in json.loads((ROOT / "docs/TH-ENRICH-2026-09-30-B1-qa.json").read_text(encoding="utf-8"))["datasets"]}
assert len(manifest["sources"]) == len(qa) == 8
assert not any((s.get("file") or "").lower() == "electrical.csv" for s in manifest["sources"])
for source in manifest["sources"]:
    dataset = source["id"]
    result = qa[dataset]
    assert result["raw_rows"] == source["raw_row_count"]
    assert result["parsed_rows"] == source["parsed_row_count"]
    assert result["unique_native_keys"] == source["unique_native_keys"]
    path = ROOT / "data/raw/th_enrich_b1" / source.get("file", source.get("dataset_id", "") + ".csv")
    assert hashlib.sha256(path.read_bytes()).hexdigest() == source["sha256"]
    assert sum(1 for _ in (ROOT / result["staged_file"]).open(encoding="utf-8")) == result["parsed_rows"]
assert qa["nj_dfs_fire_business"]["unique_native_keys"] == 542
assert qa["nj_dfs_fire_business"]["parse_failures"] == 0
assert qa["nyc_dob_license_info"]["active_general_contractor_rows"] == 9752
assert qa["nyc_dob_license_info"]["parse_failures"] == 2
assert len(qa["nyc_dob_license_info"]["status_anomalies"]) == 2
assert qa["fl_dbpr_eclb_08"]["source_rows_not_identity_eligible"] > 0
assert all(s["existing_owned"] is False for s in manifest["sources"])
print("PASS: eight immutable source hashes, staged row counts, NJ permit parse, NYC active GC and anomaly holds")
