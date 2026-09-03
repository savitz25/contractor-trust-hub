#!/usr/bin/env python3
"""NJ-CON-004 — public New Jersey contractor/construction snapshot from audited artifacts."""
from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
A001 = json.loads((ROOT / "artifacts/nj-con-001-summary.json").read_text(encoding="utf-8"))
A002A = json.loads((ROOT / "artifacts/nj-con-002a-summary.json").read_text(encoding="utf-8"))
A002B = json.loads((ROOT / "artifacts/nj-con-002b-summary.json").read_text(encoding="utf-8"))
A003 = json.loads((ROOT / "artifacts/nj-con-003-audit-summary.json").read_text(encoding="utf-8"))
RECON = ROOT / "artifacts/nj-con-003-construction-reporter-reconciliation.csv"
SAFE = ROOT / "data/samples/nj_con_002a/safe_house_hic.csv"
OUT = ROOT / "lib/new-jersey-intelligence/accepted-snapshot.json"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(obj: dict) -> str:
    body = {k: v for k, v in obj.items() if k != "fingerprint"}
    return hashlib.sha256(dump(body).encode("utf-8")).hexdigest()


def recon_rows() -> list[dict]:
    out = []
    with RECON.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out.append(
                {
                    "period": row["period"],
                    "measure": row["measure"],
                    "microdata_total": row["microdata_total"],
                    "official_reporter_total": row["official_reporter_total"],
                    "difference_percentage": row["difference_percentage"],
                    "publication_approved": row["publication_approved"],
                    "known_explanation": row["known_explanation"],
                }
            )
    return out


def safe_house() -> dict:
    rows = list(csv.DictReader(SAFE.open(encoding="utf-8")))
    renew = sum(1 for r in rows if "Renew" in r["violation"])
    register = sum(1 for r in rows if r["violation"] == "Failure to Register")
    return {
        "novs": len(rows),
        "failure_to_renew": renew,
        "failure_to_register": register,
        "proposed_penalty_usd": 2500,
        "event_type": "NOV",
        "source_date": rows[0]["source_date"] if rows else None,
        "inventory": [
            {
                "company": r["company"],
                "town": r["town"],
                "county": r["county"],
                "violation": r["violation"],
                "penalty_proposed_usd": int(r["penalty"]),
                "event_type": r["event_type"],
            }
            for r in rows
        ],
        "nov_is_not_final_order": True,
        "proposed_is_not_paid": True,
        "profile_links": 0,
    }


def county_activity() -> list[dict]:
    rows = []
    for name, rec in A003["county"].items():
        rows.append(
            {
                "name": name,
                "is_state_category": name == "STATE",
                "permit_issued_records": rec["permit_issued_records"],
                "certificate_issued_records": rec["certificate_issued_records"],
                "observed_municipality_codes": rec["observed_municipality_codes"],
            }
        )
    return rows


def build() -> dict:
    t = A003["totals"]
    fam = A001["family_results"]
    f2 = A002A["families"]
    src = A002B["official_source"]
    acq = A002B["acquisition"]
    link = A003["linkage"]
    geo = A002B["geographic_coverage"]
    recon = recon_rows()
    sh = safe_house()
    p_state = A003["county"]["STATE"]["permit_issued_records"]
    c_state = A003["county"]["STATE"]["certificate_issued_records"]

    snapshot = {
        "ticket": "NJ-CON-004",
        "version": "contractor-nj-state-intel-v1",
        "generated_at": "2026-09-03T00:00:00Z",
        "as_of": "2026-08-13",
        "source_as_of": {
            "construction_metadata": src["metadata_update"],
            "construction_received": "2026-08-07",
            "construction_sha256": acq["sha256"],
            "wall": A001["acquisition"]["NJ_WALL"]["source_as_of"],
            "watchlist": A001["acquisition"]["NJ_WAGE_VIOLATION_WATCHLIST"]["source_as_of"],
            "treasury_construction": A001["acquisition"]["NJ_TREASURY_CONSTRUCTION_DEBARMENT"]["source_as_of"],
            "treasury_vendor": A001["acquisition"]["NJ_TREASURY_VENDOR_DEBARMENT"]["source_as_of"],
        },
        "publication": {
            "route": "/new-jersey",
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/new-jersey",
            "sitemap": True,
            "county_routes": False,
            "rankings": False,
            "trust_scores": False,
            "florida_unchanged": True,
        },
        "hero": {
            "universe_value": t["source_records"],
            "universe_label": "DCA construction source records",
            "universe_hint": "Permit-issued and certificate-issued SOURCE RECORDS. Not 2.68 million permits or projects.",
            "current_value": "2026-08-07",
            "current_label": "data received as of",
            "current_hint": "Official dataset note: data received as of 08/07/2026. Metadata update 2026-08-13.",
            "observations_value": fam["NJ_WALL"]["rows"]
            + fam["NJ_WAGE_VIOLATION_WATCHLIST"]["rows"]
            + fam["NJ_TREASURY_CONSTRUCTION_DEBARMENT"]["rows"]
            + fam["NJ_TREASURY_VENDOR_DEBARMENT"]["rows"],
            "observations_label": "public-works regulatory source rows",
            "observations_hint": "WALL + Wage Watchlist occurrences + Treasury construction + Treasury vendor. Families stay distinct.",
            "geography_value": A003["canonical_current_municipalities"],
            "geography_label": "current NJ municipalities",
            "geography_hint": "Canonical current universe. Not every municipality reports in this extract.",
            "as_of_value": "2026-08-13",
            "as_of_label": "construction source metadata",
        },
        "findings": [
            {
                "id": "source-records",
                "text": (
                    f"The statewide NJ DCA construction extract contains {t['source_records']:,} source records "
                    f"({t['permit_issued']:,} permit-issued and {t['certificate_issued']:,} certificate-issued). "
                    "That is not 2.68 million unique permits or projects."
                ),
            },
            {
                "id": "muni-universe",
                "text": (
                    f"The canonical current New Jersey municipality universe is {A003['canonical_current_municipalities']} "
                    f"municipalities; {A003['current_reporting']} are observed in this extract and "
                    f"{A003['current_non_reporting']} are agency-named non-reporters."
                ),
            },
            {
                "id": "regulatory-families",
                "text": (
                    "New Jersey maintains distinct public-works evidence sources: WALL, Wage Violation Watchlist, "
                    "Treasury construction debarment, and Treasury vendor debarment. Appearance on one list is not "
                    "appearance on another. Absence is not a clean record."
                ),
            },
            {
                "id": "specialty",
                "text": (
                    f"Specialty state programs in the acquired snapshot include lead evaluation ({f2['NJ_LEAD_EVALUATION']['parsed']}), "
                    f"lead abatement ({f2['NJ_LEAD_ABATEMENT']['parsed']}), asbestos safety-control monitors "
                    f"({f2['NJ_ASCM_AUTHORIZATION']['parsed']}), and fire-protection permitted businesses "
                    f"({f2['NJ_FIRE_PROTECTION_PERMIT']['parsed']}) with official C1–C6 classes preserved."
                ),
            },
        ],
        "construction": {
            "total_source_records": t["source_records"],
            "permit_issued_records": t["permit_issued"],
            "certificate_issued_records": t["certificate_issued"],
            "update_marked": t["update_marked"],
            "state_rows": t["state_rows"],
            "municipal_rows": t["municipal_rows"],
            "columns": src["column_count"],
            "grain": "municipal_permit_or_certificate_record",
            "p_is_not_c": True,
            "total_is_not_permits": True,
            "p_plus_c_cost_blocked": True,
            "candidate_link_is_not_project": True,
            "state_not_additive_municipality": True,
            "market_only": True,
            "contractor_attribution": None,
            "dataset_id": src["dataset_id"],
            "landing_url": src["landing_url"],
            "reporter_url": src["reporter_url"],
            "stated_retention_months": src["stated_retention_months"],
            "process_date_min": src["api_date_bounds"]["min_process"],
            "process_date_max": src["api_date_bounds"]["max_process"],
            "caveat": "P and C are separate source classes. Do not add their costs. No contractor, address, or project identifier is in this source.",
        },
        "linkage": {
            "p_records_with_candidate_c": link["p_records_with_candidate_c"],
            "c_records_with_candidate_p": link["c_records_with_candidate_p"],
            "one_to_one_candidate_groups": link["one_to_one_candidate_groups"],
            "candidate_key": link["candidate_key"],
            "sufficient_for_project": False,
            "reason": link["reason_insufficient"],
            "headline_projects": None,
        },
        "cost": {
            "combined_p_plus_c": None,
            "p_stage_sum_ok_zero": A003["p_cost_sum_ok_zero"],
            "c_stage_sum_ok_zero": A003["c_cost_sum_ok_zero"],
            "p_stage_published": False,
            "c_stage_published": False,
            "combined_published": False,
            "reason": "Statewide calendar construction-value totals are BLOCKED_DUE_TO_RECONCILIATION versus the Construction Reporter (about 20–52% for 2023–2025). Combined P+C cost is BLOCKED_PENDING_DEFINITION. Extreme ≥$500M rows are excluded from any approved metric.",
            "extreme_unresolved_rows": A003["cost_outliers"],
            "blank_cost": A003["blank_cost"],
        },
        "units": {
            "p_sale_pos": A003["p_sale_pos"],
            "p_sale_neg": A003["p_sale_neg"],
            "p_rent_pos": A003["p_rent_pos"],
            "p_rent_neg": A003["p_rent_neg"],
            "negative_is_net_loss": True,
            "not_homes_built": True,
            "label": "Net housing-unit change on permit-issued records (gross positive and gross negative disclosed)",
        },
        "quality": {
            "invalid_years": A003["date_class_permit"]["INVALID_YEAR"],
            "future_date_review": A003["date_class_permit"]["FUTURE_DATE_REVIEW_REQUIRED"],
            "valid_historical_permit_dates": A003["date_class_permit"]["VALID_HISTORICAL_DATE"],
            "old_permit_recent_process": A003["old_permit_recent_process"],
            "cost_outliers": A003["cost_outliers"],
        },
        "municipalities": {
            "canonical_current": A003["canonical_current_municipalities"],
            "current_reporting": A003["current_reporting"],
            "current_non_reporting": A003["current_non_reporting"],
            "observed_codes": A003["observed_codes"],
            "historical_or_inactive_codes": A003["historical_or_inactive_codes"],
            "non_reporters": geo["non_reporting_municipalities"],
            "state_rows": t["state_rows"],
            "state_p": p_state,
            "state_c": c_state,
            "state_semantics": "STATE rows are individual state-building records. They are not an additional municipality and are not additive to a municipal statewide total.",
        },
        "counties": county_activity(),
        "reconciliation": {
            "rows": recon,
            "note": "Source-row activity and official Construction Reporter calendar summaries are different products. Record counts remain valid at source-record grain. Calendar value/unit totals that do not reconcile stay blocked.",
        },
        "regulatory": {
            "wall": {
                "label": fam["NJ_WALL"]["public_label"],
                "rows": fam["NJ_WALL"]["rows"],
                "distinct": fam["NJ_WALL"]["distinct_source_ids"],
                "as_of": A001["acquisition"]["NJ_WALL"]["source_as_of"],
                "url": A001["acquisition"]["NJ_WALL"]["page"],
                "exact": fam["NJ_WALL"]["exact"],
                "unresolved": fam["NJ_WALL"]["unresolved"],
                "review_required": fam["NJ_WALL"]["review_required"],
            },
            "wage_watchlist": {
                "label": fam["NJ_WAGE_VIOLATION_WATCHLIST"]["public_label"],
                "rows": fam["NJ_WAGE_VIOLATION_WATCHLIST"]["rows"],
                "distinct": fam["NJ_WAGE_VIOLATION_WATCHLIST"]["distinct_source_ids"],
                "as_of": A001["acquisition"]["NJ_WAGE_VIOLATION_WATCHLIST"]["source_as_of"],
                "url": A001["acquisition"]["NJ_WAGE_VIOLATION_WATCHLIST"]["page"],
                "exact": fam["NJ_WAGE_VIOLATION_WATCHLIST"]["exact"],
                "unresolved": fam["NJ_WAGE_VIOLATION_WATCHLIST"]["unresolved"],
            },
            "treasury_construction": {
                "label": fam["NJ_TREASURY_CONSTRUCTION_DEBARMENT"]["public_label"],
                "rows": fam["NJ_TREASURY_CONSTRUCTION_DEBARMENT"]["rows"],
                "distinct": fam["NJ_TREASURY_CONSTRUCTION_DEBARMENT"]["distinct_source_ids"],
                "as_of": A001["acquisition"]["NJ_TREASURY_CONSTRUCTION_DEBARMENT"]["source_as_of"],
                "url": A001["acquisition"]["NJ_TREASURY_CONSTRUCTION_DEBARMENT"]["page"],
                "exact": fam["NJ_TREASURY_CONSTRUCTION_DEBARMENT"]["exact"],
            },
            "treasury_vendor": {
                "label": fam["NJ_TREASURY_VENDOR_DEBARMENT"]["public_label"],
                "rows": fam["NJ_TREASURY_VENDOR_DEBARMENT"]["rows"],
                "distinct": fam["NJ_TREASURY_VENDOR_DEBARMENT"]["distinct_source_ids"],
                "as_of": A001["acquisition"]["NJ_TREASURY_VENDOR_DEBARMENT"]["source_as_of"],
                "url": A001["acquisition"]["NJ_TREASURY_VENDOR_DEBARMENT"]["page"],
                "exact": fam["NJ_TREASURY_VENDOR_DEBARMENT"]["exact"],
            },
            "pwcr": {
                "coverage": "SOURCE_NOT_ACQUIRED",
                "rows_displayed": None,
                "barrier": A001["acquisition"]["NJ_PWCR_REGISTRATION"]["barrier"],
            },
            "absence_is_not_clean": True,
            "families_are_distinct": True,
        },
        "specialty": {
            "lead_evaluation": {"count": f2["NJ_LEAD_EVALUATION"]["parsed"], "url": f2["NJ_LEAD_EVALUATION"]["url"], "not_general_license": True},
            "lead_abatement": {"count": f2["NJ_LEAD_ABATEMENT"]["parsed"], "url": f2["NJ_LEAD_ABATEMENT"]["url"], "not_evaluation": True, "not_general_license": True},
            "asbestos_ascm": {"count": f2["NJ_ASCM_AUTHORIZATION"]["parsed"], "url": f2["NJ_ASCM_AUTHORIZATION"]["url"], "not_dol_abatement": True, "not_general_license": True},
            "fire_protection": {
                "count": f2["NJ_FIRE_PROTECTION_PERMIT"]["parsed"],
                "url": f2["NJ_FIRE_PROTECTION_PERMIT"]["url"],
                "classes_preserved": ["C1", "C2", "C3", "C4", "C5", "C6"],
                "subclass_counts_in_public_snapshot": None,
                "not_general_license": True,
            },
        },
        "safe_house": sh,
        "ocp": {
            "coverage": "PARTIAL_SOURCE_COVERAGE",
            "documents": f2["NJ_OCP_LEGAL_FILING"]["acquired_document_count"],
            "corpus_complete": False,
            "absence_claim_allowed": False,
            "url": f2["NJ_OCP_LEGAL_FILING"]["url"],
        },
        "local_dca_identity": {
            "license_index_size": A001["license_index_size"],
            "broad_auto_match": False,
            "name_only_attach": False,
        },
        "profile_modules": {
            "permit_attribution": None,
            "public_profile_links_rendered": 0,
            "exact_may_attach": True,
            "name_only_rejected": True,
            "review_unresolved_withheld": True,
            "absence_not_clean_copy": True,
        },
        "coverage_gaps": [
            {"id": "pwcr", "label": "PWCR machine-readable roster", "state": "SOURCE_NOT_ACQUIRED"},
            {"id": "prevailing-wage-debarment", "label": "Prevailing-wage debarment bulk list", "state": "SOURCE_NOT_ACQUIRED"},
            {"id": "contractor-attribution", "label": "Construction-record contractor/license fields", "state": "not safely attributable"},
            {"id": "project-id", "label": "Canonical project identity", "state": "not in source"},
            {"id": "combined-cost", "label": "Combined P+C construction value", "state": "BLOCKED_PENDING_DEFINITION"},
            {"id": "calendar-cost", "label": "2023–2025 calendar value/unit vs Reporter", "state": "BLOCKED_DUE_TO_RECONCILIATION"},
            {"id": "ocp", "label": "OCP legal filings", "state": "PARTIAL_SOURCE_COVERAGE"},
            {"id": "board-action", "label": "Board-action bulk index", "state": "SOURCE_NOT_ACQUIRED"},
            {"id": "new-home", "label": "New-home builder roster", "state": "SOURCE_NOT_ACQUIRED"},
            {"id": "hec", "label": "Home Elevation Contractor roster", "state": "SOURCE_NOT_ACQUIRED"},
            {"id": "local-identity", "label": "Local DCA identity auto-match", "state": "insufficient address/ZIP depth"},
        ],
        "invariants": {
            "total_ne_permits": True,
            "p_ne_c": True,
            "p_plus_c_cost_blocked": True,
            "candidate_ne_project": True,
            "state_ne_muni": True,
            "nov_ne_final": True,
            "proposed_ne_paid": True,
            "absence_ne_clean": True,
            "market_only": True,
            "no_ranking": True,
            "no_trust_score": True,
            "no_county_routes": True,
        },
    }
    snapshot["fingerprint"] = fingerprint(snapshot)
    return snapshot


def main() -> None:
    snap = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snap, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("wrote", OUT)
    print("fingerprint", snap["fingerprint"])


if __name__ == "__main__":
    main()
