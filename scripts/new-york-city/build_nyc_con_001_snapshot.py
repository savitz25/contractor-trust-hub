#!/usr/bin/env python3
"""Build contractor-nyc-dcwp-intel-v1 from frozen NYC DCWP artifacts."""
from __future__ import annotations

import copy
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ACQ_DIR = ROOT / "data" / "new-york" / "nyc-con-001"
LIB = ROOT / "lib" / "new-york-city-intelligence"
LIB.mkdir(parents=True, exist_ok=True)
VERSION = "contractor-nyc-dcwp-intel-v1"
VOLATILE = frozenset({"fingerprint", "generated_at"})


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def semantic_body(obj: dict) -> dict:
    out: dict = {}
    for key, value in obj.items():
        if key in VOLATILE:
            continue
        if key == "clocks" and isinstance(value, dict):
            clocks = {}
            for ck, cv in value.items():
                if ck == "generatedAt":
                    continue
                if isinstance(cv, dict):
                    clocks[ck] = {ik: iv for ik, iv in cv.items() if ik != "generatedAt"}
                else:
                    clocks[ck] = cv
            out[key] = clocks
        else:
            out[key] = value
    return out


def fingerprint(body: dict) -> str:
    return hashlib.sha256(dump(semantic_body(body)).encode("utf-8")).hexdigest()


def load_json(name: str):
    return json.loads((ACQ_DIR / name).read_text(encoding="utf-8"))


def ids(rows: list[dict], field: str) -> set[str]:
    out = set()
    for row in rows:
        value = str(row.get(field) or "").strip()
        if value:
            out.add(value)
    return out


def main() -> None:
    acq = load_json("acquire-report.json")
    licenses = load_json("licenses.json")
    complaints = load_json("complaints.json")
    charges = load_json("charges.json")
    inspections = load_json("inspections.json")

    lic_buids = ids(licenses, "business_unique_id")
    lic_nrs = ids(licenses, "license_nbr")
    cmp_buids = ids(complaints, "business_unique_id")
    chg_buids = ids(charges, "business_unique_id")
    ins_buids = ids(inspections, "business_unique_id")
    ins_lics = ids(inspections, "dcwp_license_number")

    exact_cmp = lic_buids & cmp_buids
    exact_chg = lic_buids & chg_buids
    exact_ins = lic_buids & ins_buids
    exact_any = exact_cmp | exact_chg | exact_ins
    exact_lic_ins = lic_nrs & ins_lics
    cmp_rows_exact = sum(1 for r in complaints if str(r.get("business_unique_id") or "").strip() in lic_buids)
    chg_rows_exact = sum(1 for r in charges if str(r.get("business_unique_id") or "").strip() in lic_buids)
    ins_rows_exact = sum(1 for r in inspections if str(r.get("business_unique_id") or "").strip() in lic_buids)
    ins_rows_lic = sum(1 for r in inspections if str(r.get("dcwp_license_number") or "").strip() in lic_nrs)

    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    L = acq["licenses"]
    C = acq["complaints"]
    H = acq["charges"]
    I = acq["inspections"]
    K = acq["linking"]

    wall = {
        "coverage": "PUBLIC_RESEARCH_PATH",
        "grabbed_as": "official_html_warning_list",
        "source_url": "https://www.nyc.gov/site/dca/consumers/Wall-of-Shame-Unlicensed-Home-Improvement-Contractors.page",
        "sourceAsOf": "2026-09-01",
        "sourceAsOf_meaning": "DCWP page note: Wall of Shame information current as of 09/01/2026",
        "names": [
            "Alexander Gregg",
            "AM Lux Contracting Corp",
            "Apex Masonry Roofing Solutions Inc.",
            "Big John's Roofing LLC",
            "DRM Construction Corp",
            "Gem Air Inc.",
            "J. I Casa Remodeling Corporation",
            "Jeeta Construction Corp",
            "John Kot",
            "Local Nj Masonry & Restoration Corp",
            "Lucarelli Construction Inc",
            "Michael Hall",
            "R S Stone Construction Incorporated",
            "Riasat Ali Mohammad",
            "Salvatore Scalise",
            "Sydan Global",
            "Top Nj Home Improvement Inc",
            "Umbrella Contracting Corp",
            "Vishaam Singh",
        ],
        "name_count": 19,
        "name_only_attachment": "UNSAFE",
        "unlicensed_ne_criminal_conviction": True,
        "not_a_trusthub_blacklist": True,
        "auto_matched_to_hic_licenses": 0,
        "update_cadence": "monthly HTML list; Search Business is updated daily",
    }

    body = {
        "version": VERSION,
        "ticket": "NYC-CON-001A",
        "as_of": "2026-09-12",
        "no_trust_score": True,
        "no_ranking": True,
        "no_borough_pages": True,
        "no_dob_pluto": True,
        "no_acris": True,
        "no_westchester_nassau_suffolk": True,
        "not_statewide_nysdol_public_work": True,
        "not_dob_general_contractor": True,
        "not_all_nyc_contractors": True,
        "absence_from_hic_ne_illegal_for_every_construction_type": True,
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/new-york/new-york-city",
            "route": "/new-york/new-york-city",
            "h1": "New York City Home Improvement Contractor Intelligence",
            "statewide_handoff": "/new-york",
        },
        "clocks": {
            "generatedAt": generated,
            "snapshotAsOf": "2026-09-12",
            "snapshotAsOf_meaning": "Immutable reference date for this accepted capture",
            "licenses": {
                "sourceUpdatedAt": L["rowsUpdatedAt"],
                "sourceAsOf": L["rowsUpdatedAt"],
                "sourceAsOf_meaning": "Official Socrata rowsUpdatedAt converted to a UTC calendar date",
                "retrievedAt": L["retrievedAt"],
            },
            "complaints": {
                "sourceUpdatedAt": C["rowsUpdatedAt"],
                "sourceAsOf": C["rowsUpdatedAt"],
                "sourceAsOf_meaning": "Official Socrata rowsUpdatedAt converted to a UTC calendar date",
                "retrievedAt": C["retrievedAt"],
            },
            "charges": {
                "sourceUpdatedAt": H["rowsUpdatedAt"],
                "sourceAsOf": H["rowsUpdatedAt"],
                "sourceAsOf_meaning": "Official Socrata rowsUpdatedAt converted to a UTC calendar date",
                "retrievedAt": H["retrievedAt"],
            },
            "inspections": {
                "sourceUpdatedAt": I["rowsUpdatedAt"],
                "sourceAsOf": I["rowsUpdatedAt"],
                "sourceAsOf_meaning": "Official Socrata rowsUpdatedAt converted to a UTC calendar date",
                "retrievedAt": I["retrievedAt"],
            },
            "wall_of_shame": {
                "sourceAsOf": wall["sourceAsOf"],
                "sourceAsOf_meaning": wall["sourceAsOf_meaning"],
            },
            "do_not_use_one_master_date": True,
        },
        "hero": {
            "universe_value": L["active_distinct_license_ids"],
            "universe_label": "Source-native Active NYC DCWP HIC license IDs",
            "universe_hint": "Active license_status rows in the Home Improvement Contractor slice. Not unique companies. Frozen Open Data is not live verification.",
            "buid_value": L["distinct_business_unique_ids"],
            "buid_label": "Distinct DCWP Business Unique IDs in the HIC slice",
            "buid_hint": "Business Unique ID is the preferred same-DCWP evidence bridge. It is not a ContractorTrustHub canonical organization.",
            "complaint_exact_value": len(exact_cmp),
            "complaint_exact_label": "HIC businesses with exact BUID complaint observations",
            "inspection_exact_value": len(exact_ins),
            "inspection_exact_label": "HIC businesses with exact BUID inspection observations",
            "charge_exact_value": len(exact_chg),
            "charge_exact_label": "HIC businesses with exact BUID charge observations",
            "as_of_value": L["rowsUpdatedAt"],
            "as_of_label": "Issued Licenses rows-updated date",
        },
        "licenses": {
            "program": "NYC Department of Consumer and Worker Protection — Home Improvement Contractor license",
            "dataset_id": "w7w3-xahh",
            "source_url": "https://data.cityofnewyork.us/Business/Issued-Licenses/w7w3-xahh",
            "api_docs": "https://dev.socrata.com/foundry/data.cityofnewyork.us/w7w3-xahh",
            "verify_url": "https://a866-dcwpbp.nyc.gov/search",
            "verify_landing": "https://www.nyc.gov/site/dca/consumers/check-license.page",
            "scope_url": "https://www.nyc.gov/site/dca/consumers/shopping-services-home-improvement.page",
            "coverage_state": "ACQUIRED_CURRENT_SNAPSHOT",
            "hic_business_category": "Home Improvement Contractor",
            "did_not_use_community_filtered_view": True,
            "grain": "dcwp_hic_license_row",
            "raw_rows": L["raw_rows"],
            "parsed_rows": L["parsed_rows"],
            "rejected_rows": L["rejected_rows"],
            "distinct_license_ids": L["distinct_license_ids"],
            "rows_without_license_nbr": L["rows_without_license_nbr"],
            "rows_without_business_unique_id": L["rows_without_business_unique_id"],
            "duplicate_extra_license_nbr_rows": L["duplicate_extra_license_nbr_rows"],
            "duplicate_extra_business_unique_id_rows": L["duplicate_extra_business_unique_id_rows"],
            "distinct_business_unique_ids": L["distinct_business_unique_ids"],
            "license_status_counts": L["license_status_counts"],
            "license_type_counts": L["license_type_counts"],
            "borough_counts": L["borough_counts"],
            "nyc_borough_address_rows": L["nyc_borough_address_rows"],
            "non_nyc_borough_address_rows": L["non_nyc_borough_address_rows"],
            "active_rows": L["active_rows"],
            "active_distinct_license_ids": L["active_distinct_license_ids"],
            "active_distinct_business_unique_ids": L["active_distinct_business_unique_ids"],
            "buid_name_conflicts": L["buid_name_conflicts"],
            "status_is_source_native": True,
            "did_not_manufacture_active_from_dates": True,
            "raw_sha256": L["raw_sha256"],
            "license_ne_unique_legal_company": True,
            "buid_ne_canonical_organization": True,
            "business_address_ne_service_territory": True,
            "bbl_ne_business_identity": True,
            "bin_ne_business_identity": True,
        },
        "identity": {
            "license_namespace": "NYC-DCWP-LICENSE:{license_nbr}",
            "business_namespace": "NYC-DCWP-BUSINESS:{business_unique_id}",
            "license_ne_business_unique_id": True,
            "one_business_may_have_multiple_license_rows": True,
            "name_only": "UNSAFE",
            "name_plus_address": "REVIEW_REQUIRED",
            "precedence": [
                "Business Unique ID exact",
                "license number exact",
                "REVIEW_REQUIRED",
                "name-only rejected",
            ],
        },
        "complaints": {
            "dataset_id": "nre2-6m2s",
            "source_url": "https://data.cityofnewyork.us/Business/DCWP-Consumer-Complaints/nre2-6m2s",
            "coverage_state": "ACQUIRED_HIC_CATEGORY_SLICE",
            "grain": "dcwp_consumer_complaint_observation",
            "raw_rows": C["raw_rows"],
            "parsed_rows": C["parsed_rows"],
            "distinct_record_ids": C["distinct_record_ids"],
            "rows_without_business_unique_id": C["rows_without_business_unique_id"],
            "distinct_business_unique_ids": C["distinct_business_unique_ids"],
            "result_counts": C["result_counts"],
            "intake_min": C["intake_min"],
            "intake_max": C["intake_max"],
            "no_license_nbr_field": True,
            "complaint_ne_violation": True,
            "complaint_ne_substantiated_complaint": True,
            "complaint_mediation_ne_adjudicated_wrongdoing": True,
            "complaint_count_ne_company_quality": True,
            "no_clean_history_from_absence": True,
            "raw_sha256": C["raw_sha256"],
            "exact_buid_overlap_with_hic_licenses": len(exact_cmp),
            "exact_buid_observation_rows": cmp_rows_exact,
        },
        "charges": {
            "dataset_id": "5fn4-dr26",
            "source_url": "https://data.cityofnewyork.us/Business/DCWP-Charges/5fn4-dr26",
            "coverage_state": "ACQUIRED_HIC_CATEGORY_SLICE",
            "grain": "dcwp_charge_observation",
            "raw_rows": H["raw_rows"],
            "parsed_rows": H["parsed_rows"],
            "distinct_record_ids": H["distinct_record_ids"],
            "rows_without_business_unique_id": H["rows_without_business_unique_id"],
            "distinct_business_unique_ids": H["distinct_business_unique_ids"],
            "outcome_counts": H["outcome_counts"],
            "related_record_type_counts": H["related_record_type_counts"],
            "violation_date_min": H["violation_date_min"],
            "violation_date_max": H["violation_date_max"],
            "charge_ne_violation_finding": True,
            "charge_ne_conviction": True,
            "charge_row_ne_unique_contractor": True,
            "investigation_ne_guilt": True,
            "do_not_flatten_to_violations": True,
            "raw_sha256": H["raw_sha256"],
            "exact_buid_overlap_with_hic_licenses": len(exact_chg),
            "exact_buid_observation_rows": chg_rows_exact,
        },
        "inspections": {
            "dataset_id": "jzhd-m6uv",
            "source_url": "https://data.cityofnewyork.us/Business/DCWP-Inspections/jzhd-m6uv",
            "coverage_state": "ACQUIRED_HIC_CATEGORY_SLICE",
            "grain": "dcwp_inspection_observation",
            "category_variants": acq["inspection_category_variants"],
            "raw_rows": I["raw_rows"],
            "parsed_rows": I["parsed_rows"],
            "distinct_inspection_numbers": I["distinct_inspection_numbers"],
            "rows_without_business_unique_id": I["rows_without_business_unique_id"],
            "rows_without_dcwp_license_number": I["rows_without_dcwp_license_number"],
            "distinct_business_unique_ids": I["distinct_business_unique_ids"],
            "inspection_type_counts": I["inspection_type_counts"],
            "inspection_status_counts": I["inspection_status_counts"],
            "rows_with_bbl": I["rows_with_bbl"],
            "rows_with_bin": I["rows_with_bin"],
            "date_min": I["date_min"],
            "date_max": I["date_max"],
            "inspection_ne_violation": True,
            "business_education_ne_adverse": True,
            "unable_to_locate_ne_unlicensed": True,
            "closed_status_ne_business_closure": True,
            "inspection_count_ne_quality": True,
            "raw_sha256": I["raw_sha256"],
            "exact_buid_overlap_with_hic_licenses": len(exact_ins),
            "exact_buid_observation_rows": ins_rows_exact,
            "exact_license_nbr_overlap_with_hic_licenses": len(exact_lic_ins),
            "exact_license_nbr_observation_rows": ins_rows_lic,
        },
        "linking": {
            "license_buids": K["license_buids"],
            "complaint_buids": K["complaint_buids"],
            "charge_buids": K["charge_buids"],
            "inspection_buids": K["inspection_buids"],
            "exact_buid_license_complaint": len(exact_cmp),
            "exact_buid_license_charge": len(exact_chg),
            "exact_buid_license_inspection": len(exact_ins),
            "exact_buid_any_evidence": len(exact_any),
            "exact_license_nbr_license_inspection": len(exact_lic_ins),
            "complaint_buids_not_in_hic_licenses": K["complaint_buids_not_in_hic_licenses"],
            "charge_buids_not_in_hic_licenses": K["charge_buids_not_in_hic_licenses"],
            "inspection_buids_not_in_hic_licenses": K["inspection_buids_not_in_hic_licenses"],
            "buid_name_conflicts_in_hic_licenses": L["buid_name_conflicts"],
            "name_only": "UNSAFE",
            "name_plus_address": "REVIEW_REQUIRED",
            "review_required_crosswalks": 0,
            "rejected_name_only_crosswalks": 0,
        },
        "wall_of_shame": wall,
        "archive": {
            "coverage": "HISTORICAL_ARCHIVE_NOT_ACQUIRED",
            "reason": "No cheap same-schema archived HIC extract was required to ship the current Open Data slices.",
        },
        "claim_eligibility": {
            "broadened": False,
            "buid_is_not_customer_account_identity": True,
        },
        "expansion_ledger": {
            "NYC_DCWP_HIC_LICENSE_ROWS": L["parsed_rows"],
            "NYC_DCWP_HIC_DISTINCT_LICENSE_IDS": L["distinct_license_ids"],
            "NYC_DCWP_HIC_ACTIVE_LICENSE_ROWS": L["active_rows"],
            "NYC_DCWP_HIC_ACTIVE_DISTINCT_LICENSE_IDS": L["active_distinct_license_ids"],
            "NYC_DCWP_HIC_DISTINCT_BUSINESS_IDS": L["distinct_business_unique_ids"],
            "NYC_DCWP_COMPLAINT_OBSERVATIONS": C["parsed_rows"],
            "NYC_DCWP_COMPLAINT_DISTINCT_BUSINESS_IDS": C["distinct_business_unique_ids"],
            "NYC_DCWP_INSPECTION_OBSERVATIONS": I["parsed_rows"],
            "NYC_DCWP_INSPECTION_DISTINCT_BUSINESS_IDS": I["distinct_business_unique_ids"],
            "NYC_DCWP_CHARGE_OBSERVATIONS": H["parsed_rows"],
            "NYC_DCWP_CHARGE_DISTINCT_BUSINESS_IDS": H["distinct_business_unique_ids"],
            "EXACT_DCWP_BUSINESS_ID_RESEARCH_ASSOCIATIONS": len(exact_any),
            "EXACT_DCWP_LICENSE_RESEARCH_ASSOCIATIONS": len(exact_lic_ins),
            "REVIEW_REQUIRED_CROSSWALKS": 0,
            "REJECTED_NAME_ONLY_CROSSWALKS": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "NET_NEW_LOCAL_RESEARCH_IDENTITIES": L["distinct_license_ids"],
            "NET_NEW_LOCAL_RESEARCH_IDENTITIES_baseline": {
                "prior_accepted_nyc_dcwp_hic_license_ids": 0,
                "definition": "Distinct NYC-DCWP-LICENSE identities over an empty prior NYC HIC baseline. Business Unique IDs are a bridge identity and are not added to this count.",
            },
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "do_not_sum_licenses_complaints_charges_inspections": True,
        },
        "gate": {
            "passed": True,
            "live_cohort_not_inflated": True,
            "not_a_statewide_page": True,
        },
        "gaps": {
            "dob_permits_pluto": "FUTURE",
            "acris": "FUTURE",
            "hpd_dob_violations": "FUTURE",
            "westchester_nassau_suffolk": "FUTURE",
            "historical_archive": "HISTORICAL_ARCHIVE_NOT_ACQUIRED",
        },
        "generated_at": generated,
    }

    fp1 = fingerprint(body)
    alt = copy.deepcopy(body)
    alt["generated_at"] = "2099-01-01T00:00:00Z"
    alt["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
    if fingerprint(alt) != fp1:
        raise SystemExit("generation timestamps leaked into the semantic fingerprint")
    body["fingerprint"] = fp1

    (LIB / "accepted-snapshot.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    (ACQ_DIR / "accepted-snapshot.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"fingerprint": fp1, "active": L["active_distinct_license_ids"], "exact_buid_any": len(exact_any)}, indent=2))


if __name__ == "__main__":
    main()
