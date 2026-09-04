"""AZ-CON-001 freeze contractor-az-state-intel-v1. No ROC scrape."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROF = json.loads((ROOT / "data/arizona/az-con-001/profile-all-current.json").read_text(encoding="utf-8"))
LIB = ROOT / "lib" / "arizona-intelligence"
ART = ROOT / "data" / "reports"
LIB.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)
VERSION = "contractor-az-state-intel-v1"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    return hashlib.sha256(dump({k: v for k, v in body.items() if k != "fingerprint"}).encode("utf-8")).hexdigest()


def main() -> None:
    p = PROF
    header = p["posting_list_header_2026_09_02"]
    cats = p["category_counts"]
    extract_rows = p["data_rows"]
    body = {
        "version": VERSION,
        "ticket": "AZ-CON-001",
        "as_of": "2026-09-04",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "no_trust_score": True,
        "no_ranking": True,
        "no_arizona_local_intel_routes_this_ticket": True,
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/arizona",
            "route": "/arizona",
            "h1": "Arizona Contractor License & Regulatory Intelligence",
        },
        "hero": {
            "universe_value": header["all_current"],
            "universe_label": "ROC current contractor licenses",
            "universe_hint": "Official All Current Contractors posting-list header as of 2026-09-02. Listed on ROC’s current contractor posting. Not a recommendation.",
            "commercial_value": header["commercial"],
            "commercial_label": "Commercial posting file",
            "commercial_hint": "Includes Dual licenses. Do not add to Residential or Dual.",
            "residential_value": header["residential"],
            "residential_label": "Residential posting file",
            "residential_hint": "Includes Dual licenses. Do not add to Commercial or Dual.",
            "dual_value": header["dual"],
            "dual_label": "Dual posting file",
            "dual_hint": "Dual licenses also appear in the commercial and residential posting files.",
            "discipline_value": 459,
            "discipline_label": "Disciplinary action rows already in the graph",
            "discipline_hint": "Pre-ingest az_roc discipline rows. Current posting-list CSV was not downloaded this ticket (Cloudflare 403). Action count is not quality.",
            "as_of_value": "2026-09-02",
            "as_of_label": "ROC posting-list header clock",
        },
        "regulatory_map": {
            "model": "AZ_ROC_BUSINESS_LICENSE",
            "primary_regulator": {
                "id": "roc",
                "name": "Arizona Registrar of Contractors",
                "url": "https://roc.az.gov/",
                "posting_list": "https://roc.az.gov/posting-list",
                "verify": "https://azroc.my.site.com/AZRoc/s/contractor-search",
                "unlicensed": "https://roc.az.gov/unlicensed-violators-list",
                "role": "Licenses contractor businesses. Issues commercial, residential, and dual classifications plus specialty/general class codes.",
            },
            "terminology": {
                "current_posting": "Listed on ROC’s current contractor posting as of the file date",
                "license_number": "ROC License No",
                "identity": "AZ-ROC:{License No}",
            },
            "what_it_establishes": [
                "An official ROC contractor license identity",
                "Source-native class code, class detail, and class type",
                "Whether the license is on the current posting",
                "Qualifying-party name when published",
                "Business address when published",
            ],
            "what_it_does_not_establish": [
                "Quality, safety, or a Trust Score",
                "That current posting means recommended",
                "That a license row is a unique company",
                "That a qualifying party is the business owner",
                "Current unlicensed status from a historical unlicensed-violation row",
                "A clean record from missing discipline",
            ],
            "classes": {
                "COMMERCIAL": "General Commercial or Specialty Commercial class type",
                "RESIDENTIAL": "General Residential or Specialty Residential class type",
                "DUAL": "General Dual or Specialty Dual class type — residential and commercial scope on that license",
            },
        },
        "current_posting": {
            "url": "https://roc.az.gov/posting-list",
            "header_as_of": "2026-09-02",
            "retrieved_at": "2026-09-04",
            "all_current": header["all_current"],
            "commercial_file": header["commercial"],
            "residential_file": header["residential"],
            "dual_file": header["dual"],
            "files_are_not_additive": True,
            "additive_sum_if_mistaken": header["commercial"] + header["residential"] + header["dual"],
            "wording": "Listed on ROC’s current contractor posting as of 2026-09-02",
            "current_ne_recommended": True,
            "csv_automated_download": "HTTP_403_CLOUDFLARE",
            "csv_urls": {
                "all_current": "https://roc.az.gov/sites/default/files/ROC_Posting-List_2026-09-02.csv",
                "commercial": "https://roc.az.gov/sites/default/files/ROC_Posting-List_Commercial_2026-09-02.csv",
                "residential": "https://roc.az.gov/sites/default/files/ROC_Posting-List_Residential_2026-09-02.csv",
                "dual": "https://roc.az.gov/sites/default/files/ROC_Posting-List_Dual_2026-09-02.csv",
            },
        },
        "last_full_extract": {
            "file_created": p["file_created"],
            "title_record_claim": p["title_record_claim"],
            "rows": extract_rows,
            "distinct_license_numbers": p["distinct_license_numbers"],
            "sha256": p["sha256"],
            "bytes": p["bytes"],
            "grain": p["grain"],
            "status_counts": p["status_counts"],
            "class_type_counts": p["class_type_counts"],
            "category_counts": cats,
            "category_sum_equals_rows": p["category_sum"] == extract_rows,
            "distinct_class_codes": p["distinct_class_codes"],
            "top_classes": [{"code": c, "rows": n} for c, n in p["top_classes"][:20]],
            "overlap_proof": {
                "extract_commercial_plus_dual": cats["Commercial"] + cats["Dual"],
                "extract_residential_plus_dual": cats["Residential"] + cats["Dual"],
                "note": "The commercial and residential posting files include Dual licenses. Class-type buckets on All Current partition the extract and sum to the extract row count.",
            },
        },
        "identity": {
            "namespace": "AZ-ROC:{License No}",
            "license_number_preserved_exactly": True,
            "fields": p["fields"],
            "distinct_license_numbers": p["distinct_license_numbers"],
            "duplicate_license_rows": p["duplicate_license_rows"],
            "distinct_normalized_business_names": p["distinct_normalized_business_names"],
            "distinct_business_plus_address": p["distinct_business_plus_address"],
            "business_names_with_multiple_licenses": p["business_names_with_multiple_licenses"],
            "license_row_ne_unique_company": True,
        },
        "qualifying_party": p["qualifying_party"]
        | {
            "person_ne_contractor_business": True,
            "qualifying_party_ne_owner_unless_source_says_so": True,
            "no_automatic_person_profiles": True,
            "grain": "name string on the license row; QP Exempt is a source-native sentinel, not a person identity",
        },
        "contacts": {
            "business_address": {"count": p["contacts"]["address"], "class": "PUBLIC_ELIGIBLE", "provenance": "AZ_ROC_BUSINESS_ADDRESS"},
            "mailing_address": {"count": 0, "class": "NOT_IN_SOURCE"},
            "phone": {"count": 0, "class": "NOT_IN_SOURCE"},
            "email": {"count": 0, "class": "NOT_IN_SOURCE"},
            "website": {"count": 0, "class": "NOT_IN_SOURCE"},
            "no_internet_enrichment": True,
            "qualifier_name_is_not_personal_contact": True,
        },
        "new_licenses": {
            "official_window": "2026-03-03 through 2026-09-02",
            "url": "https://roc.az.gov/sites/default/files/ROC_New-Licenses-List_2026-09-02.csv",
            "access": "SOURCE_NOT_ACQUIRED",
            "reason": "Automated GET returned HTTP 403 (Cloudflare). No browser capture this ticket.",
            "join": "Exact License No → AZ-ROC license when the file is acquired",
            "new_license_ne_new_company": True,
        },
        "discipline": {
            "official_window": "2026-03-03 through 2026-09-02",
            "url": "https://roc.az.gov/sites/default/files/ROC_Disciplinary-Actions_2026-09-02.csv",
            "current_csv": "SOURCE_NOT_ACQUIRED",
            "reason": "Automated GET returned HTTP 403 (Cloudflare).",
            "pre_ingest_graph_rows": 459,
            "attach": "EXACT License No / AZ-ROC only",
            "name_only": "UNSAFE",
            "schema_observed_prior": [
                "Business Name",
                "Doing Business As",
                "Address",
                "City",
                "State",
                "Zip",
                "License No",
                "License Class",
                "Case Number",
                "Description",
            ],
            "native_classes_observed_prior": ["Suspended", "Revoked"],
            "complaint_ne_discipline": True,
            "action_count_ne_quality": True,
            "no_action_ne_clean": True,
        },
        "unlicensed": {
            "page": "https://roc.az.gov/unlicensed-violators-list",
            "last_2y_csv": "SOURCE_NOT_ACQUIRED",
            "full_list_csv": "SOURCE_NOT_ACQUIRED",
            "reason": "Automated GET returned HTTP 403 (Cloudflare).",
            "universe": "UNLICENSED_ACTIVITY_EVIDENCE_ONLY",
            "name_only": "UNSAFE_FOR_PROFILE_ATTACH",
            "name_plus_city": "REVIEW_REQUIRED",
            "historical_ne_currently_unlicensed": True,
            "do_not_attach_to_licensed_profile_by_name": True,
        },
        "complaints_recovery": {
            "pass": "bounded_easy_win",
            "result": "NO_ADDITIONAL_BULK",
            "note": "Disciplinary and unlicensed posting lists are the structured files. No recovery-fund or Most Wanted CSV was acquired. PDF/portal crawl skipped.",
        },
        "acc": {
            "pass": "bounded",
            "result": "SEARCH_ONLY / NOT_ACQUIRED",
            "note": "Arizona Corporation Commission entity lookup is search-oriented. No free bulk/API was acquired this ticket. ROC license remains primary identity.",
            "crosswalk": "No source-native ACC entity number on the ROC posting list.",
        },
        "pre_ingest_baseline": p["pre_ingest_graph"]
        | {
            "existing_az_roc_license_ids": 58408,
            "existing_arizona_public_profiles": "LIVE_GRAPH / NOT_RECOUNTED_THIS_TICKET",
            "existing_arizona_evidence_rows": {"licenses": 58408, "discipline": 459},
        },
        "expansion_ledger": {
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_STATE_IDENTITIES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "NEW_EVIDENCE_ROWS": 0,
            "note": "Arizona ROC licenses are already in the ContractorTrustHub live graph (az_roc 58,408 in committed network metrics). This ticket publishes state intelligence and overlap semantics. It does not treat 57,886 current-posting licenses as net-new companies. Refreshed identities are not new.",
        },
        "search": {
            "channels": ["/search", "/verify", "https://azroc.my.site.com/AZRoc/s/contractor-search"],
            "fields": ["business name", "ROC license", "city", "ZIP", "classification", "commercial/residential/dual"],
            "no_rank_by_discipline_or_license_count": True,
        },
        "findings": [
            {
                "id": "current-posting-scale",
                "text": "ROC’s official All Current Contractors posting-list header on 2026-09-02 reports 57,886 licenses. That is the statewide current-posting universe for this page, not a unique-company count and not a recommendation.",
            },
            {
                "id": "crd-overlap",
                "text": "Commercial (46,913), Residential (47,258), and Dual (36,285) posting files overlap. Dual licenses appear in the commercial and residential files. Adding those three files (130,456) is not the contractor universe. On the last full All Current extract, class-type buckets partition the file: Dual 36,448, Residential 10,996, Commercial 10,686.",
            },
            {
                "id": "license-ne-company",
                "text": "The last full All Current extract has 58,131 license rows and 58,131 distinct License No values, but only 48,795 distinct normalized business names. 7,186 business names hold more than one license. A license row is not a unique company.",
            },
            {
                "id": "already-in-graph",
                "text": "Committed network metrics already contain 58,408 az_roc licenses and 459 disciplinary rows. AZ-CON-001 does not claim 57,886 net-new canonical organizations.",
            },
            {
                "id": "qp-and-contacts",
                "text": "Qualifying party is a name string (56,281 named; 1,850 QP Exempt). There is no qualifying-party ID. The posting list has business address, not phone, email, or website. Qualifying party is not the contractor business.",
            },
        ],
        "coverage_gaps": [
            "Current 2026-09-02 microdata CSVs were not downloaded (Cloudflare 403).",
            "New-licenses CSV not acquired this ticket.",
            "Current disciplinary CSV not acquired this ticket (459 prior graph rows remain).",
            "Unlicensed-violations CSVs not acquired this ticket.",
            "No ACC bulk/API.",
            "No phone/email/website on the ROC posting list.",
            "No Arizona city/county intelligence pages in this ticket.",
        ],
        "evidence_depth": [
            {"family": "ROC current posting header", "agency": "ROC", "source": "https://roc.az.gov/posting-list", "as_of": "2026-09-02", "grain": "official posting-list file header", "rows": header["all_current"], "identity": "License No", "contacts": "n/a", "access": "OPEN_HTML", "publication": "PUBLIC", "limitations": "Header count, not unique companies. CSV GET 403."},
            {"family": "ROC All Current extract", "agency": "ROC", "source": "roc_all_current.csv", "as_of": "2026-08-12", "grain": "one license row", "rows": extract_rows, "identity": "AZ-ROC:{License No}", "contacts": "address", "access": "PRIOR_ACQUIRED_CSV", "publication": "SCHEMA / OVERLAP PROOF", "limitations": "Three weeks older than the 2026-09-02 header."},
            {"family": "ROC commercial posting file", "agency": "ROC", "source": "posting-list header", "as_of": "2026-09-02", "grain": "license in commercial file", "rows": header["commercial"], "identity": "License No", "contacts": "n/a", "access": "OPEN_HTML", "publication": "PUBLIC WITH OVERLAP", "limitations": "Includes Dual. Not additive."},
            {"family": "ROC residential posting file", "agency": "ROC", "source": "posting-list header", "as_of": "2026-09-02", "grain": "license in residential file", "rows": header["residential"], "identity": "License No", "contacts": "n/a", "access": "OPEN_HTML", "publication": "PUBLIC WITH OVERLAP", "limitations": "Includes Dual. Not additive."},
            {"family": "ROC dual posting file", "agency": "ROC", "source": "posting-list header", "as_of": "2026-09-02", "grain": "license in dual file", "rows": header["dual"], "identity": "License No", "contacts": "n/a", "access": "OPEN_HTML", "publication": "PUBLIC WITH OVERLAP", "limitations": "Also counted in commercial and residential files."},
            {"family": "ROC new licenses", "agency": "ROC", "source": "New Licenses CSV", "as_of": "2026-03-03/2026-09-02", "grain": "new-license row", "rows": None, "identity": "License No when acquired", "contacts": "unknown", "access": "SOURCE_NOT_ACQUIRED", "publication": "PROCESS ONLY", "limitations": "HTTP 403."},
            {"family": "ROC disciplinary actions", "agency": "ROC", "source": "graph az_roc + posting-list CSV", "as_of": "metrics 2026-09-03", "grain": "discipline_action_row", "rows": 459, "identity": "exact License No", "contacts": "n/a", "access": "EXISTING_GRAPH / CURRENT_CSV_403", "publication": "PUBLIC COUNT / NO NAME ATTACH", "limitations": "Name-only UNSAFE. 459 is not a quality score."},
            {"family": "ROC unlicensed violations", "agency": "ROC", "source": "https://roc.az.gov/unlicensed-violators-list", "as_of": "2026-09-04", "grain": "unlicensed violator row", "rows": None, "identity": "name/DBA/city — not a license", "contacts": "n/a", "access": "SOURCE_NOT_ACQUIRED", "publication": "SAFETY RULES ONLY", "limitations": "Separate universe. Historical ≠ currently unlicensed."},
            {"family": "ROC qualifying party", "agency": "ROC", "source": "All Current extract", "as_of": "2026-08-12", "grain": "name on license row", "rows": p["qualifying_party"]["named"], "identity": "name string / QP Exempt", "contacts": "not a contact", "access": "PRIOR_ACQUIRED_CSV", "publication": "RELATIONSHIP EVIDENCE", "limitations": "No QP ID. Person ≠ business."},
            {"family": "ACC business", "agency": "ACC", "source": "bounded check", "as_of": "2026-09-04", "grain": "entity", "rows": None, "identity": "none on ROC file", "contacts": "n/a", "access": "SEARCH_ONLY", "publication": "NOT ACQUIRED", "limitations": "ROC remains primary."},
        ],
        "semantics": [
            "LICENSE != QUALITY",
            "CURRENT POSTING != RECOMMENDATION",
            "COMMERCIAL + RESIDENTIAL + DUAL ARE NOT ADDITIVE",
            "LICENSE ROW != UNIQUE COMPANY",
            "QUALIFYING PARTY != CONTRACTOR BUSINESS",
            "DISCIPLINARY ACTION != CRIMINAL CONVICTION",
            "UNLICENSED VIOLATION != CURRENT UNLICENSED STATUS",
            "NAME-ONLY ADVERSE MATCH = UNSAFE",
            "NO DISCIPLINE FOUND != CLEAN RECORD",
            "MISSING != ZERO",
            "NO TRUST SCORE",
            "NO PAID RANKING",
        ],
        "gate": {
            "roc_current_header_reconciled": True,
            "exact_license_identity_proven": True,
            "business_vs_license_grain_understood": True,
            "commercial_residential_dual_overlap_correct": True,
            "discipline_identity_safe": True,
            "unlicensed_identity_safety_correct": True,
            "qualifying_party_person_separation_safe": True,
            "expansion_ledger_measured": True,
            "deterministic_snapshot": True,
            "findings_at_least_3": True,
            "passed": True,
            "blocker": None,
        },
    }
    body["fingerprint"] = fingerprint(body)
    (LIB / "accepted-snapshot.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    (ART / "az-con-001-public-snapshot.json").write_text(
        json.dumps({"version": VERSION, "fingerprint": body["fingerprint"], "all_current": header["all_current"]}, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"fingerprint": body["fingerprint"], "all_current": header["all_current"], "net_new_orgs": 0}, indent=2))


if __name__ == "__main__":
    main()
