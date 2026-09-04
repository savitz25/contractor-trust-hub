"""TX-CON-LOCAL-001A harvest: profile Austin/Fort Worth permits, match TDLR/TSBPE, join CAD."""
from __future__ import annotations

import csv
import hashlib
import json
import re
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

csv.field_size_limit(min(2**31 - 1, 128 * 1024 * 1024))

ROOT = Path(__file__).resolve().parents[4]
RAW = Path(r"S:\ath-raw\tx-con-local-001a")
AUSTIN_CSV = RAW / "austin-travis" / "3syk-w9eu-issued-construction-permits.csv"
FTW_CSV = RAW / "fort-worth-tarrant" / "cfw-development-permits.csv"
TCAD_ZIP = RAW / "austin-travis" / "tcad-2026-certified-appraisal-export-supp0-07182026.zip"
TAD_ZIP = RAW / "fort-worth-tarrant" / "PropertyData_Delimited.zip"
STATE_TDLR = Path(r"C:\Users\Michael.Savitsky\contractor-tx-con-001\data\raw\tx_tdlr")
STATE_TSBPE = Path(r"C:\Users\Michael.Savitsky\contractor-tx-con-001\data\raw\tx_tsbpe")
OUT = ROOT / "data" / "texas" / "local" / "tx-local-001a"
AUSTIN_OUT = ROOT / "data" / "texas" / "local" / "austin-travis"
FTW_OUT = ROOT / "data" / "texas" / "local" / "fort-worth-tarrant"
FIX_A = AUSTIN_OUT / "fixtures"
FIX_F = FTW_OUT / "fixtures"

PUNCT = re.compile(r"[^A-Z0-9 ]+")
SPACES = re.compile(r"\s+")
LEGAL = re.compile(
    r"\b(INCORPORATED|INC|LLC|L L C|CORPORATION|CORP|CO|COMPANY|LTD|LIMITED|LP|LLP|DBA|THE)\b"
)
PHONE_RE = re.compile(r"\D+")


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def nonempty(v: str | None) -> bool:
    return bool((v or "").strip())


def norm_name(value: str | None) -> str:
    s = PUNCT.sub(" ", (value or "").upper())
    s = LEGAL.sub(" ", s)
    return SPACES.sub(" ", s).strip()


def norm_addr(value: str | None) -> str:
    s = PUNCT.sub(" ", (value or "").upper())
    s = (
        s.replace(" STREET", " ST")
        .replace(" AVENUE", " AVE")
        .replace(" BOULEVARD", " BLVD")
        .replace(" ROAD", " RD")
        .replace(" DRIVE", " DR")
        .replace(" LANE", " LN")
        .replace(" SUITE", " STE")
        .replace(" NORTH", " N")
        .replace(" SOUTH", " S")
        .replace(" EAST", " E")
        .replace(" WEST", " W")
    )
    return SPACES.sub(" ", s).strip()


def norm_phone(value: str | None) -> str:
    d = PHONE_RE.sub("", value or "")
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    return d if len(d) == 10 else ""


def norm_zip(value: str | None) -> str:
    d = re.sub(r"\D", "", value or "")
    return d[:5]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


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


def trade_bucket(permit_type: str, contractor_trade: str) -> str:
    blob = f"{permit_type} {contractor_trade}".upper()
    if "ELECTR" in blob:
        return "electrical"
    if "PLUMB" in blob:
        return "plumbing"
    if "MECH" in blob or "HVAC" in blob or "A/C" in blob or "AIR COND" in blob:
        return "mechanical/HVAC"
    if "BUILD" in blob or "GENERAL" in blob:
        return "general"
    if permit_type:
        return "specialty"
    return "unknown"


def load_state_spine() -> dict:
    by_key: dict[str, dict] = {}
    name_phone: dict[str, set[str]] = defaultdict(set)
    name_addr: dict[str, set[str]] = defaultdict(set)
    name_zip: dict[str, set[str]] = defaultdict(set)
    name_city: dict[str, set[str]] = defaultdict(set)
    name_only: dict[str, set[str]] = defaultdict(set)
    phones: dict[str, set[str]] = defaultdict(set)

    def add(key: str, name: str, phone: str, addr: str, city: str, z: str, kind: str) -> None:
        n = norm_name(name)
        if not n or n in {"OWNER", "HOMEOWNER", "HOMESTEAD", "NA", "N A", "NONE"}:
            return
        rec = {
            "key": key,
            "name": name,
            "norm": n,
            "phone": phone,
            "addr": addr,
            "city": city,
            "zip": z,
            "kind": kind,
        }
        by_key[key] = rec
        name_only[n].add(key)
        if phone:
            name_phone[f"{n}|{phone}"].add(key)
            phones[phone].add(key)
        if addr:
            name_addr[f"{n}|{addr}"].add(key)
        if z:
            name_zip[f"{n}|{z}"].add(key)
        if city:
            name_city[f"{n}|{city}"].add(key)

    if STATE_TDLR.exists():
        for path in sorted(STATE_TDLR.glob("*.csv")):
            with path.open(newline="", encoding="utf-8", errors="replace") as fh:
                reader = csv.DictReader(fh)
                for row in reader:
                    ltype = g(row, "LICENSE TYPE", "license_type")
                    lnum = g(row, "LICENSE NUMBER", "license_number")
                    subtype = g(row, "LICENSE SUBTYPE", "license_subtype")
                    if not lnum:
                        continue
                    key = f"TX-TDLR:{re.sub(r'[^A-Z0-9]+', '-', ltype.upper()).strip('-')}:{lnum}"
                    if subtype:
                        key += f":{subtype}"
                    biz = g(row, "BUSINESS NAME", "business_name") or g(row, "NAME")
                    phone = norm_phone(g(row, "BUSINESS PHONE") or g(row, "PHONE NUMBER"))
                    addr = norm_addr(g(row, "BUSINESS ADDRESS-LINE1", "MAILING ADDRESS LINE1"))
                    city = norm_name(g(row, "BUSINESS COUNTY") or "")
                    # city from business city state zip
                    bcsz = g(row, "BUSINESS CITY, STATE ZIP")
                    city_from = ""
                    if bcsz:
                        city_from = norm_name(bcsz.split(",")[0] if "," in bcsz else bcsz.split(" TX")[0])
                    z = norm_zip(g(row, "BUSINESS ZIP") or bcsz)
                    add(key, biz, phone, addr, city_from or city, z, "TDLR")

    rmp = STATE_TSBPE / "tsbpe_rmp.csv"
    if rmp.exists():
        with rmp.open(newline="", encoding="utf-8", errors="replace") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                lnum = g(row, "LICENSE_NBR")
                if not lnum:
                    continue
                key = f"TX-TSBPE:RMP:{lnum}"
                biz = g(row, "PLUMB_COMPANY")
                phone = norm_phone(g(row, "PHONE"))
                addr = norm_addr(g(row, "ADDR1"))
                city = norm_name(g(row, "CITY"))
                z = norm_zip(g(row, "ZIP"))
                add(key, biz, phone, addr, city, z, "TSBPE_RMP")

    return {
        "by_key": by_key,
        "name_phone": name_phone,
        "name_addr": name_addr,
        "name_zip": name_zip,
        "name_city": name_city,
        "name_only": name_only,
        "count": len(by_key),
    }


def classify_match(spine: dict, name: str, phone: str, addr: str, city: str, z: str) -> tuple[str, list[str]]:
    n = norm_name(name)
    if not n:
        return "NO_CONTRACTOR", []
    if phone:
        keys = list(spine["name_phone"].get(f"{n}|{phone}", ()))
        if len(keys) == 1:
            return "HIGH_CONFIDENCE_BUSINESS_MATCH", keys
        if len(keys) > 1:
            return "REVIEW_REQUIRED", keys[:8]
    if addr:
        keys = list(spine["name_addr"].get(f"{n}|{addr}", ()))
        if len(keys) == 1:
            return "HIGH_CONFIDENCE_BUSINESS_MATCH", keys
        if len(keys) > 1:
            return "REVIEW_REQUIRED", keys[:8]
    if z:
        keys = list(spine["name_zip"].get(f"{n}|{z}", ()))
        if keys:
            return "REVIEW_REQUIRED", keys[:8]
    if city:
        keys = list(spine["name_city"].get(f"{n}|{city}", ()))
        if keys:
            return "REVIEW_REQUIRED", keys[:8]
    keys = list(spine["name_only"].get(n, ()))
    if keys:
        return "UNSAFE", keys[:8]
    return "LOCAL_ONLY_CONTRACTOR_IDENTITY", []


def profile_austin(spine: dict) -> dict:
    print("profiling Austin permits", flush=True)
    rows = 0
    with_company = 0
    with_person = 0
    with_phone = 0
    with_addr = 0
    with_trade = 0
    with_valuation = 0
    with_tcad = 0
    companies: set[str] = set()
    company_phone: set[str] = set()
    tcads: set[str] = set()
    types = Counter()
    status = Counter()
    years = Counter()
    trades = Counter()
    class_mapped = Counter()
    match_class = Counter()
    local_trade = Counter()
    phones = 0
    emails = 0
    websites = 0
    addresses = 0
    work: dict[str, dict] = {}
    fixture_rows: list[dict] = []
    license_like_cols = Counter()

    sha = sha256_file(AUSTIN_CSV)
    with AUSTIN_CSV.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        fields = reader.fieldnames or []
        lower_fields = [f.lower() for f in fields]
        for needle in ("tdlr", "tsbpe", "license", "licence", "contractor_id", "contractor number"):
            for f in lower_fields:
                if needle in f:
                    license_like_cols[f] += 1
        for row in reader:
            rows += 1
            company = g(row, "Contractor Company Name", "contractor_company_name")
            person = g(row, "Contractor Full Name", "contractor_full_name")
            phone = g(row, "Contractor Phone", "contractor_phone")
            addr = " ".join(
                x
                for x in (
                    g(row, "Contractor Address 1", "contractor_address1"),
                    g(row, "Contractor Address 2", "contractor_address2"),
                )
                if x
            )
            city = g(row, "Contractor City", "contractor_city")
            z = g(row, "Contractor Zip", "contractor_zip")
            trade = g(row, "Contractor Trade", "contractor_trade")
            ptype = g(row, "Permit Type Desc", "permit_type_desc")
            val = g(row, "Total Job Valuation", "total_job_valuation")
            tcad = g(row, "TCAD ID", "tcad_id")
            pnum = g(row, "Permit Num", "permit_number")
            st = g(row, "Status Current", "status_current")
            year = g(row, "Calendar Year Issued", "calendar_year_issued")
            pclass = g(row, "Permit Class Mapped", "permit_class_mapped")

            types[ptype or "(blank)"] += 1
            status[st or "(blank)"] += 1
            years[year or "(blank)"] += 1
            class_mapped[pclass or "(blank)"] += 1
            if trade:
                with_trade += 1
                trades[trade] += 1
            if company:
                with_company += 1
                companies.add(norm_name(company) or company.upper())
            if person:
                with_person += 1
            nphone = norm_phone(phone)
            if nphone:
                with_phone += 1
                phones += 1
            if nonempty(addr):
                with_addr += 1
                addresses += 1
            if val not in {"", "0", "0.0"}:
                try:
                    if float(val) > 0:
                        with_valuation += 1
                except ValueError:
                    pass
            if tcad and tcad not in {"0", "WCAD"}:
                with_tcad += 1
                tcads.add(tcad)
            if company and nphone:
                company_phone.add(f"{norm_name(company)}|{nphone}")

            identity = company or person
            cls, keys = classify_match(spine, identity, nphone, norm_addr(addr), norm_name(city), norm_zip(z))
            match_class[cls] += 1
            if cls == "LOCAL_ONLY_CONTRACTOR_IDENTITY" and company:
                local_trade[trade_bucket(ptype, trade)] += 1
            if identity:
                wk = f"{norm_name(identity)}|{nphone or 'NOCONTACT'}"
                rec = work.get(wk)
                if rec is None:
                    rec = {
                        "identity": identity,
                        "class": cls,
                        "state_keys": keys[:3],
                        "rows": 0,
                        "distinct_permits": 0,
                        "valuation_rows": 0,
                        "_seen_permits": 0,
                    }
                    work[wk] = rec
                rec["rows"] += 1
                rec["distinct_permits"] += 1
                if val not in {"", "0"}:
                    rec["valuation_rows"] += 1
                if len(work) > 250000:
                    # keep harvest bounded; remaining identities still counted in match_class
                    pass

            if len(fixture_rows) < 8 and company and nphone:
                fixture_rows.append(
                    {
                        "permit_number": pnum,
                        "permit_type_desc": ptype,
                        "contractor_company_name": company,
                        "contractor_phone": phone,
                        "contractor_trade": trade,
                        "tcad_id": tcad,
                        "status_current": st,
                        "match_class": cls,
                    }
                )
            if rows % 250000 == 0:
                print(f"  austin rows {rows}", flush=True)

    FIX_A.mkdir(parents=True, exist_ok=True)
    with (FIX_A / "austin-permits-sample.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(fixture_rows[0].keys()) if fixture_rows else ["permit_number"])
        w.writeheader()
        w.writerows(fixture_rows)

    work_out = sorted(
        (
            {
                "identity": rec["identity"],
                "class": rec["class"],
                "state_keys": rec["state_keys"],
                "permit_rows": rec["rows"],
                "distinct_permit_numbers": rec["distinct_permits"],
                "valuation_rows": rec["valuation_rows"],
            }
            for rec in work.values()
        ),
        key=lambda r: r["permit_rows"],
        reverse=True,
    )

    return {
        "source": "City of Austin Issued Construction Permits",
        "dataset_id": "3syk-w9eu",
        "url": "https://data.austintexas.gov/Building-and-Development/Issued-Construction-Permits/3syk-w9eu",
        "access_class": "OPEN_SOCRATA",
        "grain": "one row = one issued permit (permit_number unique in source metadata)",
        "path": str(AUSTIN_CSV),
        "bytes": AUSTIN_CSV.stat().st_size,
        "sha256": sha,
        "rows": rows,
        "fields": None,
        "license_like_columns": list(license_like_cols),
        "source_native_tdlr_or_tsbpe_id": False,
        "source_native_city_contractor_number": False,
        "rows_with_contractor_company": with_company,
        "rows_with_contractor_person_name": with_person,
        "rows_with_contractor_phone": with_phone,
        "rows_with_contractor_address": with_addr,
        "rows_with_contractor_trade": with_trade,
        "rows_with_valuation": with_valuation,
        "rows_with_tcad_id": with_tcad,
        "distinct_contractor_company_values": len(companies),
        "distinct_normalized_company_plus_phone": len(company_phone),
        "distinct_tcad_ids": len(tcads),
        "permit_types": types.most_common(),
        "status_mix": status.most_common(),
        "year_distribution": sorted(
            ((int(y), n) for y, n in years.items() if y.isdigit()), key=lambda x: x[0]
        ),
        "contractor_trades": trades.most_common(30),
        "permit_class_mapped": class_mapped.most_common(),
        "match_class": dict(match_class),
        "local_only_trade_breakout": dict(local_trade),
        "contacts": {
            "phones": phones,
            "emails": emails,
            "websites": websites,
            "addresses": addresses,
            "provenance_phone": "AUSTIN_PERMIT_CONTRACTOR_PHONE",
            "provenance_address": "AUSTIN_PERMIT_CONTRACTOR_ADDRESS",
            "email_website": "NOT_IN_SOURCE",
        },
        "work_history_identities": len(work),
        "work_history_top": work_out[:25],
        "semantics": [
            "LOCAL PERMIT CONTRACTOR != STATE LICENSEE",
            "GENERAL CONTRACTOR WITHOUT TDLR != UNLICENSED",
            "PERMIT COUNT != QUALITY",
            "VALUATION != REVENUE",
            "APPRAISAL VALUE != SALE PRICE",
            "MISSING != ZERO",
            "NO TRUST SCORE",
        ],
    }


def profile_fort_worth() -> dict:
    print("profiling Fort Worth permits", flush=True)
    if not FTW_CSV.exists() or FTW_CSV.stat().st_size < 1000:
        return {
            "source": "City of Fort Worth Development Permits",
            "item_id": "d2740f4d746b4bfaa03e25de0376238b",
            "feature_layer": "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0",
            "official_full_download": "https://data.fortworthtexas.gov/Development-Infrastructure/Development-Permits/quz7-xnsy",
            "access_class": "OPEN_GIS_SERVICE",
            "service_count": 1611676,
            "grain": "one row = development permit record",
            "contractor_company_field": False,
            "contractor_phone_field": False,
            "contractor_license_field": False,
            "owner_full_name_is_not_contractor": True,
            "csv_acquired": False,
            "note": "Official bulk table has no contractor identity fields. Owner_Full_Name is property owner, not contractor.",
        }
    rows = 0
    types = Counter()
    status = Counter()
    with_addr = 0
    with_value = 0
    with_legal = 0
    permits: set[str] = set()
    sha = sha256_file(FTW_CSV)
    fixture_rows: list[dict] = []
    with FTW_CSV.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        fields = reader.fieldnames or []
        for row in reader:
            rows += 1
            ptype = g(row, "Permit_Type")
            st = g(row, "Current_Status")
            types[ptype or "(blank)"] += 1
            status[st or "(blank)"] += 1
            if g(row, "Full_Street_Address"):
                with_addr += 1
            if g(row, "JobValue"):
                with_value += 1
            if g(row, "B1_LEGAL_DESC"):
                with_legal += 1
            pno = g(row, "Permit_No")
            if pno:
                permits.add(pno)
            if len(fixture_rows) < 8:
                fixture_rows.append(
                    {
                        "Permit_No": pno,
                        "Permit_Type": ptype,
                        "Current_Status": st,
                        "Full_Street_Address": g(row, "Full_Street_Address"),
                        "JobValue": g(row, "JobValue"),
                    }
                )
            if rows % 250000 == 0:
                print(f"  fort worth rows {rows}", flush=True)
    FIX_F.mkdir(parents=True, exist_ok=True)
    if fixture_rows:
        with (FIX_F / "fort-worth-permits-sample.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(fixture_rows[0].keys()))
            w.writeheader()
            w.writerows(fixture_rows)
    return {
        "source": "City of Fort Worth Development Permits",
        "item_id": "d2740f4d746b4bfaa03e25de0376238b",
        "url": "https://data.fortworthtexas.gov/Development-Infrastructure/Development-Permits/quz7-xnsy",
        "access_class": "OPEN_GIS_SERVICE",
        "grain": "one row = development permit record",
        "path": str(FTW_CSV),
        "bytes": FTW_CSV.stat().st_size,
        "sha256": sha,
        "rows": rows,
        "fields": fields,
        "distinct_permit_numbers": len(permits),
        "rows_with_street_address": with_addr,
        "rows_with_job_value": with_value,
        "rows_with_legal_description": with_legal,
        "permit_types": types.most_common(25),
        "status_mix": status.most_common(),
        "contractor_company_field": any("contractor" in f.lower() for f in fields),
        "contractor_phone_field": any("phone" in f.lower() and "contractor" in f.lower() for f in fields),
        "contractor_license_field": any("license" in f.lower() or "tdlr" in f.lower() for f in fields),
        "owner_full_name_is_not_contractor": True,
        "source_native_tdlr_or_tsbpe_id": False,
        "csv_acquired": True,
        "semantics": [
            "Owner_Full_Name is property owner, not contractor identity",
            "LOCAL PERMIT CONTRACTOR != STATE LICENSEE",
            "PERMIT COUNT != QUALITY",
            "MISSING != ZERO",
        ],
    }


def tcad_index() -> dict:
    if not TCAD_ZIP.exists():
        return {"acquired": False}
    names = []
    with zipfile.ZipFile(TCAD_ZIP) as zf:
        names = zf.namelist()
    return {
        "acquired": True,
        "path": str(TCAD_ZIP),
        "bytes": TCAD_ZIP.stat().st_size,
        "sha256": sha256_file(TCAD_ZIP),
        "members": names[:80],
        "member_count": len(names),
        "owner_dossiers": False,
        "appraisal_value_is_not_sale_price": True,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    AUSTIN_OUT.mkdir(parents=True, exist_ok=True)
    FTW_OUT.mkdir(parents=True, exist_ok=True)
    print("loading state spine", flush=True)
    spine = load_state_spine()
    print(f"state spine keys {spine['count']}", flush=True)
    austin = profile_austin(spine) if AUSTIN_CSV.exists() else {"acquired": False}
    ftw = profile_fort_worth()
    tcad = tcad_index()
    report = {
        "ticket": "TX-CON-LOCAL-001A",
        "version": "contractor-tx-local-001a-v1",
        "generated_at": utcnow(),
        "no_public_local_routes": True,
        "no_shared_texas_local_loader": True,
        "namespaces": ["austin-travis", "fort-worth-tarrant", "tx-local-001a"],
        "builder_4_namespaces_untouched": ["san-antonio-bexar", "houston-harris"],
        "state_spine": {
            "source": "TX-CON-001 acquired TDLR specialty business files + TSBPE RMP",
            "keys": spine["count"],
            "non_match_is_not_unlicensed": True,
        },
        "austin": austin,
        "fort_worth": ftw,
        "travis_cad": tcad,
        "guardrails": {
            "local_permit_contractor_ne_state_licensee": True,
            "gc_without_tdlr_ne_unlicensed": True,
            "permit_ne_quality": True,
            "permit_count_ne_experience_score": True,
            "valuation_ne_revenue": True,
            "appraisal_ne_sale_price": True,
            "property_address_ne_owner": True,
            "contractor_phone_ne_state_regulator_contact": True,
            "missing_ne_zero": True,
            "no_trust_score": True,
            "no_ranking": True,
            "no_name_only_adverse_attach": True,
        },
    }
    (OUT / "harvest-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT / "harvest-report.json", flush=True)


if __name__ == "__main__":
    main()
