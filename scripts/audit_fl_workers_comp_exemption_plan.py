#!/usr/bin/env python3
"""Read-only STATE-005 workers-compensation/exemption planning audit."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url

DEFAULT_OUTPUT = ROOT / "artifacts/cth-fl-state-005-workers-comp-exemption-plan.json"

URLS = {
    "portal": "https://dwcdataportal.fldfs.com/POCData.aspx",
    "coverage_search": "https://dwcdataportal.fldfs.com/ProofOfCoverage.aspx",
    "coverage_download": "https://dwcdataportal.fldfs.com/DigitalDownload.aspx",
    "coverage_instructions": "https://dwcdataportal.fldfs.com/ProofOfCoverageSearchPageInstructions.aspx",
    "exemption_search": "https://dwcdataportal.fldfs.com/Exemption.aspx",
    "public_records": "https://myfloridacfo.com/publicrecords",
}

COVERAGE_EXPORT_FIELDS = (
    "Policy Number", "Policy Effective Date", "Policy Cancellation Date",
    "Policy Expiration Date", "Named Insured", "Governing Class Code",
    "Agency Name", "Agency City", "Agency State", "Carrier Name",
    "Wrap-Up Indicator", "PEO Client", "Employer Name",
    "Employer Address Street", "Employer Address Street2",
    "Employer Address City", "Employer Address State",
    "Employer Address Zip", "Employer Address County",
    "Employer Phone Number", "NAICS",
)

EXEMPTION_RESULT_FIELDS = (
    "Last Name", "First Name", "Middle Inital", "Suffix", "Effective Date",
    "Expiration Date", "Employer Name", "Employer Address", "Exemption Type",
    "Scope of Business",
)


def sha256_fields(fields: tuple[str, ...]) -> str:
    return "sha256:" + hashlib.sha256(
        json.dumps(fields, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()


def validate_urls() -> dict[str, dict[str, object]]:
    checked: dict[str, dict[str, object]] = {}
    for name, url in URLS.items():
        req = urllib.request.Request(url, headers={"User-Agent": "ContractorTrustHub-STATE-005-read-only-audit/1.0"})
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read()
            checked[name] = {
                "url": url,
                "http_status": response.status,
                "content_type": response.headers.get_content_type(),
                "response_bytes": len(body),
                "acquired_at_utc": datetime.now(timezone.utc).isoformat(),
            }
    return checked


def production_reconciliation() -> dict[str, object]:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    database_url = normalize_database_url(os.environ.get("DATABASE_URL", ""))
    if not database_url:
        return {"available": False, "reason": "DATABASE_URL not configured", "mutations": 0}
    with psycopg.connect(database_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
            cur.execute("SET LOCAL statement_timeout='180s'")
            cur.execute("""SELECT count(*)::int,
              count(*) FILTER (WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_lic')::int,
              count(*) FILTER (WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_ula')::int,
              count(*) FILTER (WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_rf')::int,
              count(*) FILTER (WHERE source_system='fl_dbpr')::int,
              count(*) FILTER (WHERE source_system='az_roc')::int,
              count(*) FILTER (WHERE source_system='nj_enforcement')::int,
              count(*) FILTER (WHERE publication_state='PUBLIC_ELIGIBLE')::int
              FROM discipline_actions""")
            values = cur.fetchone()
            result = dict(zip(("whole_discipline_actions", "fl_licensed", "fl_ula",
                "fl_recovery_fund", "fl_total", "arizona", "new_jersey",
                "public_eligible"), values, strict=True))
            for key, table in (("observations", "regulatory_source_observations"),
                               ("occurrences", "regulatory_source_occurrences"),
                               ("batches", "ingest_batches"), ("contractors", "contractors"),
                               ("licenses", "licenses"), ("entities", "entities"),
                               ("contractor_entities", "contractor_entities")):
                cur.execute(f"SELECT count(*)::int FROM {table}")
                result[key] = cur.fetchone()[0]
            cur.execute("""SELECT identity_state,count(*)::int FROM discipline_actions
              WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_rf'
              GROUP BY identity_state""")
            result["recovery_fund_identity"] = dict(cur.fetchall())
            cur.execute("""SELECT count(*) FILTER (WHERE license_id IS NOT NULL)::int,
              count(DISTINCT license_id) FILTER (WHERE license_id IS NOT NULL)::int,
              count(*) FILTER (WHERE contractor_id IS NOT NULL)::int
              FROM discipline_actions WHERE source_system='fl_dbpr'
              AND source_dataset='contractor_disc_rf'""")
            linked, targets, contractors = cur.fetchone()
            result["recovery_fund_links"] = {
                "license_linked": linked, "unique_license_targets": targets,
                "contractor_linked": contractors,
            }
            cur.execute("SELECT current_setting('transaction_read_only'), current_setting('transaction_isolation'), version()")
            read_only, isolation, version = cur.fetchone()
            result.update({"available": True, "read_only": read_only, "isolation": isolation,
                           "postgresql_version": version, "mutations": 0})
        conn.rollback()
    return result


def build_plan(url_checks: dict[str, object], production: dict[str, object]) -> dict[str, object]:
    return {
        "task": "CTH-FL-STATE-005-PLAN",
        "mode": "READ_ONLY_PLANNING",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "official_sources": url_checks,
        "coverage": {
            "owner": "Florida DFS Division of Workers' Compensation",
            "grain": "employer/carrier/policy period as reported by carrier; PEO client caveat applies",
            "historical_range": "reported policies within the past five years",
            "batch_access": "segmented Excel export by employer initial, effective-date range, and county; CAPTCHA/UI; no documented API",
            "rows_obtained": None,
            "fields": COVERAGE_EXPORT_FIELDS,
            "schema_fingerprint": sha256_fields(COVERAGE_EXPORT_FIELDS),
            "search_only_identifiers": ["Federal Employer ID Number"],
            "exported_identifiers": ["Policy Number"],
            "regulator_or_entity_id_exported": False,
        },
        "exemptions": {
            "owner": "Florida DFS Division of Workers' Compensation",
            "grain": "individual corporate officer/LLC member exemption for an employer and period",
            "historical_available": True,
            "access": "interactive downloadable result search; CAPTCHA/UI; no documented bulk API",
            "rows_obtained": None,
            "fields": EXEMPTION_RESULT_FIELDS,
            "schema_fingerprint": sha256_fields(EXEMPTION_RESULT_FIELDS),
            "search_only_identifiers": ["Federal Employer ID Number"],
            "certificate_identifier_exported": False,
            "status_field_exported": False,
        },
        "access_limitation": {
            "bulk_reproducible_acquisition_available_now": False,
            "reason": "Coverage is segmented/CAPTCHA-protected and exemption access is search-driven; displayed exports omit the authoritative FEIN/certificate identity needed for controlled linkage.",
            "alternate_strategy": "Request current and historical machine-readable POC and exemption extracts, data dictionaries, stable record identifiers, and update semantics from DFS Public Records/Bureau of Compliance.",
        },
        "identity": {
            "exact": None, "deterministic": None, "review_required": None, "unresolved": None,
            "partition_status": "NOT COMPUTABLE WITHOUT OFFICIAL BULK EXTRACT",
            "dbpr_credential_exported": False,
            "sunbiz_fei_opportunity": "potential only if DFS supplies FEIN/FEI in authorized extract",
            "automatic_name_address_linking": False,
            "prohibited": ["name-only", "address-only", "phone-only", "fuzzy", "substring", "numeric-core similarity"],
        },
        "contact_inventory": {
            "coverage": {"employer_phone": True, "employer_addresses": 1, "emails": False, "websites": False},
            "exemptions": {"employer_address": True, "holder_name": True, "phones": False, "emails": False, "websites": False},
            "policy": "retain provenance-bearing business observations; never promote exemption-holder personal data to business contact without independent authoritative classification",
        },
        "semantics": {
            "coverage": "carrier-reported policy/coverage fact, not a universal compliance determination",
            "exemption": "officer/member election excluding that person from employee status/benefits, not wrongdoing",
            "absence": "no matching record returned by the selected DFS search criteria; not proof of uninsured or illegal status",
            "expired": "a source period/date fact only; do not infer a present violation or coverage gap",
            "stop_work": "separate enforcement dataset reserved for STATE-006",
        },
        "storage_architecture": {
            "discipline_actions_appropriate": False,
            "schema_prerequisite": True,
            "recommended_tables": ["workers_comp_coverage", "workers_comp_exemptions", "regulatory_source_observations_generalized", "regulatory_source_occurrences"],
            "migration_009_direct_reuse": False,
            "reason": "regulatory_source_observations.discipline_action_id is NOT NULL and coverage/exemption facts are not discipline actions",
            "narrow_migration": "generalize observation ownership with a typed regulatory subject/evidence reference, or add dedicated immutable observation tables/FKs for coverage and exemption records while preserving existing discipline provenance",
        },
        "refresh": {
            "coverage": "weekly after an approved stable bulk extract; otherwise monthly public-record snapshots",
            "exemptions": "weekly after an approved stable bulk extract; otherwise monthly public-record snapshots",
            "unchanged_checksum": "no-op",
            "same_observation_new_snapshot": "new occurrence only",
            "material_change": "new immutable observation plus revision review",
            "missing_record": "retain history; never delete; review source semantics",
        },
        "publication": {"PUBLIC_ELIGIBLE": 0, "scoring_impact": 0,
            "safe_future_wording": ["Workers' compensation coverage listed by Florida DFS", "Workers' compensation exemption listed by Florida DFS"],
            "prohibited_wording": ["safe", "insured", "uninsured", "compliant", "violation"]},
        "profile_value": {"current_coverage": "HIGH", "coverage_dates": "HIGH", "exemption_indicator": "HIGH", "exemption_expiration": "HIGH", "carrier": "MEDIUM", "history": "MEDIUM", "official_identifiers": "HIGH", "business_contacts": "LOW"},
        "production_reconciliation": production,
        "scope": {"production_mutations": 0, "stop_work_ingested": 0, "google_calls": 0,
                  "county_city_work": 0, "publication_changes": 0, "scoring_changes": 0},
        "recommendation": "READY FOR CTH-FL-STATE-005A WORKERS COMP / EXEMPTION DATA MODEL ARCHITECTURE",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--skip-url-check", action="store_true")
    args = parser.parse_args()
    checks = {} if args.skip_url_check else validate_urls()
    plan = build_plan(checks, production_reconciliation())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(plan, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "status": "SCHEMA PREREQUISITE IDENTIFIED", "production_mutations": 0}, indent=2))


if __name__ == "__main__":
    main()
