"""NJ statewide construction-permit market intelligence (NJ-CON-002B).

Official source: NJ Construction Permit Data (Socrata w9se-dmra).
Grain: one municipal permit/certificate record (muni code + record id).
A permit number is not globally unique. A row is not a contractor work history.
Default attribution is MARKET_ONLY. Public contractor attachment requires an
exact source license/registration number — this source does not supply one.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable, Iterator

from ingest.adapters.nj_public_works import canonical_value, schema_fingerprint

SOURCE_SYSTEM = "nj_dca_construction_permits"
SOURCE_FAMILY = "NJ_CONSTRUCTION_PERMIT"
DATASET_ID = "w9se-dmra"
LANDING_URL = "https://data.nj.gov/Reference-Data/NJ-Construction-Permit-Data/w9se-dmra"
CSV_DOWNLOAD_URL = "https://data.nj.gov/api/views/w9se-dmra/rows.csv?accessType=DOWNLOAD"
SODA_URL = "https://data.nj.gov/resource/w9se-dmra.json"
METADATA_URL = "https://data.nj.gov/api/views/w9se-dmra.json"
AGENCY = "New Jersey Department of Community Affairs - Division of Codes & Standards"
REPORTER_URL = "https://www.nj.gov/dca/codes/reporter/building_permits.shtml"
STATED_RETENTION_MONTHS = 60
STATE_CODE = "NJ"

DISPLAY_TO_FIELD = {
    "muni code": "comu",
    "treasurycode": "treasurycode",
    "municipality name": "muniname",
    "munitype": "munitype",
    "county": "county",
    "record id": "recordid",
    "block": "block",
    "lot": "lot",
    "permit number": "permitno",
    "status": "status",
    "permit status description": "permitstatusdesc",
    "permit date": "permitdate",
    "certificate date": "certdate",
    "permit type": "permittype",
    "permit type description": "permittypedesc",
    "update": "update",
    "certificate type": "certtype",
    "certificate type description": "certtypedesc",
    "certificate count": "certcount",
    "building fee": "buildfee",
    "plumbing fee": "plumbfee",
    "electrical fee": "electfee",
    "fire fee": "firefee",
    "dca fee": "dcafee",
    "certificate fee": "certfee",
    "elevator fee": "elevfee",
    "other fee": "otherfee",
    "total fee": "totalfee",
    "volume": "cubic",
    "square feet": "squarefeet",
    "construction cost": "constcost",
    "sale units gained": "salegained",
    "rental units gained": "rentgained",
    "use group": "usegroup",
    "use group description": "usegroupdesc",
    "census item number": "censusnumber",
    "census item number description": "censusdesc",
    "public": "public",
    "storage": "storage",
    "manufactured": "manufactured",
    "hud seal": "hudseal",
    "source": "source",
    "source description": "sourcedesc",
    "version": "version",
    "process date": "processdate",
    "pk": "pk",
}

EXPECTED_FIELDS = (
    "comu", "treasurycode", "muniname", "munitype", "county", "recordid",
    "block", "lot", "permitno", "status", "permitstatusdesc", "permitdate",
    "certdate", "permittype", "permittypedesc", "update", "certtype",
    "certtypedesc", "certcount", "buildfee", "plumbfee", "electfee", "firefee",
    "dcafee", "certfee", "elevfee", "otherfee", "totalfee", "cubic",
    "squarefeet", "constcost", "salegained", "rentgained", "usegroup",
    "usegroupdesc", "censusnumber", "censusdesc", "public", "storage",
    "manufactured", "hudseal", "source", "sourcedesc", "version",
    "processdate", "pk",
)

CONTRACTOR_FIELD_CANDIDATES = (
    "contractor", "contractor_name", "contractorname", "license", "licenseno",
    "license_number", "applicant", "owner", "owner_name", "address",
    "property_address", "street",
)

# Official dataset description: municipalities with no data in this extract.
NON_REPORTING_MUNICIPALITIES = (
    {"comu": "1901", "name": "ANDOVER BOROUGH", "county": "SUSSEX", "treatment": "non_reporting"},
    {"comu": "1513", "name": "LAKEHURST", "county": "OCEAN", "treatment": "non_reporting"},
    {"comu": "1704", "name": "LOWER ALLOWAYS CREEK", "county": "SALEM", "treatment": "non_reporting"},
    {"comu": "0812", "name": "NATIONAL PARK", "county": "GLOUCESTER", "treatment": "non_reporting"},
    {"comu": "1522", "name": "PINE BEACH", "county": "OCEAN", "treatment": "non_reporting"},
    {"comu": "1437", "name": "VICTORY GARDENS", "county": "MORRIS", "treatment": "non_reporting"},
    {"comu": "1923", "name": "WALPACK", "county": "SUSSEX", "treatment": "non_reporting"},
    {"comu": "2021", "name": "WINFIELD", "county": "UNION", "treatment": "non_reporting"},
)

PARTY_ROLES_PRESENT: dict[str, str] = {}  # none in this source

STATUS_NORMALIZED = {"P": "issued", "C": "closed"}
PERMIT_TYPE_LABEL = {"04": "New", "05": "Addition", "06": "Alteration", "13": "Demolition"}

VALID_YEAR_MIN = 1980
VALID_YEAR_MAX = 2027
EXTREME_COST = 500_000_000


def county_slug(county: str) -> str:
    text = canonical_value(county).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "unknown"


def normalize_headers(headers: Iterable[str]) -> list[str]:
    out = []
    for raw in headers:
        key = canonical_value(raw).lower()
        out.append(DISPLAY_TO_FIELD.get(key, key.replace(" ", "")))
    return out


def source_record_key(row: dict[str, str]) -> str:
    pk = canonical_value(row.get("pk"))
    if pk:
        return pk
    comu = canonical_value(row.get("comu"))
    recordid = canonical_value(row.get("recordid"))
    if comu and recordid:
        return f"{comu}{recordid}"
    return ""


def parse_source_date(value: Any) -> str | None:
    text = canonical_value(value)
    if not text:
        return None
    text = text.replace("T00:00:00.000", "").replace("T00:00:00", "")
    parsed: date | None = None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text[:10]):
        try:
            parsed = date.fromisoformat(text[:10])
        except ValueError:
            parsed = None
    else:
        for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y%m%d"):
            try:
                parsed = datetime.strptime(text[:10], fmt).date()
                break
            except ValueError:
                continue
    if parsed is None:
        return None
    if parsed.year < VALID_YEAR_MIN or parsed.year > VALID_YEAR_MAX:
        return None
    return parsed.isoformat()


def parse_number(value: Any) -> float | None:
    text = canonical_value(value).replace(",", "").replace("$", "")
    if text == "":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_int(value: Any) -> int | None:
    n = parse_number(value)
    if n is None:
        return None
    return int(n)


def classify_cost(raw: Any) -> tuple[float | None, str]:
    if canonical_value(raw) == "":
        return None, "missing"
    n = parse_number(raw)
    if n is None:
        return None, "invalid"
    if n < 0 or n > EXTREME_COST:
        return n, "extreme"
    if n == 0:
        return 0.0, "reported_zero"
    return n, "ok"


def row_fingerprint(row: dict[str, str]) -> str:
    payload = {k: canonical_value(v) for k, v in sorted(row.items())}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def inspect_party_fields(headers: Iterable[str]) -> dict[str, Any]:
    normalized = {canonical_value(h).lower().replace(" ", "") for h in headers}
    hits = sorted(c for c in CONTRACTOR_FIELD_CANDIDATES if c in normalized)
    return {
        "explicit_contractor_fields": False,
        "license_identifiers_present": False,
        "applicant_fields_present": False,
        "owner_fields_present": False,
        "address_fields_present": False,
        "matched_header_candidates": hits,
        "default_attribution": "MARKET_ONLY",
    }


def attribution_for_row(row: dict[str, str]) -> dict[str, Any]:
    return {
        "identity_state": "MARKET_ONLY",
        "identity_method": "source_has_no_contractor_or_license_fields",
        "party_roles": {
            "PROPERTY_OWNER": None,
            "APPLICANT": None,
            "AGENT": None,
            "ARCHITECT_OR_ENGINEER": None,
            "CONTRACTOR": None,
            "LICENSED_CONTRACTOR": None,
            "UNKNOWN_PARTY_ROLE": None,
        },
        "public_attachment_allowed": False,
        "reason": (
            "Official NJ Construction Permit Data does not include contractor, "
            "license, applicant, owner, or property-address fields. A permit "
            "row is market intelligence, not contractor work history."
        ),
    }


def normalize_row(row: dict[str, str], *, line_no: int) -> dict[str, Any]:
    key = source_record_key(row)
    status = canonical_value(row.get("status")).upper()
    permit_date = parse_source_date(row.get("permitdate"))
    cert_date = parse_source_date(row.get("certdate"))
    process_date = parse_source_date(row.get("processdate"))
    cost, cost_class = classify_cost(row.get("constcost"))
    county = canonical_value(row.get("county"))
    comu = canonical_value(row.get("comu"))
    rejected_reason = None
    if not key:
        rejected_reason = "missing_source_key"
    elif not comu:
        rejected_reason = "missing_municipality_code"
    event_date = cert_date if status == "C" and cert_date else permit_date
    rec = {
        "source_system": SOURCE_SYSTEM,
        "source_family": SOURCE_FAMILY,
        "state_code": STATE_CODE,
        "source_jurisdiction": comu,
        "municipality_code": comu,
        "municipality": canonical_value(row.get("muniname")),
        "municipality_type": canonical_value(row.get("munitype")),
        "county": county,
        "county_slug": county_slug(county),
        "permit_number": canonical_value(row.get("permitno")),
        "source_record_id": canonical_value(row.get("recordid")),
        "source_record_key": key,
        "source_fingerprint": row_fingerprint(row),
        "permit_type_raw": canonical_value(row.get("permittype")),
        "permit_type_normalized": canonical_value(row.get("permittypedesc")) or PERMIT_TYPE_LABEL.get(canonical_value(row.get("permittype"))),
        "work_type_raw": canonical_value(row.get("permittypedesc")),
        "work_subtype_raw": canonical_value(row.get("usegroup")),
        "status_raw": canonical_value(row.get("status")),
        "status_normalized": STATUS_NORMALIZED.get(status, "unknown"),
        "permitstatusdesc": canonical_value(row.get("permitstatusdesc")),
        "is_update": canonical_value(row.get("update")).upper() == "X",
        "certificate_type_raw": canonical_value(row.get("certtype")) or None,
        "issue_date": permit_date,
        "final_date": cert_date,
        "event_date": event_date,
        "process_date": process_date,
        "valuation": cost,
        "cost_class": cost_class,
        "sale_units": parse_int(row.get("salegained")),
        "rental_units": parse_int(row.get("rentgained")),
        "block": canonical_value(row.get("block")) or None,
        "lot": canonical_value(row.get("lot")) or None,
        "contractor_name_raw": None,
        "contractor_license_raw": None,
        "contractor_license_normalized": None,
        "applicant_name_raw": None,
        "owner_name_raw": None,
        "property_address": None,
        "source_window_status": "IN_CURRENT_SOURCE_SNAPSHOT",
        "public_eligibility_status": "internal_only",
        "attribution": attribution_for_row(row),
        "source_record_locator": f"line:{line_no}",
        "raw_payload": dict(row),
        "rejected_reason": rejected_reason,
    }
    return rec


def iter_csv_rows(path: Path) -> Iterator[tuple[int, dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        try:
            header = next(reader)
        except StopIteration:
            return
        fields = normalize_headers(header)
        for i, values in enumerate(reader, start=2):
            row = {fields[j]: values[j] if j < len(values) else "" for j in range(len(fields))}
            yield i, row


def empty_quality() -> dict[str, int]:
    return {
        "parsed": 0,
        "rejected": 0,
        "duplicate_keys": 0,
        "duplicate_fingerprints": 0,
        "missing_geography": 0,
        "missing_dates": 0,
        "missing_costs": 0,
        "invalid_extreme_costs": 0,
        "invalid_extreme_dates": 0,
        "unmapped_jurisdictions": 0,
        "update_rows": 0,
    }


def stream_normalize(path: Path) -> dict[str, Any]:
    quality = empty_quality()
    seen_keys: dict[str, str] = {}
    seen_fp: set[str] = set()
    counties: set[str] = set()
    munis: set[tuple[str, str]] = set()
    month_counts: Counter[str] = Counter()
    work_mix: Counter[str] = Counter()
    county_totals: dict[str, dict[str, float]] = defaultdict(lambda: {"rows": 0, "cost": 0.0, "sale_units": 0, "rental_units": 0})
    muni_totals: dict[str, dict[str, float]] = defaultdict(lambda: {"rows": 0, "cost": 0.0, "sale_units": 0, "rental_units": 0})
    state = {"rows": 0, "cost": 0.0, "sale_units": 0, "rental_units": 0, "permit_rows": 0, "certificate_rows": 0}
    rejected_samples: list[dict[str, Any]] = []
    normalized_samples: list[dict[str, Any]] = []
    min_permit = None
    max_permit = None
    min_process = None
    max_process = None
    headers_seen: list[str] = []
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        headers_seen = normalize_headers(header)
        party = inspect_party_fields(header)
        for i, values in enumerate(reader, start=2):
            row = {headers_seen[j]: values[j] if j < len(values) else "" for j in range(len(headers_seen))}
            rec = normalize_row(row, line_no=i)
            if rec["rejected_reason"]:
                quality["rejected"] += 1
                if len(rejected_samples) < 20:
                    rejected_samples.append({"line": i, "reason": rec["rejected_reason"], "pk": rec["source_record_key"]})
                continue
            key = rec["source_record_key"]
            fp = rec["source_fingerprint"]
            if key in seen_keys:
                quality["duplicate_keys"] += 1
                continue
            seen_keys[key] = fp
            if fp in seen_fp:
                quality["duplicate_fingerprints"] += 1
            seen_fp.add(fp)
            quality["parsed"] += 1
            if rec["county_slug"] in {"", "unknown"} or rec["municipality_code"] in {"", "9999"}:
                quality["missing_geography"] += 1
            if rec["issue_date"] is None:
                quality["missing_dates"] += 1
                raw_date = canonical_value(row.get("permitdate"))
                if raw_date:
                    quality["invalid_extreme_dates"] += 1
            if rec["cost_class"] == "missing":
                quality["missing_costs"] += 1
            elif rec["cost_class"] in {"extreme", "invalid"}:
                quality["invalid_extreme_costs"] += 1
            if rec["is_update"]:
                quality["update_rows"] += 1
            if rec["county"] and rec["municipality"]:
                counties.add(rec["county"])
                munis.add((rec["municipality_code"], rec["municipality"]))
            month_key = (rec["process_date"] or rec["issue_date"] or "")[:7]
            if month_key:
                month_counts[month_key] += 1
            work_mix[rec["permit_type_normalized"] or rec["permit_type_raw"] or "unknown"] += 1
            cost = rec["valuation"] if rec["valuation"] and rec["cost_class"] == "ok" else 0.0
            sale = rec["sale_units"] or 0
            rent = rec["rental_units"] or 0
            state["rows"] += 1
            state["cost"] += cost
            state["sale_units"] += sale
            state["rental_units"] += rent
            if rec["status_raw"] == "P":
                state["permit_rows"] += 1
            elif rec["status_raw"] == "C":
                state["certificate_rows"] += 1
            ct = county_totals[rec["county"] or "UNKNOWN"]
            ct["rows"] += 1
            ct["cost"] += cost
            ct["sale_units"] += sale
            ct["rental_units"] += rent
            mt = muni_totals[f"{rec['municipality_code']}|{rec['municipality']}"]
            mt["rows"] += 1
            mt["cost"] += cost
            mt["sale_units"] += sale
            mt["rental_units"] += rent
            if rec["issue_date"]:
                min_permit = rec["issue_date"] if min_permit is None else min(min_permit, rec["issue_date"])
                max_permit = rec["issue_date"] if max_permit is None else max(max_permit, rec["issue_date"])
            if rec["process_date"]:
                min_process = rec["process_date"] if min_process is None else min(min_process, rec["process_date"])
                max_process = rec["process_date"] if max_process is None else max(max_process, rec["process_date"])
            if len(normalized_samples) < 12:
                slim = {k: rec[k] for k in (
                    "source_record_key", "municipality_code", "municipality", "county",
                    "permit_number", "status_raw", "issue_date", "permit_type_normalized",
                    "valuation", "attribution",
                )}
                normalized_samples.append(slim)
    observed_comus = {m[0] for m in munis}
    non_reporting = []
    for item in NON_REPORTING_MUNICIPALITIES:
        present = item["comu"] in observed_comus
        non_reporting.append({**item, "observed_in_extract": present, "treatment": "non_reporting" if not present else "reported_despite_agency_note"})
    return {
        "headers": headers_seen,
        "schema_fingerprint": schema_fingerprint(headers_seen),
        "party_fields": party,
        "quality": quality,
        "counties_observed": len(counties),
        "municipalities_observed": len(munis),
        "county_names": sorted(counties),
        "non_reporting_municipalities": non_reporting,
        "month_counts": dict(sorted(month_counts.items())),
        "work_type_mix": dict(work_mix),
        "state_totals": state,
        "county_totals": {k: dict(v) for k, v in sorted(county_totals.items())},
        "municipal_totals_top": dict(sorted(muni_totals.items(), key=lambda kv: kv[1]["rows"], reverse=True)[:25]),
        "municipal_count": len(muni_totals),
        "min_permit_date": min_permit,
        "max_permit_date": max_permit,
        "min_process_date": min_process,
        "max_process_date": max_process,
        "rejected_samples": rejected_samples,
        "normalized_samples": normalized_samples,
        "public_attachments": 0,
        "exact_contractor_candidates": 0,
        "high_confidence_review_candidates": 0,
        "review_required": 0,
        "unsafe_rejected": quality["parsed"],
        "grain": "municipal_permit_or_certificate_record",
        "stable_source_id": "pk (Socrata) = comu || recordid",
        "compound_key_formula": "source_record_key = pk OR (municipality_code || recordid)",
        "permit_number_globally_unique": False,
    }


def window_status_for_process_date(process_date: str | None, as_of: str | None) -> str:
    """Official metadata states a 60-month purge. Observed rows may still be older."""
    if not process_date or not as_of:
        return "IN_CURRENT_SOURCE_SNAPSHOT"
    try:
        pd = date.fromisoformat(process_date)
        ad = date.fromisoformat(as_of[:10])
    except ValueError:
        return "IN_CURRENT_SOURCE_SNAPSHOT"
    months = (ad.year - pd.year) * 12 + (ad.month - pd.month)
    if months > STATED_RETENTION_MONTHS:
        return "OUTSIDE_STATED_RETENTION_WINDOW_BUT_PRESENT"
    return "IN_CURRENT_SOURCE_SNAPSHOT"


def permit_write_shape(rec: dict[str, Any]) -> dict[str, Any]:
    """Column mapping onto permit_source_records + permit_attributions."""
    return {
        "source_system": rec["source_system"],
        "source_jurisdiction": rec["source_jurisdiction"],
        "county_slug": rec["county_slug"],
        "municipality": rec["municipality"],
        "state_code": rec["state_code"],
        "municipality_code": rec["municipality_code"],
        "permit_number": rec["permit_number"] or rec["source_record_key"],
        "source_record_id": rec["source_record_id"],
        "source_record_key": rec["source_record_key"],
        "source_fingerprint": rec["source_fingerprint"],
        "permit_type_raw": rec["permit_type_raw"],
        "permit_type_normalized": rec["permit_type_normalized"],
        "work_type_raw": rec["work_type_raw"],
        "work_subtype_raw": rec["work_subtype_raw"],
        "status_raw": rec["status_raw"],
        "status_normalized": rec["status_normalized"],
        "issue_date": rec["issue_date"],
        "final_date": rec["final_date"],
        "event_date": rec["event_date"],
        "valuation": rec["valuation"],
        "sale_units": rec["sale_units"],
        "rental_units": rec["rental_units"],
        "certificate_type_raw": rec["certificate_type_raw"],
        "source_window_status": rec["source_window_status"],
        "contractor_name_raw": None,
        "contractor_license_raw": None,
        "applicant_name_raw": None,
        "owner_name_raw": None,
        "property_address": None,
        "raw_payload": rec["raw_payload"],
        "attribution": rec["attribution"],
    }
