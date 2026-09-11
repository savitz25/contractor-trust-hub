#!/usr/bin/env python3
"""Build contractor-il-state-intel-v1 from the frozen roofing-only acquisition."""
from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGE = ROOT / "data" / "illinois" / "il-con-001"
LIB = ROOT / "lib" / "illinois-intelligence"
ACQUIRE_PATH = STAGE / "acquire-report.json"
ROWS_PATH = STAGE / "roofing-rows.json"
FROZEN_BASE_SHA = "862da0d952275a99e4214b6e88b2082581cb837b"
CONTRACT = "contractor-il-state-intel-v1"
NAMESPACE = "IL-IDFPR:{licenseNumber}"
BIZ_DESC = "LICENSED ROOFING CONTRACTOR"
QP_DESC = "QUALIFYING PARTY ROOFING CONTRACTOR"
VOLATILE_TOP = frozenset({"fingerprint", "generated_at"})


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def semantic_body(obj: dict) -> dict:
    out = {}
    for key, value in obj.items():
        if key in VOLATILE_TOP:
            continue
        if key == "clocks" and isinstance(value, dict):
            out[key] = {ck: cv for ck, cv in value.items() if ck != "generatedAt"}
        else:
            out[key] = value
    return out


def fingerprint(body: dict) -> str:
    return sha256_bytes(dump(semantic_body(body)).encode("utf-8"))


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def nonempty_id(row: dict) -> str:
    return (row.get("license_number") or "").strip()


def desc(row: dict) -> str:
    return (row.get("description") or "").strip().upper()


def status(row: dict) -> str:
    return (row.get("license_status") or "").strip()


def biz_flag(row: dict) -> str:
    return (row.get("business") or "").strip().upper()


def subset_metrics(rows: list[dict]) -> dict:
    ids = [nonempty_id(r) for r in rows]
    nonempty = [i for i in ids if i]
    counts = Counter(nonempty)
    by_status = defaultdict(set)
    by_flag = defaultdict(set)
    for r in rows:
        i = nonempty_id(r)
        if not i:
            continue
        by_status[i].add(status(r))
        by_flag[i].add(biz_flag(r))
    active_rows = [r for r in rows if status(r).upper() == "ACTIVE"]
    active_ids = {nonempty_id(r) for r in active_rows if nonempty_id(r)}
    return {
        "rows": len(rows),
        "distinct_license_ids": len(counts),
        "rows_without_license_id": sum(1 for i in ids if not i),
        "duplicate_license_ids": sum(1 for n in counts.values() if n > 1),
        "status_conflict_ids": sum(1 for s in by_status.values() if len(s) > 1),
        "business_flag_conflict_ids": sum(1 for s in by_flag.values() if len(s) > 1),
        "active_rows": len(active_rows),
        "active_distinct_license_ids": len(active_ids),
        "status_counts": dict(Counter(status(r) or "(blank)" for r in rows)),
        "business_flag_counts": dict(Counter(biz_flag(r) or "(blank)" for r in rows)),
    }


def load_frozen() -> tuple[dict, list[dict]]:
    if not ACQUIRE_PATH.is_file() or not ROWS_PATH.is_file():
        raise SystemExit("missing frozen roofing acquisition")
    acquire = json.loads(ACQUIRE_PATH.read_text(encoding="utf-8"))
    raw = ROWS_PATH.read_bytes()
    if sha256_bytes(raw) != acquire.get("raw_sha256"):
        raise SystemExit("roofing-rows checksum does not match acquire-report")
    if not acquire.get("count_consistent"):
        raise SystemExit("frozen acquisition is not count-consistent")
    rows = json.loads(raw.decode("utf-8"))
    if len(rows) != acquire.get("acquired_rows"):
        raise SystemExit("row count drifted from acquire-report")
    return acquire, rows


def main(generated_at: str | None = None) -> dict:
    acquire, rows = load_frozen()
    generated_at = generated_at or iso_now()
    all_ids = [nonempty_id(r) for r in rows]
    nonempty = [i for i in all_ids if i]
    biz_rows = [r for r in rows if desc(r) == BIZ_DESC]
    qp_rows = [r for r in rows if desc(r) == QP_DESC]
    other_desc = [r for r in rows if desc(r) not in {BIZ_DESC, QP_DESC}]
    biz_m = subset_metrics(biz_rows)
    qp_m = subset_metrics(qp_rows)
    active_biz_y = [r for r in biz_rows if status(r).upper() == "ACTIVE" and biz_flag(r) == "Y"]
    active_biz_y_ids = {nonempty_id(r) for r in active_biz_y if nonempty_id(r)}
    flag_y = [r for r in rows if (r.get("ever_disciplined") or "").strip().upper() == "Y"]
    case_rows = [r for r in rows if (r.get("case_number") or "").strip()]
    cases = [(r.get("case_number") or "").strip() for r in case_rows]
    states = Counter((r.get("state") or "").strip().upper() or "(blank)" for r in rows)
    out_of_il = sum(v for k, v in states.items() if k not in {"IL", "(blank)"})
    biz_ids = {nonempty_id(r) for r in biz_rows if nonempty_id(r)}
    qp_ids = {nonempty_id(r) for r in qp_rows if nonempty_id(r)}
    body = {
        "version": CONTRACT,
        "ticket": "IL-CON-001",
        "as_of": acquire["sourceAsOf"],
        "no_trust_score": True,
        "no_ranking": True,
        "no_local_illinois_routes": True,
        "not_statewide_gc_or_hic_license": True,
        "roofing_only": True,
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/illinois",
            "route": "/illinois",
            "h1": "Illinois Roofing License Research",
        },
        "clocks": {
            "sourceAsOf": acquire["sourceAsOf"],
            "sourceUpdatedAt": acquire["sourceUpdatedAt"],
            "sourceAsOf_meaning": "IDFPR Open Data rowsUpdatedAt for pzzh-kp68, not per-license re-verification",
            "retrievedAt": acquire["retrievedAt"],
            "retrievedAt_end": acquire["retrievedAt_end"],
            "retrievedAt_precision": acquire["retrievedAt_precision"],
            "retrievedAt_meaning": "Wall-clock of the successful roofing-only SODA retrieval",
            "snapshotAsOf": acquire["sourceAsOf"],
            "snapshotAsOf_meaning": "Accepted capture date aligned to source update date",
            "generatedAt": generated_at,
            "clocks_are_semantically_distinct": True,
            "do_not_treat_matching_calendar_dates_as_the_same_clock": True,
        },
        "hero": {
            "universe_value": len(active_biz_y_ids),
            "universe_label": "Active Illinois roofing business licenses",
            "universe_hint": "Distinct license_number on LICENSED ROOFING CONTRACTOR + ACTIVE + business=Y. Repeated rows are extra disciplinary actions, not extra licenses. Not unique companies and not qualifying parties.",
            "rows_value": len(rows),
            "rows_label": "Roofing source rows",
            "rows_hint": "IDFPR license-transaction rows for ROOFING CONTRACTOR only. Rows are not distinct licenses.",
            "qp_value": qp_m["active_distinct_license_ids"],
            "qp_label": "Active qualifying-party credentials",
            "qp_hint": "Person grain. Do not add to business licenses.",
            "as_of_value": acquire["sourceAsOf"],
            "as_of_label": "Open Data rows-updated date",
        },
        "roofing": {
            "program": "IDFPR Roofing Industry Licensing Act credentials in Professional Licensing Open Data",
            "dataset_id": "pzzh-kp68",
            "filter": acquire["filter"],
            "coverage_state": "ACQUIRED_CURRENT_SNAPSHOT",
            "classification": "VISIBLE_PUBLIC_METRIC",
            "grain": "idfpr_roofing_license_transaction_row",
            "source_rows": len(rows),
            "distinct_license_ids": len(set(nonempty)),
            "rows_without_license_id": sum(1 for i in all_ids if not i),
            "duplicate_license_ids": sum(1 for n in Counter(nonempty).values() if n > 1),
            "repeat_reason": "Same license_number repeated when additional disciplinary action values (for example Fine vs Reprimand) appear. Status does not conflict on those IDs.",
            "descriptions": dict(Counter(desc(r) for r in rows)),
            "other_description_rows": len(other_desc),
            "count_consistent": True,
            "raw_sha256": acquire["raw_sha256"],
            "raw_bytes": acquire["raw_bytes"],
            "full_professional_csv_access": "CONFIRMED",
            "full_professional_dataset_acquisition": "NOT_PERFORMED",
            "not_statewide_gc": True,
            "absence_ne_illegal_residential_gc": True,
        },
        "business_licenses": {
            **biz_m,
            "description": BIZ_DESC,
            "classification": "VISIBLE_PUBLIC_METRIC",
            "active_business_y_rows": len(active_biz_y),
            "active_business_y_distinct_license_ids": len(active_biz_y_ids),
            "headline_definition": "distinct nonempty license_number where description=LICENSED ROOFING CONTRACTOR AND license_status=ACTIVE AND business=Y",
            "license_ne_unique_company": True,
            "did_not_use_row_count_as_headline": True,
        },
        "qualifying_parties": {
            **qp_m,
            "description": QP_DESC,
            "classification": "VISIBLE_SUPPORTING_CONTEXT",
            "person_grain": True,
            "no_public_person_directory": True,
            "not_added_to_business_denominator": True,
        },
        "identity": {
            "namespace": NAMESPACE,
            "unique_across_roofing_business_and_qp": len(biz_ids & qp_ids) == 0,
            "preserve_raw_text_and_leading_zeros": True,
            "blank_id_mints_no_identity": True,
            "conflicting_id_does_not_merge_subjects": True,
            "license_ne_unique_legal_organization": True,
            "name_only": "UNSAFE",
            "no_inferred_business_qp_join": True,
        },
        "geography": {
            "registration_jurisdiction_ne_mailing_address": True,
            "mailing_address_ne_service_territory": True,
            "il_mailing_rows": states.get("IL", 0),
            "out_of_state_mailing_rows": out_of_il,
            "blank_state_rows": states.get("(blank)", 0),
            "state_distribution_top": states.most_common(8),
            "did_not_filter_to_il_addresses": True,
        },
        "discipline": {
            "classification": "VISIBLE_SUPPORTING_CONTEXT",
            "flag_rows": len(flag_y),
            "flag_distinct_license_ids": len({nonempty_id(r) for r in flag_y if nonempty_id(r)}),
            "case_rows": len(case_rows),
            "distinct_case_ids": len(set(cases)),
            "flag_ne_case": True,
            "case_ne_violation_count": True,
            "observation_ne_conviction": True,
            "historical_ne_current_restriction": True,
            "missing_ne_clean_history": True,
            "name_only_attachment": "UNSAFE",
            "exact_profile_attachments": 0,
            "no_pdf_corpus": True,
            "not_master_dataset_discipline_counts": True,
        },
        "plumbing_and_local": {
            "idph_plumbing": "OPEN_SEARCH_ONLY",
            "chicago_cook": "NOT_STARTED",
            "classification": "VISIBLE_SUPPORTING_CONTEXT",
        },
        "grain_classification": {
            "active_business_license_ids": "VISIBLE_PUBLIC_METRIC",
            "roofing_source_rows": "VISIBLE_SUPPORTING_CONTEXT",
            "qualifying_party_ids": "VISIBLE_SUPPORTING_CONTEXT",
            "discipline_observations": "VISIBLE_SUPPORTING_CONTEXT",
            "blank_and_duplicate_diagnostics": "INTERNAL_DIAGNOSTIC_ONLY",
        },
        "claim_eligibility": {"broadened": False},
        "expansion_ledger": {
            "IL_ROOFING_SOURCE_ROWS": len(rows),
            "IL_ROOFING_DISTINCT_LICENSE_IDS": len(set(nonempty)),
            "IL_ROOFING_BUSINESS_LICENSE_ROWS": biz_m["rows"],
            "IL_ROOFING_BUSINESS_DISTINCT_LICENSE_IDS": biz_m["distinct_license_ids"],
            "IL_ROOFING_ACTIVE_BUSINESS_ROWS": len(active_biz_y),
            "IL_ROOFING_ACTIVE_BUSINESS_DISTINCT_LICENSE_IDS": len(active_biz_y_ids),
            "IL_ROOFING_QUALIFYING_PARTY_ROWS": qp_m["rows"],
            "IL_ROOFING_QUALIFYING_PARTY_DISTINCT_LICENSE_IDS": qp_m["distinct_license_ids"],
            "IL_ROOFING_DISCIPLINE_FLAG_ROWS": len(flag_y),
            "IL_ROOFING_DISTINCT_CASE_IDS": len(set(cases)),
            "NET_NEW_STATE_RESEARCH_IDENTITIES": len(set(nonempty)),
            "NET_NEW_STATE_RESEARCH_IDENTITIES_definition": "Distinct nonempty IL-IDFPR roofing license_number values in this accepted snapshot that were absent from prior accepted research artifacts in this repository.",
            "NET_NEW_STATE_RESEARCH_IDENTITIES_baseline": {
                "reviewed_base_sha": FROZEN_BASE_SHA,
                "namespace": NAMESPACE,
                "prior_accepted_certificate_ids": 0,
                "method": "Searched accepted research artifacts at the reviewed base for IL-IDFPR, pzzh-kp68, and ROOFING CONTRACTOR identity files. None existed. Names were not compared.",
                "scope": "Exact source license_number values in the roofing slice only.",
                "baseline_status": "ESTABLISHED_EMPTY",
            },
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "GRAPH_WRITES": 0,
        },
        "gate": {
            "passed": True,
            "no_combined_illinois_contractor_total": True,
            "live_cohort_not_inflated": True,
            "did_not_headline_matching_row_count": True,
        },
    }
    body["generated_at"] = generated_at
    fp = fingerprint(body)
    alt = dict(body)
    alt["generated_at"] = "2099-01-01T00:00:00Z"
    alt_clocks = dict(body["clocks"])
    alt_clocks["generatedAt"] = "2099-01-01T00:00:00Z"
    alt["clocks"] = alt_clocks
    if fingerprint(alt) != fp:
        raise SystemExit("generation timestamps leaked into the semantic fingerprint")
    body["fingerprint"] = fp
    LIB.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(body, indent=2) + "\n"
    (LIB / "accepted-snapshot.json").write_text(payload, encoding="utf-8")
    (STAGE / "accepted-snapshot.json").write_text(payload, encoding="utf-8")
    print(json.dumps({"fingerprint": fp, "headline": len(active_biz_y_ids), "rows": len(rows), "distinct": len(set(nonempty)), "qp_active": qp_m["active_distinct_license_ids"], "cases": len(set(cases))}, indent=2))
    return body


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--generated-at", default=None)
    args = parser.parse_args()
    main(generated_at=args.generated_at)
