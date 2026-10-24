"""Classify the frozen B1 credentials by holder grain; no database writes."""
from __future__ import annotations

import json
import argparse
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / "docs/TH-ENRICH-2026-09-30-B1-qa.json"
OUT = ROOT / "docs/TH-ENRICH-2026-09-30-B1-identity-review.json"

# Holder grain follows the regulator's class, never name similarity or an address.
FL_PERSON = {"HI", "MRSA", "MRSR", "AX", "CJC", "AF", "DD", "EA", "IA"}
FL_BUSINESS = {"ZA"}
NYC_BUSINESS = {"GENERAL CONTRACTOR", "ELECTRICAL FIRM", "SPECIAL INSPECTION AGENCY"}
NYC_PERSON = {
    "WELDER", "SITE SAFETY", "MASTER PLUMBER", "SUPERINTENDENT OF CONSTRUCTION",
    "JOURNEYMAN", "HOIST MACHINE OPERATOR", "STATIONARY / PORTABLE ENGINEER",
    "RIGGER", "FILING REPRESENTATIVE", "OIL BURNER INSTALLER", "TOWER CRANE RIGGER",
    "SIGN HANGER", "ELECTRICAL CONTRACTOR", "FIRE SUPPRESSION CONTRACTOR",
}


def holder(dataset: str, kind: str) -> str:
    if dataset.startswith("fl_dbpr_"):
        if kind in FL_PERSON:
            return "person"
        if kind in FL_BUSINESS:
            return "business"
        return "mixed_unknown"  # ECLB qualifiers are not proven legal businesses.
    if dataset == "nyc_dob_license_info":
        if kind in NYC_BUSINESS:
            return "business_linked"
        if kind in NYC_PERSON:
            return "person"
        return "mixed_unknown"  # composite agency/inspector and lab/safety classes
    if dataset in {"ny_dol_mold", "ny_elevator", "nj_dfs_fire_business"}:
        return "business"
    raise ValueError(dataset)


def current(dataset: str, row: dict) -> bool:
    if dataset.startswith("fl_dbpr_"):
        raw = row["raw"]
        return raw["primary_status"] == "C" and raw["secondary_status"] == "A"
    if dataset == "nj_dfs_fire_business":
        return False  # March roster cannot establish current status in September.
    return row["raw"].get("license_status", "").upper() == "ACTIVE"


def main(stage: Path) -> dict:
    qa = json.loads(QA.read_text(encoding="utf-8"))
    results = []
    for dataset in qa["datasets"]:
        name = dataset["dataset"]
        groups: dict[str, dict[str, object]] = defaultdict(lambda: {"rows": 0, "native": set(), "current": set(), "current_eligible": set(), "holder": ""})
        with (stage / f"{name}.jsonl").open(encoding="utf-8") as stream:
            for line in stream:
                row = json.loads(line)
                kind = row.get("credential_class", "FIRE PROTECTION BUSINESS PERMIT")
                group = groups[kind]
                group["rows"] += 1
                group["native"].add(row["native_key"])
                group["holder"] = holder(name, kind) if (name == "nyc_dob_license_info" or row["identity_eligible"]) else "evidence_only"
                if current(name, row):
                    group["current"].add(row["native_key"])
                    if row["identity_eligible"]:
                        group["current_eligible"].add(row["native_key"])
        types = {kind: {"raw": value["rows"], "unique_native": len(value["native"]),
                        "holder": value["holder"], "current": len(value["current"])}
                 for kind, value in sorted(groups.items())}
        keys_by_holder: dict[str, set] = defaultdict(set)
        current_keys: set = set()
        for value in groups.values():
            keys_by_holder[value["holder"]].update(value["native"])
            current_keys.update(value["current_eligible"])
        results.append({
            "dataset": name, "raw": dataset["raw_rows"], "unique_native": dataset["unique_native_keys"],
            "prior_identity_eligible": dataset["identity_eligible_native_keys"],
            "current_eligible": len(current_keys),
            "person": len(keys_by_holder["person"]),
            "business": len(keys_by_holder["business"] | keys_by_holder["business_linked"]),
            "business_linked_not_proven_canonical": len(keys_by_holder["business_linked"]),
            "mixed_unknown": len(keys_by_holder["mixed_unknown"]),
            "evidence_only": len(keys_by_holder["evidence_only"]),
            "held": dataset["unique_native_keys"],
            "collision_or_parse_rows": dataset["duplicate_native_keys"] + dataset["parse_failures"],
            "proposed_license_rows": 0,  # pending holder identity and Founder publication design
            "types": types,
        })
    assert sum(d["prior_identity_eligible"] for d in results) == 80802
    assert all(d["unique_native"] == d["person"] + d["business"] + d["mixed_unknown"] + d["evidence_only"] for d in results)
    packet = {"source": "frozen B1 stage", "datasets": results, "production_changed": False,
              "publication_rule": "No credential is a canonical business. Person and mixed credentials remain held; no license rows proposed before identity resolution."}
    OUT.write_text(json.dumps(packet, indent=2), encoding="utf-8")
    return packet


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", type=Path, default=ROOT / "data/staging/th_enrich_b1")
    packet = main(parser.parse_args().stage)
    print(json.dumps([{k: v for k, v in d.items() if k != "types"} for d in packet["datasets"]], indent=2))
