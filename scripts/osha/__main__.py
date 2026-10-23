"""Run the Group 1 matcher and write packages outside the repository."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

from scripts.osha.crosswalk import load_crosswalk
from scripts.osha.match import distinct_public_activities, distinct_published_activities, match_state
from scripts.osha.package import package_bytes, sha256_bytes, spot_bytes, spot_rows
from scripts.osha.states import STATE_ORDER


def _read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _summarize(result: dict) -> dict:
    counts = Counter(row["match_tier"] for row in result["matches"])
    inspections = len(distinct_public_activities(result["matches"]))
    published = len(distinct_published_activities(result["matches"]))
    person_rows = sum(row["person_name_licensee"] == "yes" for row in result["matches"])
    eligible_ids = {row["contractor_id"] for row in result["matches"] if row["profile_eligible"] == "yes"}
    ambiguous_held = sum(row["publication_status"] == "ambiguous_held" for row in result["matches"])
    in_state = Counter()
    for row in result["matches"]:
        if row["mailing_state"] == row["state"]:
            in_state[row["match_tier"]] += 1
    return {
        "state": result["state"],
        "source_system": result["source_system"],
        "licenses_considered": result["licenses_considered"],
        "person_licenses_considered": result["person_licenses_considered"],
        "person_capped_rows": person_rows,
        "inspections_in_state": result["inspections_in_state"],
        "duplicate_inspection_rows": result["duplicate_inspection_rows"],
        "exact": counts["exact"],
        "strong": counts["strong"],
        "weak": counts["weak"],
        "matched_license_candidates": counts["exact"] + counts["strong"],
        "eligible_profiles": len(eligible_ids),
        "eligible_license_rows": sum(row["profile_eligible"] == "yes" for row in result["matches"]),
        "ambiguous_activities": len(result["ambiguous_activities"]),
        "ambiguous_held_licenses": ambiguous_held,
        "weak_held": counts["weak"],
        "inspections_exact_strong": inspections,
        "published_activities": published,
        "exact_mailing_state": in_state["exact"],
        "strong_mailing_state": in_state["strong"],
        "weak_mailing_state": in_state["weak"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--licenses", type=Path, required=True)
    parser.add_argument("--inspections", type=Path, required=True)
    parser.add_argument("--violations", type=Path, required=True)
    parser.add_argument("--crosswalk", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--spot-dir", type=Path, required=True)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.spot_dir.mkdir(parents=True, exist_ok=True)
    licenses = _read_csv(args.licenses)
    inspections = _read_csv(args.inspections)
    violations = _read_csv(args.violations)
    crosswalk_bytes = args.crosswalk.read_bytes()
    crosswalk_sha = hashlib.sha256(crosswalk_bytes).hexdigest()
    crosswalk = load_crosswalk(args.crosswalk)
    print("CROSSWALK_SHA", crosswalk_sha)
    print("CROSSWALK_ROWS", crosswalk.rows)
    print("ZCTA_ASSIGNMENTS", sum(len(states) for states in crosswalk.county_by_zip.values()))
    summaries = []
    public_activities: set[str] = set()
    for state in STATE_ORDER:
        print("MATCHING", state)
        result = match_state(state, licenses, inspections, violations, crosswalk)
        public_activities.update(distinct_public_activities(result["matches"]))
        payload = package_bytes(result["matches"])
        package_path = args.out_dir / f"{state}-osha-match-package.csv"
        package_path.write_bytes(payload)
        digest = sha256_bytes(payload)
        summary = _summarize(result)
        summary["package_sha256"] = digest
        summary["package_bytes"] = len(payload)
        summaries.append(summary)
        for tier in ("exact", "strong", "weak"):
            spot_path = args.spot_dir / f"{state}-{tier}.csv"
            spot_path.write_bytes(spot_bytes(spot_rows(result["matches"], tier)))
        print(
            "RESULT",
            state,
            summary["exact"],
            summary["strong"],
            summary["weak"],
            summary["inspections_exact_strong"],
            summary["eligible_profiles"],
            summary["ambiguous_activities"],
            summary["person_capped_rows"],
            digest,
        )
    receipt = {
        "zcta_single_county_rule": True,
        "multicounty_selection": "MAX_AREALAND_PART",
        "tie_breaker": "LEXICOGRAPHICALLY_GREATEST_COUNTY_GEOID",
        "fuzzy_matching": False,
        "license_zip_can_infer_county": False,
        "ca_name_source": "licensee_name_raw",
        "best_tier_only": True,
        "crosswalk_sha256": crosswalk_sha,
        "states": summaries,
        "total_exact_strong": sum(item["exact"] + item["strong"] for item in summaries),
        "total_matched_license_candidates": sum(item["matched_license_candidates"] for item in summaries),
        "total_eligible_profiles": sum(item["eligible_profiles"] for item in summaries),
        "total_ambiguous_activities": sum(item["ambiguous_activities"] for item in summaries),
        "total_weak_held": sum(item["weak_held"] for item in summaries),
        "total_distinct_inspections": len(public_activities),
        "total_published_activities": sum(item["published_activities"] for item in summaries),
    }
    receipt_path = args.out_dir / "match-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print("WROTE", receipt_path.name)


if __name__ == "__main__":
    main()
