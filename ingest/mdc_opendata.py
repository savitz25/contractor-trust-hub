"""Miami-Dade Open Data issued-permits parser. Stages A–D only. Never Stage E here."""
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from ingest.enhanced_county import parse_money, sha256_bytes
from ingest.mdc_contractor_number import (
    classify_contractor_number,
    identity_from_namespace,
    is_agency_phone,
    is_owner_builder,
    normalize_full_license,
)

PARSER_VERSION = "mdc-opendata-permits-v1"
SOURCE_SYSTEM = "mdc_opendata_issued"
COUNTY_SLUG = "miami-dade"
AGENCY_PHONES_NOTE = "786-315-2880 / 305-375-2877 are agency numbers"


def folio_jurisdiction(folio: str | None) -> str:
    digits = "".join(ch for ch in (folio or "") if ch.isdigit())
    if digits.startswith("30"):
        return "unincorporated"
    return "county_issued_other"


def process_kind(process_number: str | None, permit_type: str | None) -> str:
    p = (process_number or "").strip().upper()
    t = (permit_type or "").strip().upper()
    if p.startswith("M") or t == "MBLD":
        return "associated_county_review"
    return "county_issued"


def parse_issued_date(raw: Any) -> str | None:
    if raw is None or raw == "":
        return None
    if isinstance(raw, (int, float)):
        # ArcGIS epoch ms
        try:
            return datetime.fromtimestamp(raw / 1000, tz=timezone.utc).date().isoformat()
        except (OSError, OverflowError, ValueError):
            return None
    s = str(raw).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date().isoformat()
        except ValueError:
            continue
    if "T" in s:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
        except ValueError:
            return None
    return s[:10] if len(s) >= 10 else None


def iter_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield json.loads(line)


def stage_a(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    rows = 0
    cols: set[str] = set()
    blank_num = 0
    blank_name = 0
    blank_phone = 0
    blank_folio = 0
    val_present = 0
    malformed_dates = 0
    issued_present = 0
    keys: list[str] = []
    for rec in iter_jsonl(path):
        rows += 1
        cols.update(rec.keys())
        if not (rec.get("ContractorNumber") or "").strip():
            blank_num += 1
        if not (rec.get("ContractorName") or "").strip():
            blank_name += 1
        if not (rec.get("ContractorPhone") or "").strip():
            blank_phone += 1
        if not (rec.get("FolioNumber") or "").strip():
            blank_folio += 1
        _, val = parse_money(rec.get("EstimatedValue"))
        if val is not None:
            val_present += 1
        issued = parse_issued_date(rec.get("PermitIssuedDate"))
        if rec.get("PermitIssuedDate") not in (None, "") and issued is None:
            malformed_dates += 1
        if issued:
            issued_present += 1
        pn = (rec.get("PermitNumber") or "").strip()
        jur = folio_jurisdiction(rec.get("FolioNumber"))
        if pn:
            keys.append(f"{SOURCE_SYSTEM}|{jur}|{pn}")
    dup = len(keys) - len(set(keys))
    return {
        "filename": path.name,
        "sha256": sha256_bytes(data),
        "file_format": "jsonl",
        "row_count": rows,
        "column_count": len(cols),
        "columns": sorted(cols),
        "duplicate_permit_keys": dup,
        "unique_permit_keys": len(set(keys)),
        "blank_contractor_number": blank_num,
        "blank_contractor_name": blank_name,
        "blank_contractor_phone": blank_phone,
        "blank_folio": blank_folio,
        "valuation_coverage": val_present,
        "malformed_issue_dates": malformed_dates,
        "issued_date_coverage": issued_present,
        "parser_version": PARSER_VERSION,
        "test_only": path.name.upper().startswith("TEST_ONLY"),
        "limitations": [
            "Issued-only universe. Do not infer missing=open/closed or issued=final.",
        ],
    }


def parse_row(rec: dict[str, Any]) -> dict[str, Any]:
    number = str(rec.get("PermitNumber") or "").strip()
    folio = str(rec.get("FolioNumber") or "").strip()
    jur = folio_jurisdiction(folio)
    kind = process_kind(rec.get("ProcessNumber"), rec.get("PermitType"))
    if kind == "associated_county_review":
        jur = "associated_county_review"
    raw_val, val = parse_money(rec.get("EstimatedValue"))
    if val == 0:
        # Missing-as-zero is common; keep raw, store 0 only if source wrote 0.
        pass
    ns = classify_contractor_number(rec.get("ContractorNumber"), rec.get("ContractorName"))
    phone = str(rec.get("ContractorPhone") or "").strip()
    return {
        "source_system": SOURCE_SYSTEM,
        "source_jurisdiction": jur,
        "county_slug": COUNTY_SLUG,
        "municipality": None,
        "permit_number": number,
        "source_record_id": str(rec.get("ProcessNumber") or rec.get("GlobalID") or "").strip() or None,
        "permit_type_raw": rec.get("PermitType"),
        "work_description": rec.get("DetailDescriptionComments") or rec.get("ApplicationTypeDescription"),
        "property_address": rec.get("PropertyAddress"),
        "parcel_id": folio or None,
        "contractor_name_raw": rec.get("ContractorName"),
        "contractor_license_raw": rec.get("ContractorNumber"),
        "contractor_license_normalized": ns["normalized"] or None,
        "local_contractor_id": ns["normalized"] if ns["namespace"] == "MIAMI_DADE_COC" else None,
        "contractor_namespace": ns["namespace"],
        "contractor_prefix": ns["prefix"],
        "application_date": parse_issued_date(rec.get("ApplicationDate")),
        "issue_date": parse_issued_date(rec.get("PermitIssuedDate")),
        "expiration_date": None,
        "final_date": parse_issued_date(rec.get("CoCcDate")),
        "status_raw": "issued",
        "status_normalized": "issued",
        "valuation_raw": raw_val,
        "valuation": val,
        "fees": parse_money(rec.get("PermitTotalFee"))[1],
        "owner_builder": is_owner_builder(rec.get("ContractorName"), rec.get("ContractorNumber")),
        "process_kind": kind,
        "contractor_phone_raw": phone or None,
        "contractor_phone_is_agency": is_agency_phone(phone),
        "contractor_address_raw": " ".join(
            str(rec.get(k) or "").strip()
            for k in ("ContractorAddress", "ContractorCity", "ContractorState", "ContractorZip")
            if rec.get(k)
        )
        or None,
        "raw_payload": rec,
        "parser_version": PARSER_VERSION,
    }


def stage_b(path: Path) -> list[dict[str, Any]]:
    return [parse_row(rec) for rec in iter_jsonl(path)]


def stage_c(parsed: list[dict[str, Any]], known_dbpr: set[str] | None = None) -> list[dict[str, Any]]:
    known = known_dbpr or set()
    for p in parsed:
        ns = p["contractor_namespace"]
        lic = p.get("contractor_license_normalized") or ""
        exists = lic in known if known else False
        # Dry-run without warehouse: occupation-prefixed is still not CONFIRMED
        # unless known_dbpr was supplied. Callers should pass the lookup set.
        state, method = identity_from_namespace(
            ns,
            dbpr_exists=exists,
            local_crosswalk=False,
            has_name=bool(p.get("contractor_name_raw")) and not p.get("owner_builder"),
        )
        p["identity_state"] = state
        p["identity_method"] = method
        p["dbpr_exists"] = exists
    return parsed


def contact_observations(parsed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    out: list[dict[str, Any]] = []
    for p in parsed:
        if p.get("identity_state") not in {"CONFIRMED", "HIGH_CONFIDENCE"}:
            continue
        if p.get("owner_builder"):
            continue
        lic = p.get("contractor_license_normalized") or ""
        phone = p.get("contractor_phone_raw")
        if phone and not p.get("contractor_phone_is_agency"):
            key = ("phone", phone, lic)
            if key not in seen:
                seen.add(key)
                out.append(
                    {
                        "source_system": SOURCE_SYSTEM,
                        "kind": "phone",
                        "value": phone,
                        "value_normalized": "".join(ch for ch in phone if ch.isdigit()),
                        "attributed_entity_kind": "license",
                        "attribution_class": p["identity_state"],
                        "is_agency_number": False,
                        "license_normalized": lic,
                    }
                )
        addr = p.get("contractor_address_raw")
        if addr:
            key = ("mailing_address", addr.upper(), lic)
            if key not in seen:
                seen.add(key)
                out.append(
                    {
                        "source_system": SOURCE_SYSTEM,
                        "kind": "mailing_address",
                        "value": addr,
                        "value_normalized": addr.upper(),
                        "attributed_entity_kind": "license",
                        "attribution_class": p["identity_state"],
                        "is_agency_number": False,
                        "license_normalized": lic,
                    }
                )
    return out


def stage_d(parsed: list[dict[str, Any]], audit: dict[str, Any], contacts: list[dict[str, Any]]) -> dict[str, Any]:
    keys = [f"{p['source_system']}|{p['source_jurisdiction']}|{p['permit_number']}" for p in parsed if p.get("permit_number")]
    ns_counts = Counter(p["contractor_namespace"] for p in parsed)
    ns_distinct: dict[str, set[str]] = {}
    for p in parsed:
        ns_distinct.setdefault(p["contractor_namespace"], set()).add(p.get("contractor_license_normalized") or "")
    dup = len(keys) - len(set(keys))
    return {
        "parser_version": PARSER_VERSION,
        "stage_e": "NOT_LOADED",
        "raw_rows": audit["row_count"],
        "rows_parsed": len(parsed),
        "duplicate_keys": dup,
        "unique_keys": len(set(keys)),
        "predicted_permit_source_records_inserts": len(set(keys)),
        "predicted_updates": 0,
        "predicted_conflicts": dup,
        "duplicate_exclusions": dup,
        "predicted_permit_attributions": sum(1 for p in parsed if p.get("identity_state") == "CONFIRMED"),
        "matched_dbpr_licenses": sum(1 for p in parsed if p.get("dbpr_exists")),
        "local_credential_candidates": sum(1 for p in parsed if p["contractor_namespace"] == "MIAMI_DADE_COC"),
        "predicted_contact_observations": len(contacts),
        "unresolved_rows": sum(1 for p in parsed if p.get("identity_state") == "UNRESOLVED"),
        "CONFIRMED": sum(1 for p in parsed if p.get("identity_state") == "CONFIRMED"),
        "HIGH_CONFIDENCE": sum(1 for p in parsed if p.get("identity_state") == "HIGH_CONFIDENCE"),
        "REVIEW_REQUIRED": sum(1 for p in parsed if p.get("identity_state") == "REVIEW_REQUIRED"),
        "UNRESOLVED": sum(1 for p in parsed if p.get("identity_state") == "UNRESOLVED"),
        "namespace": {
            k: {
                "rows": ns_counts[k],
                "distinct": len({x for x in ns_distinct[k] if x}),
                "pct": round(100.0 * ns_counts[k] / len(parsed), 2) if parsed else 0,
            }
            for k in sorted(ns_counts)
        },
        "process_kind": dict(Counter(p["process_kind"] for p in parsed)),
        "source_jurisdiction": dict(Counter(p["source_jurisdiction"] for p in parsed)),
    }
