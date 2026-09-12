#!/usr/bin/env python3
"""Acquire NYC DCWP HIC license spine and HIC-relevant complaint/inspection/charge observations."""
from __future__ import annotations

import hashlib
import json
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "new-york" / "nyc-con-001"
OUT.mkdir(parents=True, exist_ok=True)
UA = "ContractorTrustHub-NYC-CON-001A/1.0"
BASE = "https://data.cityofnewyork.us"
HIC = "Home Improvement Contractor"
PAGE = 50000


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def get_bytes(url: str) -> tuple[bytes, int]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read(), int(resp.status)


def soda_page(dataset_id: str, where: str, offset: int) -> list[dict]:
    q = urllib.parse.urlencode(
        {"$where": where, "$limit": str(PAGE), "$offset": str(offset), "$order": ":id"}
    )
    raw, status = get_bytes(f"{BASE}/resource/{dataset_id}.json?{q}")
    if status != 200:
        raise SystemExit(f"{dataset_id} HTTP {status}")
    rows = json.loads(raw.decode("utf-8"))
    if not isinstance(rows, list):
        raise SystemExit(f"{dataset_id} unexpected payload")
    return rows


def soda_all(dataset_id: str, where: str) -> tuple[list[dict], dict]:
    retrieved_at = utc_now()
    rows: list[dict] = []
    offset = 0
    first_status = 200
    while True:
        chunk = soda_page(dataset_id, where, offset)
        rows.extend(chunk)
        print(f"  {dataset_id} +{len(chunk)} total={len(rows)}")
        if len(chunk) < PAGE:
            break
        offset += PAGE
        time.sleep(0.2)
    raw = json.dumps(rows, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    meta = get_bytes(f"{BASE}/api/views/{dataset_id}.json")[0]
    view = json.loads(meta.decode("utf-8"))
    return rows, {
        "dataset_id": dataset_id,
        "source_url": f"{BASE}/Business/_/{dataset_id}",
        "resource_url": f"{BASE}/resource/{dataset_id}.json",
        "where": where,
        "pagination": {"limit": PAGE, "method": "offset", "order": ":id"},
        "http_status": first_status,
        "retrievedAt": retrieved_at,
        "rowsUpdatedAt_unix": view.get("rowsUpdatedAt"),
        "rowsUpdatedAt": (
            datetime.fromtimestamp(int(view["rowsUpdatedAt"]), tz=timezone.utc)
            .date()
            .isoformat()
            if view.get("rowsUpdatedAt")
            else None
        ),
        "viewLastModified_unix": view.get("viewLastModified"),
        "attribution": view.get("attribution"),
        "dataset_name": view.get("name"),
        "raw_rows": len(rows),
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
        "raw_bytes": len(raw),
    }


def blank(value: object) -> bool:
    return value is None or str(value).strip() == ""


def count_dist(rows: list[dict], field: str) -> dict[str, int]:
    c: Counter[str] = Counter()
    for row in rows:
        key = str(row.get(field) or "").strip() or "(blank)"
        c[key] += 1
    return dict(c.most_common())


def uniq(rows: list[dict], field: str) -> set[str]:
    return {str(row.get(field)).strip() for row in rows if not blank(row.get(field))}


def dups(rows: list[dict], field: str) -> int:
    c: Counter[str] = Counter()
    for row in rows:
        if blank(row.get(field)):
            continue
        c[str(row.get(field)).strip()] += 1
    return sum(n - 1 for n in c.values() if n > 1)


def min_max_date(rows: list[dict], field: str) -> tuple[str | None, str | None]:
    vals = []
    for row in rows:
        raw = str(row.get(field) or "")[:10]
        if len(raw) == 10 and raw[4] == "-":
            vals.append(raw)
    if not vals:
        return None, None
    return min(vals), max(vals)


def nyc_borough(value: str) -> bool:
    return value.strip().lower() in {"manhattan", "brooklyn", "queens", "bronx", "staten island"}


def main() -> None:
    print("licenses")
    licenses, lic_meta = soda_all("w7w3-xahh", f"business_category='{HIC}'")
    print("complaints")
    complaints, cmp_meta = soda_all("nre2-6m2s", f"business_category='{HIC}'")
    print("charges")
    charges, chg_meta = soda_all("5fn4-dr26", f"business_category='{HIC}'")
    print("inspections")
    inspections, ins_meta = soda_all(
        "jzhd-m6uv",
        "business_category='Home Improvement Contractor' OR business_category='Home Improvement Contractor - 100'",
    )

    for name, rows in [
        ("licenses.json", licenses),
        ("complaints.json", complaints),
        ("charges.json", charges),
        ("inspections.json", inspections),
    ]:
        (OUT / name).write_text(json.dumps(rows, ensure_ascii=True) + "\n", encoding="utf-8")

    lic_ids = uniq(licenses, "license_nbr")
    buids = uniq(licenses, "business_unique_id")
    active = [r for r in licenses if str(r.get("license_status") or "").strip() == "Active"]
    active_ids = uniq(active, "license_nbr")
    active_buids = uniq(active, "business_unique_id")

    cmp_buids = uniq(complaints, "business_unique_id")
    chg_buids = uniq(charges, "business_unique_id")
    ins_buids = uniq(inspections, "business_unique_id")
    ins_lics = uniq(inspections, "dcwp_license_number")
    cmp_lics = uniq(complaints, "license_nbr") if any("license_nbr" in r for r in complaints[:5]) else set()

    exact_buid_complaints = {b for b in cmp_buids if b in buids}
    exact_buid_charges = {b for b in chg_buids if b in buids}
    exact_buid_inspections = {b for b in ins_buids if b in buids}
    exact_lic_inspections = {n for n in ins_lics if n in lic_ids}

    name_conflicts = 0
    by_buid: dict[str, set[str]] = {}
    for row in licenses:
        buid = str(row.get("business_unique_id") or "").strip()
        name = str(row.get("business_name") or "").strip().upper()
        if not buid or not name:
            continue
        by_buid.setdefault(buid, set()).add(name)
    for names in by_buid.values():
        if len(names) > 1:
            name_conflicts += 1

    boroughs = count_dist(licenses, "address_borough")
    nyc_addr = sum(n for k, n in boroughs.items() if nyc_borough(k))
    out_nyc = len(licenses) - nyc_addr

    report = {
        "ticket": "NYC-CON-001A",
        "snapshot_version": "contractor-nyc-dcwp-intel-v1",
        "official_parent_dataset": "w7w3-xahh",
        "did_not_use_community_filtered_view": True,
        "hic_business_category": HIC,
        "inspection_category_variants": [
            "Home Improvement Contractor",
            "Home Improvement Contractor - 100",
        ],
        "acquired_at": utc_now(),
        "licenses": {
            **lic_meta,
            "parsed_rows": len(licenses),
            "rejected_rows": 0,
            "distinct_license_ids": len(lic_ids),
            "rows_without_license_nbr": sum(1 for r in licenses if blank(r.get("license_nbr"))),
            "rows_without_business_unique_id": sum(1 for r in licenses if blank(r.get("business_unique_id"))),
            "duplicate_extra_license_nbr_rows": dups(licenses, "license_nbr"),
            "duplicate_extra_business_unique_id_rows": dups(licenses, "business_unique_id"),
            "distinct_business_unique_ids": len(buids),
            "license_status_counts": count_dist(licenses, "license_status"),
            "license_type_counts": count_dist(licenses, "license_type"),
            "borough_counts": boroughs,
            "nyc_borough_address_rows": nyc_addr,
            "non_nyc_borough_address_rows": out_nyc,
            "active_rows": len(active),
            "active_distinct_license_ids": len(active_ids),
            "active_distinct_business_unique_ids": len(active_buids),
            "buid_name_conflicts": name_conflicts,
            "business_address_ne_service_territory": True,
        },
        "complaints": {
            **cmp_meta,
            "parsed_rows": len(complaints),
            "rejected_rows": 0,
            "distinct_record_ids": len(uniq(complaints, "record_id")),
            "rows_without_business_unique_id": sum(1 for r in complaints if blank(r.get("business_unique_id"))),
            "distinct_business_unique_ids": len(cmp_buids),
            "result_counts": count_dist(complaints, "result"),
            "intake_min": min_max_date(complaints, "intake_date")[0],
            "intake_max": min_max_date(complaints, "intake_date")[1],
            "no_license_nbr_field": True,
        },
        "charges": {
            **chg_meta,
            "parsed_rows": len(charges),
            "rejected_rows": 0,
            "distinct_record_ids": len(uniq(charges, "record_id")),
            "rows_without_business_unique_id": sum(1 for r in charges if blank(r.get("business_unique_id"))),
            "distinct_business_unique_ids": len(chg_buids),
            "outcome_counts": count_dist(charges, "outcome"),
            "related_record_type_counts": count_dist(charges, "related_record_type"),
            "violation_date_min": min_max_date(charges, "violation_date")[0],
            "violation_date_max": min_max_date(charges, "violation_date")[1],
        },
        "inspections": {
            **ins_meta,
            "parsed_rows": len(inspections),
            "rejected_rows": 0,
            "distinct_inspection_numbers": len(uniq(inspections, "inspection_number")),
            "rows_without_business_unique_id": sum(1 for r in inspections if blank(r.get("business_unique_id"))),
            "rows_without_dcwp_license_number": sum(1 for r in inspections if blank(r.get("dcwp_license_number"))),
            "distinct_business_unique_ids": len(ins_buids),
            "inspection_type_counts": count_dist(inspections, "inspection_type"),
            "inspection_status_counts": count_dist(inspections, "inspection_status"),
            "business_category_counts": count_dist(inspections, "business_category"),
            "rows_with_bbl": sum(1 for r in inspections if not blank(r.get("bbl"))),
            "rows_with_bin": sum(1 for r in inspections if not blank(r.get("bin"))),
            "date_min": min_max_date(inspections, "date_of_occurrence")[0],
            "date_max": min_max_date(inspections, "date_of_occurrence")[1],
        },
        "linking": {
            "license_buids": len(buids),
            "complaint_buids": len(cmp_buids),
            "charge_buids": len(chg_buids),
            "inspection_buids": len(ins_buids),
            "exact_buid_license_complaint": len(exact_buid_complaints),
            "exact_buid_license_charge": len(exact_buid_charges),
            "exact_buid_license_inspection": len(exact_buid_inspections),
            "exact_license_nbr_license_inspection": len(exact_lic_inspections),
            "complaint_buids_not_in_hic_licenses": len(cmp_buids - buids),
            "charge_buids_not_in_hic_licenses": len(chg_buids - buids),
            "inspection_buids_not_in_hic_licenses": len(ins_buids - buids),
            "name_only": "UNSAFE",
            "name_plus_address": "REVIEW_REQUIRED",
        },
        "no_dob_pluto": True,
        "no_acris": True,
        "no_westchester": True,
        "no_borough_pages": True,
    }
    (OUT / "acquire-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "licenses": len(licenses),
        "active": len(active),
        "buids": len(buids),
        "complaints": len(complaints),
        "charges": len(charges),
        "inspections": len(inspections),
        "exact_buid_complaint": len(exact_buid_complaints),
        "exact_buid_charge": len(exact_buid_charges),
        "exact_buid_inspection": len(exact_buid_inspections),
    }, indent=2))


if __name__ == "__main__":
    main()
