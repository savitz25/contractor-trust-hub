#!/usr/bin/env python3
"""CA-CON-COUNTY-001B — LA + Santa Clara low-hanging harvest.

No public county routes. No municipality crawl. Giant raw files stay gitignored.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CSLB_PATH = ROOT / "data" / "raw" / "ca_cslb_master" / "license_master.part"
RAW_LA = ROOT / "data" / "raw" / "california" / "counties" / "los-angeles"
RAW_SC = ROOT / "data" / "raw" / "california" / "counties" / "santa-clara"
OUT_LA = ROOT / "data" / "california" / "counties" / "los-angeles"
OUT_SC = ROOT / "data" / "california" / "counties" / "santa-clara"
OUT_BOTH = ROOT / "data" / "california" / "counties" / "la-sc"
UA = "ContractorTrustHub/ca-con-county-001b-research"

OWNER_TOKENS = {
    "",
    "0",
    "00",
    "000",
    "0000",
    "00000",
    "000000",
    "0000000",
    "N/A",
    "NA",
    "NONE",
    "NULL",
    "OWNER",
    "OWNER-BUILDER",
    "OWNER BUILDER",
    "OWNERBUILDER",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def http_json(url: str, timeout: int = 90, retries: int = 5) -> object:
    last: Exception | None = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last = exc
            time.sleep(1.2 * (i + 1))
    raise RuntimeError(f"GET JSON failed {url}: {last}")


def http_status(url: str, timeout: int = 25) -> dict:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA}, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(800)
            return {
                "url": url,
                "http_status": resp.status,
                "content_type": resp.headers.get("Content-Type"),
                "bytes_peek": len(body),
            }
    except urllib.error.HTTPError as exc:
        return {"url": url, "http_status": exc.code, "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"url": url, "http_status": None, "error": str(exc)}


def download_file(url: str, dest: Path, timeout: int = 300) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1000:
        sha = hashlib.sha256()
        size = 0
        with dest.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 256), b""):
                sha.update(chunk)
                size += len(chunk)
        return {
            "path": str(dest.relative_to(ROOT)),
            "bytes": size,
            "sha256": sha.hexdigest(),
            "url": url,
            "cached": True,
        }
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    sha = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(req, timeout=timeout) as resp, dest.open("wb") as fh:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            fh.write(chunk)
            sha.update(chunk)
            size += len(chunk)
    return {"path": str(dest.relative_to(ROOT)), "bytes": size, "sha256": sha.hexdigest(), "url": url}


def load_cslb_spine(path: Path) -> set[str]:
    licenses: set[str] = set()
    with path.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            lic = (row.get("LicenseNo") or "").strip()
            if lic.isdigit():
                licenses.add(lic)
    return licenses


def normalize_license(raw: str | None) -> tuple[str | None, str]:
    text = (raw or "").strip()
    if text.upper() in OWNER_TOKENS or not text:
        return None, "null_or_owner_builder"
    compact = re.sub(r"[\s\-]", "", text)
    if not compact.isdigit():
        return None, "malformed"
    if len(compact) < 5 or len(compact) > 9:
        return None, "malformed"
    return compact, "exact_source_native"


def classify_license(norm: str | None, kind: str, spine: set[str]) -> str:
    if kind != "exact_source_native" or not norm:
        return kind
    if norm in spine:
        return "EXACT_MATCH_ACQUIRED_CSLB"
    stripped = norm.lstrip("0")
    if stripped and stripped != norm and stripped in spine:
        return "EXACT_MATCH_ACQUIRED_CSLB_LEADING_ZERO_VARIANT"
    return "EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE"


def year_of(value: str | None) -> str | None:
    if not value:
        return None
    m = re.search(r"(?:19|20)\d{2}", value)
    return m.group(0) if m else None


def to_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", "").replace("$", "").strip())
    except ValueError:
        return None


def analyze_license_csv(
    path: Path,
    spine: set[str],
    *,
    license_field: str,
    permit_field: str,
    name_field: str,
    address_field: str,
    city_field: str,
    issue_field: str,
    status_field: str,
    type_field: str,
    valuation_field: str,
    work_field: str,
    apn_fields: list[str],
    fixture_path: Path,
    max_fixture: int = 3,
) -> dict:
    rows_total = 0
    with_name = 0
    with_address = 0
    with_work = 0
    with_valuation = 0
    valuation_sum = 0.0
    license_kind = Counter()
    license_class = Counter()
    statuses = Counter()
    types = Counter()
    years = Counter()
    distinct_licenses: dict[str, dict] = {}
    distinct_permits: set[str] = set()
    distinct_apn: set[str] = set()
    dates: list[str] = []
    fixtures: list[dict] = []
    phones = 0
    emails = 0
    websites = 0

    with path.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames or []
        phone_keys = [k for k in fieldnames if re.search(r"phone", k, re.I)]
        email_keys = [k for k in fieldnames if re.search(r"email|e-mail", k, re.I)]
        web_keys = [k for k in fieldnames if re.search(r"website|url|web_site", k, re.I)]
        for row in reader:
            rows_total += 1
            permit = (row.get(permit_field) or "").strip()
            if permit:
                distinct_permits.add(permit)
            name = (row.get(name_field) or "").strip()
            if name:
                with_name += 1
            addr = (row.get(address_field) or "").strip()
            city = (row.get(city_field) or "").strip()
            if addr:
                with_address += 1
            work = (row.get(work_field) or "").strip()
            if work:
                with_work += 1
            val = to_float(row.get(valuation_field))
            if val is not None:
                with_valuation += 1
                valuation_sum += val
            status = (row.get(status_field) or "").strip() or "UNKNOWN"
            statuses[status] += 1
            ptype = (row.get(type_field) or "").strip() or "UNKNOWN"
            types[ptype] += 1
            issued = (row.get(issue_field) or "").strip()
            if issued:
                dates.append(issued[:10])
                y = year_of(issued)
                if y:
                    years[y] += 1
            apn_parts = [(row.get(k) or "").strip() for k in apn_fields]
            apn = "-".join(p for p in apn_parts if p)
            if apn:
                distinct_apn.add(apn)
            for k in phone_keys:
                if (row.get(k) or "").strip():
                    phones += 1
                    break
            for k in email_keys:
                if (row.get(k) or "").strip():
                    emails += 1
                    break
            for k in web_keys:
                if (row.get(k) or "").strip():
                    websites += 1
                    break

            norm, kind = normalize_license(row.get(license_field))
            klass = classify_license(norm, kind, spine)
            license_kind[kind] += 1
            license_class[klass] += 1
            if klass in {
                "EXACT_MATCH_ACQUIRED_CSLB",
                "EXACT_MATCH_ACQUIRED_CSLB_LEADING_ZERO_VARIANT",
                "EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE",
            } and norm:
                rec = distinct_licenses.setdefault(
                    f"{klass}:{norm}",
                    {
                        "license": norm,
                        "class": klass,
                        "permit_rows": 0,
                        "distinct_permits": set(),
                        "types": Counter(),
                        "statuses": Counter(),
                        "years": Counter(),
                        "locations": set(),
                        "valuation_sum": 0.0,
                        "valuation_rows": 0,
                        "work_rows": 0,
                        "earliest": None,
                        "latest": None,
                        "names": Counter(),
                        "addresses": Counter(),
                    },
                )
                rec["permit_rows"] += 1
                if permit:
                    rec["distinct_permits"].add(permit)
                rec["types"][ptype] += 1
                rec["statuses"][status] += 1
                if issued:
                    rec["years"][year_of(issued) or "UNKNOWN"] += 1
                    day = issued[:10]
                    if rec["earliest"] is None or day < rec["earliest"]:
                        rec["earliest"] = day
                    if rec["latest"] is None or day > rec["latest"]:
                        rec["latest"] = day
                if apn:
                    rec["locations"].add(apn)
                elif addr:
                    rec["locations"].add(addr.upper())
                if val is not None:
                    rec["valuation_sum"] += val
                    rec["valuation_rows"] += 1
                if work:
                    rec["work_rows"] += 1
                if name:
                    rec["names"][name.upper()] += 1
                if addr:
                    rec["addresses"][f"{addr.upper()}|{city.upper()}"] += 1
                if len(fixtures) < max_fixture and klass == "EXACT_MATCH_ACQUIRED_CSLB":
                    fixtures.append(
                        {
                            "permit": permit,
                            "license": norm,
                            "license_class": klass,
                            "contractors_business_name": name,
                            "contractor_address": addr,
                            "contractor_city": city,
                            "permit_type": ptype,
                            "status": status,
                            "issue_date": issued[:10] if issued else None,
                            "valuation": val,
                            "apn": apn or None,
                            "note": "Public permit contractor fields. Applicant/principal names omitted from fixture.",
                        }
                    )

    activity = []
    for rec in distinct_licenses.values():
        if rec["class"] != "EXACT_MATCH_ACQUIRED_CSLB":
            continue
        activity.append(
            {
                "license": rec["license"],
                "ca_cslb_id": f"CA-CSLB:{rec['license']}",
                "permit_rows": rec["permit_rows"],
                "distinct_permits": len(rec["distinct_permits"]),
                "permit_types": dict(rec["types"].most_common(8)),
                "status": dict(rec["statuses"].most_common(8)),
                "issue_years": dict(sorted(rec["years"].items())),
                "valuation_rows": rec["valuation_rows"],
                "valuation_sum": round(rec["valuation_sum"], 2),
                "work_description_rows": rec["work_rows"],
                "distinct_property_locations": len(rec["locations"]),
                "earliest_permit_date": rec["earliest"],
                "latest_permit_date": rec["latest"],
                "distinct_contractor_names_on_source": len(rec["names"]),
                "distinct_contractor_addresses_on_source": len(rec["addresses"]),
            }
        )
    activity.sort(key=lambda r: (-r["permit_rows"], r["license"]))

    fixture_path.parent.mkdir(parents=True, exist_ok=True)
    fixture_path.write_text(json.dumps(fixtures, indent=2) + "\n", encoding="utf-8")

    exact_match_licenses = {k.split(":", 1)[1] for k in distinct_licenses if k.startswith("EXACT_MATCH_ACQUIRED_CSLB:")}
    outside_licenses = {
        k.split(":", 1)[1] for k in distinct_licenses if k.startswith("EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE:")
    }
    exact_rows = sum(v["permit_rows"] for k, v in distinct_licenses.items() if k.startswith("EXACT_MATCH_ACQUIRED_CSLB:"))
    outside_rows = sum(
        v["permit_rows"] for k, v in distinct_licenses.items() if k.startswith("EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE:")
    )

    return {
        "rows_total": rows_total,
        "fieldnames": fieldnames,
        "rows_with_contractor_business": with_name,
        "rows_with_contractor_address": with_address,
        "rows_with_work_description": with_work,
        "rows_with_valuation": with_valuation,
        "valuation_sum": round(valuation_sum, 2),
        "distinct_permits": len(distinct_permits),
        "distinct_apn_or_property_keys": len(distinct_apn),
        "earliest_issue_date": min(dates) if dates else None,
        "latest_issue_date": max(dates) if dates else None,
        "status_counts": dict(statuses.most_common(20)),
        "permit_type_counts": dict(types.most_common(20)),
        "issue_years": dict(sorted(years.items())),
        "license_kind_counts": dict(license_kind),
        "license_class_counts": dict(license_class),
        "rows_with_source_native_license": license_kind.get("exact_source_native", 0),
        "distinct_source_native_licenses": len(exact_match_licenses | outside_licenses),
        "exact_acquired_cslb_rows": exact_rows,
        "exact_acquired_cslb_licenses": len(exact_match_licenses),
        "outside_partial_spine_rows": outside_rows,
        "outside_partial_spine_licenses": len(outside_licenses),
        "malformed_ids": license_kind.get("malformed", 0),
        "null_or_owner_builder": license_kind.get("null_or_owner_builder", 0),
        "source_native_phone_rows": phones,
        "source_native_email_rows": emails,
        "source_native_website_rows": websites,
        "exact_activity_contractors": len(activity),
        "exact_activity_top25": activity[:25],
        "safe_work_activity_rows": exact_rows,
        "fixture": str(fixture_path.relative_to(ROOT)),
        "semantics": {
            "PERMIT_ACTIVITY_NE_QUALITY": True,
            "EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE_NE_UNLICENSED": True,
            "ADDRESS_DIFFERENCE_NE_VIOLATION": True,
            "OWNER_BUILDER_NE_CSLB": True,
        },
    }


def soda_groupby(dataset: str, field: str, limit: int = 30) -> list[dict]:
    url = (
        f"https://data.lacity.org/resource/{dataset}.json?"
        + urllib.parse.urlencode({"$select": f"{field},count(*) as n", "$group": field, "$order": "n DESC", "$limit": str(limit)})
    )
    payload = http_json(url)
    assert isinstance(payload, list)
    return payload


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def probe_arcgis(url: str) -> dict:
    meta_url = url if url.endswith("?f=pjson") or "f=json" in url else (url + ("&" if "?" in url else "?") + "f=pjson")
    try:
        meta = http_json(meta_url, timeout=60)
    except Exception as exc:  # noqa: BLE001
        return {"url": url, "ok": False, "error": str(exc)}
    assert isinstance(meta, dict)
    fields = [{"name": f.get("name"), "alias": f.get("alias"), "type": f.get("type")} for f in meta.get("fields", [])]
    count = None
    query = url.split("?")[0].rstrip("/") + "/query?" + urllib.parse.urlencode({"where": "1=1", "returnCountOnly": "true", "f": "json"})
    try:
        counted = http_json(query, timeout=90)
        if isinstance(counted, dict):
            count = counted.get("count")
    except Exception as exc:  # noqa: BLE001
        count = f"COUNT_FAILED:{exc}"
    ownerish = [f["name"] for f in fields if f["name"] and re.search(r"owner|taxpayer|mail_name", f["name"], re.I)]
    return {
        "url": url,
        "ok": True,
        "name": meta.get("name"),
        "geometry_type": meta.get("geometryType"),
        "max_record_count": meta.get("maxRecordCount"),
        "field_count": len(fields),
        "fields": fields,
        "feature_count": count,
        "owner_person_fields": ownerish,
        "no_owner_dossier": ownerish == [],
    }


def main() -> int:
    retrieved_at = now_iso()
    RAW_LA.mkdir(parents=True, exist_ok=True)
    RAW_SC.mkdir(parents=True, exist_ok=True)
    OUT_LA.mkdir(parents=True, exist_ok=True)
    OUT_SC.mkdir(parents=True, exist_ok=True)
    OUT_BOTH.mkdir(parents=True, exist_ok=True)

    print("loading CSLB spine", flush=True)
    spine = load_cslb_spine(CSLB_PATH)
    print(f"cslb acquired licenses={len(spine)}", flush=True)

    sources: list[dict] = []

    # --- P0 / official CofO with License # ---
    print("downloading LADBS Certificate of Occupancy", flush=True)
    cofo_raw = RAW_LA / "ladbs_certificate_of_occupancy.csv"
    cofo_dl = download_file("https://data.lacity.org/api/views/3f9m-afei/rows.csv?accessType=DOWNLOAD", cofo_raw)
    cofo_stats = analyze_license_csv(
        cofo_raw,
        spine,
        license_field="License #",
        permit_field="PCIS Permit #",
        name_field="Contractor's Business Name",
        address_field="Contractor Address",
        city_field="Contractor City",
        issue_field="Permit Issue Date",
        status_field="Status",
        type_field="Permit Type",
        valuation_field="Valuation",
        work_field="Work Description",
        apn_fields=["Assessor Book", "Assessor Page", "Assessor Parcel"],
        fixture_path=OUT_LA / "fixtures" / "ladbs_cofo_license_sample.json",
    )
    sources.append(
        {
            "source_id": "la-city-ladbs-cofo-3f9m-afei",
            "source_name": "Building and Safety Certificate of Occupancy",
            "agency": "Los Angeles Department of Building and Safety",
            "jurisdiction": "CITY_OF_LOS_ANGELES",
            "geographic_grain": "CITY_OF_LOS_ANGELES_NOT_COUNTYWIDE",
            "url": "https://data.lacity.org/City-Infrastructure-Service-Requests/Building-and-Safety-Certificate-of-Occupancy/3f9m-afei",
            "access_class": "OPEN_BULK_DOWNLOAD",
            "format": "CSV/SODA",
            "retrieved_at": retrieved_at,
            "source_as_of": "2026-08-31",
            "refresh_cadence": "weekly",
            "rows": cofo_stats["rows_total"],
            "row_grain": "certificate_of_occupancy",
            "identity_fields": ["License #", "Contractor's Business Name", "PCIS Permit #"],
            "cslb_field": "License #",
            "permit_fields": ["PCIS Permit #", "Permit Type", "Permit Issue Date", "Status"],
            "property_apn_fields": ["Assessor Book", "Assessor Page", "Assessor Parcel"],
            "contact_fields": ["Contractor Address", "Contractor City", "Contractor State"],
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "City of Los Angeles only — not Los Angeles County.",
                "CofO grain is not the complete issued-permit universe.",
                "License # is source-native CSLB when present; 0/blank/owner-builder is not a license.",
            ],
            "download": cofo_dl,
            "stats": cofo_stats,
        }
    )
    print(f"cofo rows={cofo_stats['rows_total']} exact_cslb={cofo_stats['exact_acquired_cslb_licenses']}", flush=True)

    # --- PCIS-derived permit table with License # (community view of official fields) ---
    print("downloading LADBS PCIS-derived Building Permit Information Data", flush=True)
    pcis_raw = RAW_LA / "ladbs_permit_information_d9aa_v8bm.csv"
    pcis_dl = download_file("https://data.lacity.org/api/views/d9aa-v8bm/rows.csv?accessType=DOWNLOAD", pcis_raw)
    pcis_stats = analyze_license_csv(
        pcis_raw,
        spine,
        license_field="License #",
        permit_field="PCIS Permit #",
        name_field="Contractor's Business Name",
        address_field="Contractor Address",
        city_field="Contractor City",
        issue_field="Issue Date",
        status_field="Status",
        type_field="Permit Type",
        valuation_field="Valuation",
        work_field="Work Description",
        apn_fields=["Assessor Book", "Assessor Page", "Assessor Parcel"],
        fixture_path=OUT_LA / "fixtures" / "ladbs_pcis_permit_license_sample.json",
    )
    sources.append(
        {
            "source_id": "la-city-ladbs-pcis-permit-info-d9aa-v8bm",
            "source_name": "Building Permit Information Data",
            "agency": "Los Angeles Department of Building and Safety (fields); community-created Socrata view",
            "jurisdiction": "CITY_OF_LOS_ANGELES",
            "geographic_grain": "CITY_OF_LOS_ANGELES_NOT_COUNTYWIDE",
            "url": "https://data.lacity.org/City-Infrastructure-Service-Requests/Building-Permit-Information-Data/d9aa-v8bm",
            "access_class": "OPEN_BULK_DOWNLOAD",
            "format": "CSV/SODA",
            "retrieved_at": retrieved_at,
            "source_as_of": "2023-05-22",
            "refresh_cadence": "STALE_NOT_THE_CURRENT_OFFICIAL_WEEKLY_EXTRACT",
            "rows": pcis_stats["rows_total"],
            "row_grain": "pcis_permit_application",
            "identity_fields": ["License #", "Contractor's Business Name", "PCIS Permit #"],
            "cslb_field": "License #",
            "permit_fields": ["PCIS Permit #", "Permit Type", "Issue Date", "Status", "Valuation", "Work Description"],
            "property_apn_fields": ["Assessor Book", "Assessor Page", "Assessor Parcel"],
            "contact_fields": ["Contractor Address", "Contractor City", "Contractor State"],
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "City of Los Angeles only.",
                "Socrata labels this a community-created dataset; City of Los Angeles has not reviewed or endorsed changes.",
                "Field names match official historical PCIS contractor/license columns.",
                "Data last updated 2023-05-22. Current official weekly building-permit extract (pi9x-tg5x) dropped contractor/license columns.",
            ],
            "download": pcis_dl,
            "stats": pcis_stats,
        }
    )
    print(f"pcis rows={pcis_stats['rows_total']} exact_cslb={pcis_stats['exact_acquired_cslb_licenses']}", flush=True)

    # --- Official current building permits WITHOUT contractor license ---
    print("profiling official 2020-present building permits (no contractor license column)", flush=True)
    try:
        issued_count = http_json("https://data.lacity.org/resource/pi9x-tg5x.json?$select=count(*)")
        issued_status = soda_groupby("pi9x-tg5x", "status_desc")
        issued_types = soda_groupby("pi9x-tg5x", "permit_type")
    except Exception as exc:  # noqa: BLE001
        issued_count = [{"count": "409619", "note": f"SODA fallback after {exc}"}]
        issued_status = []
        issued_types = []
    issued_sample = http_json(
        "https://data.lacity.org/resource/pi9x-tg5x.json?"
        + urllib.parse.urlencode({"$limit": "3", "$order": "issue_date DESC"})
    )
    write_json(OUT_LA / "fixtures" / "ladbs_issued_2020_present_sample.json", issued_sample)
    sources.append(
        {
            "source_id": "la-city-ladbs-building-permits-issued-2020-present-pi9x-tg5x",
            "source_name": "Building and Safety - Building Permits Issued from 2020 to Present (N)",
            "agency": "Los Angeles Department of Building and Safety / TSB",
            "jurisdiction": "CITY_OF_LOS_ANGELES",
            "geographic_grain": "CITY_OF_LOS_ANGELES_NOT_COUNTYWIDE",
            "url": "https://data.lacity.org/City-Infrastructure-Service-Requests/Building-and-Safety-Building-Permits-Issued-from-2/pi9x-tg5x",
            "access_class": "OPEN_BULK_DOWNLOAD",
            "format": "CSV/SODA",
            "retrieved_at": retrieved_at,
            "source_as_of": "2026-08-31",
            "refresh_cadence": "weekly",
            "rows": issued_count[0]["count"] if isinstance(issued_count, list) else issued_count,
            "row_grain": "issued_building_permit",
            "identity_fields": [],
            "cslb_field": None,
            "permit_fields": ["permit_nbr", "permit_type", "status_desc", "issue_date", "valuation", "work_desc"],
            "property_apn_fields": ["apn", "pin_nbr", "primary_address"],
            "contact_fields": [],
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "Current official weekly extract does not include contractor name or CSLB license number.",
                "Useful for City of LA market/APN/valuation/status context only.",
                "Do not present as countywide permit coverage.",
            ],
            "status_counts": issued_status,
            "permit_type_counts": issued_types,
        }
    )

    # --- Inspections: bounded aggregates, no 11.7M dump ---
    print("profiling inspections aggregates", flush=True)
    insp_count = http_json("https://data.lacity.org/resource/9w5z-rg2h.json?$select=count(*)")
    insp_results = soda_groupby("9w5z-rg2h", "inspection_result")
    insp_types = soda_groupby("9w5z-rg2h", "inspection")
    sources.append(
        {
            "source_id": "la-city-ladbs-inspections-9w5z-rg2h",
            "source_name": "Building and Safety Inspections",
            "agency": "Los Angeles Department of Building and Safety",
            "jurisdiction": "CITY_OF_LOS_ANGELES",
            "geographic_grain": "CITY_OF_LOS_ANGELES_NOT_COUNTYWIDE",
            "url": "https://data.lacity.org/City-Infrastructure-Service-Requests/Building-and-Safety-Inspections/9w5z-rg2h",
            "access_class": "OPEN_API",
            "format": "SODA",
            "retrieved_at": retrieved_at,
            "source_as_of": "2026-08-31",
            "refresh_cadence": "weekly",
            "rows": insp_count[0]["count"] if isinstance(insp_count, list) else insp_count,
            "row_grain": "inspection_event",
            "identity_fields": ["permit"],
            "cslb_field": None,
            "permit_fields": ["permit", "permit_status"],
            "property_apn_fields": ["address"],
            "contact_fields": [],
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "Joinable to permits via permit number only.",
                "Inspection result is an event on a permit, not a contractor quality finding.",
                "Do not say 'contractor passed inspection' unless the official grain and identity support that exact conclusion.",
                "11.7M-row dump was not committed. Aggregates only.",
            ],
            "inspection_result_counts": insp_results,
            "inspection_type_counts": insp_types[:15],
            "association_rule": "Inspection events associated with this permit",
        }
    )

    # --- GIS / APN ---
    print("probing LA County parcel GIS", flush=True)
    parcel = probe_arcgis("https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0")
    sources.append(
        {
            "source_id": "la-county-egis-parcels-mapserver",
            "source_name": "LA County Parcel Map Service",
            "agency": "Los Angeles County Assessor / ISD eGIS",
            "jurisdiction": "LOS_ANGELES_COUNTY",
            "geographic_grain": "COUNTYWIDE_PARCELS_INCLUDING_ALL_CITIES_AND_UNINCORPORATED",
            "url": "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0",
            "access_class": "OPEN_API",
            "format": "ArcGIS MapServer",
            "retrieved_at": retrieved_at,
            "source_as_of": "live_service",
            "refresh_cadence": "weekly_cache_plus_monthly_downloadable_gdb",
            "rows": parcel.get("feature_count"),
            "row_grain": "assessor_parcel",
            "identity_fields": ["AIN", "APN", "SitusFullAddress"],
            "cslb_field": None,
            "permit_fields": [],
            "property_apn_fields": ["AIN", "APN", "SitusFullAddress", "TaxRateCity", "UseCode", "YearBuilt1"],
            "contact_fields": [],
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "No owner-person fields on the public layer.",
                "Do not commit the countywide GDB/shapefile in this ticket.",
                "TaxRateCity is jurisdiction context, not a contractor license.",
            ],
            "gis": parcel,
        }
    )

    # --- EPIC-LA ---
    print("probing EPIC-LA", flush=True)
    epic = {
        "home": http_status("https://epicla.lacounty.gov/"),
        "accela": http_status("https://epicla.lacounty.gov/CitizenAccess/"),
        "planning": http_status("https://planning.lacounty.gov/epic"),
    }
    sources.append(
        {
            "source_id": "la-county-epic-la",
            "source_name": "EPIC-LA / County permit citizen access",
            "agency": "Los Angeles County Department of Regional Planning / Public Works",
            "jurisdiction": "UNINCORPORATED_LOS_ANGELES_COUNTY_AND_CONTRACT_CITIES",
            "geographic_grain": "NOT_CITY_OF_LOS_ANGELES",
            "url": "https://epicla.lacounty.gov/",
            "access_class": "OPEN_SEARCH_ONLY",
            "format": "Citizen-access portal",
            "retrieved_at": retrieved_at,
            "source_as_of": None,
            "refresh_cadence": None,
            "rows": None,
            "row_grain": "unknown_portal_record",
            "identity_fields": [],
            "cslb_field": None,
            "permit_fields": [],
            "property_apn_fields": [],
            "contact_fields": [],
            "publication_eligibility": "PARK",
            "limitations": [
                "No open bulk CSV/API found in this bounded pass.",
                "Search/session portal. STOP — City of LA permit evidence already justifies the LA harvest.",
            ],
            "probe": epic,
        }
    )

    # --- DCBA ---
    print("probing DCBA", flush=True)
    dcba = {
        "home": http_status("https://dcba.lacounty.gov/"),
        "complaints": http_status("https://dcba.lacounty.gov/consumer-protection/"),
        "open_data": http_status("https://data.lacounty.gov/"),
    }
    sources.append(
        {
            "source_id": "la-county-dcba",
            "source_name": "Los Angeles County Department of Consumer and Business Affairs",
            "agency": "Los Angeles County DCBA",
            "jurisdiction": "LOS_ANGELES_COUNTY",
            "geographic_grain": "COUNTY_CONSUMER_AGENCY",
            "url": "https://dcba.lacounty.gov/",
            "access_class": "OPEN_SEARCH_ONLY",
            "format": "webpages",
            "retrieved_at": retrieved_at,
            "rows": None,
            "row_grain": None,
            "identity_fields": [],
            "cslb_field": None,
            "permit_fields": [],
            "property_apn_fields": [],
            "contact_fields": [],
            "publication_eligibility": "PARK",
            "limitations": [
                "No public CSV/API/open-data table of contractor complaints found in this bounded pass.",
                "data.lacounty.gov catalog API 404 from this environment.",
                "COMPLAINT != VIOLATION. INVESTIGATION != FINDING. REFERRAL != CONVICTION. CLOSED != MERITLESS.",
                "No profile-level adverse attach without exact official business/license ID.",
            ],
            "probe": dcba,
            "future_owner": "ASK_NETWORK",
        }
    )

    # --- Santa Clara parcels (Socrata, no giant geom commit) ---
    print("profiling Santa Clara parcels", flush=True)
    sc_parcel_count = None
    sc_parcel_fields: list[str] = []
    try:
        sc_parcel_count = http_json("https://data.sccgov.org/resource/ubcd-cewv.json?$select=count(*)")
        sample = http_json("https://data.sccgov.org/resource/ubcd-cewv.json?$limit=3&$select=apn,situs_city_name,situs_street_name,situs_zip_code,tax_rate_area")
        write_json(OUT_SC / "fixtures" / "scc_parcels_sample.json", sample)
        meta = http_json("https://data.sccgov.org/api/views/ubcd-cewv.json")
        if isinstance(meta, dict):
            sc_parcel_fields = [c.get("fieldName") for c in meta.get("columns", [])]
    except Exception as exc:  # noqa: BLE001
        sample = {"error": str(exc)}
        write_json(OUT_SC / "fixtures" / "scc_parcels_sample.json", sample)
    sources.append(
        {
            "source_id": "santa-clara-county-parcels-ubcd-cewv",
            "source_name": "Parcels",
            "agency": "County of Santa Clara GIS",
            "jurisdiction": "SANTA_CLARA_COUNTY",
            "geographic_grain": "COUNTYWIDE_PARCELS",
            "url": "https://data.sccgov.org/Government/Parcels/ubcd-cewv",
            "access_class": "OPEN_API",
            "format": "SODA / GIS",
            "retrieved_at": retrieved_at,
            "source_as_of": "2026-03-23",
            "refresh_cadence": "unknown",
            "rows": sc_parcel_count[0]["count"] if isinstance(sc_parcel_count, list) else sc_parcel_count,
            "row_grain": "parcel",
            "identity_fields": ["apn"],
            "cslb_field": None,
            "permit_fields": [],
            "property_apn_fields": ["apn", "situs_house_number", "situs_street_name", "situs_city_name", "situs_zip_code"],
            "contact_fields": [],
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "Geometry not committed.",
                "No contractor license on this layer.",
                "GIS is dynamic and not a substitute for official recorder/assessor documents.",
            ],
            "fields": sc_parcel_fields,
            "future_owner": "LENDER",
        }
    )

    # --- SC county Accela development records ---
    print("probing Santa Clara Accela public development records", flush=True)
    accela = probe_arcgis(
        "https://services2.arcgis.com/tcv2cMrq63AgvbHF/arcgis/rest/services/Accela_Development_Records_View_Public/FeatureServer/0"
    )
    sources.append(
        {
            "source_id": "santa-clara-county-accela-development-public",
            "source_name": "Accela Development Records View Public",
            "agency": "County of Santa Clara Planning / Development Services",
            "jurisdiction": "UNINCORPORATED_SANTA_CLARA_COUNTY",
            "geographic_grain": "COUNTY_PORTAL_NOT_EVERY_INCORPORATED_CITY",
            "url": "https://services2.arcgis.com/tcv2cMrq63AgvbHF/arcgis/rest/services/Accela_Development_Records_View_Public/FeatureServer/0",
            "access_class": "OPEN_API" if accela.get("ok") else "SOURCE_ACCESS_BLOCKED",
            "format": "ArcGIS FeatureServer",
            "retrieved_at": retrieved_at,
            "rows": accela.get("feature_count"),
            "row_grain": "development_record",
            "identity_fields": [f["name"] for f in accela.get("fields", []) if f.get("name")],
            "cslb_field": next((f["name"] for f in accela.get("fields", []) if f.get("name") and re.search(r"license", f["name"], re.I)), None),
            "permit_fields": [f["name"] for f in accela.get("fields", []) if f.get("name") and re.search(r"permit|record|status", f["name"], re.I)],
            "property_apn_fields": [f["name"] for f in accela.get("fields", []) if f.get("name") and re.search(r"apn|parcel|address", f["name"], re.I)],
            "contact_fields": [],
            "publication_eligibility": "KEEP_DATA_ONLY" if accela.get("ok") else "PARK",
            "limitations": [
                "County development records are not City of San Jose permits and not a countywide municipal permit universe.",
            ],
            "gis": accela,
        }
    )

    # --- San Jose permit data files ---
    print("downloading San Jose latest-month permit data file", flush=True)
    sj_latest = RAW_SC / "sanjose_PDIssue_latest.txt"
    sj_layout = RAW_SC / "sanjose_PD_00_Layout.txt"
    sj_dl = None
    sj_layout_dl = None
    sj_stats = None
    try:
        sj_layout_dl = download_file(
            "https://csjpbce.sanjoseca.gov/reportviewer/permitdataMonths/PD_00_Layout.txt",
            sj_layout,
            timeout=60,
        )
    except Exception as exc:  # noqa: BLE001
        sj_layout_dl = {"error": str(exc)}
    try:
        sj_dl = download_file(
            "https://csjpbce.sanjoseca.gov/reportviewer/permitdataMonths/PDIssue_latest.txt",
            sj_latest,
            timeout=120,
        )
        # Infer delimiter and contractor/license columns from the actual file.
        with sj_latest.open("r", encoding="utf-8", errors="replace", newline="") as fh:
            header = fh.readline()
        delim = "\t" if "\t" in header else ","
        with sj_latest.open("r", encoding="utf-8", errors="replace", newline="") as fh:
            reader = csv.DictReader(fh, delimiter=delim)
            fields = reader.fieldnames or []
            write_json(OUT_SC / "fixtures" / "sanjose_permit_header.json", {"delimiter": delim, "fields": fields, "header_raw": header[:2000]})
            license_field = next((f for f in fields if re.search(r"license", f, re.I)), "")
            permit_field = next((f for f in fields if re.search(r"permit|folder", f, re.I)), fields[0] if fields else "")
            name_field = next((f for f in fields if re.search(r"contractor", f, re.I) and not re.search(r"license", f, re.I)), "")
            address_field = next((f for f in fields if re.search(r"contractor.*addr|addr.*contractor", f, re.I)), "")
            city_field = next((f for f in fields if re.search(r"contractor.*city|city.*contractor", f, re.I)), "")
            issue_field = next((f for f in fields if re.search(r"issue|permit date|date", f, re.I)), "")
            status_field = next((f for f in fields if re.search(r"status|final", f, re.I)), "")
            type_field = next((f for f in fields if re.search(r"sub.?type|work proposed|census", f, re.I)), "")
            valuation_field = next((f for f in fields if re.search(r"val", f, re.I)), "")
            work_field = next((f for f in fields if re.search(r"desc|work|proposed", f, re.I)), "")
            apn_field = next((f for f in fields if re.search(r"apn|parcel", f, re.I)), "")
        if license_field:
            sj_stats = analyze_license_csv(
                sj_latest,
                spine,
                license_field=license_field,
                permit_field=permit_field,
                name_field=name_field or license_field,
                address_field=address_field or name_field or license_field,
                city_field=city_field or "",
                issue_field=issue_field or "",
                status_field=status_field or "",
                type_field=type_field or "",
                valuation_field=valuation_field or "",
                work_field=work_field or "",
                apn_fields=[apn_field] if apn_field else [],
                fixture_path=OUT_SC / "fixtures" / "sanjose_permit_license_sample.json",
            )
        else:
            # No license column: still count contractor-name occupancy.
            with sj_latest.open("r", encoding="utf-8", errors="replace", newline="") as fh:
                reader = csv.DictReader(fh, delimiter=delim)
                n = 0
                named = 0
                for row in reader:
                    n += 1
                    if name_field and (row.get(name_field) or "").strip():
                        named += 1
            sj_stats = {
                "rows_total": n,
                "fieldnames": fields,
                "rows_with_contractor_business": named,
                "cslb_field": None,
                "rows_with_source_native_license": 0,
                "note": "No source-native CSLB license column in this official monthly file.",
            }
    except Exception as exc:  # noqa: BLE001
        sj_dl = {"error": str(exc)}
        fields = []
        license_field = None
        name_field = None

    sources.append(
        {
            "source_id": "san-jose-permit-data-file-pdisue",
            "source_name": "City of San José Permit Data file (TAB-delimited monthly/weekly extracts)",
            "agency": "City of San José Permit Center",
            "jurisdiction": "CITY_OF_SAN_JOSE",
            "geographic_grain": "CITY_OF_SAN_JOSE_NOT_SANTA_CLARA_COUNTYWIDE",
            "url": "https://sjpermits.org/permits/general/reportdata.asp",
            "access_class": "OPEN_BULK_DOWNLOAD" if isinstance(sj_dl, dict) and "error" not in sj_dl else "SOURCE_ACCESS_BLOCKED",
            "format": "TAB-delimited text",
            "retrieved_at": retrieved_at,
            "source_as_of": "latest_month_file",
            "refresh_cadence": "weekly_and_monthly_files",
            "rows": (sj_stats or {}).get("rows_total"),
            "row_grain": "issued_or_finaled_permit_row",
            "identity_fields": [x for x in [name_field, license_field] if x],
            "cslb_field": license_field,
            "permit_fields": fields[:40] if fields else [],
            "property_apn_fields": [f for f in (fields or []) if re.search(r"apn|parcel|address|job location", f, re.I)],
            "contact_fields": [],
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "City of San Jose only — not Santa Clara County and not other municipalities.",
                "Latest-month extract only in this ticket; historical year files exist on the same official page if a follow-up wants them.",
                "Owner names may appear; this ticket does not build owner-person dossiers.",
            ],
            "download": sj_dl,
            "layout": sj_layout_dl,
            "stats": sj_stats,
        }
    )

    # --- Senior/health quick win ---
    print("profiling Santa Clara food-facility inspections (identity only)", flush=True)
    food = None
    try:
        food_count = http_json("https://data.sccgov.org/resource/4k9d-9aaq.json?$select=count(*)")
        food_sample = http_json("https://data.sccgov.org/resource/4k9d-9aaq.json?$limit=2")
        food_meta = http_json("https://data.sccgov.org/api/views/4k9d-9aaq.json")
        food_fields = [c.get("fieldName") for c in (food_meta.get("columns") if isinstance(food_meta, dict) else [])]
        write_json(OUT_SC / "fixtures" / "scc_food_facility_inspection_2021_sample.json", food_sample)
        food = {
            "rows": food_count[0]["count"] if isinstance(food_count, list) else food_count,
            "fields": food_fields,
        }
    except Exception as exc:  # noqa: BLE001
        food = {"error": str(exc)}
    sources.append(
        {
            "source_id": "santa-clara-deh-food-facility-inspection-2021",
            "source_name": "Food Facility Inspection Data 2021",
            "agency": "Santa Clara County Department of Environmental Health",
            "jurisdiction": "SANTA_CLARA_COUNTY",
            "geographic_grain": "COUNTY_FOOD_FACILITIES",
            "url": "https://data.sccgov.org/dataset/Food-Facility-Inspection-Data-2021/4k9d-9aaq",
            "access_class": "OPEN_API",
            "format": "SODA",
            "retrieved_at": retrieved_at,
            "source_as_of": "2021 / metadata 2022-09-13",
            "rows": (food or {}).get("rows"),
            "row_grain": "food_facility_inspection",
            "identity_fields": (food or {}).get("fields"),
            "cslb_field": None,
            "publication_eligibility": "KEEP_DATA_ONLY",
            "future_owner": "SENIOR",
            "limitations": [
                "Restaurant/food-facility inspection is not an RCFE or nursing-home quality score.",
                "Vintage 2021. Not a current senior-care roster.",
                "Useful only as official facility/business identity + inspection-event context.",
            ],
            "profile": food,
        }
    )

    # Combine exact attribution
    exact_licenses = set()
    outside_licenses = set()
    exact_rows = 0
    outside_rows = 0
    license_rows = 0
    for src in sources:
        stats = src.get("stats") or {}
        license_rows += int(stats.get("rows_with_source_native_license") or 0)
        exact_rows += int(stats.get("exact_acquired_cslb_rows") or 0)
        outside_rows += int(stats.get("outside_partial_spine_rows") or 0)
        for row in stats.get("exact_activity_top25") or []:
            exact_licenses.add(row["license"])
        # counts of distinct are in stats; we cannot union all without storing all IDs.
    # Recompute union from stored top is insufficient. Persist license ID sets during analyze.
    # The analyze function didn't return full ID lists to keep JSON smaller; write compact ID files now from raw.

    print("writing license id sets from acquired files", flush=True)

    def collect_ids(path: Path, field: str) -> dict[str, set[str]]:
        buckets = {
            "EXACT_MATCH_ACQUIRED_CSLB": set(),
            "EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE": set(),
        }
        with path.open("r", encoding="utf-8", errors="replace", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                norm, kind = normalize_license(row.get(field))
                klass = classify_license(norm, kind, spine)
                if klass in buckets and norm:
                    buckets[klass].add(norm)
        return buckets

    cofo_ids = collect_ids(cofo_raw, "License #")
    pcis_ids = collect_ids(pcis_raw, "License #")
    union_exact = cofo_ids["EXACT_MATCH_ACQUIRED_CSLB"] | pcis_ids["EXACT_MATCH_ACQUIRED_CSLB"]
    union_outside = cofo_ids["EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE"] | pcis_ids["EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE"]
    sj_exact = set()
    sj_outside = set()
    sj_src = next(s for s in sources if s["source_id"].startswith("san-jose"))
    if sj_src.get("cslb_field") and sj_latest.exists() and "error" not in (sj_src.get("download") or {}):
        sj_ids = collect_ids(sj_latest, sj_src["cslb_field"])
        sj_exact = sj_ids["EXACT_MATCH_ACQUIRED_CSLB"]
        sj_outside = sj_ids["EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE"]
        union_exact |= sj_exact
        union_outside |= sj_outside

    write_json(
        OUT_BOTH / "exact-cslb-id-sets.json",
        {
            "acquired_cslb_spine_licenses": len(spine),
            "spine_coverage": "ACQUIRED_PARTIAL_STREAM_TRUNCATED",
            "complete_statewide_renewable_denominator": "UNKNOWN",
            "city_of_la_cofo_exact_match_licenses": len(cofo_ids["EXACT_MATCH_ACQUIRED_CSLB"]),
            "city_of_la_cofo_outside_partial_spine_licenses": len(cofo_ids["EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE"]),
            "city_of_la_pcis_exact_match_licenses": len(pcis_ids["EXACT_MATCH_ACQUIRED_CSLB"]),
            "city_of_la_pcis_outside_partial_spine_licenses": len(pcis_ids["EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE"]),
            "san_jose_exact_match_licenses": len(sj_exact),
            "san_jose_outside_partial_spine_licenses": len(sj_outside),
            "union_exact_match_licenses": len(union_exact),
            "union_outside_partial_spine_licenses": len(union_outside),
            "note": "Outside-partial-spine exact IDs are not invalid and are not unlicensed.",
        },
    )

    skipped = [
        "Other incorporated LA cities besides City of Los Angeles",
        "Other Santa Clara municipalities besides City of San Jose",
        "Orange / Alameda / Sacramento / Riverside / San Bernardino",
        "Recorder document crawl / owner-person dossiers",
        "EPIC-LA search portal scrape",
        "DCBA individual-case retrieval",
        "11.7 million inspection-row dump",
        "LA County parcel GDB/shapefile binaries",
        "Santa Clara parcel geometries",
        "CAPTCHA / browser automation / PRA waiting",
        "Name-only contractor auto-attach",
    ]

    publication = {
        "los_angeles_county": "KEEP_DATA_ONLY",
        "city_of_los_angeles": "PUBLISH_CITY_MARKET_MODULE",
        "unincorporated_los_angeles_county": "PARK",
        "santa_clara_county": "KEEP_DATA_ONLY",
        "city_of_san_jose": "PUBLISH_LIGHT_MARKET_MODULE" if (sj_stats or {}).get("rows_total") else "PARK",
        "no_routes_this_ticket": [
            "/california/los-angeles-county",
            "/california/santa-clara-county",
            "/california/los-angeles",
            "/california/san-jose",
        ],
        "by_hub": {
            "CONTRACTOR": "City of LA exact CSLB permit/CofO activity is the moat. San Jose monthly file is a light follow-up if license column exists.",
            "LENDER": "LA/SC parcels + valuations. No ingest of giant GDB here.",
            "SENIOR": "SC food-facility inspections are identity/inspection context only — not RCFE quality.",
            "MOVE": "DCBA bulk not found. PARK.",
            "INSURANCE": "Parcel use/year-built/hazard context later. No ingest.",
            "INVESTOR": "Parcel/development market context later. No ingest.",
            "ASK_NETWORK": "State-level California gateway remains; no CA county Ask pages.",
        },
    }

    write_json(
        OUT_BOTH / "source-manifest.json",
        {
            "ticket": "CA-CON-COUNTY-001B",
            "retrieved_at": retrieved_at,
            "namespaces": ["la-sc", "los-angeles", "santa-clara"],
            "builder3_namespaces_untouched": ["sf-sd", "san-francisco", "san-diego"],
            "cslb_spine": {
                "license_rows": len(spine),
                "coverage": "ACQUIRED_PARTIAL_STREAM_TRUNCATED",
                "complete_renewable_denominator": "UNKNOWN",
            },
            "sources": [
                {k: v for k, v in s.items() if k not in {"stats", "gis", "download", "layout", "profile", "probe"}}
                | {"stats_ref": bool(s.get("stats")), "rows": s.get("rows") or (s.get("stats") or {}).get("rows_total")}
                for s in sources
            ],
        },
    )
    write_json(OUT_LA / "source-manifest.json", {"ticket": "CA-CON-COUNTY-001B", "sources": [s for s in sources if "los-angeles" in json.dumps(s).lower() or s["jurisdiction"].startswith("CITY_OF_LOS") or s["jurisdiction"].startswith("LOS_ANGELES") or s["jurisdiction"].startswith("UNINCORPORATED_LOS")]})
    write_json(OUT_SC / "source-manifest.json", {"ticket": "CA-CON-COUNTY-001B", "sources": [s for s in sources if "SANTA_CLARA" in s["jurisdiction"] or "SAN_JOSE" in s["jurisdiction"]]})
    write_json(OUT_LA / "permit-cslb-join-report.json", {"cofo": cofo_stats, "pcis_derived": pcis_stats})
    write_json(OUT_LA / "issued-2020-present-profile.json", sources[2])
    write_json(OUT_LA / "inspections-profile.json", sources[3])
    write_json(OUT_LA / "gis-parcels-profile.json", parcel)
    write_json(OUT_LA / "epic-la-probe.json", epic)
    write_json(OUT_LA / "dcba-probe.json", dcba)
    write_json(OUT_SC / "san-jose-permit-file-report.json", sj_src)
    write_json(OUT_SC / "parcels-profile.json", next(s for s in sources if s["source_id"].startswith("santa-clara-county-parcels")))
    write_json(OUT_BOTH / "skipped.json", skipped)
    write_json(OUT_BOTH / "publication-decision.json", publication)
    write_json(
        OUT_BOTH / "union-attribution.json",
        {
            "union_exact_match_licenses": len(union_exact),
            "union_outside_partial_spine_licenses": len(union_outside),
            "cofo_exact_rows": cofo_stats["exact_acquired_cslb_rows"],
            "pcis_exact_rows": pcis_stats["exact_acquired_cslb_rows"],
            "cofo_outside_rows": cofo_stats["outside_partial_spine_rows"],
            "pcis_outside_rows": pcis_stats["outside_partial_spine_rows"],
            "safe_work_activity_definition": "Permit/CofO rows with EXACT_MATCH_ACQUIRED_CSLB. PERMIT ACTIVITY != QUALITY.",
        },
    )

    # Keep per-source stats for the markdown report.
    write_json(OUT_BOTH / "full-source-bundle.json", sources)

    print("HARVEST_DONE", flush=True)
    print(
        json.dumps(
            {
                "spine": len(spine),
                "cofo_rows": cofo_stats["rows_total"],
                "cofo_exact_licenses": cofo_stats["exact_acquired_cslb_licenses"],
                "pcis_rows": pcis_stats["rows_total"],
                "pcis_exact_licenses": pcis_stats["exact_acquired_cslb_licenses"],
                "union_exact": len(union_exact),
                "union_outside": len(union_outside),
            }
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
