"""CA-CON-COUNTY-002 — accepted local snapshot + compact exact CSLB activity index."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

csv.field_size_limit(min(2**31 - 1, 128 * 1024 * 1024))

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "lib" / "california-intelligence" / "local"
VERSION = "contractor-ca-local-intel-v1"
LIC_RE = re.compile(r"\b(\d{5,8})\b")
SF_CONTACTS = Path(
    r"C:\Users\Michael.Savitsky\contractor-ca-con-county-001a\data\raw\california\counties\san-francisco\3pee-9qhc-building-permit-contacts.csv"
)
LA_COFO = Path(
    r"C:\Users\Michael.Savitsky\contractor-ca-con-county-001b\data\raw\california\counties\los-angeles\ladbs_certificate_of_occupancy.csv"
)
LA_PCIS = Path(
    r"C:\Users\Michael.Savitsky\contractor-ca-con-county-001b\data\raw\california\counties\los-angeles\ladbs_permit_information_d9aa_v8bm.csv"
)


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    return hashlib.sha256(dump(body).encode("utf-8")).hexdigest()


def load_json(rel: str) -> dict:
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def spine_licenses() -> set[str]:
    inv = json.loads((ROOT / "public" / "california-inventory.json").read_text(encoding="utf-8"))
    return {row[0] for row in inv["rows"] if row and row[0]}


def getf(row: dict, *names: str) -> str:
    keys = {k.strip().lower().replace(" ", "_").replace("#", "number"): k for k in row}
    for name in names:
        if name in row and row[name] is not None:
            return str(row[name]).strip()
        slug = name.strip().lower().replace(" ", "_").replace("#", "number")
        if slug in keys:
            val = row.get(keys[slug])
            if val is not None:
                return str(val).strip()
    return ""


def parse_date(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    s = s.split(" ")[0].replace(".", "/").replace("-", "/")
    parts = s.split("/")
    if len(parts) == 3:
        a, b, c = parts
        if len(a) == 4:
            return f"{a}-{b.zfill(2)}-{c.zfill(2)}"
        if len(c) == 4:
            return f"{c}-{a.zfill(2)}-{b.zfill(2)}"
        if len(c) == 2:
            year = int(c)
            year += 2000 if year < 70 else 1900
            return f"{year}-{a.zfill(2)}-{b.zfill(2)}"
    return s[:10]


def bump(rec: dict, prefix: str, permit: str, date: str) -> None:
    rec[f"{prefix}_rows"] = rec.get(f"{prefix}_rows", 0) + 1
    if permit:
        rec.setdefault(f"{prefix}_permits", set()).add(permit)
    d = parse_date(date)
    if d:
        rec[f"{prefix}_first"] = d if not rec.get(f"{prefix}_first") or d < rec[f"{prefix}_first"] else rec[f"{prefix}_first"]
        rec[f"{prefix}_last"] = d if not rec.get(f"{prefix}_last") or d > rec[f"{prefix}_last"] else rec[f"{prefix}_last"]


def build_index(spine: set[str]) -> dict:
    store: dict[str, dict] = {}

    def rec(lic: str) -> dict:
        row = store.get(lic)
        if row is None:
            row = {"spine": lic in spine}
            store[lic] = row
        return row

    if SF_CONTACTS.exists():
        print("index SF contacts", flush=True)
        with SF_CONTACTS.open(newline="", encoding="utf-8", errors="replace") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                permit = getf(row, "Permit Number", "permit_number")
                date = getf(row, "From Date", "from_date")
                for key in ("License1", "License2", "license1", "license2"):
                    for lic in LIC_RE.findall(getf(row, key)):
                        bump(rec(lic), "sf", permit, date)
    if LA_COFO.exists():
        print("index LA CofO", flush=True)
        with LA_COFO.open(newline="", encoding="utf-8", errors="replace") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                lic_raw = getf(row, "License #", "License Number", "license_number")
                found = LIC_RE.findall(lic_raw)
                if not found:
                    continue
                permit = getf(row, "PCIS Permit #", "CofO Number")
                date = getf(row, "Permit Issue Date", "CofO Issue Date", "Issue Date")
                bump(rec(found[0]), "la_cofo", permit, date)
    if LA_PCIS.exists():
        print("index LA PCIS", flush=True)
        with LA_PCIS.open(newline="", encoding="utf-8", errors="replace") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                lic_raw = getf(row, "License #", "License Number", "license_number")
                found = LIC_RE.findall(lic_raw)
                if not found:
                    continue
                permit = getf(row, "PCIS Permit #")
                date = getf(row, "Issue Date", "Status Date")
                bump(rec(found[0]), "la_pcis", permit, date)

    compact = {}
    for lic, row in store.items():
        compact[lic] = {
            "spine": bool(row.get("spine")),
            "sf_contacts": int(row.get("sf_rows", 0)),
            "sf_permits": len(row.get("sf_permits") or []),
            "sf_first": row.get("sf_first") or None,
            "sf_last": row.get("sf_last") or None,
            "la_cofo": int(row.get("la_cofo_rows", 0)),
            "la_pcis": int(row.get("la_pcis_rows", 0)),
            "la_permits": len((row.get("la_cofo_permits") or set()) | (row.get("la_pcis_permits") or set())),
            "la_first": min([d for d in (row.get("la_cofo_first"), row.get("la_pcis_first")) if d] or [None]) if True else None,
            "la_last": max([d for d in (row.get("la_cofo_last"), row.get("la_pcis_last")) if d] or [None]) if True else None,
        }
        if compact[lic]["la_first"] is None:
            compact[lic]["la_first"] = None
        if compact[lic]["la_last"] is None:
            compact[lic]["la_last"] = None
    return compact


def snapshot(index: dict) -> dict:
    sf = load_json("data/california/counties/sf-sd/harvest-report.json")
    la_join = load_json("data/california/counties/los-angeles/permit-cslb-join-report.json")
    la_cur = load_json("data/california/counties/los-angeles/issued-2020-present-profile.json")
    la_ins = load_json("data/california/counties/los-angeles/inspections-profile.json")
    union = load_json("data/california/counties/la-sc/union-attribution.json")
    sj = load_json("data/california/counties/santa-clara/san-jose-permit-file-report.json")
    sc_par = load_json("data/california/counties/santa-clara/parcels-profile.json")
    sd = sf  # same harvest report holds SD
    cofo = la_join["cofo"]
    pcis = la_join["pcis_derived"]
    body = {
        "version": VERSION,
        "ticket": "CA-CON-COUNTY-002",
        "as_of": "2026-09-03",
        "cslb_spine": {
            "rows": 75572,
            "coverage": "ACQUIRED_PARTIAL_STREAM_TRUNCATED",
            "complete_denominator": "UNKNOWN",
            "outside_partial_is_not_unlicensed": True,
        },
        "publication": {
            "dedicated": ["/california/san-francisco", "/california/los-angeles"],
            "modules_on_state_page": ["san-diego", "san-jose"],
            "parked": ["san-diego-county", "santa-clara-county", "los-angeles-county"],
            "rankings": False,
            "trustScore": False,
            "indexable": True,
            "robots": "index,follow",
        },
        "geographies": {
            "san-francisco": {
                "slug": "san-francisco",
                "display_name": "City and County of San Francisco",
                "geography_type": "CITY_COUNTY",
                "route": "/california/san-francisco",
                "surface": "DEDICATED_PAGE",
            },
            "los-angeles": {
                "slug": "los-angeles",
                "display_name": "City of Los Angeles",
                "geography_type": "CITY",
                "route": "/california/los-angeles",
                "surface": "DEDICATED_PAGE",
                "not_los_angeles_county": True,
            },
            "san-diego": {
                "slug": "san-diego",
                "display_name": "City of San Diego",
                "geography_type": "CITY",
                "route": None,
                "surface": "STATE_PAGE_MODULE",
                "not_san_diego_county": True,
            },
            "san-jose": {
                "slug": "san-jose",
                "display_name": "City of San Jose",
                "geography_type": "CITY",
                "route": None,
                "surface": "STATE_PAGE_MODULE",
                "not_santa_clara_countywide": True,
            },
        },
        "parked": {
            "san-diego-county": {
                "geography_type": "COUNTY",
                "permit_bulk": "SOURCE_NOT_ACQUIRED",
            },
            "santa-clara-county": {
                "geography_type": "COUNTY",
                "parcels": int(str(sc_par.get("rows", "504717")).replace(",", "")),
                "development_records": 30179,
                "cslb_field": False,
            },
            "los-angeles-county": {
                "geography_type": "COUNTY",
                "unincorporated": "PARK",
            },
        },
        "san_francisco": {
            "business": {
                "rows": sf["sf_registered_business"]["rows"],
                "accounts": sf["sf_registered_business"]["distinct_business_accounts"],
                "current": sf["sf_registered_business"]["current_if_no_end_and_not_admin_closed"],
                "construction_locations": sf["sf_registered_business"]["construction_related_rows"],
                "construction_accounts": sf["sf_registered_business"]["construction_related_accounts"],
                "cslb_match": sf["sf_registered_business"]["cslb_match"],
                "no_source_native_cslb": True,
                "high_confidence_is_not_license_verification": True,
            },
            "permits": {
                "rows": sf["sf_building_permits"]["rows"],
                "distinct_permit_numbers": sf["sf_building_permits"]["distinct_permit_numbers"],
                "status_top": sf["sf_building_permits"]["status_top"],
                "valuation_rows": sf["sf_building_permits"]["rows_with_valuation"],
                "parcel_rows": sf["sf_building_permits"]["rows_with_parcel_or_block_lot"],
                "completed_date_rows": sf["sf_building_permits"]["rows_with_completed_date"],
                "contractor_license_on_permit_file": 0,
                "grain": "permit at an address",
                "as_of": "2026-09-02",
            },
            "contacts": {
                "rows": sf["sf_permit_contacts"]["rows"],
                "with_license": sf["sf_permit_contacts"]["rows_with_license1_or_license2"],
                "distinct_source_licenses": sf["sf_permit_contacts"]["distinct_license_ids"],
                "exact_acquired_cslb_licenses": sf["sf_permit_contacts"]["distinct_exact_match_acquired_cslb"],
                "outside_partial_spine_licenses": sf["sf_permit_contacts"][
                    "distinct_exact_license_not_in_acquired_partial_spine"
                ],
                "contractor_role_rows": sf["sf_permit_contacts"]["contractor_role_rows"],
            },
            "inspections": {
                "rows": sf["sf_inspections"]["rows"],
                "by_reference_type": sf["sf_inspections"]["reference_number_type"],
                "result_top": sf["sf_inspections"]["result_top"],
                "attribution": "PERMIT_OR_PROPERTY_GRAIN",
                "not_contractor_passed": True,
            },
        },
        "los_angeles": {
            "cofo": {
                "rows": cofo["rows_total"],
                "source_native_cslb_rows": cofo["rows_with_source_native_license"],
                "distinct_source_licenses": cofo["distinct_source_native_licenses"],
                "exact_acquired_cslb_rows": cofo["exact_acquired_cslb_rows"],
                "exact_acquired_cslb_licenses": cofo["exact_acquired_cslb_licenses"],
                "outside_partial_rows": cofo["outside_partial_spine_rows"],
                "outside_partial_licenses": cofo["outside_partial_spine_licenses"],
                "as_of": "weekly / 2026-08-31",
                "grain": "certificate of occupancy",
            },
            "pcis": {
                "rows": pcis["rows_total"],
                "as_of": "2023-05-22",
                "stale": True,
                "source_native_cslb_rows": pcis["rows_with_source_native_license"],
                "distinct_source_licenses": pcis["distinct_source_native_licenses"],
                "exact_acquired_cslb_rows": pcis["exact_acquired_cslb_rows"],
                "exact_acquired_cslb_licenses": pcis["exact_acquired_cslb_licenses"],
                "outside_partial_rows": pcis["outside_partial_spine_rows"],
                "outside_partial_licenses": pcis["outside_partial_spine_licenses"],
                "grain": "pcis permit application",
            },
            "current_permits_2020_present": {
                "rows": int(str(la_cur["rows"]).replace(",", "")),
                "as_of": la_cur.get("source_as_of", "2026-08-31"),
                "cslb_field": None,
                "not_joined_to_stale_pcis_by_address": True,
                "grain": "issued building permit",
            },
            "inspections": {
                "rows": int(str(la_ins["rows"]).replace(",", "")),
                "as_of": la_ins.get("source_as_of", "2026-08-31"),
                "runtime_asset": False,
                "join": "permit number",
                "wording": "Inspection events associated with this permit",
                "not_contractor_quality": True,
            },
            "union": {
                "exact_acquired_cslb_licenses": union["union_exact_match_licenses"],
                "outside_partial_spine_licenses": union["union_outside_partial_spine_licenses"],
                "safely_attributable_acquired_spine_rows": {
                    "cofo": union["cofo_exact_rows"],
                    "pcis": union["pcis_exact_rows"],
                    "sources_kept_separate": True,
                },
            },
            "not_los_angeles_county": True,
        },
        "san_diego": {
            "approvals_created_2024_2026": {
                "rows": sd["sd_city_approvals"]["rows"],
                "distinct_projects": sd["sd_city_approvals"]["distinct_project_ids"],
                "with_permit_holder": sd["sd_city_approvals"]["rows_with_permit_holder"],
                "exact_acquired_cslb_rows": sd["sd_city_approvals"]["cslb_match"].get("EXACT_MATCH_ACQUIRED_CSLB", 0),
                "outside_partial_rows": sd["sd_city_approvals"]["cslb_match"].get(
                    "EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE", 0
                ),
                "source_native_exact_cslb_rows": sd["sd_city_approvals"]["cslb_match"].get("EXACT_MATCH_ACQUIRED_CSLB", 0)
                + sd["sd_city_approvals"]["cslb_match"].get("EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE", 0),
                "jurisdiction": "CITY_OF_SAN_DIEGO",
            },
            "business_tax_active": sd["sd_business_tax_active"]["rows"],
            "rental_unit_accounts": sd["sd_rental_unit_business_tax"]["rows"],
            "not_san_diego_county": True,
        },
        "san_jose": {
            "monthly_permit_rows": sj["stats"]["rows_total"],
            "contractor_name_rows": sj["stats"]["rows_with_contractor_business"],
            "source_native_cslb": 0,
            "name_only": "UNSAFE",
            "jurisdiction": "CITY_OF_SAN_JOSE",
            "not_santa_clara_countywide": True,
        },
        "exact_activity_index": {
            "licenses": len(index),
            "no_high_confidence_name_matches": True,
            "key": "CA-CSLB:{LicenseNo}",
        },
        "semantics": [
            "PERMIT ACTIVITY != QUALITY",
            "HIGH PERMIT COUNT != BETTER CONTRACTOR",
            "LOW PERMIT COUNT != INEXPERIENCED",
            "PERMIT VALUE != COMPANY REVENUE",
            "PERMIT VALUE != FINAL PROJECT COST",
            "PERMIT HOLDER != PROPERTY OWNER",
            "ISSUED != COMPLETED",
            "COMPLETED != EVERY INSPECTION PASSED",
            "INSPECTION PASSED != CONTRACTOR QUALITY",
            "FAILED INSPECTION != CONTRACTOR MISCONDUCT",
            "NO LOCAL RECORD != NO WORK",
            "EXACT LOCAL LICENSE OUTSIDE PARTIAL SPINE != UNLICENSED",
            "BUSINESS REGISTRY != CSLB LICENSE",
            "BUSINESS TAX CERTIFICATE != TRADE AUTHORIZATION",
            "NO TRUST SCORE",
            "NO RANKING",
        ],
        "profile_integration": "DEFERRED",
        "california_local_closeout": True,
    }
    fp = fingerprint(body)
    body["fingerprint"] = fp
    body["generated_at"] = datetime.now(timezone.utc).isoformat()
    return body


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print("spine", flush=True)
    spine = spine_licenses()
    print("spine", len(spine), flush=True)
    index = build_index(spine)
    print("index licenses", len(index), flush=True)
    snap = snapshot(index)
    (OUT / "accepted-snapshot.json").write_text(json.dumps(snap, indent=2) + "\n", encoding="utf-8")
    (OUT / "exact-activity-index.json").write_text(
        json.dumps({"version": VERSION, "fingerprint": snap["fingerprint"], "licenses": index}, separators=(",", ":"))
        + "\n",
        encoding="utf-8",
    )
    print("fingerprint", snap["fingerprint"])
    print("wrote", OUT)


if __name__ == "__main__":
    main()
