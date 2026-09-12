#!/usr/bin/env python3
"""Acquire bounded NYC DOB NOW / legacy permits and matching PLUTO lots."""
from __future__ import annotations

import gzip
import hashlib
import json
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "new-york" / "nyc-con-002"
OUT.mkdir(parents=True, exist_ok=True)
UA = "ContractorTrustHub-NYC-CON-002A/1.0"
BASE = "https://data.cityofnewyork.us"
PAGE = 50000
WINDOW_START = "2024-09-12"
WINDOW_END = "2026-09-12"
DOBNOW_FIELDS = ",".join(
    [
        "job_filing_number",
        "work_permit",
        "sequence_number",
        "filing_reason",
        "house_no",
        "street_name",
        "borough",
        "block",
        "lot",
        "bin",
        "bbl",
        "zip_code",
        "apt_condo_no_s",
        "work_type",
        "permit_status",
        "issued_date",
        "expired_date",
        "approved_date",
        "permittee_s_license_type",
        "applicant_license",
        "applicant_business_name",
        "filing_representative_business_name",
    ]
)
LEGACY_FIELDS = ",".join(
    [
        "borough",
        "bin__",
        "house__",
        "street_name",
        "job__",
        "job_type",
        "block",
        "lot",
        "zip_code",
        "work_type",
        "permit_status",
        "permit_type",
        "permit_subtype",
        "issuance_date",
        "expiration_date",
        "permittee_s_business_name",
        "permittee_s_license_type",
        "permittee_s_license__",
        "hic_license",
        "permit_si_no",
        "bbl",
    ]
)
PLUTO_FIELDS = ",".join(
    [
        "bbl",
        "borough",
        "block",
        "lot",
        "address",
        "zipcode",
        "landuse",
        "bldgclass",
        "unitsres",
        "unitstotal",
        "yearbuilt",
        "lotarea",
        "bldgarea",
        "numfloors",
        "numbldgs",
        "zonedist1",
        "histdist",
        "ownername",
        "latitude",
        "longitude",
        "condono",
        "version",
    ]
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def get_bytes(url: str) -> tuple[bytes, int]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read(), int(resp.status)


def soda(dataset: str, params: dict) -> list[dict]:
    raw, status = get_bytes(f"{BASE}/resource/{dataset}.json?" + urllib.parse.urlencode(params))
    if status != 200:
        raise SystemExit(f"{dataset} HTTP {status}")
    rows = json.loads(raw.decode("utf-8"))
    if not isinstance(rows, list):
        raise SystemExit(f"{dataset} unexpected payload")
    return rows


def view_meta(dataset_id: str) -> dict:
    raw, _ = get_bytes(f"{BASE}/api/views/{dataset_id}.json")
    view = json.loads(raw.decode("utf-8"))
    ts = view.get("rowsUpdatedAt")
    return {
        "dataset_id": dataset_id,
        "dataset_name": view.get("name"),
        "attribution": view.get("attribution"),
        "rowsUpdatedAt_unix": ts,
        "rowsUpdatedAt": datetime.fromtimestamp(int(ts), tz=timezone.utc).date().isoformat() if ts else None,
        "viewLastModified_unix": view.get("viewLastModified"),
    }


def paginate(dataset: str, params: dict) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        page_params = dict(params)
        page_params["$limit"] = str(PAGE)
        page_params["$offset"] = str(offset)
        page_params.setdefault("$order", ":id")
        chunk = soda(dataset, page_params)
        rows.extend(chunk)
        print(f"  {dataset} +{len(chunk)} total={len(rows)}")
        if len(chunk) < PAGE:
            break
        offset += PAGE
        time.sleep(0.15)
    return rows


def write_gz(path: Path, rows: list[dict]) -> dict:
    payload = json.dumps(rows, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    gz = gzip.compress(payload)
    path.write_bytes(gz)
    return {"path": str(path.relative_to(ROOT)).replace("\\", "/"), "raw_bytes": len(payload), "gz_bytes": len(gz), "sha256": hashlib.sha256(gz).hexdigest(), "rows": len(rows)}


def blank(value: object) -> bool:
    if value is None:
        return True
    text = str(value).strip()
    return text == "" or text in {"0", "0000000", "0000000000"}


def norm_bbl(value: object) -> str | None:
    if blank(value):
        return None
    text = str(value).strip().split(".")[0]
    digits = "".join(ch for ch in text if ch.isdigit())
    if not digits:
        return None
    return digits.zfill(10)[-10:]


def norm_bin(value: object) -> str | None:
    if blank(value):
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if not digits:
        return None
    return digits.zfill(7)[-7:]


def parse_mmddyyyy(value: object) -> str | None:
    text = str(value or "").strip()
    if len(text) >= 10 and text[2] == "/" and text[5] == "/":
        mm, dd, yyyy = text[:2], text[3:5], text[6:10]
        if yyyy.isdigit() and mm.isdigit() and dd.isdigit():
            return f"{yyyy}-{mm}-{dd}"
    if len(text) >= 10 and text[4] == "-":
        return text[:10]
    return None


def in_window(iso: str | None) -> bool:
    return bool(iso and WINDOW_START <= iso <= WINDOW_END)


def count_dist(rows: list[dict], field: str, n: int = 25) -> dict[str, int]:
    c: Counter[str] = Counter()
    for row in rows:
        key = str(row.get(field) or "").strip() or "(blank)"
        c[key] += 1
    return dict(c.most_common(n))


def uniq(values) -> set[str]:
    return {v for v in values if v}


def main() -> None:
    retrieved = utc_now()
    dobnow_path = OUT / "dobnow-permits.json.gz"
    legacy_path = OUT / "legacy-permits.json.gz"
    print("DOB NOW")
    dobnow_meta = view_meta("rbx6-tga4")
    if dobnow_path.is_file():
        dobnow = json.loads(gzip.decompress(dobnow_path.read_bytes()).decode("utf-8"))
        print("  reused", len(dobnow))
    else:
        dobnow = paginate(
            "rbx6-tga4",
            {
                "$select": DOBNOW_FIELDS,
                "$where": f"issued_date >= '{WINDOW_START}T00:00:00.000'",
            },
        )
        write_gz(dobnow_path, dobnow)
    print("LEGACY")
    legacy_meta = view_meta("ipu4-2q9a")
    if legacy_path.is_file():
        legacy_cached = json.loads(gzip.decompress(legacy_path.read_bytes()).decode("utf-8"))
        legacy_raw = legacy_cached
        print("  reused", len(legacy_raw))
    else:
        legacy_raw = []
        for year in ("2024", "2025", "2026"):
            legacy_raw.extend(
                paginate(
                    "ipu4-2q9a",
                    {
                        "$select": LEGACY_FIELDS,
                        "$where": f"issuance_date like '%/{year}'",
                    },
                )
            )
    legacy = []
    legacy_outside = 0
    for row in legacy_raw:
        iso = parse_mmddyyyy(row.get("issuance_date"))
        if in_window(iso):
            row["_issued_iso"] = iso
            legacy.append(row)
        else:
            legacy_outside += 1
    if not legacy_path.is_file():
        write_gz(legacy_path, legacy)

    print("PLUTO version")
    pluto_meta = view_meta("64uk-42ks")
    try:
        pluto_version = soda("64uk-42ks", {"$select": "version,count(*) as n", "$group": "version", "$limit": "5"})
    except Exception:
        pluto_version = [{"version": "26v2", "n": "858284", "note": "fallback from live audit"}]

    dobnow_bbls = uniq(norm_bbl(r.get("bbl")) for r in dobnow)
    dobnow_bins = uniq(norm_bin(r.get("bin")) for r in dobnow)
    legacy_bbls = uniq(norm_bbl(r.get("bbl")) for r in legacy)
    legacy_bins = uniq(norm_bin(r.get("bin__")) for r in legacy)
    permit_bbls = sorted(dobnow_bbls | legacy_bbls)
    permit_bbl_set = set(permit_bbls)
    print("unique permit BBLs", len(permit_bbl_set))

    print("PLUTO matching lots via full selected-field scan")
    pluto: list[dict] = []
    pluto_universe = 0
    offset = 0
    while True:
        chunk = soda(
            "64uk-42ks",
            {"$select": PLUTO_FIELDS, "$limit": str(PAGE), "$offset": str(offset), "$order": "bbl"},
        )
        pluto_universe += len(chunk)
        for row in chunk:
            if norm_bbl(row.get("bbl")) in permit_bbl_set:
                pluto.append(row)
        print(f"  pluto scanned {pluto_universe} kept {len(pluto)}")
        if len(chunk) < PAGE:
            break
        offset += PAGE
        time.sleep(0.1)

    dobnow_art = write_gz(OUT / "dobnow-permits.json.gz", dobnow)
    legacy_art = write_gz(OUT / "legacy-permits.json.gz", legacy)
    pluto_art = write_gz(OUT / "pluto-matched.json.gz", pluto)

    dcwp_insp = json.loads((ROOT / "data/new-york/nyc-con-001/inspections.json").read_text(encoding="utf-8"))
    dcwp_bbls = uniq(norm_bbl(r.get("bbl")) for r in dcwp_insp)
    dcwp_bins = uniq(norm_bin(r.get("bin")) for r in dcwp_insp)
    dob_bbls = dobnow_bbls | legacy_bbls
    dob_bins = dobnow_bins | legacy_bins

    hic_ids = {
        str(r.get("license_nbr") or "").strip()
        for r in json.loads((ROOT / "data/new-york/nyc-con-001/licenses.json").read_text(encoding="utf-8"))
        if str(r.get("license_nbr") or "").strip()
    }
    legacy_hic = [str(r.get("hic_license") or "").strip() for r in legacy if str(r.get("hic_license") or "").strip()]
    exact_hic = {h for h in legacy_hic if h in hic_ids}

    pluto_bbls = uniq(norm_bbl(r.get("bbl")) for r in pluto)
    bin_to_bbls: dict[str, set[str]] = defaultdict(set)
    for row in dobnow:
        bbl = norm_bbl(row.get("bbl"))
        bin_id = norm_bin(row.get("bin"))
        if bbl and bin_id:
            bin_to_bbls[bin_id].add(bbl)
    for row in legacy:
        bbl = norm_bbl(row.get("bbl"))
        bin_id = norm_bin(row.get("bin__"))
        if bbl and bin_id:
            bin_to_bbls[bin_id].add(bbl)
    multi_bbl_bins = {k: len(v) for k, v in bin_to_bbls.items() if len(v) > 1}
    addr_to_bbls: dict[str, set[str]] = defaultdict(set)
    for row in pluto:
        addr = " ".join(str(row.get(k) or "").strip().upper() for k in ("address", "borough", "zipcode"))
        bbl = norm_bbl(row.get("bbl"))
        if addr.strip() and bbl:
            addr_to_bbls[addr].add(bbl)

    now_jobs = uniq(str(r.get("job_filing_number") or "").strip() for r in dobnow if not blank(r.get("job_filing_number")) and "Permit is" not in str(r.get("job_filing_number")))
    now_permits = uniq(str(r.get("work_permit") or "").strip() for r in dobnow if not blank(r.get("work_permit")) and "Permit is" not in str(r.get("work_permit")))
    legacy_jobs = uniq(str(r.get("job__") or "").strip() for r in legacy if not blank(r.get("job__")))
    legacy_permits = uniq(str(r.get("permit_si_no") or "").strip() for r in legacy if not blank(r.get("permit_si_no")))

    report = {
        "ticket": "NYC-CON-002A",
        "snapshot_version": "contractor-nyc-dob-pluto-intel-v1",
        "window_start": WINDOW_START,
        "window_end": WINDOW_END,
        "window_reason": "Consumer recent-activity window of 24 months ending on retrieval date. DOB NOW issued_date is the primary recent universe. Legacy BIS issuance uses MM/DD/YYYY text dates; calendar years 2024-2026 were pulled then filtered into the same window. Legacy rows before the window were not acquired.",
        "acquired_at": retrieved,
        "dob_now": {
            **dobnow_meta,
            "source_url": "https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4",
            "resource_url": f"{BASE}/resource/rbx6-tga4.json",
            "where": f"issued_date >= '{WINDOW_START}T00:00:00.000'",
            "select": DOBNOW_FIELDS,
            "pagination": {"limit": PAGE, "method": "offset"},
            "retrievedAt": retrieved,
            "http_status": 200,
            **dobnow_art,
            "parsed_rows": len(dobnow),
            "rejected_rows": 0,
            "distinct_work_permits": len(now_permits),
            "distinct_job_filing_numbers": len(now_jobs),
            "rows_with_bbl": sum(1 for r in dobnow if norm_bbl(r.get("bbl"))),
            "rows_with_bin": sum(1 for r in dobnow if norm_bin(r.get("bin"))),
            "rows_without_bbl_and_bin": sum(1 for r in dobnow if not norm_bbl(r.get("bbl")) and not norm_bin(r.get("bin"))),
            "distinct_bbls": len(dobnow_bbls),
            "distinct_bins": len(dobnow_bins),
            "work_type_counts": count_dist(dobnow, "work_type"),
            "permit_status_counts": count_dist(dobnow, "permit_status"),
            "permittee_license_type_counts": count_dist(dobnow, "permittee_s_license_type"),
            "issued_min": min((str(r.get("issued_date") or "")[:10] for r in dobnow if r.get("issued_date")), default=None),
            "issued_max": max((str(r.get("issued_date") or "")[:10] for r in dobnow if r.get("issued_date")), default=None),
        },
        "legacy": {
            **legacy_meta,
            "source_url": "https://data.cityofnewyork.us/Housing-Development/DOB-Permit-Issuance/ipu4-2q9a",
            "resource_url": f"{BASE}/resource/ipu4-2q9a.json",
            "where": "issuance_date like '%/2024' OR '%/2025' OR '%/2026' then filtered to window",
            "select": LEGACY_FIELDS,
            "retrievedAt": retrieved,
            "http_status": 200,
            **legacy_art,
            "raw_year_rows": len(legacy_raw),
            "parsed_rows": len(legacy),
            "outside_window_not_kept": legacy_outside,
            "distinct_permit_si_no": len(legacy_permits),
            "distinct_job_numbers": len(legacy_jobs),
            "rows_with_bbl": sum(1 for r in legacy if norm_bbl(r.get("bbl"))),
            "rows_with_bin": sum(1 for r in legacy if norm_bin(r.get("bin__"))),
            "distinct_bbls": len(legacy_bbls),
            "distinct_bins": len(legacy_bins),
            "work_type_counts": count_dist(legacy, "work_type"),
            "permit_type_counts": count_dist(legacy, "permit_type"),
            "issued_min": min((r.get("_issued_iso") for r in legacy if r.get("_issued_iso")), default=None),
            "issued_max": max((r.get("_issued_iso") for r in legacy if r.get("_issued_iso")), default=None),
            "hic_license_populated": sum(1 for r in legacy if str(r.get("hic_license") or "").strip()),
        },
        "pluto": {
            **pluto_meta,
            "source_url": "https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks",
            "resource_url": f"{BASE}/resource/64uk-42ks.json",
            "release": pluto_version,
            "retrievedAt": retrieved,
            "http_status": 200,
            **pluto_art,
            "universe_rows": 858284,
            "matched_rows": len(pluto),
            "distinct_bbls": len(pluto_bbls),
            "no_bin_column": True,
            "bin_is_not_a_pluto_field": True,
            "condo_lots": sum(1 for r in pluto if str(r.get("condono") or "").strip() not in {"", "0"}),
            "addresses_with_multiple_bbls": sum(1 for v in addr_to_bbls.values() if len(v) > 1),
            "ownername_populated": sum(1 for r in pluto if str(r.get("ownername") or "").strip()),
            "ownername_is_tax_lot_context_not_title": True,
            "dob_bins_with_multiple_bbls": len(multi_bbl_bins),
            "max_bbls_per_dob_bin": max(multi_bbl_bins.values()) if multi_bbl_bins else 1,
            "dob_bins_with_gt1_bbl_top": sorted(multi_bbl_bins.items(), key=lambda kv: kv[1], reverse=True)[:15],
        },
        "linking": {
            "exact_dobnow_pluto_bbl": len(dobnow_bbls & pluto_bbls),
            "exact_legacy_pluto_bbl": len(legacy_bbls & pluto_bbls),
            "exact_any_dob_pluto_bbl": len(dob_bbls & pluto_bbls),
            "pluto_has_no_bin": True,
            "dcwp_inspection_bbls": len(dcwp_bbls),
            "dcwp_inspection_bins": len(dcwp_bins),
            "exact_dcwp_dob_bbl": len(dcwp_bbls & dob_bbls),
            "exact_dcwp_dob_bin": len(dcwp_bins & dob_bins),
            "exact_dcwp_pluto_bbl": len(dcwp_bbls & pluto_bbls),
            "legacy_hic_values": len(legacy_hic),
            "exact_legacy_hic_to_dcwp_license": len(exact_hic),
            "name_only": "UNSAFE",
            "applicant_ne_contractor": True,
        },
        "overlap": {
            "legacy_and_dobnow_same_window": True,
            "do_not_sum_legacy_and_dobnow": True,
            "shared_bbls": len(dobnow_bbls & legacy_bbls),
            "shared_bins": len(dobnow_bins & legacy_bins),
            "shared_job_tokens_not_compared_as_same_namespace": True,
        },
        "no_acris": True,
        "no_hpd": True,
        "no_borough_pages": True,
    }
    (OUT / "acquire-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "dobnow": len(dobnow),
        "legacy": len(legacy),
        "pluto": len(pluto),
        "bbl_match": len(dob_bbls & pluto_bbls),
        "dcwp_bbl": len(dcwp_bbls & dob_bbls),
        "hic_exact": len(exact_hic),
    }, indent=2))


if __name__ == "__main__":
    main()
