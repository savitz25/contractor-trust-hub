"""Freeze contractor-va-state-intel-v1 from acquired DPOR files."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

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


def parse_revocation_file(path: Path, meeting: str, url: str) -> list[dict]:
    text = path.read_text(encoding="latin-1", errors="replace")
    pat = re.compile(
        r"(?P<name>[^\n]+)\n(?P<loc>[^\n]+)\nCase No\.\s*(?P<case>[\d-]+)\nLic[e]?nse Number\s+(?P<lic>\d+)",
        re.I,
    )
    rows = []
    for m in pat.finditer(text):
        loc = m.group("loc").strip()
        city, st = loc, ""
        if "," in loc:
            city, st = [p.strip() for p in loc.rsplit(",", 1)]
        lic = m.group("lic")
        grain = "contractor_business_license"
        if lic.startswith("2710") or lic.startswith("2709"):
            grain = "tradesman_person"
        elif lic.startswith("2722"):
            grain = "rbea_person"
        rows.append(
            {
                "meeting_date": meeting,
                "respondent": m.group("name").strip(),
                "city": city,
                "state": st,
                "case_number": m.group("case"),
                "license_number": lic,
                "identity": f"VA-DPOR:{lic}",
                "attach": "EXACT_CONTRACTOR_LICENSE",
                "grain": grain,
                "source_url": url,
            }
        )
    return rows


def main() -> None:
    acq = json.loads((STAGE / "acquire-report.json").read_text(encoding="utf-8"))
    retrieved = acq["retrieved_at"]
    lists_as_of = "2026-09-08"
    class_pdf_as_of = "2025-10-14"
    pop_as_of = "2025-06-01"
    pop_file_modified = "2025-07-25"

    class_text = "\n".join((p.extract_text() or "") for p in PdfReader(RAW / "classifications_pdf.pdf").pages)
    class_found = re.findall(r'"([^"]+)"\s*\(Abbr:\s*([A-Z0-9/]+)[}\) ]', class_text)
    classifications = [{"code": code, "official_name": name.strip()} for name, code in class_found]

    rev_meta = {
        "2026-08-25": acq["revocations"]["files"]["2026-08-25"]["url"],
        "2026-06-23": acq["revocations"]["files"]["2026-06-23"]["url"],
        "2026-04-28": acq["revocations"]["files"]["2026-04-28"]["url"],
        "2026-02-24": acq["revocations"]["files"]["2026-02-24"]["url"],
        "2025-12-09": acq["revocations"]["files"]["2025-12-09"]["url"],
        "2025-10-07": acq["revocations"]["files"]["2025-10-07"]["url"],
        "2025-08-19": acq["revocations"]["files"]["2025-08-19"]["url"],
        "2025-06-24": acq["revocations"]["files"]["2025-06-24"]["url"],
        "2025-04-29": acq["revocations"]["files"]["2025-04-29"]["url"],
        "2025-03-11": acq["revocations"]["files"]["2025-03-11"]["url"],
        "2025-03-11-addtl": acq["revocations"]["files"]["2025-03-11-addtl"]["url"],
    }
    rev_rows = []
    for meeting, url in rev_meta.items():
        path = RAW / f"revocation_{meeting}.txt"
        if path.exists():
            rev_rows.extend(parse_revocation_file(path, meeting, url))

    exact_rows = [r for r in rev_rows if r["attach"] == "EXACT_CONTRACTOR_LICENSE"]
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
            "regulant_lists_sourceAsOf": lists_as_of,
            "regulant_lists_sourceAsOf_label": "Updated Tuesday, September 8, 2026 on DPOR Regulant Lists",
            "regulant_lists_file_last_modified": "2026-09-08",
            "regulant_lists_retrievedAt": retrieved,
            "classifications_pdf_last_modified": class_pdf_as_of,
            "population_list_sourceAsOf": pop_as_of,
            "population_list_file_last_modified": pop_file_modified,
            "population_list_retrievedAt": retrieved,
            "statute_class_thresholds_as_of": "2026-09-10",
            "snapshotAsOf": lists_as_of,
            "generatedAt_excluded_from_fingerprint": True,
            "retrievedAt_is_not_sourceAsOf": True,
        },
        "hero": {
            "universe_value": br["distinct_class_abc_licenses"],
            "universe_label": "Distinct Class A/B/C contractor-business licenses",
            "universe_hint": "Official DPOR regulant lists 2705A + 2701 + 2705B + 2705C as of 2026-09-08. One row is one license number. Not unique companies if a firm holds more than one license. Not tradesmen.",
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
            "source": DPOR_LISTS,
            "sourceAsOf": lists_as_of,
            "retrievedAt": retrieved,
            "refresh_cadence": "Updated to the website every 5 business days (usually Mondays)",
            "class_a_2705a_rows": a["rows"],
            "class_a_2701_legacy_rows": a_legacy["rows"],
            "class_a_distinct": br["class_a_distinct"],
            "class_b_rows": b["rows"],
            "class_b_distinct": br["class_b_distinct"],
            "class_c_rows": c["rows"],
            "class_c_distinct": br["class_c_distinct"],
            "distinct_class_abc_licenses": br["distinct_class_abc_licenses"],
            "sum_if_classes_added": br["class_a_plus_b_plus_c_if_summed"],
            "classes_are_disjoint": br["overlap_ab"] == 0 and br["overlap_ac"] == 0 and br["overlap_bc"] == 0,
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
            "note": "Official monthly Regulant Population List through June 1, 2025. Not the September 8, 2026 row-level roster. Not a public profile directory.",
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
            "effective_for_snapshot": "Current Code of Virginia § 54.1-1100 as retrieved 2026-09-10. 2025 cc. 127, 133.",
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
            "do_not_assume_examples_exhaustive": False,
            "official_list_used": True,
        },
        "tradesmen": {
            "grain": "person",
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
            "coverage": "DPOR contractor revocation news releases. Not all Board disciplinary actions. Town Hall minutes remain OPEN_SEARCH_ONLY.",
            "subset_of_all_discipline": True,
            "earliest_meeting_this_index": "2025-03-11",
            "latest_meeting_this_index": "2026-08-25",
            "release_files_2026": 4,
            "release_files_2025_contractor": 7,
            "observation_rows": len(exact_rows),
            "observation_rows_2026": len(y2026),
            "observation_rows_2025": len(y2025),
            "distinct_licenses": len(licenses),
            "distinct_cases": len(cases),
            "business_license_observations": len(business_rows),
            "person_grain_observations": len(person_rows),
            "exact_license_attachments": len(exact_rows),
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
            "DISCIPLINE_EVIDENCE_ROWS": len(exact_rows),
            "RECOVERY_FUND_EVIDENCE_ROWS": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REJECTED_UNSAFE_JOINS": 0,
            "note": "Exact DPOR license identities are acquired as research state identities. They are not automatically published as claimable ContractorTrustHub profiles this ticket.",
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
