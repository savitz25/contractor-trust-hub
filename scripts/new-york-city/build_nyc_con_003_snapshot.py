#!/usr/bin/env python3
"""Build contractor-nyc-acris-intel-v1 from frozen artifacts."""
from __future__ import annotations

import copy
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ACQ_DIR = ROOT / "data" / "new-york" / "nyc-con-003"
LIB = ROOT / "lib" / "new-york-city-acris-intelligence"
LIB.mkdir(parents=True, exist_ok=True)
VERSION = "contractor-nyc-acris-intel-v1"
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


def main() -> None:
    acq = json.loads((ACQ_DIR / "acquire-report.json").read_text(encoding="utf-8"))
    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    M = acq["master"]
    L = acq["legals"]
    K = acq["linking"]
    C = acq["coverage"]
    groups = M["display_group_counts"]
    body = {
        "version": VERSION,
        "ticket": "NYC-CON-003A",
        "as_of": "2026-09-12",
        "no_trust_score": True,
        "no_ranking": True,
        "no_borough_pages": True,
        "no_hpd_dob_violations": True,
        "no_title_chain": True,
        "no_beneficial_ownership": True,
        "not_a_second_nyc_page": True,
        "extends_existing_route": "/new-york/new-york-city",
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/new-york/new-york-city",
            "route": "/new-york/new-york-city",
            "module": "Recorded Property Documents",
        },
        "clocks": {
            "generatedAt": generated,
            "snapshotAsOf": "2026-09-12",
            "master": {"sourceUpdatedAt": M["rowsUpdatedAt"], "sourceAsOf": M["rowsUpdatedAt"], "retrievedAt": M["retrievedAt"]},
            "legals": {"sourceUpdatedAt": L["rowsUpdatedAt"], "sourceAsOf": L["rowsUpdatedAt"], "retrievedAt": L["retrievedAt"]},
            "window_date_basis": "recorded_datetime",
            "do_not_use_one_master_date": True,
        },
        "window": {
            "start": acq["window_start"],
            "end": acq["window_end"],
            "date_field": acq["date_field"],
            "why": acq["date_field_why"],
            "recorded_min": M["recorded_min"],
            "recorded_max": M["recorded_max"],
            "missing_older_history_ne_no_older_documents": True,
        },
        "hero": {
            "master_value": M["parsed_rows"],
            "master_label": "ACRIS Master document observations (recorded in 24-month window)",
            "master_hint": "Recorded/filed documents. Not sales, not current owners, not a title search.",
            "docs_value": M["distinct_document_ids"],
            "docs_label": "Distinct ACRIS document IDs",
            "bbl_value": K["distinct_bbls"],
            "bbl_label": "Distinct exact BBLs on ACRIS legal rows",
            "spine_value": K["acris_bbls_in_permit_spine"],
            "spine_label": "Exact BBL overlap with NYC permit/property spine",
            "deed_value": groups.get("deed", 0),
            "deed_label": "Deed-type document observations",
            "deed_hint": "A deed-type document is not automatically an arm’s-length sale or current ownership.",
            "mtge_value": groups.get("mortgage", 0),
            "mtge_label": "Mortgage-type document observations",
            "mtge_hint": "A recorded mortgage document is not current balance, holder, or NMLS identity.",
        },
        "master": {
            "dataset_id": "bnx9-e6tj",
            "official_title": M["dataset_name"],
            "agency": M["attribution"],
            "source_url": M["source_url"],
            "grain": "acris_real_property_master_observation",
            "parsed_rows": M["parsed_rows"],
            "distinct_document_ids": M["distinct_document_ids"],
            "doc_type_counts": M["doc_type_counts"],
            "display_group_counts": M["display_group_counts"],
            "recorded_borough_counts": M["recorded_borough_counts"],
            "raw_sha256": M["sha256"],
            "master_row_ne_legal_row": True,
            "document_amt_ne_market_value": True,
            "recorded_ne_completed_transaction": True,
        },
        "legals": {
            "dataset_id": "8h5j-fqxa",
            "official_title": L["dataset_name"],
            "agency": L["attribution"],
            "source_url": L["source_url"],
            "grain": "acris_real_property_legal_observation",
            "parsed_rows": L["parsed_rows"],
            "invalid_bbl_rows": L["invalid_bbl_rows"],
            "staten_island_property_rows": L["staten_island_property_rows"],
            "rows_with_unit": L["rows_with_unit"],
            "property_type_counts": L.get("property_type_counts") or {},
            "raw_sha256": L["sha256"],
            "legal_row_ne_document": True,
        },
        "identity": {
            "bbl_namespace": "NYC-BBL:{bbl}",
            "document_namespace": "NYC-ACRIS-DOC:{document_id}",
            "document_ne_property_ne_person_ne_company": True,
            "name_only": "UNSAFE",
            "address_only_auto_attach": "REJECTED",
            "normalized_address": "REVIEW_REQUIRED",
            "precedence": ["exact BBL", "exact legal borough/block/lot", "property-search candidate", "normalized address REVIEW_REQUIRED", "address-only rejected"],
        },
        "document_type_display": {
            "keeps_source_labels": True,
            "mapping": {
                "deed": ["DEED", "DEED, TS", "DEED, LE", "DEEDO", "CORRD", "TODD"],
                "mortgage": ["MTGE", "M&CON", "MCON", "CORRM"],
                "assignment": ["ASST", "ASPM"],
                "satisfaction": ["SAT"],
                "release": ["REL", "PREL"],
            },
            "unmapped_remain_other": True,
            "do_not_collapse_to_sale_mortgage_lien": True,
        },
        "linking": {
            "documents_with_legal_rows": K["documents_with_legal_rows"],
            "documents_without_legal_rows": K["documents_without_legal_rows"],
            "distinct_bbls": K["distinct_bbls"],
            "documents_with_bbl": K["documents_with_bbl"],
            "documents_with_1_bbl": K["documents_with_1_bbl"],
            "documents_with_gt1_bbl": K["documents_with_gt1_bbl"],
            "max_bbls_per_document": K["max_bbls_per_document"],
            "documents_with_gt1_legal_row": K["documents_with_gt1_legal_row"],
            "max_legal_rows_per_document": K["max_legal_rows_per_document"],
            "documents_with_unit_legal_row": K["documents_with_unit_legal_row"],
            "addresses_with_gt1_bbl": K["addresses_with_gt1_bbl"],
            "max_bbls_per_address": acq["multi_lot"]["max_bbls_per_address"],
            "no_source_native_condo_flag": True,
            "exact_acris_to_existing_nyc_bbl_identities": K["acris_bbls_in_permit_spine"],
            "acris_bbls_not_in_permit_spine": K["acris_bbls_not_in_permit_spine"],
            "permit_bbls_with_acris": K["permit_bbls_with_acris"],
            "do_not_infer_permit_plus_deed_is_same_project": True,
            "review_required_address_associations": 0,
            "review_required_address_associations_meaning": "No address-only ACRIS crosswalk was attempted or applied.",
            "rejected_name_only_party_associations": 0,
            "rejected_name_only_party_associations_meaning": "ACRIS party names were not acquired. This is not a clearance of party names.",
        },
        "coverage": {
            "state": C["coverage_state"],
            "staten_island_recording_office": C["staten_island_recording_office"],
            "recorded_borough_5": C["recorded_borough_5_staten_island"],
            "staten_island_property_legal_rows": C["staten_island_property_legal_rows"],
            "note": C["staten_island_note"],
        },
        "claim_eligibility": {"broadened": False, "document_identity_is_not_business_identity": True, "party_names_are_not_customer_identities": True},
        "expansion_ledger": {
            "NYC_ACRIS_MASTER_ROWS": M["parsed_rows"],
            "NYC_ACRIS_DISTINCT_DOCUMENT_IDS": M["distinct_document_ids"],
            "NYC_ACRIS_LEGAL_ROWS": L["parsed_rows"],
            "NYC_ACRIS_DISTINCT_BBLS": K["distinct_bbls"],
            "NYC_ACRIS_DOCUMENTS_WITH_BBL": K["documents_with_bbl"],
            "NYC_ACRIS_MULTI_BBL_DOCUMENTS": K["documents_with_gt1_bbl"],
            "NYC_ACRIS_DEED_TYPE_DOCUMENTS": groups.get("deed", 0),
            "NYC_ACRIS_MORTGAGE_TYPE_DOCUMENTS": groups.get("mortgage", 0),
            "EXACT_ACRIS_BBL_ASSOCIATIONS": K["documents_with_bbl"],
            "EXACT_ACRIS_TO_EXISTING_NYC_BBL_IDENTITIES": K["acris_bbls_in_permit_spine"],
            "REVIEW_REQUIRED_ADDRESS_ASSOCIATIONS": 0,
            "REJECTED_NAME_ONLY_PARTY_ASSOCIATIONS": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "NET_NEW_ACRIS_DOCUMENT_IDENTITIES": M["distinct_document_ids"],
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "do_not_sum_master_and_legal_rows": True,
            "do_not_sum_with_permits_or_pluto": True,
            "baselines": {"prior_accepted_nyc_acris_document_ids": 0},
        },
        "gate": {"passed": True, "not_a_second_nyc_local_page": True, "live_cohort_not_inflated": True},
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
    print(json.dumps({"fingerprint": fp1, "master": M["parsed_rows"], "docs": M["distinct_document_ids"], "bbls": K["distinct_bbls"]}, indent=2))


if __name__ == "__main__":
    main()
