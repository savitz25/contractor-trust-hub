"""CO-CON-001 freeze contractor-co-state-intel-v1 from acquired DORA extract."""
from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGE = ROOT / "data" / "colorado" / "co-con-001"
LIB = ROOT / "lib" / "colorado-intelligence"
ART = ROOT / "data" / "reports"
VERSION = "contractor-co-state-intel-v1"
DORA_VERIFY = "https://apps2.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx"
DORA_ROSTER = "https://apps2.colorado.gov/dora/licensing/lookup/generateroster.aspx"
DORA_HOME = "https://dpo.colorado.gov/"
CIM = "https://data.colorado.gov/Regulations/Professional-and-Occupational-Licenses-in-Colorado/7s5z-vewr"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    return hashlib.sha256(dump({k: v for k, v in body.items() if k != "fingerprint"}).encode("utf-8")).hexdigest()


def pfx(report: dict, key: str) -> dict:
    return report["contractor_relevant"][key]


def main() -> None:
    report = json.loads((STAGE / "acquire-report.json").read_text(encoding="utf-8"))
    LIB.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    ec = pfx(report, "EC")
    pc = pfx(report, "PC")
    retrieved = report["retrieved_at"]
    as_of = retrieved[:10]
    body = {
        "version": VERSION,
        "ticket": "CO-CON-001",
        "as_of": as_of,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "no_trust_score": True,
        "no_ranking": True,
        "no_colorado_local_intel_routes_this_ticket": True,
        "no_statewide_general_contractor_universe": True,
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/colorado",
            "route": "/colorado",
            "h1": "Colorado Contractor License & Regulatory Intelligence",
        },
        "hero": {
            "ec_active_value": ec["active_exact"],
            "ec_active_label": "Active electrical contractor registrations",
            "ec_active_hint": "DORA prefix EC. Business-grain. Not unique companies. Not a general-contractor count.",
            "pc_active_value": pc["active_exact"],
            "pc_active_label": "Active plumbing contractor registrations",
            "pc_active_hint": "DORA prefix PC. Business-grain. Do not add to EC as unique companies.",
            "discipline_rows_value": report["contractor_discipline_rows"],
            "discipline_rows_label": "Contractor-relevant discipline observations",
            "discipline_rows_hint": "Rows with caseNumber on EC/PC/trade/AELS prefixes. One case may appear on more than one row. Not quality.",
            "discipline_cases_value": report["contractor_distinct_cases"],
            "discipline_cases_label": "Distinct case numbers on those rows",
            "discipline_cases_hint": "Deduplicated caseNumber values. Still not a ranking or Trust Score.",
            "as_of_value": as_of,
            "as_of_label": "DORA CIM extract retrievedAt date",
        },
        "source": {
            "dataset_id": report["dataset_id"],
            "types_dataset_id": report["types_dataset_id"],
            "source_url": report["source_url"],
            "csv_url": report["csv_url"],
            "soda_resource": report["soda_resource"],
            "retrieved_at": retrieved,
            "update_description": report["update_description"],
            "license": report["license"],
            "access": report["access"],
            "raw_sha256": report["raw_sha256"],
            "raw_bytes": report["raw_bytes"],
            "master_rows": report["master_rows"],
            "type_rows": report["type_rows"],
            "distinct_prefixes_in_master": report["distinct_prefixes_in_master"],
            "discipline_flagged_rows_all_prefixes": report["discipline_flagged_rows"],
            "distinct_case_numbers_all_prefixes": report["distinct_case_numbers_all"],
            "do_not_headline_master_as_contractors": True,
        },
        "regulatory_map": {
            "model": "CO_DORA_SPECIALTY_NOT_GC",
            "primary_regulator": {
                "id": "dora_dpo",
                "name": "Colorado Division of Professions and Occupations (DORA)",
                "url": DORA_HOME,
                "verify": DORA_VERIFY,
                "roster": DORA_ROSTER,
                "cim": CIM,
                "role": "Statewide electrical and plumbing contractor registration plus individual trade and AELS professional licenses. Does not issue a statewide general-contractor license.",
            },
            "terminology": {
                "identity": "CO-DORA:{licensePrefix}:{licenseNumber}",
                "active": "licenseStatusDescription equals Active",
                "active_family": "status begins with Active (includes restricted/conditions)",
            },
            "what_it_establishes": [
                "An official DORA license identity (prefix + number)",
                "Whether an electrical or plumbing contractor registration is Active",
                "Source-native license status, issue/expiration dates, and verify URL",
                "Disciplinary observations attached only by exact prefix + number",
            ],
            "what_it_does_not_establish": [
                "A statewide general-contractor license",
                "That absence from EC/PC means an unlicensed general contractor",
                "Quality, safety, or a Trust Score",
                "That a license row is a unique company",
                "That an architect, engineer, surveyor, or landscape architect is a contractor business",
                "That an apprentice is a contractor business",
                "Bond, insurance, or statewide permit evidence",
                "A clean record from missing discipline",
            ],
        },
        "identity": {
            "namespace": "CO-DORA:{licensePrefix}:{licenseNumber}",
            "license_number_alone_not_globally_unique": True,
            "license_row_ne_person": True,
            "license_row_ne_business": True,
            "ec_ne_me": True,
            "pc_ne_mp": True,
            "pe_ne_general_contractor": True,
            "architect_ne_contractor_business": True,
            "apprentice_ne_contractor_business": True,
            "discipline_row_ne_unique_case": True,
            "case_ne_criminal_conviction": True,
            "active_ne_recommended": True,
            "licensed_ne_trusted": True,
            "missing_ne_zero": True,
            "contractor_identity_keys": report["contractor_identity_keys"],
            "duplicate_contractor_identity_rows": report["duplicate_contractor_identity_rows"],
            "ec_pc_index_rows": report["ec_pc_index_rows"],
            "ec_pc_distinct_normalized_names": report["ec_pc_distinct_normalized_names"],
            "ec_pc_names_with_multiple_credentials": report["ec_pc_names_with_multiple_credentials"],
            "license_row_ne_unique_company": True,
        },
        "business_credentials": {
            "EC": {**ec, "publication": "PUBLIC", "grain": "business_contractor_registration"},
            "PC": {**pc, "publication": "PUBLIC", "grain": "business_contractor_registration"},
            "do_not_headline_ec_plus_pc_as_colorado_contractors": True,
            "combined_active_exact_if_shown": {
                "value": ec["active_exact"] + pc["active_exact"],
                "label": "Colorado active electrical + plumbing contractor credential rows",
                "not": "unique contractor companies",
            },
        },
        "individual_trades": {
            "publication": "PUBLIC_RESEARCH_GRAPH",
            "no_automatic_person_profiles": True,
            "prefixes": {k: pfx(report, k) for k in ("ME", "JW", "RW", "MP", "JP", "RP")},
        },
        "apprentices": {
            "publication": "INTERNAL",
            "omit_from_public_directory_metrics": True,
            "prefixes": {k: pfx(report, k) for k in ("APE", "AP")},
        },
        "aels": {
            "publication": "PUBLIC_RESEARCH_GRAPH",
            "not_general_contractors": True,
            "not_construction_businesses": True,
            "not_project_performance": True,
            "prefixes": {k: pfx(report, k) for k in ("PE", "ARC", "PLS", "LA")},
        },
        "discipline": {
            "attach": "EXACT_OFFICIAL_ID licensePrefix + licenseNumber",
            "name_only": "UNSAFE",
            "all_prefix_flagged_rows": report["discipline_flagged_rows"],
            "contractor_relevant_rows": report["contractor_discipline_rows"],
            "contractor_distinct_cases": report["contractor_distinct_cases"],
            "row_ne_case": True,
            "action_ne_quality": True,
            "no_action_ne_clean": True,
            "complaint_ne_discipline": True,
            "top_actions_all_prefixes": report["top_discipline_actions"][:15],
            "publication": "PUBLIC_RESEARCH_GRAPH",
        },
        "sos_enrichment": {
            "acquired": False,
            "reason": "ATH-CO-000 reserves the 3.11M SOS entity file as a shared identity layer. CO-CON-001 does not ingest it.",
            "name_only": "REVIEW / UNSAFE",
        },
        "bond_insurance": {
            "acquired": False,
            "coverage": "UNKNOWN / NOT_ACQUIRED",
            "missing_ne_zero": True,
            "note": "Electrical contractor applications may require workers' compensation/unemployment evidence. No accepted bulk filing graph.",
        },
        "permits": {
            "statewide_bulk": "NOT_IDENTIFIED",
            "denver_ingested": False,
            "local_routes": False,
            "note": "Building permits are generally local/AHJ evidence in Colorado. Denver Accela remains parked.",
        },
        "public_works_debarment": {
            "access": "VERIFY / SEARCH / REQUEST",
            "bulk_file": "NOT_CONFIRMED",
            "do_not_claim_zero_debarred": True,
            "destination": "https://www.colorado.gov/pacific/dpa/procurement",
        },
        "search": {
            "channels": ["/colorado", "/verify?state=co", DORA_VERIFY, DORA_ROSTER],
            "fields": ["EC or PC prefix + number", "business name", "city"],
            "no_rank_by_discipline_or_license_count": True,
            "person_trades_not_claimable": True,
        },
        "claim": {
            "individual_trades_claimable": False,
            "apprentices_claimable": False,
            "aels_claimable": False,
            "business_follows_existing_public_profile_rules": True,
            "dora_record_ne_claim_eligibility": True,
            "claimed_ne_verified": True,
        },
        "expansion_ledger": {
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_STATE_IDENTITIES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "NEW_EVIDENCE_ROWS": report["contractor_discipline_rows"],
            "NEW_PUBLIC_RESEARCH_SURFACES": 1,
            "note": "EC/PC credential rows are source identities, not net-new canonical companies. Do not treat Active EC+PC as unique businesses. SOS graph was not ingested.",
        },
        "findings": [
            {
                "id": "no-statewide-gc",
                "text": "Colorado does not issue a statewide general-contractor license. DORA statewide contractor-business evidence is electrical contractor (EC) and plumbing contractor (PC) registration. Absence from EC/PC is not proof that a general contractor is unlicensed — general contracting is primarily local.",
            },
            {
                "id": "business-first",
                "text": f"Active EC registrations {ec['active_exact']:,} and Active PC registrations {pc['active_exact']:,} are separate specialty credential populations. They are not additive unique companies. Combined they are electrical + plumbing contractor credential rows, not “Colorado contractors.”",
            },
            {
                "id": "master-not-contractors",
                "text": f"The DORA master extract has {report['master_rows']:,} license rows across {report['distinct_prefixes_in_master']} prefixes. That file includes nurses, pharmacists, and other professions. It is not a contractor universe.",
            },
            {
                "id": "discipline-exact-id",
                "text": f"Contractor-relevant prefixes carry {report['contractor_discipline_rows']:,} discipline observations and {report['contractor_distinct_cases']:,} distinct case numbers. Attach only with licensePrefix + licenseNumber. Name-only is unsafe. A discipline row is not a unique case. A case is not a criminal conviction.",
            },
            {
                "id": "aels-not-gc",
                "text": "Professional engineer, architect, land surveyor, and landscape architect licenses are statewide professional credentials. They are not general contractors, construction businesses, or proof of project performance.",
            },
        ],
        "coverage_gaps": [
            "No statewide general-contractor license.",
            "No Denver/local contractor licenses or permits in this ticket.",
            "No SOS 3.11M entity ingest.",
            "No bond/insurance bulk graph.",
            "No statewide building-permit bulk.",
            "Debarment list not confirmed as a free bulk file.",
            "Apprentice records are internal.",
            "Individual trade professionals are not automatic public profiles.",
        ],
        "gate": {
            "passed": True,
            "blocker": None,
            "required": [
                "official DORA SODA/CSV acquired once",
                "prefix+number identity",
                "EC/PC business grain",
                "no statewide GC claim",
                "no Denver routes",
            ],
        },
    }
    body["fingerprint"] = fingerprint(body)
    (LIB / "accepted-snapshot.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    shutil.copy2(STAGE / "ec-pc-identity-index.json", LIB / "ec-pc-identity-index.json")
    (ART / "co-con-001-public-snapshot.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    pub = (LIB / "publication.ts")
    pub.write_text(
        f'''export const CO_STATE_INTEL_VERSION = "{VERSION}" as const;
export const CO_STATE_PUBLIC_FINGERPRINT =
  "{body["fingerprint"]}";

export const COLORADO_INTELLIGENCE_GATE = {{
  path: "/colorado",
  robotsIndex: true,
  sitemap: true,
  title: "Colorado Contractor License & Regulatory Intelligence | ContractorTrustHub",
  description:
    "Research official Colorado DORA electrical and plumbing contractor registrations, licensed trades, AELS credentials, and exact license-linked discipline. Colorado has no statewide general-contractor license. Not a ranking or Trust Score.",
}} as const;

export const DORA_HOME = "{DORA_HOME}";
export const DORA_VERIFY = "{DORA_VERIFY}";
export const DORA_ROSTER = "{DORA_ROSTER}";
export const DORA_CIM = "{CIM}";
''',
        encoding="utf-8",
    )
    print("snapshot", body["fingerprint"], "master", report["master_rows"], "EC active", ec["active_exact"], "PC active", pc["active_exact"])


if __name__ == "__main__":
    main()
