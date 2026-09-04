"""TX-CON-LOCAL-002 — City of Austin accepted snapshot + public company+phone identity index.

One-time build from TX-CON-LOCAL-001A harvest artifacts and the already-acquired
Austin issued-construction-permits CSV. The 1.5 GB CSV is not imported at runtime.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

csv.field_size_limit(min(2**31 - 1, 128 * 1024 * 1024))

ROOT = Path(__file__).resolve().parents[4]
RAW_CSV = Path(r"S:\ath-raw\tx-con-local-001a\austin-travis\3syk-w9eu-issued-construction-permits.csv")
HARVEST = ROOT / "data" / "texas" / "local" / "tx-local-001a" / "harvest-report.json"
HARVEST_B = ROOT / "data" / "texas" / "local" / "tx-local-001b" / "harvest-report.json"
TCAD_JOIN = ROOT / "data" / "texas" / "local" / "austin-travis" / "permit-tcad-join.json"
OUT = ROOT / "lib" / "texas-intelligence" / "local"
VERSION = "contractor-tx-austin-local-intel-v1"
RECENT_CAP = 8
EXPECTED_PUBLIC_IDENTITIES = 31908
EXPECTED_ROWS = 2_373_854
EXPECTED_SHA = "3ff78f727b98c7d8c7f6a17867e46afa133776c7fbb2b306b8b03cd9b7e53aa8"

PUNCT = re.compile(r"[^A-Z0-9 ]+")
SPACES = re.compile(r"\s+")
LEGAL = re.compile(
    r"\b(INCORPORATED|INC|LLC|L L C|CORPORATION|CORP|CO|COMPANY|LTD|LIMITED|LP|LLP|DBA|THE)\b"
)
PHONE_RE = re.compile(r"\D+")


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    return hashlib.sha256(dump(body).encode("utf-8")).hexdigest()


def nonempty(v: str | None) -> bool:
    return bool((v or "").strip())


def norm_name(value: str | None) -> str:
    s = PUNCT.sub(" ", (value or "").upper())
    s = LEGAL.sub(" ", s)
    return SPACES.sub(" ", s).strip()


def norm_phone(value: str | None) -> str:
    d = PHONE_RE.sub("", value or "")
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    return d if len(d) == 10 else ""


def parse_date(raw: str) -> str:
    s = (raw or "").strip().split(" ")[0].replace(".", "/").replace("-", "/")
    if not s:
        return ""
    parts = s.split("/")
    if len(parts) == 3:
        a, b, c = parts
        if len(a) == 4:
            return f"{a}-{b.zfill(2)}-{c.zfill(2)}"
        if len(c) == 4:
            return f"{c}-{a.zfill(2)}-{b.zfill(2)}"
    return ""


def g(row: dict, *names: str) -> str:
    for n in names:
        if n in row and row[n] is not None:
            return str(row[n]).strip()
    lower = {k.lower().replace(" ", "_"): k for k in row}
    for n in names:
        k = lower.get(n.lower().replace(" ", "_"))
        if k and row.get(k) is not None:
            return str(row[k]).strip()
    return ""


def pairs_to_obj(pairs: list) -> list[dict]:
    return [{"name": name, "rows": n} for name, n in pairs]


def build_snapshot(h: dict, hb: dict, tcad: dict, public_identities: int) -> dict:
    a = h["austin"]
    fw = h["fort_worth"]
    return {
        "version": VERSION,
        "ticket": "TX-CON-LOCAL-002",
        "as_of": "2026-09-04",
        "generated_at": h["generated_at"],
        "source_clock": {
            "harvest_ticket": "TX-CON-LOCAL-001A",
            "harvest_generated_at": h["generated_at"],
            "dataset_id": a["dataset_id"],
            "dataset_url": a["url"],
            "csv_sha256": a["sha256"],
            "csv_bytes": a["bytes"],
            "csv_rows": a["rows"],
            "grain": a["grain"],
            "runtime_csv_import": False,
            "year_range": [1921, 2026],
        },
        "publication": {
            "dedicated": ["/texas/austin"],
            "parked": ["fort-worth", "tarrant", "san-antonio", "bexar", "houston", "harris"],
            "rankings": False,
            "trustScore": False,
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/texas/austin",
            "h1": "City of Austin Contractor & Permit Intelligence",
        },
        "geographies": {
            "austin": {
                "slug": "austin",
                "display_name": "City of Austin",
                "geography_type": "CITY",
                "route": "/texas/austin",
                "surface": "DEDICATED_PAGE",
                "not_travis_county": True,
                "not_austin_metro": True,
                "not_statewide_permits": True,
            }
        },
        "austin": {
            "source": a["source"],
            "dataset_id": a["dataset_id"],
            "url": a["url"],
            "access_class": a["access_class"],
            "grain": a["grain"],
            "rows": a["rows"],
            "sha256": a["sha256"],
            "bytes": a["bytes"],
            "source_native_tdlr_or_tsbpe_id": False,
            "source_native_city_contractor_number": False,
            "license_like_columns": [],
            "exact_state_credential": 0,
            "rows_with_contractor_company": a["rows_with_contractor_company"],
            "rows_with_contractor_person_name": a["rows_with_contractor_person_name"],
            "rows_with_contractor_phone": a["rows_with_contractor_phone"],
            "rows_with_contractor_address": a["rows_with_contractor_address"],
            "rows_with_contractor_trade": a["rows_with_contractor_trade"],
            "rows_with_valuation": a["rows_with_valuation"],
            "rows_with_tcad_id": a["rows_with_tcad_id"],
            "distinct_contractor_company_values": a["distinct_contractor_company_values"],
            "distinct_normalized_company_plus_phone": a["distinct_normalized_company_plus_phone"],
            "distinct_tcad_ids": a["distinct_tcad_ids"],
            "permit_types": pairs_to_obj(a["permit_types"]),
            "status_mix": pairs_to_obj(a["status_mix"]),
            "contractor_trades": pairs_to_obj(a["contractor_trades"]),
            "permit_class_mapped": pairs_to_obj(a["permit_class_mapped"]),
            "match_class": {
                "EXACT_STATE_CREDENTIAL": 0,
                "HIGH_CONFIDENCE_BUSINESS_MATCH": a["match_class"]["HIGH_CONFIDENCE_BUSINESS_MATCH"],
                "REVIEW_REQUIRED": a["match_class"]["REVIEW_REQUIRED"],
                "UNSAFE": a["match_class"]["UNSAFE"],
                "LOCAL_ONLY_CONTRACTOR_IDENTITY": a["match_class"]["LOCAL_ONLY_CONTRACTOR_IDENTITY"],
                "NO_CONTRACTOR": a["match_class"]["NO_CONTRACTOR"],
            },
            "high_confidence_is_not_license_verification": True,
            "high_confidence_is_internal_only": True,
            "local_only_trade_breakout": a["local_only_trade_breakout"],
            "contacts": a["contacts"],
            "work_history_identities_including_person_name": a["work_history_identities"],
            "person_name_only": "REVIEW_REQUIRED_NOT_PUBLIC",
            "identity_key": "AUSTIN_PERMIT_CONTRACTOR_IDENTITY",
            "identity_key_rule": "normalized contractor company + normalized contractor phone; both required",
            "jurisdiction": "CITY_OF_AUSTIN",
            "not_travis_county": True,
            "not_austin_metro": True,
        },
        "lookup": {
            "public_identities": public_identities,
            "harvest_distinct_normalized_company_plus_phone": EXPECTED_PUBLIC_IDENTITIES,
            "placeholder_company_names_excluded": [
                "OWNER",
                "HOMEOWNER",
                "HOMESTEAD",
                "NA",
                "N A",
                "NONE",
            ],
            "identity_key": "AUSTIN_PERMIT_CONTRACTOR_IDENTITY",
            "recent_permits_per_identity": RECENT_CAP,
            "result_cap": 25,
            "sort": "alphabetical_or_query_relevance",
            "never_sort_by_permit_count": True,
            "never_sort_by_valuation": True,
            "not_a_complete_permit_directory": True,
            "person_name_only_not_public": True,
            "match_class_not_on_public_identity": True,
        },
        "state_credential": {
            "exact_state_credential": 0,
            "source_native_tdlr_or_tsbpe_id": False,
            "source_native_city_contractor_number": False,
            "high_confidence_business_match_rows": a["match_class"]["HIGH_CONFIDENCE_BUSINESS_MATCH"],
            "high_confidence_is_not_license_verification": True,
            "high_confidence_is_internal_only": True,
            "verify_tdlr": "https://www.tdlr.texas.gov/LicenseSearch/",
            "verify_tsbpe": "https://tsbpe.texas.gov/",
        },
        "local_only": {
            "rows": a["match_class"]["LOCAL_ONLY_CONTRACTOR_IDENTITY"],
            "general": a["local_only_trade_breakout"]["general"],
            "electrical": a["local_only_trade_breakout"]["electrical"],
            "plumbing": a["local_only_trade_breakout"]["plumbing"],
            "mechanical_hvac": a["local_only_trade_breakout"]["mechanical/HVAC"],
            "local_only_ne_unlicensed": True,
            "no_statewide_general_contractor_license": True,
        },
        "tcad": {
            "permit_rows_with_tcad_id": a["rows_with_tcad_id"],
            "distinct_permit_tcad_ids": tcad["permit_rows_with_tcad_id_distinct"],
            "prop_rows_scanned": tcad["prop_rows_scanned"],
            "prop_rows_with_geo_id": tcad["prop_rows_with_geo_id"],
            "exact_geo_id_joins": tcad["exact_geo_id_joins"],
            "unmatched_permit_tcad_ids": tcad["unmatched_permit_tcad_ids"],
            "join_rate": round(tcad["exact_geo_id_joins"] / tcad["permit_rows_with_tcad_id_distinct"], 4),
            "join_key": tcad["join_key"],
            "owner_dossiers": False,
            "owner_fields_not_exported": True,
            "appraisal_value_is_not_sale_price": True,
        },
        "parked": {
            "fort_worth": {
                "surface": "DATA_ONLY",
                "route": None,
                "rows": fw["rows"],
                "distinct_permit_numbers": fw["distinct_permit_numbers"],
                "contractor_company_field": False,
                "contractor_phone_field": False,
                "contractor_license_field": False,
                "owner_full_name_is_not_contractor": True,
                "permit_to_tad_exact_join": fw["permit_to_tad_exact_join"],
                "note": "City of Fort Worth development permits have no contractor identity fields.",
            },
            "tarrant": {
                "surface": "DATA_ONLY",
                "route": None,
                "cad_rows": h["tarrant_cad"]["rows"],
                "owner_dossiers": False,
                "appraisal_value_is_not_sale_price": True,
            },
            "san_antonio": {
                "surface": "DATA_ONLY",
                "route": None,
                "permits_issued_rows": hb["san_antonio"]["permits_issued_rows"],
                "permits_issued_2020_2024_rows": hb["san_antonio"]["permits_issued_2020_2024_rows"],
                "distinct_primary_contacts": hb["san_antonio"]["distinct_primary_contacts"],
                "contractor_registration": hb["san_antonio"]["contractor_registration"],
                "credential_fields_in_permit_csv": "none",
            },
            "bexar": {
                "surface": "DATA_ONLY",
                "route": None,
                "cad_bulk": hb["bexar"]["cad_bulk"],
                "permit_property_join": hb["bexar"]["permit_property_join"],
            },
            "houston": {
                "surface": "DATA_ONLY",
                "route": None,
                "building_permit_bulk": hb["houston"]["building_permit_bulk"],
                "geography": hb["houston"]["geography"],
                "contractor_registration": hb["houston"]["contractor_registration"],
            },
            "harris": {
                "surface": "DATA_ONLY",
                "route": None,
                "permit_bulk": hb["harris_county"]["permit_bulk"],
                "geography": hb["harris_county"]["geography"],
                "hcad_real_acct_rows": hb["hcad"]["real_acct_rows"],
            },
        },
        "semantics": [
            "LOCAL PERMIT CONTRACTOR != STATE LICENSEE",
            "AUSTIN_PERMIT_CONTRACTOR_IDENTITY != TDLR OR TSBPE CREDENTIAL",
            "HIGH_CONFIDENCE_BUSINESS_MATCH != LICENSE VERIFICATION",
            "EXACT_STATE_CREDENTIAL = 0",
            "GENERAL CONTRACTOR WITHOUT TDLR != UNLICENSED",
            "LOCAL_ONLY != UNLICENSED",
            "PERMIT != QUALITY",
            "PERMIT COUNT != QUALITY",
            "HIGH PERMIT COUNT != BETTER CONTRACTOR",
            "LOW PERMIT COUNT != INEXPERIENCED",
            "VALUATION != REVENUE",
            "VALUATION != FINAL PROJECT COST",
            "FINAL != INSPECTIONS PASSED",
            "EXPIRED != DISCIPLINE",
            "VOID != MISCONDUCT",
            "APPRAISAL VALUE != SALE PRICE",
            "TCAD JOIN != OWNER DOSSIER",
            "PROPERTY ADDRESS != OWNER",
            "CONTRACTOR PHONE != STATE REGULATOR CONTACT",
            "PERSON-NAME-ONLY != PUBLIC IDENTITY",
            "MISSING != ZERO",
            "NO LOCAL RECORD != NO WORK",
            "NO TRUST SCORE",
            "NO RANKING",
        ],
        "profile_integration": "DEFERRED",
        "texas_local_harvest_closed": True,
        "texas_fully_closed": True,
        "next_state": "WASHINGTON",
        "guardrails": h["guardrails"],
    }


def scan_public_identities() -> tuple[list[dict], int]:
    print("scanning Austin CSV for public company+phone identities", flush=True)
    identities: dict[str, dict] = {}
    rows = 0
    with RAW_CSV.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows += 1
            company = g(row, "Contractor Company Name")
            phone = norm_phone(g(row, "Contractor Phone"))
            if not company or not phone:
                continue
            ncompany = norm_name(company)
            if not ncompany or ncompany in {"OWNER", "HOMEOWNER", "HOMESTEAD", "NA", "N A", "NONE"}:
                continue
            key = f"{ncompany}|{phone}"
            rec = identities.get(key)
            issued = parse_date(g(row, "Issued Date"))
            addr1 = g(row, "Contractor Address 1")
            addr2 = g(row, "Contractor Address 2")
            city = g(row, "Contractor City")
            z = re.sub(r"\D", "", g(row, "Contractor Zip"))[:5]
            addr = SPACES.sub(" ", " ".join(x for x in (addr1, addr2, city, z) if x)).strip()
            trade = g(row, "Contractor Trade")
            pnum = g(row, "Permit Num")
            ptype = g(row, "Permit Type Desc")
            status = g(row, "Status Current")
            if rec is None:
                rec = {
                    "c": company,
                    "p": phone,
                    "a": addr,
                    "z": z,
                    "t": [],
                    "_t": set(),
                    "n": 0,
                    "f": issued,
                    "l": issued,
                    "r": [],
                    "_ld": "",
                }
                identities[key] = rec
            rec["n"] += 1
            if issued and (not rec["f"] or issued < rec["f"]):
                rec["f"] = issued
            if issued and (not rec["l"] or issued > rec["l"]):
                rec["l"] = issued
            if issued and issued >= rec.get("_ld", ""):
                rec["c"] = company
                if addr:
                    rec["a"] = addr
                if z:
                    rec["z"] = z
                rec["_ld"] = issued
            if trade and trade not in rec["_t"] and len(rec["_t"]) < 8:
                rec["_t"].add(trade)
                rec["t"].append(trade)
            if pnum:
                recent = rec["r"]
                item = [pnum, ptype, issued, status]
                if len(recent) < RECENT_CAP:
                    recent.append(item)
                    recent.sort(key=lambda x: x[2] or "", reverse=True)
                elif issued and (not recent[-1][2] or issued > recent[-1][2]):
                    recent.append(item)
                    recent.sort(key=lambda x: x[2] or "", reverse=True)
                    del recent[RECENT_CAP:]
            if rows % 250000 == 0:
                print(f"  austin rows {rows} identities {len(identities)}", flush=True)
    print(f"scan complete rows={rows} public_identities={len(identities)}", flush=True)
    if rows != EXPECTED_ROWS:
        raise SystemExit(f"Austin row count drifted: {rows}")
    out = []
    for rec in identities.values():
        rec.pop("_t", None)
        rec.pop("_ld", None)
        out.append(rec)
    out.sort(key=lambda r: (r["c"].upper(), r["p"]))
    return out, rows


def main() -> None:
    h = json.loads(HARVEST.read_text(encoding="utf-8"))
    hb = json.loads(HARVEST_B.read_text(encoding="utf-8"))
    tcad = json.loads(TCAD_JOIN.read_text(encoding="utf-8"))
    if h["austin"]["sha256"] != EXPECTED_SHA:
        raise SystemExit("harvest CSV sha drifted")
    if not RAW_CSV.exists():
        raise SystemExit(f"missing Austin CSV {RAW_CSV}")

    identities, rows = scan_public_identities()
    public_n = len(identities)
    if public_n != EXPECTED_PUBLIC_IDENTITIES:
        print(f"WARNING public identities {public_n} != harvest {EXPECTED_PUBLIC_IDENTITIES}", flush=True)
    if public_n < 30000:
        raise SystemExit(f"public identity count too low: {public_n}")

    body = build_snapshot(h, hb, tcad, public_n)
    fp = fingerprint(body)
    body["fingerprint"] = fp

    OUT.mkdir(parents=True, exist_ok=True)
    snap_path = OUT / "accepted-snapshot.json"
    snap_path.write_text(json.dumps(body, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    index = {
        "version": VERSION,
        "fingerprint": fp,
        "identity_key": "AUSTIN_PERMIT_CONTRACTOR_IDENTITY",
        "rows": public_n,
        "recent_cap": RECENT_CAP,
        "csv_rows": rows,
        "not_a_complete_permit_directory": True,
        "person_name_only_not_public": True,
        "match_class_not_on_public_identity": True,
        "i": identities,
    }
    idx_path = OUT / "identity-index.json"
    idx_path.write_text(json.dumps(index, separators=(",", ":"), ensure_ascii=True), encoding="utf-8")
    print("snapshot", snap_path, "bytes", snap_path.stat().st_size, flush=True)
    print("index", idx_path, "bytes", idx_path.stat().st_size, flush=True)
    print("fingerprint", fp, flush=True)
    print("public_identities", public_n, flush=True)


if __name__ == "__main__":
    main()
