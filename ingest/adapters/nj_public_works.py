"""NJ public-works registration and exclusion-source parsers.

Six official source families stay separate. No composite score. No name-only attach.
PWCR / prevailing-wage Power BI exports are optional local inputs.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

from ingest.xlsx_stdlib import read_xlsx_dicts

SOURCE_FAMILIES = (
    "NJ_PWCR_REGISTRATION",
    "NJ_PREVAILING_WAGE_DEBARMENT",
    "NJ_WALL",
    "NJ_WAGE_VIOLATION_WATCHLIST",
    "NJ_TREASURY_CONSTRUCTION_DEBARMENT",
    "NJ_TREASURY_VENDOR_DEBARMENT",
)

PUBLIC_LABELS = {
    "NJ_PWCR_REGISTRATION": "New Jersey Public Works Contractor Registration",
    "NJ_PREVAILING_WAGE_DEBARMENT": "New Jersey prevailing-wage debarment",
    "NJ_WALL": "Workplace Accountability in Labor List",
    "NJ_WAGE_VIOLATION_WATCHLIST": "Wage Violation Watchlist",
    "NJ_TREASURY_CONSTRUCTION_DEBARMENT": "New Jersey Treasury construction debarment, suspension, or disqualification",
    "NJ_TREASURY_VENDOR_DEBARMENT": "New Jersey Treasury vendor debarment, suspension, or disqualification",
    "NJ_LEAD_EVALUATION": "New Jersey Lead Evaluation Certification",
    "NJ_LEAD_ABATEMENT": "New Jersey Lead Abatement Certification",
    "NJ_ASCM_AUTHORIZATION": "New Jersey Asbestos Safety Control Monitoring Authorization",
    "NJ_FIRE_PROTECTION_PERMIT": "New Jersey Fire Protection Equipment Contractor Permit",
    "NJ_NEW_HOME_BUILDER": "New Jersey New Home Builder Registration",
    "NJ_HEC_REGISTRATION": "New Jersey Home Elevation Contractor Registration",
    "NJ_OPERATION_SAFE_HOUSE": "Notice of Violation",
    "NJ_OCP_LEGAL_FILING": "Office of Consumer Protection legal filing",
    "NJ_BOARD_ACTION": "New Jersey contractor board action",
}

FORBIDDEN_PUBLIC_LABELS = (
    "Public Works Vetted",
    "Public Works Qualified",
    "Government Approved",
    "Government Vetted",
    "Higher Trust",
    "Safer Contractor",
)

SOURCE_COVERAGE_ACQUIRED = "ACQUIRED"
SOURCE_COVERAGE_PARTIAL = "PARTIAL_SOURCE_COVERAGE"
SOURCE_COVERAGE_NOT_ACQUIRED = "SOURCE_NOT_ACQUIRED"

# Absence of an unacquired source is never a clean-history conclusion.
FORBIDDEN_ABSENCE_CLAIMS = (
    "No other enforcement record found",
    "No record found",
    "Clean record",
    "No disciplinary history",
)

EVIDENCE_CLASS = {
    "NJ_LEAD_EVALUATION": "specialty_credential",
    "NJ_LEAD_ABATEMENT": "specialty_credential",
    "NJ_ASCM_AUTHORIZATION": "specialty_credential",
    "NJ_FIRE_PROTECTION_PERMIT": "specialty_credential",
    "NJ_NEW_HOME_BUILDER": "specialty_credential",
    "NJ_HEC_REGISTRATION": "specialty_credential",
    "NJ_OPERATION_SAFE_HOUSE": "regulatory_event",
    "NJ_OCP_LEGAL_FILING": "regulatory_event",
    "NJ_BOARD_ACTION": "regulatory_event",
    "NJ_PWCR_REGISTRATION": "registration_roster",
    "NJ_PREVAILING_WAGE_DEBARMENT": "exclusion_list",
    "NJ_WALL": "exclusion_list",
    "NJ_WAGE_VIOLATION_WATCHLIST": "exclusion_list",
    "NJ_TREASURY_CONSTRUCTION_DEBARMENT": "exclusion_list",
    "NJ_TREASURY_VENDOR_DEBARMENT": "exclusion_list",
}

TREASURY_REASON = {
    "A": "Criminal Offense",
    "B": "Organized Crime Contract",
    "C": "Antitrust / Anti-Kickback",
    "D": "Election Law Offense",
    "E": "Discrimination Law",
    "F": "Wage & Hour Violation",
    "G": "Industry Law Violation",
    "H": "Failure To Perform",
    "I": "Poor Performance",
    "J": "Contingent Fees",
    "K": "Other",
}

TREASURY_DEPARTMENT = {
    "20": "EDA",
    "46": "DHSS",
    "54": "DHS",
    "62": "LABOR",
    "66": "LPS",
    "78": "DOT",
    "82": "TREASURY",
}

TREASURY_AGENCY = {
    "0018": "Schools Development Authority",
    "0997": "Schools Development Authority",
    "1000": "Criminal Justice",
    "1050": "Consumer Affairs Board of Medical Examiners",
    "1321": "Consumer Affairs Board of Architects",
    "2050": "Treasury Purchase Bureau",
    "2065": "Treasury Property Management and Construction",
    "2800": "School Construction Corporation",
    "4210": "Health & Senior Services",
    "4550": "Workplace Standards",
    "6000": "NJ Turnpike Authority",
    "6120": "Contract Administration",
    "7540": "Medical Assistance (Medicaid)",
    "8020": "Housing and Mortgage Finance Agency",
}

TREASURY_FIELDS = (
    "firm_name",
    "individual_name",
    "vendor_id",
    "firm_street",
    "firm_city",
    "firm_state",
    "firm_zip",
    "firm_plus4",
    "npi_number",
    "individual_street",
    "individual_city",
    "individual_state",
    "individual_zip",
    "individual_plus4",
    "category",
    "action",
    "reason",
    "debarring_department",
    "debarring_agency",
    "effective_date",
    "expiration_date",
    "permanent_debarment",
)

WALL_REQUIRED_HEADERS = {
    "Name of Employer/DBA",
    "Violation Type",
    "Date Posted on the WALL",
}

WATCHLIST_REQUIRED_HEADERS = {
    "Name of Employer/DBA",
    "Nature of Claim",
    "Status",
}

PWCR_REQUIRED_HEADERS = {
    "certificate_number",
    "business_name",
}

PW_DEBARMENT_REQUIRED_HEADERS = {
    "business_name",
}

EXCLUDED_TREASURY_CATEGORIES = {"MEDICAL", "PROFESSIONAL"}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def schema_fingerprint(headers: Iterable[str]) -> str:
    blob = json.dumps(list(headers), separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def canonical_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def observation_key(*, source_family: str, fields: dict[str, str]) -> str:
    payload = {"source_family": source_family, **{k: canonical_value(v) for k, v in sorted(fields.items())}}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_date(value: Any) -> str | None:
    text = canonical_value(value)
    if not text:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text
    try:
        serial = float(text)
        if serial > 20000:
            return (datetime(1899, 12, 30) + timedelta(days=int(serial))).date().isoformat()
    except ValueError:
        pass
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y%m%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def split_us_address(raw: str) -> dict[str, str]:
    text = canonical_value(raw)
    out = {"address_line_1": "", "city": "", "state": "", "postal_code": ""}
    if not text:
        return out
    m = re.search(r",\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$", text, re.I)
    if m:
        out["address_line_1"] = text[: m.start()].strip(" ,")
        out["city"] = m.group(1).strip()
        out["state"] = m.group(2).upper()
        out["postal_code"] = m.group(3)
        return out
    m2 = re.search(r"\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$", text, re.I)
    if m2:
        out["state"] = m2.group(1).upper()
        out["postal_code"] = m2.group(2)
        rest = text[: m2.start()].rstrip(" ,")
        if "," in rest:
            line, city = rest.rsplit(",", 1)
            out["address_line_1"] = line.strip()
            out["city"] = city.strip()
        else:
            out["address_line_1"] = rest
        return out
    out["address_line_1"] = text
    return out


def _base_observation(source_family: str, raw: dict[str, Any], key_fields: dict[str, str]) -> dict[str, Any]:
    key = observation_key(source_family=source_family, fields=key_fields)
    return {
        "source_family": source_family,
        "public_label": PUBLIC_LABELS.get(source_family, source_family),
        "source_record_id": key_fields.get("source_record_id") or key,
        "source_observation_key": key,
        "row_fingerprint_sha256": key,
        "contractor_id": None,
        "official_business_name": canonical_value(raw.get("official_business_name")),
        "individual_name": canonical_value(raw.get("individual_name")) or None,
        "address_line_1": canonical_value(raw.get("address_line_1")) or None,
        "city": canonical_value(raw.get("city")) or None,
        "state": (canonical_value(raw.get("state")) or "NJ")[:2].upper() or None,
        "postal_code": canonical_value(raw.get("postal_code")) or None,
        "county": canonical_value(raw.get("county")) or None,
        "certificate_or_vendor_id": canonical_value(raw.get("certificate_or_vendor_id")) or None,
        "registration_status": canonical_value(raw.get("registration_status")) or None,
        "effective_date": parse_date(raw.get("effective_date")),
        "expiration_date": parse_date(raw.get("expiration_date")),
        "action": canonical_value(raw.get("action")) or None,
        "reason_code": canonical_value(raw.get("reason_code")) or None,
        "reason_text": canonical_value(raw.get("reason_text")) or None,
        "debarring_department": canonical_value(raw.get("debarring_department")) or None,
        "debarring_agency": canonical_value(raw.get("debarring_agency")) or None,
        "permanent_flag": canonical_value(raw.get("permanent_flag")) or None,
        "source_publication_date": parse_date(raw.get("source_publication_date")),
        "match_method": "unresolved",
        "match_confidence": "unresolved",
        "public_eligibility_status": "internal_only",
        "currency": "current_snapshot",
        "evidence_class": EVIDENCE_CLASS.get(source_family),
        "raw_payload": raw.get("raw_payload") or {},
    }


def parse_treasury_text(text: str, *, delimiter: str, source_family: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if source_family not in {
        "NJ_TREASURY_CONSTRUCTION_DEBARMENT",
        "NJ_TREASURY_VENDOR_DEBARMENT",
    }:
        raise ValueError(source_family)
    parsed: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    expected_category = "CONSTRUCTION" if "CONSTRUCTION" in source_family else "VENDOR"
    for i, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        parts = line.split(delimiter)
        if len(parts) < 22:
            rejected.append({"row": i, "reason": "column_count", "raw": line[:200]})
            continue
        rec = {TREASURY_FIELDS[j]: canonical_value(parts[j]) for j in range(22)}
        category = rec["category"].upper()
        if category in EXCLUDED_TREASURY_CATEGORIES:
            rejected.append({"row": i, "reason": "excluded_category", "category": category})
            continue
        if category and category != expected_category:
            rejected.append({"row": i, "reason": "category_family_mismatch", "category": category})
            continue
        reason_code = rec["reason"].upper()
        firm = rec["firm_name"]
        person = rec["individual_name"]
        addr_src = rec["firm_street"] or rec["individual_street"]
        city = rec["firm_city"] or rec["individual_city"]
        state = rec["firm_state"] or rec["individual_state"] or "NJ"
        postal = rec["firm_zip"] or rec["individual_zip"]
        action = rec["action"].upper()
        perm = rec["permanent_debarment"].upper()
        key_fields = {
            "vendor_id": rec["vendor_id"],
            "firm_name": firm,
            "individual_name": person,
            "category": category,
            "action": action,
            "reason": reason_code,
            "effective_date": rec["effective_date"],
            "expiration_date": rec["expiration_date"],
            "permanent_debarment": perm,
            "firm_street": rec["firm_street"],
            "individual_street": rec["individual_street"],
        }
        raw = {
            "official_business_name": firm or None,
            "individual_name": person or None,
            "address_line_1": addr_src or None,
            "city": city or None,
            "state": state or None,
            "postal_code": postal or None,
            "certificate_or_vendor_id": rec["vendor_id"] or None,
            "action": action or None,
            "reason_code": reason_code or None,
            "reason_text": TREASURY_REASON.get(reason_code),
            "debarring_department": TREASURY_DEPARTMENT.get(rec["debarring_department"], rec["debarring_department"]),
            "debarring_agency": TREASURY_AGENCY.get(rec["debarring_agency"], rec["debarring_agency"]),
            "effective_date": rec["effective_date"],
            "expiration_date": rec["expiration_date"],
            "permanent_flag": perm or None,
            "raw_payload": rec,
        }
        obs = _base_observation(source_family, raw, key_fields)
        obs["source_record_locator"] = f"line:{i}"
        parsed.append(obs)
    return parsed, rejected


def parse_treasury_file(path: Path, *, source_family: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    data = path.read_bytes()
    text = data.decode("latin-1")
    delimiter = "%" if path.name.endswith("2.txt") or text[:200].count("%") > text[:200].count("\t") else "\t"
    return parse_treasury_text(text, delimiter=delimiter, source_family=source_family)


def _require_headers(row: dict[str, str], required: set[str], source: str) -> None:
    missing = [h for h in required if h not in row]
    if missing:
        raise ValueError(f"{source} schema drift, missing headers: {missing}; have {sorted(row)}")


def parse_wall_rows(rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    parsed: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    if not rows:
        return parsed, rejected
    _require_headers(rows[0], WALL_REQUIRED_HEADERS, "NJ_WALL")
    addr_key = "Employer's Principal Address" if "Employer's Principal Address" in rows[0] else "Principal Address of Employer"
    for i, row in enumerate(rows, start=2):
        name = canonical_value(row.get("Name of Employer/DBA"))
        if not name:
            rejected.append({"row": i, "reason": "missing_name"})
            continue
        addr = split_us_address(row.get(addr_key, ""))
        key_fields = {
            "name": name,
            "address": canonical_value(row.get(addr_key)),
            "violation_type": canonical_value(row.get("Violation Type")),
            "date_posted": canonical_value(row.get("Date Posted on the WALL")),
            "liability": canonical_value(row.get("Total Liability Owed Under Final Judgment / Order")),
        }
        raw = {
            "official_business_name": name,
            "address_line_1": addr["address_line_1"] or canonical_value(row.get(addr_key)) or None,
            "city": addr["city"] or None,
            "state": addr["state"] or "NJ",
            "postal_code": addr["postal_code"] or None,
            "county": canonical_value(row.get("County")) or None,
            "action": "WALL_LISTING",
            "reason_text": canonical_value(row.get("Violation Type")) or None,
            "source_publication_date": row.get("Date Posted on the WALL"),
            "raw_payload": row,
        }
        obs = _base_observation("NJ_WALL", raw, key_fields)
        obs["source_record_locator"] = f"row:{i}"
        parsed.append(obs)
    return parsed, rejected


def parse_watchlist_rows(rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    parsed: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    if not rows:
        return parsed, rejected
    _require_headers(rows[0], WATCHLIST_REQUIRED_HEADERS, "NJ_WAGE_VIOLATION_WATCHLIST")
    for i, row in enumerate(rows, start=2):
        name = canonical_value(row.get("Name of Employer/DBA"))
        if not name:
            rejected.append({"row": i, "reason": "missing_name"})
            continue
        status = canonical_value(row.get("Status"))
        if re.search(r"debar", status, re.I):
            # Preserve watchlist terminology; do not coerce to debarment.
            status = status
        addr = split_us_address(row.get("Employer Address", ""))
        key_fields = {
            "name": name,
            "address": canonical_value(row.get("Employer Address")),
            "nature": canonical_value(row.get("Nature of Claim")),
            "status": status,
            "final_order": canonical_value(row.get("Date of Final Order and Judgement")),
        }
        raw = {
            "official_business_name": name,
            "address_line_1": addr["address_line_1"] or canonical_value(row.get("Employer Address")) or None,
            "city": addr["city"] or None,
            "state": addr["state"] or "NJ",
            "postal_code": addr["postal_code"] or None,
            "action": "WATCHLIST_FINAL_DETERMINATION",
            "registration_status": status or None,
            "reason_text": canonical_value(row.get("Nature of Claim")) or None,
            "effective_date": row.get("Date of Final Order and Judgement"),
            "source_publication_date": row.get("Date of Final Order and Judgement"),
            "raw_payload": row,
        }
        obs = _base_observation("NJ_WAGE_VIOLATION_WATCHLIST", raw, key_fields)
        obs["source_record_locator"] = f"row:{i}"
        parsed.append(obs)
    return parsed, rejected


def parse_pwcr_rows(rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    parsed: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    if not rows:
        return parsed, rejected
    lowered = {re.sub(r"[^a-z0-9]+", "_", k.lower()).strip("_"): k for k in rows[0]}
    cert_key = lowered.get("certificate_number") or lowered.get("pwcr_number") or lowered.get("registration_number")
    name_key = lowered.get("business_name") or lowered.get("contractor_name") or lowered.get("name")
    if not cert_key or not name_key:
        raise ValueError(f"NJ_PWCR_REGISTRATION schema drift, headers={sorted(rows[0])}")
    for i, row in enumerate(rows, start=2):
        cert = canonical_value(row.get(cert_key))
        name = canonical_value(row.get(name_key))
        if not cert or not name:
            rejected.append({"row": i, "reason": "missing_certificate_or_name"})
            continue
        addr = split_us_address(row.get(lowered.get("address") or lowered.get("business_address") or "", ""))
        key_fields = {
            "certificate_number": cert,
            "business_name": name,
            "effective_date": canonical_value(row.get(lowered.get("effective_date") or lowered.get("registration_effective_date") or "", "")),
            "expiration_date": canonical_value(row.get(lowered.get("expiration_date") or lowered.get("registration_expiration_date") or "", "")),
            "status": canonical_value(row.get(lowered.get("status") or lowered.get("registration_status") or "", "")),
        }
        raw = {
            "official_business_name": name,
            "individual_name": canonical_value(row.get(lowered.get("owner") or lowered.get("responsible_officer") or "", "")) or None,
            "address_line_1": addr["address_line_1"] or None,
            "city": addr["city"] or canonical_value(row.get(lowered.get("city") or "", "")) or None,
            "state": addr["state"] or canonical_value(row.get(lowered.get("state") or "", "")) or "NJ",
            "postal_code": addr["postal_code"] or canonical_value(row.get(lowered.get("zip") or lowered.get("postal_code") or "", "")) or None,
            "certificate_or_vendor_id": cert,
            "registration_status": key_fields["status"] or "CURRENT_SOURCE_ROSTER",
            "effective_date": key_fields["effective_date"] or None,
            "expiration_date": key_fields["expiration_date"] or None,
            "raw_payload": row,
        }
        obs = _base_observation("NJ_PWCR_REGISTRATION", raw, key_fields)
        obs["source_record_locator"] = f"row:{i}"
        parsed.append(obs)
    return parsed, rejected


def parse_pw_debarment_rows(rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    parsed: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    if not rows:
        return parsed, rejected
    lowered = {re.sub(r"[^a-z0-9]+", "_", k.lower()).strip("_"): k for k in rows[0]}
    name_key = lowered.get("business_name") or lowered.get("firm_name") or lowered.get("name")
    if not name_key:
        raise ValueError(f"NJ_PREVAILING_WAGE_DEBARMENT schema drift, headers={sorted(rows[0])}")
    for i, row in enumerate(rows, start=2):
        name = canonical_value(row.get(name_key))
        person = canonical_value(row.get(lowered.get("individual_name") or lowered.get("person_name") or "", ""))
        if not name and not person:
            rejected.append({"row": i, "reason": "missing_name"})
            continue
        key_fields = {k: canonical_value(v) for k, v in row.items()}
        raw = {
            "official_business_name": name or None,
            "individual_name": person or None,
            "address_line_1": canonical_value(row.get(lowered.get("address") or "", "")) or None,
            "city": canonical_value(row.get(lowered.get("city") or "", "")) or None,
            "state": canonical_value(row.get(lowered.get("state") or "", "")) or "NJ",
            "postal_code": canonical_value(row.get(lowered.get("zip") or "", "")) or None,
            "action": "PREVAILING_WAGE_DEBARMENT",
            "effective_date": row.get(lowered.get("effective_date") or lowered.get("start_date") or "", "") or None,
            "expiration_date": row.get(lowered.get("expiration_date") or lowered.get("end_date") or "", "") or None,
            "reason_text": canonical_value(row.get(lowered.get("reason") or "", "")) or None,
            "raw_payload": row,
        }
        obs = _base_observation("NJ_PREVAILING_WAGE_DEBARMENT", raw, key_fields)
        obs["source_record_locator"] = f"row:{i}"
        parsed.append(obs)
    return parsed, rejected


def parse_csv_dicts(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return [{k: canonical_value(v) for k, v in row.items()} for row in csv.DictReader(fh)]


def load_source(path: Path, source_family: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    suffix = path.suffix.lower()
    if source_family in {"NJ_TREASURY_CONSTRUCTION_DEBARMENT", "NJ_TREASURY_VENDOR_DEBARMENT"}:
        return parse_treasury_file(path, source_family=source_family)
    if source_family == "NJ_WALL":
        rows = read_xlsx_dicts(path) if suffix == ".xlsx" else parse_csv_dicts(path)
        return parse_wall_rows(rows)
    if source_family == "NJ_WAGE_VIOLATION_WATCHLIST":
        rows = read_xlsx_dicts(path) if suffix == ".xlsx" else parse_csv_dicts(path)
        return parse_watchlist_rows(rows)
    if source_family == "NJ_PWCR_REGISTRATION":
        return parse_pwcr_rows(parse_csv_dicts(path))
    if source_family == "NJ_PREVAILING_WAGE_DEBARMENT":
        return parse_pw_debarment_rows(parse_csv_dicts(path))
    raise ValueError(source_family)


OFFICIAL_DOWNLOADS = {
    "NJ_WALL": {
        "url": "https://www.nj.gov/labor/ea/assets/PDFs/Wall_Dataset.xlsx",
        "filename": "Wall_Dataset.xlsx",
        "agency": "NJDOL Office of Strategic Enforcement and Compliance",
        "page": "https://www.nj.gov/labor/ea/osec/wall.shtml",
    },
    "NJ_WAGE_VIOLATION_WATCHLIST": {
        "url": "https://www.nj.gov/labor/ea/assets/PDFs/WVW-List.xlsx",
        "filename": "WVW-List.xlsx",
        "agency": "NJDOL Office of Strategic Enforcement and Compliance",
        "page": "https://www.nj.gov/labor/ea/osec/wageviolationlist.shtml",
    },
    "NJ_TREASURY_CONSTRUCTION_DEBARMENT": {
        "url": "https://www.nj.gov/treasury/treasfiles/debarment/Debarment-CONSTRUCTION.txt",
        "filename": "Debarment-CONSTRUCTION.txt",
        "agency": "NJ Department of the Treasury / DORES",
        "page": "https://www.nj.gov/treasury/revenue/debarment/debarsearch-construction.shtml",
    },
    "NJ_TREASURY_VENDOR_DEBARMENT": {
        "url": "https://www.nj.gov/treasury/treasfiles/debarment/Debarment-VENDOR.txt",
        "filename": "Debarment-VENDOR.txt",
        "agency": "NJ Department of the Treasury / DORES",
        "page": "https://www.nj.gov/treasury/revenue/debarment/debarsearch-vendor.shtml",
    },
}

POWER_BI_BLOCKED = {
    "NJ_PWCR_REGISTRATION": {
        "page": "https://www.nj.gov/labor/wageandhour/registration-permits/register/publicworksregistration.shtml",
        "view": "https://app.powerbigov.us/view?r=eyJrIjoiZmY1YmVjMzktMjc5ZS00NzQxLWFkMWQtYjYzZGRmN2JhNTViIiwidCI6IjUwNzZjM2QxLTM4MDItNGI5Zi1iMzZhLWUwYTQxYmQ2NDJhNyJ9",
        "agency": "NJDOL Division of Wage and Hour Compliance",
        "barrier": "Official roster is a Power BI interactive view with no supported deterministic full-file export.",
    },
    "NJ_PREVAILING_WAGE_DEBARMENT": {
        "page": "https://www.nj.gov/labor/wageandhour/registration-permits/register/debarmentlist.shtml",
        "view": "https://app.powerbigov.us/view?r=eyJrIjoiZDQxYTM0MDMtMGQ2Mi00ZTRkLThmNzQtNTYyYjBhNjhiMTQyIiwidCI6IjUwNzZjM2QxLTM4MDItNGI5Zi1iMzZhLWUwYTQxYmQ2NDJhNyJ9",
        "agency": "NJDOL Division of Wage and Hour Compliance",
        "barrier": "Official list is a Power BI interactive view with no supported deterministic full-file export.",
    },
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Parse NJ public-works / exclusion source files (no DB write).")
    parser.add_argument("--source-family", required=True, choices=SOURCE_FAMILIES)
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", help="Write parsed JSONL")
    args = parser.parse_args(argv)
    parsed, rejected = load_source(Path(args.input), args.source_family)
    print(json.dumps({"source_family": args.source_family, "parsed": len(parsed), "rejected": len(rejected)}, indent=2))
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8") as fh:
            for row in parsed:
                fh.write(json.dumps(row, ensure_ascii=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
