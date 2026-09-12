#!/usr/bin/env python3
"""Build contractor-nyc-dob-pluto-intel-v1 from frozen artifacts."""
from __future__ import annotations

import copy
import gzip
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ACQ_DIR = ROOT / "data" / "new-york" / "nyc-con-002"
LIB = ROOT / "lib" / "new-york-city-dob-intelligence"
LIB.mkdir(parents=True, exist_ok=True)
VERSION = "contractor-nyc-dob-pluto-intel-v1"
VOLATILE = frozenset({"fingerprint", "generated_at"})


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def semantic_body(obj: dict) -> dict:
    out = {}
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


def core_id(value: str) -> str:
    text = value.upper().replace("-DCA", "").replace("DCA", "")
    digits = "".join(ch for ch in text if ch.isdigit()).lstrip("0")
    return digits


def main() -> None:
    acq = json.loads((ACQ_DIR / "acquire-report.json").read_text(encoding="utf-8"))
    licenses = json.loads((ROOT / "data/new-york/nyc-con-001/licenses.json").read_text(encoding="utf-8"))
    dcwp_cores = {core_id(str(r.get("license_nbr") or "")) for r in licenses}
    dcwp_cores.discard("")
    legacy = json.loads(gzip.decompress((ACQ_DIR / "legacy-permits.json.gz").read_bytes()).decode("utf-8"))
    hic_values = [str(r.get("hic_license") or "").strip() for r in legacy if str(r.get("hic_license") or "").strip()]
    exact_hic = {v for v in hic_values if core_id(v) in dcwp_cores}
    hic_cores = {core_id(v) for v in hic_values if core_id(v)}
    exact_hic_cores = {core_id(v) for v in exact_hic if core_id(v)}
    review_hic_cores = hic_cores - exact_hic_cores
    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    D = acq["dob_now"]
    L = acq["legacy"]
    P = acq["pluto"]
    K = acq["linking"]
    union_bbls = D["distinct_bbls"] + L["distinct_bbls"] - acq["overlap"]["shared_bbls"]
    union_bins = D["distinct_bins"] + L["distinct_bins"] - acq["overlap"]["shared_bins"]
    bbls_without_pluto = union_bbls - P["distinct_bbls"]
    work_map = {
        "General Construction": "general construction",
        "Plumbing": "plumbing",
        "Mechanical Systems": "mechanical",
        "Structural": "structural",
        "Foundation": "structural",
        "Full Demolition": "demolition",
        "Solar": "equipment",
        "Boiler Equipment": "equipment",
        "Green Roof": "roofing",
        "Construction Fence": "other",
        "Sidewalk Shed": "other",
        "Supported Scaffold": "other",
        "Suspended Scaffold": "other",
        "Sprinklers": "other",
        "Standpipe": "other",
        "Sign": "other",
        "Antenna": "other",
        "Curb Cut": "other",
        "Earth Work": "other",
        "Support of Excavation": "other",
        "Protection and Mechanical Methods": "other",
    }
    body = {
        "version": VERSION,
        "ticket": "NYC-CON-002A",
        "as_of": "2026-09-12",
        "no_trust_score": True,
        "no_ranking": True,
        "no_borough_pages": True,
        "no_acris": True,
        "no_hpd_dob_violations": True,
        "not_a_second_nyc_page": True,
        "extends_existing_route": "/new-york/new-york-city",
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/new-york/new-york-city",
            "route": "/new-york/new-york-city",
            "module": "Property & Permit Intelligence",
        },
        "clocks": {
            "generatedAt": generated,
            "snapshotAsOf": "2026-09-12",
            "dob_now": {
                "sourceUpdatedAt": D["rowsUpdatedAt"],
                "sourceAsOf": D["rowsUpdatedAt"],
                "retrievedAt": D["retrievedAt"],
            },
            "legacy": {
                "sourceUpdatedAt": L["rowsUpdatedAt"],
                "sourceAsOf": L["rowsUpdatedAt"],
                "retrievedAt": L["retrievedAt"],
            },
            "pluto": {
                "sourceUpdatedAt": P["rowsUpdatedAt"],
                "sourceAsOf": P["rowsUpdatedAt"],
                "release": "26v2",
                "retrievedAt": P["retrievedAt"],
            },
            "do_not_use_one_master_date": True,
        },
        "window": {
            "start": acq["window_start"],
            "end": acq["window_end"],
            "reason": acq["window_reason"],
            "missing_older_history_ne_no_older_permit": True,
        },
        "hero": {
            "dobnow_value": D["parsed_rows"],
            "dobnow_label": "DOB NOW approved-permit observations (24-month issued window)",
            "dobnow_hint": "Issued-date rows in DOB NOW: Build – Approved Permits. Not unique contractors and not completed jobs.",
            "bbl_value": D["distinct_bbls"],
            "bbl_label": "Distinct DOB NOW BBLs with permit activity",
            "bin_value": D["distinct_bins"],
            "bin_label": "Distinct DOB NOW BINs with permit activity",
            "pluto_value": P["matched_rows"],
            "pluto_label": "PLUTO tax lots matched by exact BBL",
            "pluto_hint": "PLUTO 26v2 lot context. Not title, ownership, or contractor identity. PLUTO has no BIN column.",
        },
        "dob_now": {
            "dataset_id": "rbx6-tga4",
            "official_title": D["dataset_name"],
            "source_url": D["source_url"],
            "coverage_state": "ACQUIRED_BOUNDED_ISSUED_WINDOW",
            "grain": "dob_now_approved_permit_observation",
            "window_start": acq["window_start"],
            "window_end": acq["window_end"],
            "parsed_rows": D["parsed_rows"],
            "distinct_permit_ids": D["distinct_work_permits"],
            "distinct_job_filing_numbers": D["distinct_job_filing_numbers"],
            "rows_with_bbl": D["rows_with_bbl"],
            "rows_with_bin": D["rows_with_bin"],
            "distinct_bbls": D["distinct_bbls"],
            "distinct_bins": D["distinct_bins"],
            "work_type_counts": D["work_type_counts"],
            "permit_status_counts": D["permit_status_counts"],
            "permittee_license_type_counts": D["permittee_license_type_counts"],
            "issued_min": D["issued_min"],
            "issued_max": D["issued_max"],
            "raw_sha256": D["sha256"],
            "permit_ne_job_ne_filing": True,
            "permit_row_ne_contractor": True,
            "issued_ne_completed": True,
            "expired_ne_violation": True,
        },
        "legacy": {
            "dataset_id": "ipu4-2q9a",
            "official_title": L["dataset_name"],
            "source_url": L["source_url"],
            "coverage_state": "ACQUIRED_BOUNDED_COMPLEMENTARY_WINDOW",
            "grain": "dob_bis_permit_issuance_observation",
            "parsed_rows": L["parsed_rows"],
            "distinct_permit_ids": L["distinct_permit_si_no"],
            "distinct_job_ids": L["distinct_job_numbers"],
            "rows_with_bbl": L["rows_with_bbl"],
            "rows_with_bin": L["rows_with_bin"],
            "distinct_bbls": L["distinct_bbls"],
            "distinct_bins": L["distinct_bins"],
            "work_type_counts": L["work_type_counts"],
            "permit_type_counts": L["permit_type_counts"],
            "issued_min": L["issued_min"],
            "issued_max": L["issued_max"],
            "raw_sha256": L["sha256"],
            "do_not_sum_with_dobnow": True,
            "shared_bbls_with_dobnow": acq["overlap"]["shared_bbls"],
            "shared_bins_with_dobnow": acq["overlap"]["shared_bins"],
        },
        "pluto": {
            "dataset_id": "64uk-42ks",
            "official_title": P["dataset_name"],
            "source_url": P["source_url"],
            "release": "26v2",
            "universe_rows": P["universe_rows"],
            "matched_rows": P["matched_rows"],
            "distinct_bbls": P["distinct_bbls"],
            "no_bin_column": True,
            "condo_lots": P["condo_lots"],
            "addresses_with_multiple_bbls": P["addresses_with_multiple_bbls"],
            "ownername_populated": P["ownername_populated"],
            "ownername_is_tax_lot_context_not_title": True,
            "not_ownership_proof": True,
            "not_acris": True,
            "raw_sha256": P["sha256"],
        },
        "identity": {
            "bbl_namespace": "NYC-BBL:{bbl}",
            "bin_namespace": "NYC-BIN:{bin}",
            "dobnow_permit_namespace": "NYC-DOBNOW-PERMIT:{work_permit}",
            "dobnow_job_namespace": "NYC-DOBNOW-JOB:{job_filing_number}",
            "legacy_permit_namespace": "NYC-DOB-BIS-PERMIT:{permit_si_no}",
            "legacy_job_namespace": "NYC-DOB-JOB:{job_number}",
            "bbl_ne_bin": True,
            "permit_ne_job_ne_filing": True,
            "name_only": "UNSAFE",
            "address_only_auto_attach": "REJECTED",
            "normalized_address": "REVIEW_REQUIRED",
            "precedence": ["DOB BBL exact", "DOB BIN exact", "normalized address REVIEW_REQUIRED", "address-only rejected"],
        },
        "work_type_display": {
            "keeps_source_labels": True,
            "mapping": work_map,
            "unmapped_remain_source": True,
            "no_text_classification_of_job_description": True,
        },
        "linking": {
            "exact_dob_pluto_bbl": K["exact_any_dob_pluto_bbl"],
            "exact_dobnow_pluto_bbl": K["exact_dobnow_pluto_bbl"],
            "exact_dcwp_dob_bbl": K["exact_dcwp_dob_bbl"],
            "exact_dcwp_dob_bin": K["exact_dcwp_dob_bin"],
            "property_level_ne_contractor_performed_the_work": True,
            "exact_legacy_hic_to_dcwp_license": len(exact_hic),
            "legacy_hic_populated": len(hic_values),
            "dob_gc_license_ne_dcwp_hic": True,
            "applicant_ne_contractor": True,
            "pe_ra_ne_general_contractor": True,
            "owner_ne_contractor": True,
            "filing_representative_ne_permittee": True,
            "review_required_dob_actor_associations": len(review_hic_cores),
            "review_required_dob_actor_associations_meaning": "Distinct legacy hic_license cores considered against DCWP HIC license cores that did not exact-match. Not DOB NOW permit observation rows.",
            "dobnow_applicant_license_dcwp_crosswalk": "NOT_EVALUATED",
            "dobnow_applicant_license_dcwp_crosswalk_meaning": "DOB NOW applicant_license and permittee_s_license_type are DOB namespaces. They were not treated as DCWP HIC crosswalk candidates.",
            "rejected_name_only": 0,
            "rejected_name_only_meaning": "No name-only crosswalk was attempted or applied. This is not a clearance of all names.",
            "exact_profile_attachments": 0,
            "exact_dob_contractor_id_associations": len(exact_hic_cores),
        },
        "claim_eligibility": {"broadened": False, "property_identity_is_not_customer_identity": True},
        "expansion_ledger": {
            "NYC_DOBNOW_PERMIT_ROWS": D["parsed_rows"],
            "NYC_DOBNOW_DISTINCT_PERMIT_IDS": D["distinct_work_permits"],
            "NYC_DOBNOW_DISTINCT_JOB_IDS": D["distinct_job_filing_numbers"],
            "NYC_DOBNOW_ROWS_WITH_BBL": D["rows_with_bbl"],
            "NYC_DOBNOW_ROWS_WITH_BIN": D["rows_with_bin"],
            "NYC_DOBNOW_DISTINCT_BBLS": D["distinct_bbls"],
            "NYC_DOBNOW_DISTINCT_BINS": D["distinct_bins"],
            "NYC_LEGACY_PERMIT_ROWS": L["parsed_rows"],
            "NYC_LEGACY_DISTINCT_PERMIT_IDS": L["distinct_permit_si_no"],
            "NYC_LEGACY_DISTINCT_JOB_IDS": L["distinct_job_numbers"],
            "NYC_PLUTO_ROWS": P["matched_rows"],
            "NYC_PLUTO_UNIVERSE_ROWS": P["universe_rows"],
            "NYC_PLUTO_DISTINCT_BBLS": P["distinct_bbls"],
            "NYC_PLUTO_DISTINCT_BINS": None,
            "NYC_DOBNOW_DISTINCT_BIN_IDENTITIES": D["distinct_bins"],
            "NYC_ALL_ACQUIRED_DISTINCT_BIN_IDENTITIES": union_bins,
            "NET_NEW_LOCAL_BBL_IDENTITIES": union_bbls,
            "NET_NEW_LOCAL_BIN_IDENTITIES": union_bins,
            "PLUTO_MATCHED_BBL_IDENTITIES": P["distinct_bbls"],
            "DOB_BBLS_WITHOUT_PLUTO_MATCH": bbls_without_pluto,
            "NET_NEW_DOBNOW_PERMIT_IDENTITIES": D["distinct_work_permits"],
            "NET_NEW_LEGACY_BIS_PERMIT_IDENTITIES": L["distinct_permit_si_no"],
            "EXACT_DOB_PLUTO_BBL_ASSOCIATIONS": K["exact_any_dob_pluto_bbl"],
            "EXACT_DCWP_DOB_BBL_ASSOCIATIONS": K["exact_dcwp_dob_bbl"],
            "EXACT_DCWP_DOB_BIN_ASSOCIATIONS": K["exact_dcwp_dob_bin"],
            "EXACT_DCWP_PROPERTY_ASSOCIATIONS": K["exact_dcwp_dob_bbl"],
            "EXACT_DOB_CONTRACTOR_ID_ASSOCIATIONS": len(exact_hic_cores),
            "REVIEW_REQUIRED_DOB_ACTOR_ASSOCIATIONS": len(review_hic_cores),
            "REVIEW_REQUIRED_DOB_ACTOR_ASSOCIATIONS_meaning": "Distinct legacy hic_license cores considered for DCWP linkage that did not exact-match. A DOB NOW permit observation row is not an actor association.",
            "REJECTED_NAME_ONLY_DOB_ASSOCIATIONS": 0,
            "REJECTED_NAME_ONLY_DOB_ASSOCIATIONS_meaning": "No name-only crosswalk was attempted or applied. This is not a clearance of all names.",
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "do_not_sum_permits_jobs_bbls_bins_pluto": True,
            "no_combined_property_identity_headline": True,
            "no_combined_permit_identity_headline": True,
            "bbl_ne_bin": True,
            "dobnow_permit_namespace_ne_bis_permit_namespace": True,
            "baselines": {
                "prior_accepted_nyc_dobnow_permit_ids": 0,
                "prior_accepted_nyc_legacy_bis_permit_ids": 0,
                "prior_accepted_nyc_bbl_identities": 0,
                "prior_accepted_nyc_bin_identities": 0,
                "prior_accepted_nyc_pluto_bbls": 0,
            },
        },
        "gate": {"passed": True, "live_cohort_not_inflated": True, "not_a_second_nyc_local_page": True},
        "generated_at": generated,
    }
    fp1 = fingerprint(body)
    alt = copy.deepcopy(body)
    alt["generated_at"] = "2099-01-01T00:00:00Z"
    alt["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
    if fingerprint(alt) != fp1:
        raise SystemExit("generatedAt leaked")
    body["fingerprint"] = fp1
    (LIB / "accepted-snapshot.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    (ACQ_DIR / "accepted-snapshot.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "fingerprint": fp1,
        "dobnow": D["parsed_rows"],
        "union_bbls": union_bbls,
        "union_bins": union_bins,
        "bbls_without_pluto": bbls_without_pluto,
        "hic_exact_cores": len(exact_hic_cores),
        "review_hic_cores": len(review_hic_cores),
    }, indent=2))


if __name__ == "__main__":
    main()
