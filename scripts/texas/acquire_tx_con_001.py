#!/usr/bin/env python3
"""TX-CON-001 acquire + harvest official Texas contractor/trade bulk files.

Texas has no statewide general-contractor license. This harvest keeps
business contractor credentials, person trade credentials, state vendors,
and TxDOT projects in separate grains.

Raw files stay under data/raw (gitignored). Harvest JSON is the commit unit.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
ART = ROOT / "artifacts" / "tx-con-001"
USER_AGENT = "ContractorTrustHub/0.1 (research; https://github.com/savitz25/contractor-trust-hub)"
AS_OF = datetime.now(timezone.utc).date()
AS_OF_ISO = AS_OF.isoformat()

TDLR_NATIVE_BASE = "https://www.tdlr.texas.gov/dbproduction2/"
SODA_TDLR = "https://data.texas.gov/resource/7358-krk7.json"
SODA_TXDOT = "https://data.texas.gov/resource/drau-zphx.json"
PORTAL_TDLR_SODA = "https://data.texas.gov/dataset/TDLR-All-Licenses/7358-krk7"
PORTAL_TDLR_NATIVE = "https://www.tdlr.texas.gov/dbproduction2/"
PORTAL_TSBPE = "https://tsbpe.texas.gov/free-licensee-list/"
PORTAL_CMBL = "https://comptroller.texas.gov/purchasing/downloads"
PORTAL_TXDOT = "https://data.texas.gov/dataset/Project-Information/drau-zphx"

# Native TDLR listing-format contractor BUSINESS files (small official CSVs).
TDLR_BUSINESS_FILES = [
    {
        "key": "ac_contractor",
        "label": "A/C Contractor",
        "license_type": "A/C Contractor",
        "grain": "BUSINESS_CONTRACTOR",
        "filename": "ltairref.csv",
        "format": "listing",
    },
    {
        "key": "electrical_contractor",
        "label": "Electrical Contractor",
        "license_type": "Electrical Contractor",
        "grain": "BUSINESS_CONTRACTOR",
        "filename": "Lteecele.csv",
        "format": "listing",
    },
    {
        "key": "electrical_sign_contractor",
        "label": "Electrical Sign Contractor",
        "license_type": "Electrical Sign Contractor",
        "grain": "BUSINESS_CONTRACTOR",
        "filename": "Ltescele.csv",
        "format": "listing",
    },
    {
        "key": "appliance_installation_contractor",
        "label": "Appliance Installation Contractor",
        "license_type": "Appliance Installation Contractor",
        "grain": "BUSINESS_CONTRACTOR",
        "filename": "Ltactele.csv",
        "format": "listing",
    },
    {
        "key": "water_well",
        "label": "Water Well Driller/Pump Installer",
        "license_type": "Water Well Driller/Pump Installer",
        "grain": "BUSINESS_CONTRACTOR",
        "filename": "ltwwdpmp.csv",
        "format": "listing",
    },
    {
        "key": "elevator_contractor",
        "label": "Elevator Contractor",
        "license_type": "Elevator Contractor",
        "grain": "BUSINESS_CONTRACTOR",
        "filename": "ltelectr.csv",
        "format": "listing",
    },
]

# Versa organization files (have License Status).
TDLR_VERSA_ORG = [
    {
        "key": "mold_assessment_company",
        "label": "Mold Assessment Company",
        "license_type": "Mold Assessment Company",
        "grain": "BUSINESS_CONTRACTOR",
        "filename": "vsMoldAssessmentCompany.csv",
        "format": "versa_org",
    },
    {
        "key": "mold_remediation_company",
        "label": "Mold Remediation Company",
        "license_type": "Mold Remediation Company",
        "grain": "BUSINESS_CONTRACTOR",
        "filename": "vsMoldRemediationCompany.csv",
        "format": "versa_org",
    },
    {
        "key": "mold_analysis_lab",
        "label": "Mold Analysis Laboratory",
        "license_type": "Mold Analysis Laboratory",
        "grain": "BUSINESS_ADJACENT",
        "filename": "vsMoldAnalysisLaboratory.csv",
        "format": "versa_org",
    },
    {
        "key": "solar_residential_retailer",
        "label": "Solar Residential Retailer",
        "license_type": "Solar Residential Retailer",
        "grain": "BUSINESS_ADJACENT",
        "filename": "vsResidentialSolarRetailers.csv",
        "format": "versa_org",
    },
    {
        "key": "ev_supply_provider",
        "label": "EV Supply Provider",
        "license_type": "EV Supply Provider",
        "grain": "BUSINESS_ADJACENT",
        "filename": "vsEVSupplyProvider.csv",
        "format": "versa_org",
    },
]

TDLR_VERSA_PERSON = [
    {
        "key": "mold_remediation_contractor",
        "label": "Mold Remediation Contractor",
        "license_type": "Mold Remediation Contractor",
        "grain": "PERSON_TRADE_CREDENTIAL",
        "filename": "vsMoldRemediationContractor.csv",
        "format": "versa_person",
    },
    {
        "key": "mold_assessment_consultant",
        "label": "Mold Assessment Consultant",
        "license_type": "Mold Assessment Consultant",
        "grain": "PERSON_TRADE_CREDENTIAL",
        "filename": "vsMoldAssessmentConsultant.csv",
        "format": "versa_person",
    },
]

LISTING_FIELDS = [
    "license_type",
    "license_number",
    "expiration",
    "county",
    "name",
    "mailing_line1",
    "mailing_line2",
    "mailing_csz",
    "phone",
    "business_name",
    "business_line1",
    "business_line2",
    "business_csz",
    "business_county_code",
    "business_county",
    "business_zip",
    "business_phone",
    "license_subtype",
    "ce_flag",
    "same_address",
    "business_box",
    "mailing_box",
    "phone_same",
]

# TDLR All Licenses type → grain. Unlisted types default OTHER.
TDLR_TYPE_GRAIN: dict[str, str] = {
    "A/C Contractor": "BUSINESS_CONTRACTOR",
    "Electrical Contractor": "BUSINESS_CONTRACTOR",
    "Electrical Sign Contractor": "BUSINESS_CONTRACTOR",
    "Appliance Installation Contractor": "BUSINESS_CONTRACTOR",
    "Elevator Contractor": "BUSINESS_CONTRACTOR",
    "Water Well Driller/Pump Installer": "BUSINESS_CONTRACTOR",
    "A/C Technician": "PERSON_TRADE_CREDENTIAL",
    "Master Electrician": "PERSON_TRADE_CREDENTIAL",
    "Journeyman Electrician": "PERSON_TRADE_CREDENTIAL",
    "Apprentice Electrician": "PERSON_TRADE_CREDENTIAL",
    "Residential Wireman": "PERSON_TRADE_CREDENTIAL",
    "Appliance Installer": "PERSON_TRADE_CREDENTIAL",
    "Apprentice Sign Electrician": "PERSON_TRADE_CREDENTIAL",
    "Master Sign Electrician": "PERSON_TRADE_CREDENTIAL",
    "Journeyman Sign Electrician": "PERSON_TRADE_CREDENTIAL",
    "Journeyman Industrial Electrician": "PERSON_TRADE_CREDENTIAL",
    "Maintenance Electrician": "PERSON_TRADE_CREDENTIAL",
    "Journeyman Lineman Electrician": "PERSON_TRADE_CREDENTIAL",
    "Water Well Driller/Pump Installer Apprentice": "PERSON_TRADE_CREDENTIAL",
    "Qualified Elevator Inspector": "PERSON_TRADE_CREDENTIAL",
    "Elevator Responsible Party": "OTHER",
    "Registered Accessibility Specialist": "OTHER",
    "Electrician CE Provider": "OTHER",
    "A/C CE Provider": "OTHER",
    "Water Well Driller/Pump Installer CE Provider": "OTHER",
    "Electrician Apprenticeship Program": "OTHER",
}

CONSTRUCTION_NIGP_CLASSES = {"909", "910", "912", "913", "914", "968"}

LEGAL_SUFFIX_RE = re.compile(
    r"\b(INCORPORATED|INC|L\.?L\.?C\.?|L\.?L\.?P\.?|L\.?P\.?|LTD|LIMITED|CORP|CORPORATION|CO|COMPANY|PLC|PC|PA|PLLC|DBA|D/B/A)\b",
    re.I,
)
NON_ALNUM_RE = re.compile(r"[^A-Z0-9]+")
PHONE_RE = re.compile(r"\d{7,}")


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def fetch(url: str, timeout: int = 180) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_json(url: str) -> Any:
    raw = fetch(url, timeout=120)
    return json.loads(raw.decode("utf-8"))


def maybe_unzip(payload: bytes, url: str) -> bytes:
    if url.lower().endswith(".zip") or payload[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(payload)) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
            if not names:
                raise RuntimeError(f"No CSV inside zip from {url}")
            return zf.read(names[0])
    return payload


def download_to(url: str, dest: Path, unzip: bool = False) -> dict[str, Any]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  GET {url}")
    try:
        payload = fetch(url, timeout=240)
        if unzip:
            payload = maybe_unzip(payload, url)
        dest.write_bytes(payload)
        return {
            "url": url,
            "path": str(dest).replace("\\", "/"),
            "bytes": len(payload),
            "sha256": sha256_bytes(payload),
            "ok": True,
            "error": None,
        }
    except (urllib.error.URLError, urllib.error.HTTPError, RuntimeError, TimeoutError) as exc:
        print(f"    FAILED {exc}")
        return {
            "url": url,
            "path": str(dest).replace("\\", "/"),
            "bytes": 0,
            "sha256": None,
            "ok": False,
            "error": str(exc),
        }


def parse_expiration(value: str) -> str:
    v = clean(value)
    if not v:
        return ""
    for fmt in ("%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%m%d%Y", "%Y%m%d"):
        try:
            d = datetime.strptime(v, fmt).date()
            if d.year <= 1901:
                return ""
            return d.isoformat()
        except ValueError:
            continue
    return ""


def expiration_bucket(iso: str) -> str:
    if not iso:
        return "UNKNOWN_NO_EXPIRATION"
    try:
        d = datetime.strptime(iso, "%Y-%m-%d").date()
    except ValueError:
        return "UNKNOWN_UNPARSED_EXPIRATION"
    if d >= AS_OF:
        return "CURRENT_BY_EXPIRATION"
    return "EXPIRED_BY_EXPIRATION"


def phone_ok(value: str) -> bool:
    digits = re.sub(r"\D", "", value or "")
    if digits in {"", "0", "0000000", "0000000000", "9999999999"}:
        return False
    return len(digits) >= 7


def type_slug(license_type: str) -> str:
    s = re.sub(r"[^A-Z0-9]+", "-", clean(license_type).upper()).strip("-")
    return s or "LICENSE"


def tdlr_key(license_type: str, number: str, subtype: str = "") -> str | None:
    num = clean(number).upper().replace(" ", "")
    if not num:
        return None
    key = f"TX-TDLR:{type_slug(license_type)}:{num}"
    sub = clean(subtype).upper().replace(" ", "")
    if sub:
        key += f":{sub}"
    return key


def tsbpe_key(kind: str, number: str) -> str | None:
    num = clean(number).upper().replace(" ", "")
    if not num:
        return None
    return f"TX-TSBPE:{kind.upper()}:{num}"


def norm_name(value: str) -> str:
    s = clean(value).upper()
    s = LEGAL_SUFFIX_RE.sub(" ", s)
    s = NON_ALNUM_RE.sub(" ", s)
    return " ".join(s.split())


def norm_addr(line: str, csz: str = "") -> str:
    blob = " ".join(x for x in [clean(line).upper(), clean(csz).upper()] if x)
    blob = blob.replace("P.O. BOX", "PO BOX").replace("P O BOX", "PO BOX")
    blob = NON_ALNUM_RE.sub(" ", blob)
    return " ".join(blob.split())


def parse_csz(blob: str) -> tuple[str, str, str]:
    s = clean(blob)
    if not s:
        return "", "TX", ""
    m = re.search(r",\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$", s, re.I)
    if m:
        return s[: m.start()].strip().rstrip(",").strip(), m.group(1).upper(), m.group(2)
    m2 = re.search(r"\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$", s, re.I)
    if m2:
        return s[: m2.start()].strip().rstrip(",").strip(), m2.group(1).upper(), m2.group(2)
    return s, "TX", ""


def sniff_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",|\t;")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = "," if sample.count(",") >= sample.count("|") else "|"
    f = io.StringIO(text)
    reader = csv.reader(f, delimiter=delimiter)
    try:
        first = next(reader)
    except StopIteration:
        return [], []
    headerish = sum(1 for c in first if re.search(r"[A-Za-z]", c or "")) >= max(2, len(first) // 3)
    if headerish:
        fields = [clean(c) or f"col_{i}" for i, c in enumerate(first)]
        rows = []
        for raw in reader:
            if not any(clean(x) for x in raw):
                continue
            rec = {fields[i]: clean(raw[i]) if i < len(raw) else "" for i in range(len(fields))}
            rows.append(rec)
        return fields, rows
    # listing format without header
    rows = []
    all_raw = [first] + list(reader)
    for raw in all_raw:
        if not any(clean(x) for x in raw):
            continue
        rec = {LISTING_FIELDS[i]: clean(raw[i]) if i < len(raw) else "" for i in range(len(LISTING_FIELDS))}
        if len(raw) > len(LISTING_FIELDS):
            rec["_extra"] = "|".join(clean(x) for x in raw[len(LISTING_FIELDS) :])
        rows.append(rec)
    return LISTING_FIELDS, rows


def profile_listing(rows: list[dict[str, str]], meta: dict[str, str]) -> dict[str, Any]:
    license_type = meta["license_type"]
    keys: set[str] = set()
    names: set[str] = set()
    name_addr: set[str] = set()
    phones = 0
    status = Counter()
    subtypes = Counter()
    counties = Counter()
    identities: list[dict[str, str]] = []
    for row in rows:
        number = row.get("license_number") or row.get("LICENSE NUMBER") or ""
        subtype = row.get("license_subtype") or row.get("LICENSE SUBTYPE") or ""
        key = tdlr_key(license_type, number, subtype)
        if not key:
            continue
        keys.add(key)
        biz = row.get("business_name") or ""
        person = row.get("name") or ""
        display = biz or person
        names.add(norm_name(display))
        addr1 = row.get("business_line1") or row.get("mailing_line1") or ""
        csz = row.get("business_csz") or row.get("mailing_csz") or ""
        na = f"{norm_name(display)}|{norm_addr(addr1, csz)}"
        name_addr.add(na)
        phone = row.get("business_phone") or row.get("phone") or ""
        if phone_ok(phone):
            phones += 1
        exp = parse_expiration(row.get("expiration") or "")
        bucket = expiration_bucket(exp)
        status[bucket] += 1
        if subtype:
            subtypes[subtype] += 1
        county = (row.get("business_county") or row.get("county") or "UNKNOWN").upper() or "UNKNOWN"
        counties[county] += 1
        identities.append(
            {
                "key": key,
                "license_number": clean(number).upper().replace(" ", ""),
                "license_type": license_type,
                "subtype": subtype,
                "display": display,
                "norm_name": norm_name(display),
                "norm_addr": norm_addr(addr1, csz),
                "phone": phone if phone_ok(phone) else "",
                "county": county,
                "expiration": exp,
                "status_bucket": bucket,
                "grain": meta["grain"],
            }
        )
    return {
        "meta": meta,
        "row_count": len(rows),
        "distinct_keys": len(keys),
        "distinct_normalized_names": len({i["norm_name"] for i in identities if i["norm_name"]}),
        "distinct_name_addr": len({x for x in name_addr if x and not x.endswith("|")}),
        "business_phone_public_eligible": phones,
        "status_buckets": dict(status),
        "subtype_counts": dict(subtypes.most_common(20)),
        "top_counties": [{"county": k, "rows": v} for k, v in counties.most_common(12)],
        "named_counties": len([c for c in counties if c not in {"", "UNKNOWN", "OUT OF STATE"}]),
        "identities": identities,
    }


def _field(row: dict[str, str], *names: str) -> str:
    lower = {k.lower().strip(): k for k in row}
    for name in names:
        if name in row and clean(row[name]):
            return clean(row[name])
        key = lower.get(name.lower())
        if key and clean(row[key]):
            return clean(row[key])
    return ""


def profile_versa(rows: list[dict[str, str]], meta: dict[str, str]) -> dict[str, Any]:
    license_type = meta["license_type"]
    identities: list[dict[str, str]] = []
    status = Counter()
    counties = Counter()
    phones = 0
    for row in rows:
        number = _field(row, "License Number", "license_number", "LicenseNumber")
        key = tdlr_key(license_type, number)
        if not key:
            continue
        display = _field(row, "Licensee", "licensee", "Name")
        native_status = _field(row, "License Status", "license_status", "Status") or "UNKNOWN"
        status[native_status] += 1
        exp = parse_expiration(_field(row, "License Expiration Date", "license_expiration_date", "Expiration Date"))
        addr1 = _field(row, "Street Address", "street_address", "Address")
        city = _field(row, "Address City", "address_city", "City")
        state = _field(row, "Address State", "address_state", "State")
        zipc = _field(row, "Address Zip", "address_zip", "Zip")
        county = (_field(row, "Address County", "address_county", "County") or "UNKNOWN").upper()
        phone = _field(row, "Phone", "phone")
        if phone_ok(phone):
            phones += 1
        counties[county] += 1
        identities.append(
            {
                "key": key,
                "license_number": clean(number).upper().replace(" ", ""),
                "license_type": license_type,
                "subtype": "",
                "display": display,
                "norm_name": norm_name(display),
                "norm_addr": norm_addr(addr1, f"{city} {state} {zipc}"),
                "phone": phone if phone_ok(phone) else "",
                "county": county,
                "expiration": exp,
                "status_bucket": native_status,
                "grain": meta["grain"],
            }
        )
    return {
        "meta": meta,
        "row_count": len(rows),
        "distinct_keys": len({i["key"] for i in identities}),
        "distinct_normalized_names": len({i["norm_name"] for i in identities if i["norm_name"]}),
        "distinct_name_addr": len({f"{i['norm_name']}|{i['norm_addr']}" for i in identities if i["norm_name"]}),
        "business_phone_public_eligible": phones,
        "status_buckets": dict(status),
        "subtype_counts": {},
        "top_counties": [{"county": k, "rows": v} for k, v in counties.most_common(12)],
        "named_counties": len([c for c in counties if c not in {"", "UNKNOWN"}]),
        "identities": identities,
        "has_source_native_status": True,
    }


def soda_type_counts() -> dict[str, Any]:
    url = SODA_TDLR + "?" + urllib.parse.urlencode(
        {"$select": "license_type,count(*) as n", "$group": "license_type", "$order": "n DESC", "$limit": "500"}
    )
    print("  SODA TDLR license_type group-by")
    rows = fetch_json(url)
    types = []
    grain_totals = Counter()
    total = 0
    null_type = 0
    for row in rows:
        label = clean(row.get("license_type"))
        n = int(row.get("n") or row.get("count") or 0)
        total += n
        if not label:
            null_type += n
            grain = "OTHER"
        else:
            grain = TDLR_TYPE_GRAIN.get(label, "OTHER")
        grain_totals[grain] += n
        types.append({"license_type": label or "(blank)", "rows": n, "grain": grain})
    return {
        "source": PORTAL_TDLR_SODA,
        "dataset_id": "7358-krk7",
        "row_count": total,
        "null_license_type_rows": null_type,
        "type_count": len(types),
        "grain_totals": dict(grain_totals),
        "types": types,
        "no_status_field": True,
        "status_field_note": "Socrata 7358-krk7 has expiration only. No source-native CURRENT/EXPIRED/REVOKED column.",
        "as_of": AS_OF_ISO,
    }


def soda_txdot_profile() -> dict[str, Any]:
    print("  SODA TxDOT project aggregations")
    count_url = SODA_TXDOT + "?" + urllib.parse.urlencode({"$select": "count(*) as n"})
    n = int(fetch_json(count_url)[0]["n"])
    let_url = SODA_TXDOT + "?" + urllib.parse.urlencode(
        {"$select": "let_type_description,count(*) as n", "$group": "let_type_description", "$order": "n DESC"}
    )
    let_rows = fetch_json(let_url)
    status_url = SODA_TXDOT + "?" + urllib.parse.urlencode(
        {"$select": "project_status,count(*) as n", "$group": "project_status", "$order": "n DESC", "$limit": "50"}
    )
    try:
        status_rows = fetch_json(status_url)
    except Exception:
        status_rows = []
    work_url = SODA_TXDOT + "?" + urllib.parse.urlencode(
        {
            "$select": "type_of_work,count(*) as n",
            "$group": "type_of_work",
            "$order": "n DESC",
            "$limit": "15",
        }
    )
    try:
        work_rows = fetch_json(work_url)
    except Exception:
        work_rows = []
    sample_url = SODA_TXDOT + "?" + urllib.parse.urlencode(
        {
            "$select": "control_section_job_csj,contract_number,construction_manager,construction_manager_email,district_division,county,let_type_description",
            "$limit": "5",
        }
    )
    sample = fetch_json(sample_url)
    cols = {k for row in sample for k in row}
    contractorish = [c for c in sorted(cols) if re.search(r"contractor|vendor|award|bidder|company", c, re.I)]
    return {
        "source": PORTAL_TXDOT,
        "dataset_id": "drau-zphx",
        "row_count": n,
        "let_type_counts": {clean(r.get("let_type_description")) or "(blank)": int(r.get("n") or 0) for r in let_rows},
        "project_status_counts": {
            clean(r.get("project_status")) or "(blank)": int(r.get("n") or 0) for r in status_rows
        },
        "top_type_of_work": [
            {"type": clean(r.get("type_of_work")) or "(blank)", "rows": int(r.get("n") or 0)} for r in work_rows
        ],
        "construction_manager_is_txdot_staff": True,
        "awarded_contractor_field": None,
        "contractorish_columns": contractorish,
        "semantics": "PROJECT_NOT_CONTRACTOR. construction_manager is TxDOT contact, not the awarded contractor.",
        "coverage": "ACQUIRED_METADATA_AND_AGGREGATES",
        "as_of": AS_OF_ISO,
    }


def tceq_probe() -> dict[str, Any]:
    # Regional Central Registry fragment only. Do not treat as contractor universe.
    url = "https://data.texas.gov/resource/msah-s2rv.json?" + urllib.parse.urlencode(
        {
            "$select": "indus_type_cd_name,count(*) as n",
            "$group": "indus_type_cd_name",
            "$where": "indus_type_cd_name like '23%'",
            "$order": "n DESC",
            "$limit": "30",
        }
    )
    print("  SODA TCEQ NAICS 23* probe (regional fragment)")
    try:
        rows = fetch_json(url)
        count_url = "https://data.texas.gov/resource/msah-s2rv.json?" + urllib.parse.urlencode(
            {"$select": "count(*) as n"}
        )
        n = int(fetch_json(count_url)[0]["n"])
        return {
            "coverage": "PARKED_REGIONAL_FRAGMENT",
            "dataset_id": "msah-s2rv",
            "dataset_name": "TCEQ Central Registry Files - Central Texas",
            "row_count": n,
            "naics_23_sample": [
                {"naics": clean(r.get("indus_type_cd_name")), "rows": int(r.get("n") or 0)} for r in rows
            ],
            "semantics": "TCEQ_REGULATED_ENTITY_NOT_CONTRACTOR. Customer/RE grain. Construction NAICS is not a contractor license.",
            "statewide_complete": False,
            "reason_parked": "Portal files are regional fragments (658k+ Central Texas alone). No statewide contractor-classified dump acquired.",
        }
    except Exception as exc:
        return {
            "coverage": "SOURCE_PROBED_NOT_ACQUIRED",
            "error": str(exc),
            "semantics": "TCEQ_REGULATED_ENTITY_NOT_CONTRACTOR",
        }


def acquire_tdlr() -> dict[str, Any]:
    out_dir = RAW / "tx_tdlr"
    out_dir.mkdir(parents=True, exist_ok=True)
    soda = soda_type_counts()
    files = []
    identities: list[dict[str, str]] = []
    family_summaries = []
    for spec in TDLR_BUSINESS_FILES + TDLR_VERSA_ORG + TDLR_VERSA_PERSON:
        dest = out_dir / spec["filename"]
        info = download_to(TDLR_NATIVE_BASE + spec["filename"], dest)
        info["spec"] = {k: spec[k] for k in spec if k != "identities"}
        if not info["ok"] or dest.stat().st_size < 20:
            info["profile"] = None
            files.append(info)
            continue
        fields, rows = sniff_rows(dest)
        if spec["format"] == "listing":
            # If headered listing, map common header names onto listing fields.
            if fields and fields[0].lower().replace(" ", "_") in {"license_type", "licensetype"}:
                mapped = []
                for row in rows:
                    mapped.append(
                        {
                            "license_type": _field(row, "LICENSE TYPE", "license_type") or spec["license_type"],
                            "license_number": _field(row, "LICENSE NUMBER", "license_number"),
                            "expiration": _field(row, "LICENSE EXPIRATION DATE", "license_expiration_date"),
                            "county": _field(row, "COUNTY", "county"),
                            "name": _field(row, "NAME", "name", "OWNER NAME"),
                            "mailing_line1": _field(row, "MAILING ADDRESS LINE1", "mailing_address_line1"),
                            "mailing_line2": _field(row, "MAILING ADDRESS LINE2", "mailing_address_line2"),
                            "mailing_csz": _field(row, "MAILING ADDRESS CITY, STATE ZIP", "mailing_address_city_state_zip"),
                            "phone": _field(row, "PHONE NUMBER", "phone_number", "OWNER TELEPHONE"),
                            "business_name": _field(row, "BUSINESS NAME", "business_name"),
                            "business_line1": _field(row, "BUSINESS ADDRESS-LINE1", "business_address_line1"),
                            "business_line2": _field(row, "BUSINESS ADDRESS-LINE2", "business_address_line2"),
                            "business_csz": _field(row, "BUSINESS CITY, STATE ZIP", "business_city_state_zip"),
                            "business_county": _field(row, "BUSINESS COUNTY", "business_county"),
                            "business_phone": _field(row, "BUSINESS PHONE", "business_phone", "BUSINESS TELEPHONE"),
                            "license_subtype": _field(row, "LICENSE SUBTYPE", "license_subtype"),
                        }
                    )
                rows = mapped
            prof = profile_listing(rows, spec)
        else:
            prof = profile_versa(rows, spec)
        identities.extend(prof["identities"])
        summary = {k: v for k, v in prof.items() if k != "identities"}
        summary["fields_sample"] = fields[:12]
        info["profile"] = summary
        files.append(info)
        family_summaries.append(summary)

    return {
        "soda_all_licenses": soda,
        "native_portal": PORTAL_TDLR_NATIVE,
        "native_as_of": "2026-09-03",
        "files": [{k: v for k, v in f.items() if k != "profile" or True} for f in files],
        "family_summaries": family_summaries,
        "identities": identities,
    }


def acquire_tsbpe() -> dict[str, Any]:
    out_dir = RAW / "tx_tsbpe"
    out_dir.mkdir(parents=True, exist_ok=True)
    datasets = {
        "RMP": {
            "label": "Responsible Master Plumber",
            "grain": "BUSINESS_CONTRACTOR",
            "urls": ["https://tsbpe.texas.gov/download-csv/RMP/", "https://tsbpe.texas.gov/wp-content/uploads/2015/03/RMP.csv"],
            "filename": "tsbpe_rmp.csv",
        },
        "MP": {
            "label": "Master Plumber",
            "grain": "PERSON_TRADE_CREDENTIAL",
            "urls": ["https://tsbpe.texas.gov/download-csv/MP/"],
            "filename": "tsbpe_mp.csv",
        },
        "JP": {
            "label": "Journeyman Plumber",
            "grain": "PERSON_TRADE_CREDENTIAL",
            "urls": [
                "https://tsbpe.texas.gov/wp-content/uploads/2015/03/JP.csv.zip",
                "https://tsbpe.texas.gov/download-csv/JP/",
            ],
            "filename": "tsbpe_jp.csv",
            "unzip": True,
        },
        "TP": {
            "label": "Tradesman Plumber-Limited",
            "grain": "PERSON_TRADE_CREDENTIAL",
            "urls": ["https://tsbpe.texas.gov/download-csv/TP/"],
            "filename": "tsbpe_tp.csv",
        },
    }
    files = []
    identities: list[dict[str, str]] = []
    family_summaries = []
    for kind, spec in datasets.items():
        dest = out_dir / spec["filename"]
        info = None
        for url in spec["urls"]:
            info = download_to(url, dest, unzip=bool(spec.get("unzip") or url.lower().endswith(".zip")))
            if info["ok"] and dest.exists() and dest.stat().st_size > 50:
                break
        assert info is not None
        info["kind"] = kind
        info["label"] = spec["label"]
        info["grain"] = spec["grain"]
        if not info["ok"]:
            files.append(info)
            continue
        fields, rows = sniff_rows(dest)
        status = Counter()
        counties = Counter()
        phones = 0
        fam_ids: list[dict[str, str]] = []
        for row in rows:
            number = _field(row, "LICENSE_NBR", "license_nbr", "LICENSE_NUMBER", "License Number")
            key = tsbpe_key(kind, number)
            if not key:
                continue
            person = " ".join(
                x
                for x in [
                    _field(row, "FIRST_NAME", "first_name"),
                    _field(row, "MIDDLE_NAME", "middle_name"),
                    _field(row, "LAST_NAME", "last_name"),
                    _field(row, "SUFFIX", "suffix"),
                ]
                if x
            )
            company = _field(row, "PLUMB_COMPANY", "plumb_company", "COMPANY", "company")
            display = company if kind == "RMP" and company else (company or person)
            native_status = _field(row, "LIC_STATUS", "lic_status", "STATUS") or "UNKNOWN"
            status[native_status] += 1
            county = (_field(row, "COUNTY", "county") or "UNKNOWN").upper()
            counties[county] += 1
            phone = _field(row, "PHONE", "phone", "PHONE_NBR", "BUSINESS_PHONE")
            if kind == "RMP" and phone_ok(phone):
                phones += 1
            addr1 = _field(row, "ADDR1", "addr1", "ADDRESS1", "address")
            city = _field(row, "CITY", "city")
            st = _field(row, "STATE", "state")
            zipc = _field(row, "ZIP", "zip", "POSTAL")
            fam_ids.append(
                {
                    "key": key,
                    "license_number": clean(number).upper().replace(" ", ""),
                    "license_type": spec["label"],
                    "subtype": kind,
                    "display": display,
                    "norm_name": norm_name(display),
                    "norm_addr": norm_addr(addr1, f"{city} {st} {zipc}"),
                    "phone": phone if (kind == "RMP" and phone_ok(phone)) else "",
                    "county": county,
                    "expiration": parse_expiration(_field(row, "EXPIRATION_DTE", "expiration_dte", "EXPIRATION")),
                    "status_bucket": native_status,
                    "grain": spec["grain"],
                    "person_name": person,
                    "company_name": company,
                }
            )
        identities.extend(fam_ids)
        summary = {
            "kind": kind,
            "label": spec["label"],
            "grain": spec["grain"],
            "row_count": len(rows),
            "distinct_keys": len({i["key"] for i in fam_ids}),
            "fields": fields[:20],
            "status_buckets": dict(status),
            "business_phone_public_eligible": phones,
            "top_counties": [{"county": k, "rows": v} for k, v in counties.most_common(12)],
            "has_source_native_status": True,
        }
        info["profile"] = summary
        files.append(info)
        family_summaries.append(summary)
    return {
        "source": PORTAL_TSBPE,
        "files": files,
        "family_summaries": family_summaries,
        "identities": identities,
        "semantics": "TSBPE is a separate plumbing board. Responsible Master Plumber may contract with the public. Master/Journeyman/Tradesman are person credentials.",
    }


def acquire_cmbl() -> dict[str, Any]:
    out_dir = RAW / "tx_cmbl"
    out_dir.mkdir(parents=True, exist_ok=True)
    filespecs = [
        ("web_name.csv", "https://comptroller.texas.gov/auto-data/purchasing/web_name.csv", "active_cmbl_vethub"),
        ("vnr_clas.csv", "https://comptroller.texas.gov/auto-data/purchasing/vnr_clas.csv", "vendor_class_nigp"),
        ("hub_name.csv", "https://comptroller.texas.gov/auto-data/purchasing/hub_name.csv", "hub_vethub"),
        ("hub_clas.csv", "https://comptroller.texas.gov/auto-data/purchasing/hub_clas.csv", "hub_class"),
        ("comm_book.csv", "https://comptroller.texas.gov/auto-data/purchasing/comm_book.csv", "nigp_commodity_book"),
    ]
    files = []
    for filename, url, role in filespecs:
        dest = out_dir / filename
        info = download_to(url, dest)
        info["role"] = role
        files.append(info)
    return {"source": PORTAL_CMBL, "files": files}


def parse_cmbl(tdlr_ids: list[dict[str, str]], tsbpe_ids: list[dict[str, str]]) -> dict[str, Any]:
    out_dir = RAW / "tx_cmbl"
    web = out_dir / "web_name.csv"
    clas = out_dir / "vnr_clas.csv"
    hub = out_dir / "hub_name.csv"
    comm = out_dir / "comm_book.csv"
    if not web.exists() or web.stat().st_size < 50:
        return {"coverage": "SOURCE_NOT_ACQUIRED", "reason": "web_name.csv missing"}

    fields, vendors = sniff_rows(web)
    print(f"  CMBL vendors {len(vendors)} fields={fields[:12]}")

    def vid_of(row: dict[str, str]) -> str:
        return _field(row, "VENDOR_ID", "vendor_id", "VID", "VENDORID", "VEND_ID", "IDENT")

    def name_of(row: dict[str, str]) -> str:
        return _field(row, "VENDOR_NAME", "vendor_name", "NAME", "BUSINESS_NAME", "COMPANY_NAME", "VEND_NAME")

    hub_fields, hub_rows = sniff_rows(hub) if hub.exists() and hub.stat().st_size > 50 else ([], [])
    hub_vids = {vid_of(r) for r in hub_rows if vid_of(r)}
    vethub_flag_rows = 0
    for row in vendors:
        blob = " ".join(row.values()).upper()
        if "VET" in blob and "HUB" in blob:
            vethub_flag_rows += 1

    clas_fields, clas_rows = sniff_rows(clas) if clas.exists() else ([], [])
    vendor_classes: dict[str, set[str]] = defaultdict(set)
    class_counts = Counter()
    for row in clas_rows:
        vid = vid_of(row) or _field(row, "IDENT", "VEND_IDNR")
        code = _field(row, "CLASS", "NIGP_CLASS", "CLASS_CODE", "COMMODITY_CLASS", "ITEM_CLASS")
        if not code:
            # sometimes class is first numeric-looking field besides vid
            for v in row.values():
                if re.fullmatch(r"\d{3}", v):
                    code = v
                    break
        if vid and code:
            cls3 = code[:3]
            vendor_classes[vid].add(cls3)
            class_counts[cls3] += 1

    construction_vids = {
        vid for vid, classes in vendor_classes.items() if classes & CONSTRUCTION_NIGP_CLASSES
    }
    if not construction_vids and clas_rows:
        # fallback: keyword on class file is unsafe; keep empty and document
        construction_vids = set()

    comm_fields, comm_rows = sniff_rows(comm) if comm.exists() else ([], [])
    comm_labels = {}
    for row in comm_rows:
        code = _field(row, "CLASS", "NIGP_CLASS", "CLASS_CODE", "ITEM")
        label = _field(row, "CLASS_TITLE", "TITLE", "DESCRIPTION", "ITEM_DESC")
        if code and label:
            comm_labels[code[:3]] = label

    # Build regulator indexes (business grains only).
    name_index: dict[str, list[str]] = defaultdict(list)
    name_addr_index: dict[str, list[str]] = defaultdict(list)
    license_numbers: set[str] = set()
    for rec in tdlr_ids + tsbpe_ids:
        if rec.get("grain") != "BUSINESS_CONTRACTOR":
            continue
        if rec.get("norm_name"):
            name_index[rec["norm_name"]].append(rec["key"])
        if rec.get("norm_name") and rec.get("norm_addr"):
            name_addr_index[f"{rec['norm_name']}|{rec['norm_addr']}"].append(rec["key"])
        if rec.get("license_number"):
            license_numbers.add(rec["license_number"])

    match_counts = Counter()
    exact = 0
    high = 0
    review = 0
    unsafe = 0
    net_new = 0
    construction_vendor_rows = 0
    vendor_phones = 0
    vendor_emails = 0
    examples = {"EXACT": [], "HIGH_CONFIDENCE": [], "REVIEW_REQUIRED": [], "UNSAFE": [], "NET_NEW": []}

    for row in vendors:
        vid = vid_of(row)
        if not vid:
            continue
        is_construction = vid in construction_vids
        if not is_construction:
            continue
        construction_vendor_rows += 1
        name = name_of(row)
        nn = norm_name(name)
        addr1 = _field(row, "ADDRESS1", "ADDR1", "MAIL_ADDRESS1", "STREET", "ADDRESS")
        city = _field(row, "CITY", "MAIL_CITY")
        st = _field(row, "STATE", "MAIL_STATE")
        zipc = _field(row, "ZIP", "ZIPCODE", "MAIL_ZIP")
        na = f"{nn}|{norm_addr(addr1, f'{city} {st} {zipc}')}"
        phone = _field(row, "PHONE", "PHONE_NUMBER", "BUSINESS_PHONE")
        email = _field(row, "EMAIL", "EMAIL_ADDRESS", "E_MAIL")
        if phone_ok(phone):
            vendor_phones += 1
        if email and "@" in email:
            vendor_emails += 1

        blob = " ".join(row.values()).upper()
        exact_hits = [lic for lic in license_numbers if lic and lic in blob and len(lic) >= 5]
        name_hits = name_index.get(nn, [])
        addr_hits = name_addr_index.get(na, [])

        if exact_hits and len(set(exact_hits)) == 1:
            cls = "EXACT"
            exact += 1
        elif addr_hits and len(set(addr_hits)) == 1 and nn:
            cls = "HIGH_CONFIDENCE"
            high += 1
        elif name_hits and len(set(name_hits)) == 1 and nn:
            cls = "REVIEW_REQUIRED"
            review += 1
        elif name_hits:
            cls = "UNSAFE"
            unsafe += 1
        else:
            cls = "NET_NEW"
            net_new += 1
        match_counts[cls] += 1
        if len(examples[cls]) < 5:
            examples[cls].append({"vid": vid, "name": name, "class": cls})

    # If NIGP join failed, still count vendors but mark taxonomy incomplete.
    nigp_join_ok = bool(vendor_classes)
    return {
        "coverage": "ACQUIRED",
        "semantics": "CMBL_VENDOR_NOT_CONTRACTOR_LICENSE. HUB/VetHUB are procurement certifications, not trade licenses.",
        "web_name_fields": fields[:25],
        "web_name_rows": len(vendors),
        "hub_name_rows": len(hub_rows),
        "hub_distinct_vids": len(hub_vids),
        "vnr_clas_rows": len(clas_rows),
        "vnr_clas_fields": clas_fields[:15],
        "comm_book_rows": len(comm_rows),
        "nigp_join_ok": nigp_join_ok,
        "construction_nigp_classes": sorted(CONSTRUCTION_NIGP_CLASSES),
        "construction_nigp_labels": {c: comm_labels.get(c, "") for c in sorted(CONSTRUCTION_NIGP_CLASSES)},
        "construction_vendor_vids": len(construction_vids),
        "construction_vendor_rows": construction_vendor_rows,
        "class_item_counts_top": [{"class": k, "rows": v} for k, v in class_counts.most_common(15)],
        "vendor_phone_public_eligible": vendor_phones,
        "vendor_email_public_eligible": vendor_emails,
        "match": {
            "EXACT": exact,
            "HIGH_CONFIDENCE": high,
            "REVIEW_REQUIRED": review,
            "UNSAFE": unsafe,
            "NET_NEW_BUSINESS_CANDIDATES": net_new,
            "note": "EXACT requires a source-native trade/license ID in the vendor row. HIGH_CONFIDENCE is name+address, not a license. NET_NEW is not unlicensed.",
            "examples": examples,
        },
        "adverse_attach_rule": "EXACT official credential ID only. Do not attach HIGH_CONFIDENCE/REVIEW/UNSAFE as adverse evidence.",
    }


def acquire_txdot_file() -> dict[str, Any]:
    dest = RAW / "tx_txdot" / "drau-zphx.csv"
    info = download_to(
        "https://data.texas.gov/api/views/drau-zphx/rows.csv?accessType=DOWNLOAD",
        dest,
    )
    profile = soda_txdot_profile()
    if info["ok"] and dest.exists():
        fields, rows = sniff_rows(dest)
        profile["csv_rows"] = len(rows)
        profile["csv_fields"] = fields[:40]
        profile["csv_sha256"] = info["sha256"]
        profile["csv_bytes"] = info["bytes"]
        contractorish = [f for f in fields if re.search(r"contractor|vendor|award|bidder|company", f, re.I)]
        profile["csv_contractorish_columns"] = contractorish
        cm_sample = []
        for row in rows[:20]:
            cm = _field(row, "CONSTRUCTION MANAGER", "construction_manager")
            email = _field(row, "CONSTRUCTION MANAGER EMAIL", "construction_manager_email")
            if cm and len(cm_sample) < 3:
                cm_sample.append({"construction_manager": cm, "email": email})
        profile["construction_manager_sample"] = cm_sample
    profile["download"] = {k: info[k] for k in info}
    return profile


def summarize_identities(identities: list[dict[str, str]], grain: str) -> dict[str, Any]:
    subset = [i for i in identities if i.get("grain") == grain]
    status = Counter(i.get("status_bucket") or "UNKNOWN" for i in subset)
    types = Counter(i.get("license_type") or "UNKNOWN" for i in subset)
    phones = sum(1 for i in subset if i.get("phone"))
    return {
        "credential_rows": len(subset),
        "distinct_keys": len({i["key"] for i in subset}),
        "distinct_normalized_names": len({i["norm_name"] for i in subset if i.get("norm_name")}),
        "distinct_name_addr": len(
            {f"{i.get('norm_name')}|{i.get('norm_addr')}" for i in subset if i.get("norm_name")}
        ),
        "status_buckets": dict(status),
        "trade_counts": [{"trade": k, "rows": v} for k, v in types.most_common()],
        "business_phone_public_eligible": phones,
    }


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def main() -> int:
    ART.mkdir(parents=True, exist_ok=True)
    print("TX-CON-001 acquire as_of", AS_OF_ISO)

    print("\n== TDLR ==")
    tdlr = acquire_tdlr()
    print("\n== TSBPE ==")
    tsbpe = acquire_tsbpe()
    print("\n== CMBL ==")
    cmbL_dl = acquire_cmbl()
    print("\n== TxDOT ==")
    txdot = acquire_txdot_file()
    print("\n== TCEQ probe ==")
    tceq = tceq_probe()

    tdlr_ids = tdlr.get("identities") or []
    tsbpe_ids = tsbpe.get("identities") or []
    print("\n== CMBL profile / vendor match ==")
    cmbL = parse_cmbl(tdlr_ids, tsbpe_ids)

    harvest = {
        "ticket": "TX-CON-001",
        "as_of": AS_OF_ISO,
        "acquired_at": datetime.now(timezone.utc).isoformat(),
        "absolute_semantics": {
            "texas_trade_credential_is_not_all_texas_contractors": True,
            "person_trade_license_is_not_contractor_business": True,
            "cmbl_hub_vethub_is_not_contractor_license": True,
            "txdot_project_is_not_contractor_identity": True,
            "tceq_regulated_entity_is_not_contractor": True,
            "unmatched_vendor_is_not_unlicensed": True,
            "expired_is_not_disciplined": True,
            "complaint_is_not_violation": True,
            "missing_is_not_zero": True,
            "no_trust_score": True,
            "no_ranking": True,
            "no_statewide_general_contractor_license": True,
        },
        "tdlr": {k: v for k, v in tdlr.items() if k != "identities"},
        "tsbpe": {k: v for k, v in tsbpe.items() if k != "identities"},
        "cmbl_download": cmbL_dl,
        "cmbl": cmbL,
        "txdot": txdot,
        "tceq": tceq,
        "tdlr_identity_summary": {
            "BUSINESS_CONTRACTOR": summarize_identities(tdlr_ids, "BUSINESS_CONTRACTOR"),
            "BUSINESS_ADJACENT": summarize_identities(tdlr_ids, "BUSINESS_ADJACENT"),
            "PERSON_TRADE_CREDENTIAL": summarize_identities(tdlr_ids, "PERSON_TRADE_CREDENTIAL"),
        },
        "tsbpe_identity_summary": {
            "BUSINESS_CONTRACTOR": summarize_identities(tsbpe_ids, "BUSINESS_CONTRACTOR"),
            "PERSON_TRADE_CREDENTIAL": summarize_identities(tsbpe_ids, "PERSON_TRADE_CREDENTIAL"),
        },
        "identity_counts": {
            "tdlr_business_keys": len({i["key"] for i in tdlr_ids if i.get("grain") == "BUSINESS_CONTRACTOR"}),
            "tdlr_adjacent_keys": len({i["key"] for i in tdlr_ids if i.get("grain") == "BUSINESS_ADJACENT"}),
            "tdlr_person_keys_acquired": len(
                {i["key"] for i in tdlr_ids if i.get("grain") == "PERSON_TRADE_CREDENTIAL"}
            ),
            "tsbpe_rmp_keys": len({i["key"] for i in tsbpe_ids if i.get("grain") == "BUSINESS_CONTRACTOR"}),
            "tsbpe_person_keys": len({i["key"] for i in tsbpe_ids if i.get("grain") == "PERSON_TRADE_CREDENTIAL"}),
        },
    }

    # Compact identity index for snapshot matching (no raw PII dump in git beyond harvest summaries).
    compact_ids = []
    for rec in tdlr_ids + tsbpe_ids:
        if rec.get("grain") != "BUSINESS_CONTRACTOR":
            continue
        compact_ids.append(
            {
                "key": rec["key"],
                "type": rec.get("license_type"),
                "n": rec.get("norm_name"),
                "a": rec.get("norm_addr"),
                "c": rec.get("county"),
                "s": rec.get("status_bucket"),
                "p": 1 if rec.get("phone") else 0,
            }
        )
    write_json(ART / "business-identity-index.json", compact_ids)
    write_json(ART / "harvest.json", harvest)
    print("\nWrote", ART / "harvest.json")
    print("TDLR business keys", harvest["identity_counts"]["tdlr_business_keys"])
    print("TSBPE RMP keys", harvest["identity_counts"]["tsbpe_rmp_keys"])
    print("CMBL construction vids", harvest["cmbl"].get("construction_vendor_vids"))
    print("TxDOT rows", harvest["txdot"].get("row_count"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
