#!/usr/bin/env python3
"""Read-only Florida DFS stop-work enforcement planning audit."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url

SOURCE_URL = "https://dwcdataportal.fldfs.com/Emp_List.aspx?vEmployerName=&vddSortBy=1"
SEARCH_URL = "https://dwcdataportal.fldfs.com/SWOquery.aspx"
PORTAL_URL = "https://dwcdataportal.fldfs.com/POCData.aspx"
PUBLIC_RECORDS_URL = "https://myfloridacfo.com/publicrecords"
DEFAULT_OUTPUT = ROOT / "artifacts/cth-fl-state-006-stop-work-enforcement-plan.json"

FIELDS = (
    "Employer Name", "County", "City", "Date Served", "Date Ended*",
    "Date Reinstated**", "Reason",
)
LOGICAL_FIELDS = ("Employer Name", "County", "City", "Date Served", "Reason")


def clean_cell(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", value)).replace("\xa0", " ").strip()


def acquire() -> tuple[dict[str, object], list[tuple[str, ...]]]:
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "ContractorTrustHub-STATE-006-read-only-audit/1.0"})
    acquired = datetime.now(timezone.utc).isoformat()
    with urllib.request.urlopen(req, timeout=240) as response:
        raw = response.read()
        status = response.status
        content_type = response.headers.get_content_type()
    text = raw.decode("utf-8", "replace")
    headers = tuple(clean_cell(x) for x in re.findall(r"<th[^>]*>(.*?)</th>", text, re.I | re.S))
    if headers[: len(FIELDS)] != FIELDS:
        raise RuntimeError(f"unexpected stop-work schema: {headers[:len(FIELDS)]!r}")
    rows: list[tuple[str, ...]] = []
    for match in re.findall(r"<tr[^>]*>(.*?)</tr>", text, re.I | re.S):
        cells = tuple(clean_cell(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", match, re.I | re.S))
        if len(cells) == len(FIELDS):
            rows.append(cells)
    reported = re.search(r"lblRecCount\">([0-9,]+)<", text)
    if reported and int(reported.group(1).replace(",", "")) != len(rows):
        raise RuntimeError("reported row count does not match parsed rows")
    return ({"url": SOURCE_URL, "search_url": SEARCH_URL, "http_status": status,
             "content_type": content_type, "bytes": len(raw),
             "sha256": hashlib.sha256(raw).hexdigest(), "retrieved_at_utc": acquired,
             "database_last_updated_raw": (re.search(r"Database was Last Updated:\s*([^<]+)", text, re.I) or [None, None])[1]}, rows)


def analyze(rows: list[tuple[str, ...]]) -> dict[str, object]:
    unique = set(rows)
    employer_counts = Counter(r[0] for r in rows)
    reasons = Counter(r[6] for r in rows)
    ended = Counter("NOT_ENDED" if "not ended" in r[4].lower() else "DATED" for r in rows)
    reinstated = Counter("NOT_REINSTATED" if "not reinstated" in r[5].lower() else "DATED" for r in rows)
    return {
        "rows": len(rows), "unique_exact_observations": len(unique),
        "exact_duplicate_occurrences": len(rows) - len(unique),
        "distinct_employer_names": len(employer_counts),
        "employers_with_multiple_rows": sum(count > 1 for count in employer_counts.values()),
        "maximum_rows_per_employer_name": max(employer_counts.values(), default=0),
        "reason_distribution": dict(sorted(reasons.items())),
        "date_ended_shape": dict(ended), "date_reinstated_shape": dict(reinstated),
        "blank_counts": {FIELDS[i]: sum(not row[i] for row in rows) for i in range(len(FIELDS))},
        "fields": FIELDS, "logical_review_fields": LOGICAL_FIELDS,
        "schema_fingerprint": "sha256:" + hashlib.sha256(json.dumps(FIELDS, separators=(",", ":")).encode()).hexdigest(),
    }


def production() -> dict[str, object]:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = normalize_database_url(os.environ.get("DATABASE_URL", ""))
    if not url:
        return {"available": False, "mutations": 0}
    with psycopg.connect(url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
            cur.execute("SET LOCAL statement_timeout='30s'")
            cur.execute("""SELECT count(*)::int,
              count(*) FILTER(WHERE source_system='fl_dbpr')::int,
              count(*) FILTER(WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_lic')::int,
              count(*) FILTER(WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_ula')::int,
              count(*) FILTER(WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_rf')::int,
              count(*) FILTER(WHERE source_system='az_roc')::int,
              count(*) FILTER(WHERE source_system='nj_enforcement')::int,
              count(*) FILTER(WHERE publication_state='PUBLIC_ELIGIBLE')::int FROM discipline_actions""")
            result = dict(zip(("whole_discipline_actions", "florida_all", "licensed", "ula",
                "recovery_fund", "arizona", "new_jersey", "public_eligible"), cur.fetchone(), strict=True))
            for key, table in (("observations", "regulatory_source_observations"),
                               ("occurrences", "regulatory_source_occurrences"),
                               ("batches", "ingest_batches")):
                cur.execute(f"SELECT count(*)::int FROM {table}")
                result[key] = cur.fetchone()[0]
            cur.execute("""SELECT identity_state,count(*)::int FROM discipline_actions
              WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_rf' GROUP BY identity_state""")
            result["recovery_fund_identity"] = dict(cur.fetchall())
            cur.execute("""SELECT count(*) FILTER(WHERE license_id IS NOT NULL)::int,
              count(DISTINCT license_id) FILTER(WHERE license_id IS NOT NULL)::int,
              count(*) FILTER(WHERE contractor_id IS NOT NULL)::int,
              count(*) FILTER(WHERE publication_state='PUBLIC_ELIGIBLE')::int
              FROM discipline_actions WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_rf'""")
            linked, targets, contractors, public = cur.fetchone()
            result["recovery_fund_links"] = {"license_linked": linked, "target_licenses": targets,
                                               "contractor_linked": contractors, "public": public}
            cur.execute("SELECT current_setting('transaction_read_only'),current_setting('transaction_isolation'),version()")
            read_only, isolation, version = cur.fetchone()
            result.update({"available": True, "read_only": read_only, "isolation": isolation,
                           "postgresql_version": version, "mutations": 0})
        conn.rollback()
    return result


def plan(source: dict[str, object], analysis: dict[str, object], prod: dict[str, object]) -> dict[str, object]:
    return {
        "task": "CTH-FL-STATE-006-PLAN", "mode": "READ_ONLY_PLANNING",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "official_sources": {
            "stop_work_search": {**source, "regulator": "Florida DFS Division of Workers' Compensation",
                "dataset": "Compliance Stop-Work Order Database", "access": "unauthenticated HTML search/report",
                "authentication": "none", "history_start": "2004-01-01", "refresh": "daily by 08:00, sometimes later",
                "pagination": "none observed; all-employer report available", "automation": "practical but large (~80 MB)"},
            "portal": {"url": PORTAL_URL, "boundary": "coverage/exemption are STATE-005; stop-work is STATE-006"},
            "public_records": {"url": PUBLIC_RECORDS_URL, "purpose": "request authoritative order/case IDs, FEIN and penalty/order detail extract"},
            "final_orders": {"pre_2015": "https://finalorders.fldfs.com/ExternalWebAccess.aspx",
                             "post_2015": "https://www.doah.state.fl.us/FLAIO/", "deterministic_links": 0},
        },
        "record_grain": {"interpretation": "one displayed stop-work order history row for employer/location/served date/reason, including end and possible reinstatement state",
                         **analysis, "complaint_or_order_number_present": False,
                         "duplicate_policy": "preserve row occurrences; exact-content dedupe only after DFS confirms whether indistinguishable rows are duplicate display records"},
        "identifiers": {"order_id": 0, "case_id": 0, "employer_id": 0, "FEIN_displayed": 0,
                        "FEIN_searchable": True, "DBPR_credential": 0, "Sunbiz_id": 0,
                        "penalty_order_id": 0, "DOAH_case_id": 0, "final_order_id": 0},
        "identity": {"EXACT": 0, "DETERMINISTIC": 0, "REVIEW_REQUIRED": 0,
                     "UNRESOLVED": analysis["unique_exact_observations"],
                     "initial_policy": "all standalone/unresolved because the result does not expose authoritative identity identifiers",
                     "entity_path": "prefer FEIN -> entity -> separately proven contractor/license relationships if DFS supplies FEIN in an official extract",
                     "prohibited": ["name-only", "address-only", "phone-only", "fuzzy", "substring", "numeric-core-only"]},
        "semantics": {"issued": "Date Served records service of a DFS stop-work order",
                      "ended": "Date Ended indicates the order ended after compliance/payment-plan or penalty-payment conditions described by DFS",
                      "reinstated": "Date Reinstated indicates reinstatement after default under a periodic payment agreement",
                      "active": "only supportable when the current daily source explicitly shows not ended; historical issue alone is not active status",
                      "closed": "not a raw source status; do not manufacture",
                      "appeal": "employers may request an administrative hearing within 21 days, but appeal status is absent",
                      "reasons": analysis["reason_distribution"], "raw_values_preserved": True},
        "penalties": {"amount_fields": 0, "proposed_amount": 0, "assessed_amount": 0, "paid_amount": 0,
                      "balance": 0, "semantics": "the public row has no monetary fields; Date Ended footnote may reflect compliance plus payment agreement or payment in full, without distinguishing them"},
        "contacts": {"emails": 0, "phones": 0, "extensions": 0, "websites": 0,
                     "contact_names": 0, "roles": 0, "street_addresses": 0,
                     "business_location_fields": ["County", "City"],
                     "pii_policy": "do not promote names/locations or acquire personal contact data as contractor contacts"},
        "absence_semantics": "No matching row in a historical, search-limited representative database dating to 2004; not proof of compliance, coverage, or no enforcement history.",
        "storage": {"discipline_actions_appropriate": "CONDITIONAL", "schema_prerequisite": False,
                    "migration_prerequisite": False, "migration_009_reusable": True,
                    "conditions": ["source_dataset=fl_dfs_workers_comp_stop_work", "one action per approved exact observation",
                                   "all initial identity UNRESOLVED", "contractor_id/license_id NULL", "INTERNAL only",
                                   "dataset-specific status semantics and public exclusions", "raw seven-field payload preserved"],
                    "source_fields": FIELDS, "logical_fields": LOGICAL_FIELDS,
                    "source_key": "source-observation-key-v2 over ordered seven-field contract",
                    "logical_key": "logical-matter-detail-key-v1 over employer/county/city/date-served/reason; review only"},
        "refresh": {"cadence": "daily after DFS update window", "unchanged_snapshot_checksum": "no-op",
                    "same_observation_new_snapshot": "new occurrence only", "material_change": "new observation and revision review",
                    "missing_prior_row": "retain history and review; no deletion", "active_status_recomputed": False},
        "publication": {"PUBLIC_ELIGIBLE": 0, "scoring_impact": 0,
                        "safe_future_wording": ["Florida DFS issued a stop-work order on [date]", "Florida DFS lists the order as ended on [date]"],
                        "prohibited": ["currently active based only on historical issue", "fully compliant", "uninsured", "fraud", "unsafe"],
                        "scoring_future": "DEFERRED — SEPARATE POLICY REVIEW"},
        "production_reconciliation": prod,
        "scope": {"production_mutations": 0, "coverage_or_exemption_ingestion": 0, "stop_work_ingestion": 0,
                  "publication_changes": 0, "scoring_changes": 0, "google_calls": 0, "county_city_work": 0},
        "recommendation": "READY FOR CTH-FL-STATE-006 STOP-WORK CONTROLLED INGESTION ARCHITECTURE",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    source, rows = acquire()
    result = plan(source, analyze(rows), production())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as output_file:
        output_file.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"output": str(args.output), "rows": len(rows),
                      "unique": len(set(rows)), "production_mutations": 0}, indent=2))


if __name__ == "__main__":
    main()
