"""Build a local, non-public preview from certified Contractor reconciliation rows."""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/TH-ENRICH-CON-2026-09-30-IDR1"
OUTPUT = EVIDENCE / "credential-layer-preview.json"

SOURCES = {
    "nyc_dob_license_info": ("CREDENTIAL_ONLY", "NYC General Contractor License", "BUSINESS_LICENSE / CREDENTIAL", 9752),
    "ny_dol_mold": ("CREDENTIAL_ONLY", "New York Mold License", "BUSINESS_LICENSE / CREDENTIAL", 2510),
    "ny_elevator": ("CREDENTIAL_ONLY", "New York Elevator Contractor License", "BUSINESS_LICENSE / CREDENTIAL", 302),
    "fl_dbpr_asbestos_59": ("NEW_BUSINESS_WITH_AUTHORITATIVE_ID", "Florida Asbestos Business License", "SOURCE-NATIVE BUSINESS LICENSE", 228),
    "nj_dfs_fire_business": ("HELD", "NJ Fire Protection Permit", "PERMIT_EVIDENCE", 542),
}


def records(dataset: str):
    with (EVIDENCE / f"{dataset}-reconciliation.csv").open(newline="", encoding="utf-8") as stream:
        yield from csv.DictReader(stream)


def public_status(dataset: str, raw: str) -> str:
    if dataset == "fl_dbpr_asbestos_59":
        return "Current; Active reported" if raw == "C|A" else "Current; secondary status not reported"
    if dataset == "nj_dfs_fire_business":
        return "Permit listed; current status unverified"
    return raw.title()


def build_preview() -> dict:
    result = {"canonical_business_count_change": 0, "person_profiles_created": 0, "production_rows": 0, "sources": {}}
    for dataset, (classification, label, grain, expected) in SOURCES.items():
        rows = [row for row in records(dataset) if row["classification"] == classification and
                (dataset != "nyc_dob_license_info" or
                 (row["credential_class"] == "GENERAL CONTRACTOR" and row["source_status"] == "ACTIVE")) and
                (dataset != "fl_dbpr_asbestos_59" or row["credential_class"] == "ZA")]
        keys = [row["native_key"] for row in rows]
        if len(rows) != expected or len(keys) != len(set(keys)) or any(not key for key in keys):
            raise ValueError(f"{dataset}: count or native-key invariant failed")
        statuses = dict(sorted(Counter(row["source_status"] for row in rows).items()))
        sample = rows[0]
        result["sources"][dataset] = {
            "count": len(rows), "source_grain": grain, "label": label,
            "raw_statuses": statuses, "canonical_business_id": None,
            "example": {"source_native_key": sample["native_key"],
                        "display_name_as_published": sample["associated_business_name_raw"] or sample["holder_name_raw"],
                        "status_label": public_status(dataset, sample["source_status"]),
                        "source_grain": grain, "label": label,
                        "canonical_business_id": None},
        }
    return result


if __name__ == "__main__":
    OUTPUT.write_text(json.dumps(build_preview(), indent=2) + "\n", encoding="utf-8")
    print(OUTPUT)
