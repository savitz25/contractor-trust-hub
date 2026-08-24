#!/usr/bin/env python3
"""Read-only Florida DBPR unlicensed-activity ingestion planner.

This script has no execution mode and performs no database writes. It analyzes
official contractor_disc_ula CSVs and a REPEATABLE READ, READ ONLY production
snapshot. Candidate name/address overlaps are statistics only and never links.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg

ROOT = Path(__file__).resolve().parents[1]
import sys
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url
from ingest.normalize import normalize_address_line, normalize_entity_name, zip5
from ingest.regulatory.fl_dbpr_identity import FloridaDbprCredentialResolver, LicenseCredential
from ingest.regulatory.source_observation import (
    LOGICAL_MATTER_ALGORITHM,
    SOURCE_OBSERVATION_ALGORITHM,
    canonical_source_row,
    logical_matter_detail_key_v1,
    source_observation_key_v2,
)

SOURCE_SYSTEM = "fl_dbpr"
SOURCE_DATASET = "contractor_disc_ula"
ULA_FIELDS = (
    "License Type", "Respondent Name", "Address Line 1", "Address Line 2",
    "Address Line 3", "City", "State", "ZIP Code", "County",
    "Complaint Nbr", "Classification", "Entered Date", "Disposition",
    "Disposition Date", "Discipline Date - Description", "Violation Code",
)
ULA_LOGICAL_FIELDS = (
    "Complaint Nbr", "License Type", "Respondent Name", "Classification",
    "Entered Date", "Violation Code",
)
FILES = {
    "2021-22": ("2122", 2312, "4f0ca3409686d5a1fe960e7ecf2c0cf0416d62e216d29c4bc371432846d07d1c"),
    "2022-23": ("2223", 2631, "2c03c334e3bcda679d689494c397f7166c205aa60d3d43c05c8cf875ee84cc7b"),
    "2023-24": ("2324", 2568, "a5036af5f02e85d12b9af3252d17368b71b4c7cd9fa5c6b9a57fafcd4d2dcddc"),
    "2024-25": ("2425", 2338, "06169ddf04e1911fc6414977924c3eea28d872899a5499f6d86c766813f22b15"),
    "2025-26": ("2526", 1842, "3e9a92d8340f2c0975e4204d31b6d83cbc5bf8a7eef36a85da11b30218e87c9a"),
}


def digest(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def filename(code: str) -> str:
    return f"contractor_disc_ula_{code}.csv"


def source_url(code: str) -> str:
    return f"https://www2.myfloridalicense.com/pro/cilb/reports/{filename(code)}"


def load_files(raw_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    inventory: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    schema_fp = digest(list(ULA_FIELDS))
    for year, (code, expected_rows, expected_sha) in FILES.items():
        path = raw_dir / filename(code)
        payload = path.read_bytes()
        actual_sha = hashlib.sha256(payload).hexdigest()
        if actual_sha != expected_sha:
            raise RuntimeError(f"SOURCE_DRIFT {year}: {actual_sha}")
        parsed: list[dict[str, str]] = []
        with path.open("r", encoding="cp1252", errors="strict", newline="") as handle:
            reader = csv.DictReader(handle)
            if tuple(reader.fieldnames or ()) != ULA_FIELDS:
                raise RuntimeError(f"SCHEMA_DRIFT {year}: {reader.fieldnames}")
            for locator, row in enumerate(reader, start=1):
                if None in row or set(row) != set(ULA_FIELDS):
                    raise RuntimeError(f"MALFORMED {year}:{locator}")
                parsed.append(canonical_source_row(row, ULA_FIELDS))
        if len(parsed) != expected_rows:
            raise RuntimeError(f"ROW_DRIFT {year}: {len(parsed)}")
        observed = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        inventory.append({
            "fiscal_year": year, "url": source_url(code), "filename": path.name,
            "http_status": 200, "byte_size": len(payload), "downloaded_at": observed,
            "sha256": actual_sha, "rows": len(parsed), "columns": len(ULA_FIELDS),
            "ordered_header": list(ULA_FIELDS), "schema_fingerprint": schema_fp,
        })
        rows.extend({"fiscal_year": year, "source_record_locator": f"csv-record:{i}", "payload": row}
                    for i, row in enumerate(parsed, start=1))
    return inventory, rows


def semantic_category(disposition: str) -> str:
    mapping = {
        "Final Order": "FINAL_ORDER",
        "Citation filed": "CITATION",
        "Notice to Cease & Desist Issued": "ORDER",
        "Mandate": "ORDER",
        "Dismissed": "DISMISSED",
        "No violation found": "DISMISSED",
        "Closed after legal review": "CLOSED_ADMINISTRATIVE",
        "Duplicate Complaint": "CLOSED_ADMINISTRATIVE",
        "Civil Matter - No Jurisdiction": "CLOSED_ADMINISTRATIVE",
        "Insufficient Evidence to Prosecute": "INSUFFICIENT_EVIDENCE",
        "Insufficient Evidence": "INSUFFICIENT_EVIDENCE",
        "": "COMPLAINT_INVESTIGATION",
    }
    return mapping.get(disposition, "OTHER")


def candidate_analysis(cur, matter_rows: list[dict[str, str]]) -> dict[str, Any]:
    ula_names = sorted({normalize_entity_name(row["Respondent Name"]) for row in matter_rows if normalize_entity_name(row["Respondent Name"])})
    license_full: defaultdict[tuple[str, str, str], set[str]] = defaultdict(set)
    license_zip: defaultdict[tuple[str, str], set[str]] = defaultdict(set)
    license_name: defaultdict[str, set[str]] = defaultdict(set)
    cur.execute("""SELECT contractor_id,licensee_name_raw,dba_name_raw,address_line_1,postal_code
      FROM licenses WHERE source_system='fl_dbpr'""")
    for contractor_id, legal, dba, address, postal in cur.fetchall():
        target = f"contractor:{contractor_id}"
        for name in (legal, dba):
            n = normalize_entity_name(name)
            if not n: continue
            a, z = normalize_address_line(address), zip5(postal)
            license_name[n].add(target)
            if z: license_zip[(n, z)].add(target)
            if a and z: license_full[(n, a, z)].add(target)

    sunbiz_full: defaultdict[tuple[str, str, str], set[str]] = defaultdict(set)
    sunbiz_zip: defaultdict[tuple[str, str], set[str]] = defaultdict(set)
    sunbiz_name: defaultdict[str, set[str]] = defaultdict(set)
    # Restrict the very large Sunbiz table to exact normalized ULA names. This
    # is a review-opportunity count, never an authorization to link evidence.
    cur.execute("""SELECT id,legal_name,name_normalized,principal_address,postal_code
      FROM entities WHERE source_system='fl_sunbiz' AND name_normalized=ANY(%s)""", (ula_names,))
    for entity_id, legal, normalized, address, postal in cur.fetchall():
        n = normalized or normalize_entity_name(legal)
        if not n: continue
        target = f"entity:{entity_id}"
        a, z = normalize_address_line(address), zip5(postal)
        sunbiz_name[n].add(target)
        if z: sunbiz_zip[(n, z)].add(target)
        if a and z: sunbiz_full[(n, a, z)].add(target)

    counts = Counter()
    review, ambiguous, unresolved = 0, 0, 0
    review_rows, ambiguous_rows, unresolved_rows = 0, 0, 0
    for row in matter_rows:
        n = normalize_entity_name(row["Respondent Name"])
        a, z = normalize_address_line(row["Address Line 1"]), zip5(row["ZIP Code"])
        lf = license_full.get((n, a, z), set()) if n and a and z else set()
        sf = sunbiz_full.get((n, a, z), set()) if n and a and z else set()
        lz = license_zip.get((n, z), set()) if n and z else set()
        sz = sunbiz_zip.get((n, z), set()) if n and z else set()
        ln = license_name.get(n, set()) if n else set()
        sn = sunbiz_name.get(n, set()) if n else set()
        counts["license_exact_name_address"] += bool(lf)
        counts["license_exact_name_zip"] += bool(lz)
        counts["license_name_only"] += bool(ln)
        counts["sunbiz_exact_name_address"] += bool(sf)
        counts["sunbiz_exact_name_zip"] += bool(sz)
        counts["sunbiz_name_only"] += bool(sn)
        counts["combined_exact_name_address"] += bool(lf | sf)
        counts["combined_exact_name_zip"] += bool(lz | sz)
        counts["combined_name_only"] += bool(ln | sn)
        exact_targets = lf | sf
        matter_row_count = int(row.get("_matter_row_count", 1))
        if len(exact_targets) == 1:
            review += 1; review_rows += matter_row_count
        elif len(exact_targets) > 1:
            ambiguous += 1; ambiguous_rows += matter_row_count
        else:
            unresolved += 1; unresolved_rows += matter_row_count
    return dict(counts) | {
        "review_candidate_unique_exact_name_address": review,
        "ambiguous_exact_name_address": ambiguous,
        "unresolved_no_exact_name_address": unresolved,
        "review_candidate_observation_rows": review_rows,
        "ambiguous_candidate_observation_rows": ambiguous_rows,
        "unresolved_observation_rows": unresolved_rows,
    }


def production_snapshot(cur) -> dict[str, Any]:
    cur.execute("SELECT count(*)::int FROM discipline_actions")
    whole = cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM discipline_actions WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_lic'")
    licensed = cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM discipline_actions WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_ula'")
    ula = cur.fetchone()[0]
    cur.execute("SELECT identity_state,count(*)::int FROM discipline_actions WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_lic' GROUP BY identity_state")
    identity = dict(cur.fetchall())
    cur.execute("SELECT count(*)::int FROM regulatory_source_observations o JOIN discipline_actions d ON d.id=o.discipline_action_id WHERE d.source_system='fl_dbpr' AND d.source_dataset='contractor_disc_lic'")
    observations = cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM regulatory_source_occurrences ro JOIN regulatory_source_observations o ON o.id=ro.source_observation_id JOIN discipline_actions d ON d.id=o.discipline_action_id WHERE d.source_system='fl_dbpr' AND d.source_dataset='contractor_disc_lic'")
    occurrences = cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM discipline_actions WHERE source_system='fl_dbpr' AND publication_state='PUBLIC_ELIGIBLE'")
    public = cur.fetchone()[0]
    cur.execute("""SELECT id,external_key,occupation_code,license_number,source_board,contractor_id
      FROM licenses WHERE source_system='fl_dbpr' ORDER BY id""")
    credentials = [LicenseCredential(str(r[0]), r[1], r[2], r[3], r[4], str(r[5]) if r[5] else None) for r in cur.fetchall()]
    resolver = FloridaDbprCredentialResolver(credentials)
    cur.execute("""SELECT d.license_id,o.source_payload FROM discipline_actions d
      JOIN regulatory_source_observations o ON o.discipline_action_id=d.id
      WHERE d.source_system='fl_dbpr' AND d.source_dataset='contractor_disc_lic'""")
    safe = correctable = 0
    for current_license_id, payload in cur.fetchall():
        resolution = resolver.resolve(source_dataset='contractor_disc_lic', license_type=payload['License Type'], license_number=payload['License Nbr'])
        if resolution.identity_state in ('EXACT', 'DETERMINISTIC'):
            if str(current_license_id) == resolution.proposed_license_id: safe += 1
            else: correctable += 1
    cur.execute("SELECT source_system,count(*)::int FROM discipline_actions WHERE source_system IN ('az_roc','nj_enforcement') GROUP BY source_system")
    non_fl = dict(cur.fetchall())
    return {"whole_discipline_actions": whole, "licensed_discipline": licensed, "ula": ula,
            "licensed_observations": observations, "licensed_occurrences": occurrences,
            "licensed_identity": identity, "licensed_safe_links": safe,
            "licensed_correctable": correctable, "fl_public_eligible": public, "non_fl": non_fl}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    inventory, items = load_files(args.raw_dir)
    rows = [x["payload"] for x in items]
    exact_keys = [source_observation_key_v2(source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET, row=r, fields=ULA_FIELDS) for r in rows]
    logical_keys = [logical_matter_detail_key_v1(source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET, row=r, fields=ULA_LOGICAL_FIELDS) for r in rows]
    exact_counts = Counter(exact_keys)
    matters: defaultdict[str, list[int]] = defaultdict(list)
    for i, row in enumerate(rows): matters[row["Complaint Nbr"]].append(i)
    matter_rows = [rows[indexes[0]] | {"_matter_row_count": len(indexes)} for key, indexes in matters.items() if key]
    repeated = [v for k, v in matters.items() if k and len(v) > 1]
    matters_multiple_dispositions = sum(len({rows[i]["Disposition"] for i in v}) > 1 for k, v in matters.items() if k)
    matters_multiple_violations = sum(len({rows[i]["Violation Code"] for i in v}) > 1 for k, v in matters.items() if k)
    cross_year = 0
    for indexes in matters.values():
        if len({items[i]["fiscal_year"] for i in indexes}) > 1: cross_year += 1
    logical_groups: defaultdict[str, list[int]] = defaultdict(list)
    for i, key in enumerate(logical_keys): logical_groups[key].append(i)
    revision_groups = [v for v in logical_groups.values() if len({exact_keys[i] for i in v}) > 1 and len({items[i]["fiscal_year"] for i in v}) > 1]
    disposition = Counter(r["Disposition"] for r in rows)
    classification = Counter(r["Classification"] for r in rows)
    violation = Counter(r["Violation Code"] for r in rows)
    semantic = Counter(semantic_category(r["Disposition"]) for r in rows)
    for category in ("COMPLAINT_INVESTIGATION", "CITATION", "ORDER", "FINAL_ORDER", "DISMISSED",
                     "CLOSED_ADMINISTRATIVE", "INSUFFICIENT_EVIDENCE", "OTHER", "UNKNOWN"):
        semantic.setdefault(category, 0)
    final_order_matters = len({r["Complaint Nbr"] for r in rows if r["Disposition"] == "Final Order"})

    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    with psycopg.connect(normalize_database_url(os.environ["DATABASE_URL"]), autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            cur.execute("SET LOCAL statement_timeout='30s'")
            cur.execute("SELECT current_setting('server_version')")
            pg_version = cur.fetchone()[0]
            production = production_snapshot(cur)
            candidates = candidate_analysis(cur, matter_rows)
            conn.rollback()

    result = {
        "task": "CTH-FL-STATE-003-PLAN",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "main_sha": os.popen("git rev-parse HEAD").read().strip(),
        "source_system": SOURCE_SYSTEM,
        "source_dataset": SOURCE_DATASET,
        "source_inventory": inventory,
        "corpus": {"raw_rows": len(rows), "parseable_rows": len(rows), "malformed_rows": 0,
                   "blank_rows": 0, "prior_expected_total": 11691, "fresh_total": len(rows),
                   "source_drift": len(rows) != 11691, "unique_exact_observations": len(exact_counts),
                   "exact_duplicate_occurrences": sum(v - 1 for v in exact_counts.values()),
                   "true_net_new": len(exact_counts), "revision_candidates": len(revision_groups)},
        "grain": {"distinct_matters": len([k for k in matters if k]), "blank_matter_rows": len(matters.get("", [])),
                  "repeated_matters": len(repeated), "multi_line_matters": len(repeated),
                  "rows_in_multi_line_matters": sum(map(len, repeated)),
                  "single_line_matters": sum(len(v) == 1 for k, v in matters.items() if k),
                  "max_rows_per_matter": max(map(len, matters.values())),
                  "matters_in_multiple_fiscal_files": cross_year,
                  "respondents_per_matter_max": max(len({rows[i]["Respondent Name"] for i in v}) for v in matters.values()),
                  "matters_with_multiple_dispositions": matters_multiple_dispositions,
                  "matters_with_multiple_violation_codes": matters_multiple_violations,
                  "rows_with_repeated_matter_respondent": sum(map(len, repeated)),
                  "exact_duplicates": sum(v - 1 for v in exact_counts.values()),
                  "revision_candidate_groups": len(revision_groups)},
        "schema": {"columns": 16, "ordered_header": list(ULA_FIELDS), "schema_fingerprint": digest(list(ULA_FIELDS)),
                   "field_purpose": {"License Type": "CLASSIFICATION", "Respondent Name": "RESPONDENT",
                   "Address Line 1": "ADDRESS", "Address Line 2": "ADDRESS", "Address Line 3": "ADDRESS",
                   "City": "ADDRESS", "State": "ADDRESS", "ZIP Code": "ADDRESS", "County": "ADDRESS",
                   "Complaint Nbr": "MATTER", "Classification": "CLASSIFICATION", "Entered Date": "DATE",
                   "Disposition": "DISPOSITION", "Disposition Date": "DATE",
                   "Discipline Date - Description": "ACTION_DESCRIPTION", "Violation Code": "VIOLATION"}},
        "semantics": {"normalized": dict(semantic), "raw_disposition": dict(disposition),
                      "raw_classification": dict(classification), "raw_violation": dict(violation),
                      "final_order_rows": disposition["Final Order"], "final_order_matters": final_order_matters,
                      "severity_score_created": False, "wrongdoing_label_created": False},
        "identifiers": {"license_number_rows": 0, "complaint_number_rows": len(rows),
                        "distinct_complaint_numbers": len([k for k in matters if k]),
                        "ula_case_id_rows": 0, "citation_number_rows": 0,
                        "final_order_number_rows": 0, "doah_number_rows": 0,
                        "entity_id_rows": 0, "fei_sunbiz_rows": 0, "other_regulator_id_rows": 0,
                        "license_type_is_not_a_credential_identifier": True},
        "identity_linkage": {"OFFICIAL_IDENTIFIER_EXACT": 0, "OFFICIAL_DOCUMENT_CORROBORATED": 0,
                             "REVIEW_CANDIDATE": candidates["combined_exact_name_address"],
                             "UNRESOLVED": candidates["unresolved_no_exact_name_address"],
                             "candidate_unit": "distinct complaint/respondent matter",
                             "statistics_only_no_links": True} | candidates,
        "doah_final_orders": {"dbpr_unlicensed_search": "https://www.myfloridalicense.com/STO/UnlicensedActivity/default.asp",
                              "doah_agency_index": "https://www.doah.state.fl.us/FLAIO/",
                              "doah_case_search": "https://www.doah.state.fl.us/ALJ/SearchDOAH/",
                              "rows_with_official_complaint_key": len(rows),
                              "final_order_rows_with_potential_agency_case_key": disposition["Final Order"],
                              "deterministic_document_links_confirmed": 0,
                              "ambiguous_document_links": 0,
                              "unresolved_final_order_document_links": disposition["Final Order"],
                              "linkage_rule": "exact agency complaint/case identifier only; later bounded official-index enrichment",
                              "name_only_linking": False},
        "contacts": {"email_rows": 0, "phone_rows": 0, "website_rows": 0,
                     "additional_name_fields": 0, "role_title_rows": 0,
                     "address_line_1_rows": sum(bool(r["Address Line 1"]) for r in rows),
                     "address_line_2_rows": sum(bool(r["Address Line 2"]) for r in rows),
                     "address_line_3_rows": sum(bool(r["Address Line 3"]) for r in rows),
                     "city_rows": sum(bool(r["City"]) for r in rows),
                     "postal_rows": sum(bool(r["ZIP Code"]) for r in rows),
                     "respondent_promoted_to_contact": False,
                     "canonical_address_mutations": 0},
        "provenance_schema": {"migration_009_reusable": True, "discipline_actions_compatible": True,
                              "source_observation_algorithm": SOURCE_OBSERVATION_ALGORITHM,
                              "source_observation_fields": "FL_ULA_FIELDS (the ordered 16-field contract)",
                              "logical_matter_algorithm": LOGICAL_MATTER_ALGORITHM,
                              "logical_matter_fields": list(ULA_LOGICAL_FIELDS),
                              "complaint_level_dedupe_prohibited": True,
                              "identity_state_for_standalone": "UNRESOLVED",
                              "identity_method_for_standalone": "NO_OFFICIAL_IDENTITY_IDENTIFIER",
                              "schema_prerequisite_required": False,
                              "code_prerequisite_required": True,
                              "code_prerequisite": "dataset-specific immutable field constants, audit tests, and insert-only ULA executor"},
        "future_ingest": {"true_net_new_observations": len(exact_counts), "exact_duplicates_suppressed": 0,
                          "revision_review_observations": len(revision_groups), "safely_attributable_by_official_id": 0,
                          "review_only_candidates": candidates["review_candidate_observation_rows"] + candidates["ambiguous_candidate_observation_rows"],
                          "standalone_unresolved": candidates["unresolved_observation_rows"], "discipline_actions_proposed": len(exact_counts),
                          "observations_proposed": len(exact_counts), "occurrences_proposed": len(rows),
                          "contractor_id_mutations": 0, "license_id_mutations": 0, "PUBLIC_ELIGIBLE": 0,
                          "publication_state": "INTERNAL"},
        "refresh": {"open_fiscal_year": "monthly", "historical_files": "quarterly checksum review",
                    "unchanged_file": "no new batch or occurrence for identical same snapshot",
                    "same_observation_new_snapshot": "new occurrence only",
                    "material_change": "REVISION_REVIEW_REQUIRED; preserve old version",
                    "missing_prior_row": "retain and investigate; never delete automatically"},
        "production": {"postgresql_version": pg_version, "transaction": "REPEATABLE READ READ ONLY",
                       "statement_timeout": "30s", "snapshot": production, "mutations": 0},
        "scope": {"ula_ingested": 0, "recovery_fund": 0, "google_calls": 0, "county_work": 0,
                  "publication_enabled": False, "non_fl_mutations": 0},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"corpus": result["corpus"], "grain": result["grain"], "semantics": result["semantics"],
                      "identity_linkage": result["identity_linkage"], "production": result["production"]}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
