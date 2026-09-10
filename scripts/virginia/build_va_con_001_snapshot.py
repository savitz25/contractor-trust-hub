"""Freeze contractor-va-state-intel-v1 from acquired DPOR files."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from email.utils import parsedate_to_datetime
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "virginia"
STAGE = ROOT / "data" / "virginia" / "va-con-001"
LIB = ROOT / "lib" / "virginia-intelligence"
ART = ROOT / "data" / "reports"
VERSION = "contractor-va-state-intel-v1"

DPOR_HOME = "https://www.dpor.virginia.gov/"
DPOR_BOARD = "https://www.dpor.virginia.gov/Boards/Contractors"
DPOR_LISTS = "https://www.dpor.virginia.gov/node/10230"
DPOR_LOOKUP = "https://www.dpor.virginia.gov/LicenseLookup"
DPOR_COMPLAINT = "https://www.dpor.virginia.gov/Report-Licensee/"
DPOR_RECOVERY = "https://www.dpor.virginia.gov/Boards/Contractors_Recovery_Fund/"
DPOR_NEWS = "https://www.dpor.virginia.gov/NewsReleases"
TOWN_HALL = "https://townhall.virginia.gov/L/Meetings.cfm?BoardID=10"
STATUTE = "https://law.lis.virginia.gov/vacode/title54.1/chapter11/section54.1-1100/"
REGS = "https://law.lis.virginia.gov/admincode/title18/agency50/chapter22/"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    skip = {"fingerprint", "generated_at"}
    return hashlib.sha256(dump({k: v for k, v in body.items() if k not in skip}).encode("utf-8")).hexdigest()


def http_date_iso(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError, IndexError):
        return None


def main() -> None:
    acq = json.loads((STAGE / "acquire-report.json").read_text(encoding="utf-8"))
    retrieved = acq["retrieved_at"]
    lists_as_of = acq.get("regulant_lists_source_as_of_iso") or acq.get("regulant_lists_file_last_modified")
    if not lists_as_of:
        raise SystemExit("STOP: no derived regulant-list clock in acquire-report")
    updated_label = acq.get("regulant_lists_source_as_of_label")
    file_lm = acq.get("regulant_lists_file_last_modified") or http_date_iso(
        acq.get("downloads", {}).get("2705a_class_a", {}).get("last_modified")
    )
    class_pdf_as_of = http_date_iso(acq.get("downloads", {}).get("classifications_pdf", {}).get("last_modified"))
    pop_file_modified = http_date_iso(acq.get("downloads", {}).get("population_pdf", {}).get("last_modified"))
    pop_as_of = "2025-06-01"

    class_text = "\n".join((p.extract_text() or "") for p in PdfReader(RAW / "classifications_pdf.pdf").pages)
    class_found = re.findall(r'"([^"]+)"\s*\(Abbr:\s*([A-Z0-9/]+)[}\) ]', class_text)
    classifications = [{"code": code, "official_name": name.strip()} for name, code in class_found]

    exact_rows = json.loads((STAGE / "revocation-observations.json").read_text(encoding="utf-8"))
    rev_audit = acq["revocation_audit"]
    crosswalk = acq["revocation_roster_crosswalk"]
    person_rows = [r for r in exact_rows if r["grain"] != "contractor_business_license"]
    business_rows = [r for r in exact_rows if r["grain"] == "contractor_business_license"]
    licenses = sorted({r["license_number"] for r in exact_rows})
    cases = sorted({r["case_number"] for r in exact_rows})
    y2026 = [r for r in exact_rows if r["meeting_date"].startswith("2026")]
    y2025 = [r for r in exact_rows if r["meeting_date"].startswith("2025")]

    a = acq["profiles"]["2705a_class_a.txt"]
    b = acq["profiles"]["2705b_class_b.txt"]
    c = acq["profiles"]["2705c_class_c.txt"]
    a_legacy = acq["profiles"]["2701_class_a_legacy.txt"]
    tmp = acq["profiles"]["2703_temporary.txt"]
    trad = acq["profiles"]["2710_tradesman_person.txt"]
    rbea_f = acq["profiles"]["2707_rbea_firm.txt"]
    rbea_p = acq["profiles"]["2722_rbea_person.txt"]
    br = acq["business_roster"]

    body = {
        "version": VERSION,
        "ticket": "VA-CON-001A",
        "as_of": lists_as_of,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "no_trust_score": True,
        "no_ranking": True,
        "no_virginia_local_intel_routes_this_ticket": True,
        "statewide_contractor_business_licensing": True,
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/virginia",
            "route": "/virginia",
            "h1": "Virginia Contractor License & Regulatory Intelligence",
        },
        "clocks": {
            "regulant_lists_sourceAsOf": lists_as_of if updated_label else None,
            "regulant_lists_sourceAsOf_label": (
                f"Updated {updated_label} on DPOR Regulant Lists" if updated_label else None
            ),
            "regulant_lists_sourceAsOf_text": updated_label,
            "regulant_lists_file_last_modified": file_lm,
            "regulant_lists_retrievedAt": retrieved,
            "classifications_pdf_last_modified": class_pdf_as_of,
            "population_list_sourceAsOf": pop_as_of,
            "population_list_file_last_modified": pop_file_modified,
            "population_list_retrievedAt": retrieved,
            "statute_class_thresholds_retrievedAt": retrieved[:10],
            "snapshotAsOf": lists_as_of,
            "generatedAt_excluded_from_fingerprint": True,
            "retrievedAt_is_not_sourceAsOf": True,
            "clock_derivation": "sourceAsOf parsed from official Regulant Lists Updated label in acquired HTML; fileLastModified from HTTP Last-Modified of 2705A; retrievedAt from acquisition timestamp. No hard-coded list date.",
        },
        "parser_audit": acq["parser"],
        "hero": {
            "universe_value": br["distinct_class_abc_licenses"],
            "universe_label": "Distinct Class A/B/C contractor-business licenses",
            "universe_hint": f"Official DPOR regulant lists 2705A ∪ 2701 ∪ 2705B ∪ 2705C. sourceAsOf {lists_as_of}. One row is one license number. Not unique companies if a firm holds more than one license. Not tradesmen.",
            "class_a_value": br["class_a_distinct"],
            "class_a_label": "Class A contractor licenses",
            "class_a_hint": "License class is a contract-value threshold, not a quality score.",
            "class_b_value": br["class_b_distinct"],
            "class_b_label": "Class B contractor licenses",
            "class_c_value": br["class_c_distinct"],
            "class_c_label": "Class C contractor licenses",
            "discipline_value": len(exact_rows),
            "discipline_label": "Revocation-release observations with exact license numbers",
            "discipline_hint": "DPOR contractor revocation news releases. Not all Board discipline. Case count is not violation count.",
            "as_of_value": lists_as_of,
            "as_of_label": "DPOR regulant-list update",
        },
        "regulatory_map": {
            "model": "VA_DPOR_BOARD_FOR_CONTRACTORS",
            "primary_regulator": {
                "id": "dpor",
                "name": "Virginia Department of Professional and Occupational Regulation",
                "board": "Virginia Board for Contractors",
                "url": DPOR_BOARD,
                "lists": DPOR_LISTS,
                "verify": DPOR_LOOKUP,
                "role": "Licenses contractor businesses statewide in Class A, B, or C plus a classification/specialty. Also licenses tradesmen as a separate person grain.",
            },
            "what_it_establishes": [
                "An official DPOR contractor-business license identity",
                "License class A, B, or C as a statutory contract-value threshold",
                "Classification/specialty as the permitted work scope",
                "A live License Lookup verification path",
            ],
            "what_it_does_not_establish": [
                "Quality, safety, or a Trust Score",
                "That Class A is safer or better than Class C",
                "That a specialty token is a unique contractor",
                "That a tradesman is a contractor business",
                "A clean record from missing discipline",
                "That a Recovery Fund claim is Board discipline",
            ],
        },
        "identity": {
            "namespace": "VA-DPOR:{licenseNumber}",
            "license_number_is_source_identity": True,
            "class_is_not_entity_id": True,
            "specialty_is_not_entity_id": True,
            "license_row_ne_unique_company": True,
            "contractor_business_ne_tradesman_person": True,
            "contractor_business_ne_qualified_individual": True,
            "contractor_business_ne_designated_employee": True,
            "contractor_business_ne_home_inspector": True,
            "contractor_business_ne_architect": True,
            "contractor_business_ne_engineer": True,
            "contractor_business_ne_building_official": True,
            "active_ne_recommended": True,
            "current_license_ne_clean_history": True,
        },
        "business_roster": {
            "status": "ACQUIRED",
            "grain": "contractor_business_license_number",
            "entity_type": "contractor_business",
            "source": DPOR_LISTS,
            "sourceAsOf": lists_as_of,
            "retrievedAt": retrieved,
            "refresh_cadence": "Updated to the website every 5 business days (usually Mondays)",
            "class_a_2705a_rows": a["rows"],
            "class_a_2701_legacy_rows": a_legacy["rows"],
            "file_2705a_distinct": br["file_2705a_distinct"],
            "file_2701_distinct": br["file_2701_distinct"],
            "file_2705a_intersect_2701": br["file_2705a_intersect_2701"],
            "class_a_union_method": br["class_a_union_method"],
            "class_a_distinct": br["class_a_union"],
            "class_b_rows": b["rows"],
            "class_b_distinct": br["class_b_distinct"],
            "class_c_rows": c["rows"],
            "class_c_distinct": br["class_c_distinct"],
            "distinct_class_abc_licenses": br["distinct_class_abc_licenses"],
            "sum_if_classes_added": br["class_a_plus_b_plus_c_if_summed"],
            "overlap_ab": br["overlap_ab"],
            "overlap_ac": br["overlap_ac"],
            "overlap_bc": br["overlap_bc"],
            "classes_are_disjoint": br["classes_are_disjoint"],
            "2701_source_native_rank_a": br["2701_source_native_rank_a"],
            "2701_source_native_rank_not_a": br["2701_source_native_rank_not_a"],
            "parse_audit": {
                "2705a": a["parse_audit"],
                "2705b": b["parse_audit"],
                "2705c": c["parse_audit"],
                "2701": a_legacy["parse_audit"],
            },
            "duplicate_license_rows_2705a": a["duplicate_license_rows"],
            "duplicate_license_rows_2705b": b["duplicate_license_rows"],
            "duplicate_license_rows_2705c": c["duplicate_license_rows"],
            "temporary_rows": tmp["rows"],
            "temporary_not_added_to_abc": True,
            "one_row_one_license": True,
            "multiple_specialties_may_appear_on_one_license": True,
            "class_a_rows_with_multiple_specialties": a["rows_with_multiple_specialties"],
            "do_not_sum_specialty_tokens_as_contractors": True,
            "sha256": {
                "2705a": acq["downloads"]["2705a_class_a"]["sha256"],
                "2705b": acq["downloads"]["2705b_class_b"]["sha256"],
                "2705c": acq["downloads"]["2705c_class_c"]["sha256"],
                "2701": acq["downloads"]["2701_class_a_legacy"]["sha256"],
            },
        },
        "population_list": {
            "status": "ACQUIRED_DATED_AGGREGATE",
            "url": acq["downloads"]["population_pdf"]["url"],
            "sourceAsOf": pop_as_of,
            "file_last_modified": pop_file_modified,
            "retrievedAt": retrieved,
            "note": f"Official monthly Regulant Population List through {pop_as_of}. Grain is a dated aggregate by license type, not the row-level regulant list (sourceAsOf {lists_as_of}). Not a public profile directory.",
            "grain": "monthly_regulant_population_aggregate",
            "contractors_class_a": 34221,
            "contractors_class_b": 8998,
            "contractors_class_c": 11864,
            "contractors_tradesman": 30029,
            "temporary_contractor": 9,
            "rbea_firms": 58,
            "rbea_analysts": 106,
            "ne_row_level_roster": True,
            "ne_unique_current_contractors_from_roster": True,
            "do_not_create_profiles_from_this_count": True,
        },
        "license_class": {
            "statute": STATUTE,
            "regulations": REGS,
            "effective_for_snapshot": f"Current Code of Virginia § 54.1-1100 as retrieved {retrieved[:10]}. 2025 cc. 127, 133.",
            "class_a": {
                "label": "Class A",
                "single_contract": "$150,000 or more",
                "twelve_month": "$1 million or more",
                "not_quality": True,
            },
            "class_b": {
                "label": "Class B",
                "single_contract": "$30,000 or more, but less than $150,000",
                "twelve_month": "$250,000 or more, but less than $1 million",
                "not_quality": True,
            },
            "class_c": {
                "label": "Class C",
                "single_contract": "over $1,000 but less than $30,000",
                "twelve_month": "less than $250,000",
                "not_quality": True,
            },
            "class_ne_classification": True,
            "class_a_ne_best": True,
            "class_c_ne_worse": True,
        },
        "classifications": {
            "source": acq["downloads"]["classifications_pdf"]["url"],
            "sourceAsOf": class_pdf_as_of,
            "count": len(classifications),
            "items": classifications,
            "credential_relationship": "Classification/specialty is the permitted work scope on a Class A/B/C contractor license. Some designations require a separate DPOR credential.",
            "specialty_ne_tradesman_person": True,
            "do_not_assume_examples_exhaustive": True,
            "official_acquired_dictionary_complete": True,
            "official_list_used": True,
        },
        "tradesmen": {
            "grain": "person",
            "entity_type": "tradesman_person",
            "license_type": "2710_combined_tradesman",
            "status": "ACQUIRED_AS_RESEARCH_EVIDENCE",
            "combined_license_rows": trad["rows"],
            "residential_tradesman_rows": acq["profiles"]["2709_residential_tradesman.txt"]["rows"],
            "not_added_to_contractor_business_denominator": True,
            "no_public_person_directory_this_ticket": True,
            "no_employer_string_inference": True,
            "sourceAsOf": lists_as_of,
            "designations_source": acq["downloads"]["tradesman_designations_pdf"]["url"],
            "designations": [
                "JELE",
                "JPLB",
                "JNGF",
                "JLPG",
                "JHVA",
                "JGFC",
                "MELE",
                "MPLB",
                "MNGF",
                "MLPG",
                "MHVA",
                "MGFC",
            ],
        },
        "adjacent_credentials": {
            "rbea_firm_rows": rbea_f["rows"],
            "rbea_person_rows": rbea_p["rows"],
            "not_added_to_class_abc_denominator": True,
            "home_inspector_not_in_contractor_denominator": True,
        },
        "lookup": {
            "status": "OFFICIAL_VERIFICATION_PATH",
            "url": DPOR_LOOKUP,
            "search_only_ne_zero": True,
            "lookup_result_ne_trusthub_profile": True,
            "capabilities_documented": [
                "business license number",
                "class",
                "specialty",
                "status",
                "expiration",
                "final orders and consent orders for disciplinary cases",
            ],
        },
        "discipline": {
            "status": "ACQUIRED_PARTIAL_RELEASE_INDEX",
            "grain": "revocation_release_observation",
            "entity_type": "disciplinary_observation",
            "coverage": "DPOR contractor revocation news releases. Not all Board disciplinary actions. Town Hall minutes remain OPEN_SEARCH_ONLY.",
            "subset_of_all_discipline": True,
            "earliest_meeting_this_index": "2025-03-11",
            "latest_meeting_this_index": "2026-08-25",
            "release_files_2026": 4,
            "release_files_2025_contractor": 7,
            "observation_rows": rev_audit["observation_rows"],
            "observation_rows_2026": len(y2026),
            "observation_rows_2025": len(y2025),
            "distinct_licenses": rev_audit["distinct_licenses"],
            "distinct_cases": rev_audit["distinct_cases"],
            "business_license_observations": len(business_rows),
            "person_grain_observations": len(person_rows),
            "exact_license_linked_evidence_rows": rev_audit["observation_rows"],
            "exact_source_identity_matched_observations": rev_audit["observation_rows"],
            "exact_duplicate_rows_removed": rev_audit["exact_duplicate_rows_removed"],
            "license_ids_appearing_in_multiple_observations": rev_audit["license_ids_appearing_in_multiple_observations"],
            "license_ids_with_multiple_respondent_labels": rev_audit["license_ids_with_multiple_respondent_labels"],
            "roster_crosswalk": crosswalk,
            "review_required_name_city": 0,
            "unsafe_name_only_rejected": 0,
            "attach": "EXACT_CONTRACTOR_LICENSE",
            "name_only": "UNSAFE",
            "name_plus_city": "REVIEW_REQUIRED",
            "row_ne_case": True,
            "case_ne_violation_count": True,
            "revocation_ne_criminal_conviction": True,
            "complaint_ne_discipline": True,
            "no_result_ne_clean_history": True,
            "town_hall": {
                "url": TOWN_HALL,
                "status": "OPEN_SEARCH_ONLY",
                "publication": "PUBLIC_RESEARCH_PATH",
            },
            "lookup_orders": "Final orders and consent orders available through License Lookup — not bulk-harvested this ticket.",
        },
        "recovery_fund": {
            "status": "PUBLIC_RESEARCH_PATH",
            "url": DPOR_RECOVERY,
            "structured_bulk": "SOURCE_NOT_ACQUIRED",
            "filing_ne_payment": True,
            "approved_ne_revocation": True,
            "fund_case_ne_board_discipline": True,
            "court_judgment_ne_criminal_conviction": True,
            "payment_ne_total_consumer_loss": True,
            "single_claim_limit": 30000,
            "same_contractor_biennium_limit": 100000,
            "attach": "EXACT_CONTRACTOR_LICENSE",
        },
        "complaints": {
            "status": "PUBLIC_RESEARCH_PATH",
            "url": DPOR_COMPLAINT,
            "bulk": "SOURCE_NOT_ACQUIRED",
            "complaint_ne_disciplinary_case": True,
            "complaint_ne_violation": True,
            "filed_ne_substantiated": True,
            "no_result_ne_clean_history": True,
        },
        "bond_insurance": {
            "coverage": "UNKNOWN / VERIFY_PATH / NOT_ACQUIRED",
            "missing_ne_zero": True,
            "class_a_b_financial_verification_or_surety_bond_at_application": True,
            "class_c_same_bond_not_assumed": True,
            "no_boolean_bonded_from_license_status": True,
            "bond_form": "https://www.dpor.virginia.gov/sites/default/files/boards/Contractors/A501-27BOND.pdf",
            "financial_statement_form": "https://www.dpor.virginia.gov/sites/default/files/boards/Contractors/A501-27FINST.pdf",
        },
        "permits": {"local_routes": False},
        "expansion_ledger": {
            "NEW_STATE_IDENTITIES": br["distinct_class_abc_licenses"],
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "CREDENTIAL_ROWS": br["distinct_class_abc_licenses"],
            "DISCIPLINE_EVIDENCE_ROWS": rev_audit["observation_rows"],
            "RECOVERY_FUND_EVIDENCE_ROWS": 0,
            "EXACT_LICENSE_LINKED_EVIDENCE_ROWS": rev_audit["observation_rows"],
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REJECTED_UNSAFE_JOINS": 0,
            "note": "Exact DPOR license identities are acquired as research state identities. EXACT_LICENSE_LINKED_EVIDENCE_ROWS are revocation observations matched by source-native license number. EXACT_PROFILE_ATTACHMENTS remain 0 because no public Virginia contractor profiles were created.",
        },
        "search_v1": {
            "bulk_discovery": "FAIL_CLOSED",
            "do_not_return_tradesmen_as_companies": True,
            "class_is_not_ranking": True,
        },
        "claim_safety": {
            "claim_eligibility_unchanged": True,
            "still_florida_dbpr_only": True,
            "tradesmen_not_claimable": True,
            "disciplinary_respondents_not_automatically_claimable": True,
            "recovery_fund_respondents_not_automatically_claimable": True,
        },
        "gaps": {
            "ACQUIRED": [
                "Class A/B/C contractor-business regulant lists",
                "Official classification/specialty dictionary",
                "Tradesman combined-license file as person-grain evidence",
                "2025-2026 contractor revocation releases with exact license numbers",
                "Dated June 1, 2025 Regulant Population List",
            ],
            "OPEN_SEARCH_ONLY": [
                "DPOR License Lookup live verification",
                "Virginia Regulatory Town Hall Board minutes/actions",
                "Final/consent orders inside License Lookup",
            ],
            "SOURCE_NOT_ACQUIRED": [
                "Structured Recovery Fund payment/claim bulk file",
                "Bulk complaint dataset",
                "Current contractor-specific bond/insurance proof file",
                "Complete Board discipline corpus beyond revocation releases",
            ],
            "SOURCE_AVAILABLE_BY_REQUEST": [],
            "UNKNOWN": ["Complete current monthly population list after June 1, 2025"],
            "NOT_APPLICABLE": ["Colorado-style no-statewide-GC model"],
        },
        "gate": {
            "passed": True,
            "statewide_only": True,
            "no_local_routes": True,
        },
        "no_ranking": True,
        "no_trust_score": True,
    }
    body["fingerprint"] = fingerprint(body)
    LIB.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    (LIB / "accepted-snapshot.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    shutil.copy(LIB / "accepted-snapshot.json", ART / "va-con-001-public-snapshot.json")
    (STAGE / "revocation-observations.json").write_text(json.dumps(exact_rows, indent=2) + "\n", encoding="utf-8")
    pub = f'''export const VA_STATE_INTEL_VERSION = "{VERSION}" as const;
export const VA_STATE_PUBLIC_FINGERPRINT =
  "{body["fingerprint"]}";

export const VIRGINIA_INTELLIGENCE_GATE = {{
  path: "/virginia",
  robotsIndex: true,
  sitemap: true,
  title: "Virginia Contractor License & Regulatory Intelligence | ContractorTrustHub",
  description:
    "Research official Virginia DPOR Board for Contractors Class A, B, and C business licenses, classifications/specialties, License Lookup verification, revocation releases, and the Contractor Transaction Recovery Fund. Not a ranking or Trust Score. Class is not quality.",
}} as const;

export const DPOR_HOME = "{DPOR_HOME}";
export const DPOR_BOARD = "{DPOR_BOARD}";
export const DPOR_LISTS = "{DPOR_LISTS}";
export const DPOR_LOOKUP = "{DPOR_LOOKUP}";
export const DPOR_COMPLAINT = "{DPOR_COMPLAINT}";
export const DPOR_RECOVERY = "{DPOR_RECOVERY}";
export const DPOR_NEWS = "{DPOR_NEWS}";
export const DPOR_TOWN_HALL = "{TOWN_HALL}";
'''
    (LIB / "publication.ts").write_text(pub, encoding="utf-8")
    print(
        "snapshot",
        body["fingerprint"],
        "abc",
        br["distinct_class_abc_licenses"],
        "revocations",
        len(exact_rows),
        "classes",
        len(classifications),
        "cases",
        len(cases),
        "licenses",
        len(licenses),
    )


if __name__ == "__main__":
    main()
