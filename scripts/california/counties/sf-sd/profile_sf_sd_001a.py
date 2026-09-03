"""CA-CON-COUNTY-001A — profile official SF/SD files and match to acquired CSLB spine."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

csv.field_size_limit(min(2**31 - 1, 128 * 1024 * 1024))

ROOT = Path(__file__).resolve().parents[4]
RAW_SF = ROOT / "data" / "raw" / "california" / "counties" / "san-francisco"
RAW_SD = ROOT / "data" / "raw" / "california" / "counties" / "san-diego"
CSLB = ROOT / "data" / "raw" / "california" / "cslb_spine" / "license_master.part"
OUT = ROOT / "data" / "california" / "counties" / "sf-sd"
FIX_SF = ROOT / "data" / "california" / "counties" / "san-francisco" / "fixtures"
FIX_SD = ROOT / "data" / "california" / "counties" / "san-diego" / "fixtures"

PUNCT = re.compile(r"[^A-Z0-9 ]+")
SPACES = re.compile(r"\s+")
LEGAL = re.compile(
    r"\b(INCORPORATED|INC|LLC|L L C|CORPORATION|CORP|CO|COMPANY|LTD|LIMITED|LP|LLP|DBA|THE)\b"
)
LICENSE_RE = re.compile(r"\b(\d{5,8})\b")


def norm_name(value: str | None) -> str:
    s = PUNCT.sub(" ", (value or "").upper())
    s = LEGAL.sub(" ", s)
    return SPACES.sub(" ", s).strip()


def norm_addr(value: str | None) -> str:
    s = PUNCT.sub(" ", (value or "").upper())
    s = s.replace(" STREET", " ST").replace(" AVENUE", " AVE").replace(" BOULEVARD", " BLVD")
    s = s.replace(" ROAD", " RD").replace(" DRIVE", " DR").replace(" LANE", " LN")
    return SPACES.sub(" ", s).strip()


def norm_zip(value: str | None) -> str:
    digits = re.sub(r"\D", "", value or "")
    return digits[:5]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def nonempty(value: str | None) -> bool:
    return bool((value or "").strip())


def get_field(row: dict, *names: str) -> str:
    if not row:
        return ""
    keys = {k.lower().replace(" ", "_").replace("-", "_"): k for k in row}
    for name in names:
        if name in row and row[name] is not None:
            return str(row[name])
        slug = name.lower().replace(" ", "_").replace("-", "_")
        if slug in keys:
            val = row.get(keys[slug])
            if val is not None:
                return str(val)
    return ""


def naics_family(code: str | None, description: str | None) -> str | None:
    c = re.sub(r"\D", "", code or "")
    blob = f"{c} {(description or '').upper()}"
    if c.startswith("23") or any(
        k in blob
        for k in (
            "CONSTRUCTION",
            "CONTRACTOR",
            "PLUMBING",
            "ELECTRICAL",
            "ROOFING",
            "HVAC",
            "CARPENT",
            "MASON",
            "PAINTING",
            "DRYWALL",
            "CONCRETE",
            "SPECIALTY TRADE",
        )
    ):
        return "construction"
    if c.startswith(("484", "4884", "4889", "492")) or any(
        k in blob for k in ("MOVER", "MOVING", "HOUSEHOLD GOODS", "RELOCATION")
    ):
        return "moving"
    if c.startswith(("623", "6241", "6216")) or any(
        k in blob for k in ("ASSISTED LIVING", "NURSING", "HOME CARE", "RESIDENTIAL CARE", "ELDER")
    ):
        return "senior"
    if c.startswith("524") or "INSURANCE" in blob:
        return "insurance"
    if c.startswith("52") or any(k in blob for k in ("MORTGAGE", "BANK", "CREDIT", "LEND")):
        return "financial"
    return None


def load_cslb() -> dict:
    by_license: dict[str, dict] = {}
    name_city: dict[str, list[str]] = defaultdict(list)
    name_zip: dict[str, list[str]] = defaultdict(list)
    name_addr: dict[str, list[str]] = defaultdict(list)
    with CSLB.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            lic = (row.get("LicenseNo") or "").strip()
            if not lic:
                continue
            rec = {
                "license": lic,
                "business_name": row.get("BusinessName") or "",
                "full_name": row.get("FullBusinessName") or "",
                "city": row.get("City") or "",
                "zip": norm_zip(row.get("ZIPCode")),
                "address": row.get("MailingAddress") or "",
                "phone": row.get("BusinessPhone") or "",
                "status": row.get("PrimaryStatus") or "",
                "county": row.get("County") or "",
            }
            by_license[lic] = rec
            n1 = norm_name(rec["full_name"])
            n2 = norm_name(rec["business_name"])
            addr = norm_addr(rec["address"])
            city = norm_name(rec["city"])
            for n in {n1, n2} - {""}:
                name_city[f"{n}|{city}"].append(lic)
                name_zip[f"{n}|{rec['zip']}"].append(lic)
                if addr:
                    name_addr[f"{n}|{addr}"].append(lic)
    return {
        "by_license": by_license,
        "name_city": name_city,
        "name_zip": name_zip,
        "name_addr": name_addr,
        "count": len(by_license),
    }


def classify_cslb(license_id: str | None, name: str | None, address: str | None, zipcode: str | None, city: str | None, spine: dict) -> str:
    lic = re.sub(r"\D", "", license_id or "")
    if lic:
        if lic in spine["by_license"]:
            return "EXACT_MATCH_ACQUIRED_CSLB"
        if len(lic) >= 5:
            return "EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE"
        return "NO_SOURCE_LICENSE_ID"
    n = norm_name(name)
    a = norm_addr(address)
    if n and a:
        hits = spine["name_addr"].get(f"{n}|{a}", [])
        if len(set(hits)) == 1:
            return "HIGH_CONFIDENCE"
        if hits:
            return "REVIEW_REQUIRED"
    z = norm_zip(zipcode)
    c = norm_name(city)
    if n and z and spine["name_zip"].get(f"{n}|{z}"):
        return "REVIEW_REQUIRED"
    if n and c and spine["name_city"].get(f"{n}|{c}"):
        return "REVIEW_REQUIRED"
    if n:
        return "UNSAFE"
    return "NO_SOURCE_LICENSE_ID"


def profile_csv(path: Path, limit_sample: int = 8) -> dict:
    info = {
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "rows": 0,
        "columns": [],
        "sample": [],
        "nonempty": {},
    }
    with path.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        info["columns"] = reader.fieldnames or []
        nonempty = Counter()
        for i, row in enumerate(reader):
            info["rows"] += 1
            if i < limit_sample:
                info["sample"].append({k: (row.get(k) or "")[:180] for k in (info["columns"][:24])})
            if i < 200_000:
                for k, v in row.items():
                    if nonempty[k] < 3 and nonempty_value(v):
                        nonempty[k] += 1
        info["nonempty"] = {k: int(nonempty[k] > 0) for k in info["columns"]}
    return info


def nonempty_value(v: str | None) -> bool:
    return bool((v or "").strip())


def profile_sf_business(path: Path, spine: dict) -> dict:
    rows = 0
    accounts = set()
    names = set()
    current = 0
    loc_sf = 0
    loc_ca = 0
    families = Counter()
    construction_rows = 0
    construction_accounts = set()
    match = Counter()
    phones = emails = websites = addresses = 0
    with path.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows += 1
            acc = get_field(row, "certificate_number", "Business Account Number").strip()
            if acc:
                accounts.add(acc)
            dba = get_field(row, "dba_name", "DBA Name")
            own = get_field(row, "ownership_name", "Ownership Name")
            names.add(norm_name(dba) or norm_name(own))
            end = get_field(row, "location_end_date", "Location End Date").strip()
            admin = get_field(row, "administratively_closed", "Administratively Closed").strip()
            if not end and admin.lower() not in {"true", "t", "1", "yes"}:
                current += 1
            city = get_field(row, "city", "City").strip().upper()
            state = get_field(row, "state", "State").strip().upper()
            if "SAN FRANCISCO" in city or city in {"SF", "SAN FRAN"}:
                loc_sf += 1
            if state in {"CA", "CALIFORNIA", ""}:
                loc_ca += 1
            fam = naics_family(
                get_field(row, "self_reported_naics_code", "Self-Reported NAICS Code"),
                get_field(row, "lic_code_description", "LIC Code Description"),
            )
            if fam:
                families[fam] += 1
            addr = get_field(row, "full_business_address", "Street Address")
            if addr:
                addresses += 1
            if fam == "construction":
                construction_rows += 1
                if acc:
                    construction_accounts.add(acc)
                cls = classify_cslb(
                    None,
                    dba or own,
                    addr,
                    get_field(row, "business_zip", "Source Zipcode"),
                    city,
                    spine,
                )
                match[cls] += 1
    names.discard("")
    return {
        "grain": "registered business location",
        "rows": rows,
        "distinct_business_accounts": len(accounts),
        "distinct_locations": rows,
        "distinct_business_names": len(names),
        "current_if_no_end_and_not_admin_closed": current,
        "sf_city_rows": loc_sf,
        "ca_or_blank_state_rows": loc_ca,
        "family_rows": dict(families),
        "construction_related_rows": construction_rows,
        "construction_related_accounts": len(construction_accounts),
        "cslb_match": dict(match),
        "contacts": {
            "phones": phones,
            "emails": emails,
            "websites": websites,
            "addresses": addresses,
            "phone_eligibility": "INTERNAL_ONLY",
            "email_eligibility": "INTERNAL_ONLY",
            "address_eligibility": "PUBLIC_ELIGIBLE",
            "note": "DataSF registered-business schema has no phone/email/website columns.",
        },
        "file": {
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
            "columns": None,
        },
    }


def profile_sf_permits(path: Path) -> dict:
    rows = 0
    permits = set()
    types = Counter()
    statuses = Counter()
    with_name = 0
    with_lic = 0
    with_val = 0
    with_parcel = 0
    with_complete = 0
    filed_min = filed_max = None
    columns = []
    with path.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        columns = reader.fieldnames or []
        lower = {k.lower(): k for k in columns}

        def col(*names: str) -> str | None:
            for n in names:
                if n in columns:
                    return n
                if n.lower() in lower:
                    return lower[n.lower()]
            return None

        c_permit = col("Permit Number", "permit_number")
        c_type = col("Permit Type Definition", "permit_type_definition", "Permit Type")
        c_status = col("Current Status", "current_status", "Status")
        c_filed = col("Filed Date", "filed_date", "Permit Creation Date", "permit_creation_date")
        c_complete = col("Completed Date", "completed_date")
        c_val = col("Estimated Cost", "estimated_cost", "Revised Cost", "revised_cost")
        c_block = col("Block", "block")
        c_lot = col("Lot", "lot")
        c_parcel = col("Parcel Number", "parcel_number")
        c_contractor = col("Contractor Name", "contractor_name")
        c_lic = col("Contractor License", "contractor_license", "License Number")
        for row in reader:
            rows += 1
            p = (row.get(c_permit) or "").strip() if c_permit else ""
            if p:
                permits.add(p)
            if c_type:
                types[(row.get(c_type) or "").strip() or "(blank)"] += 1
            if c_status:
                statuses[(row.get(c_status) or "").strip() or "(blank)"] += 1
            if c_contractor and nonempty(row.get(c_contractor)):
                with_name += 1
            if c_lic and nonempty(row.get(c_lic)):
                with_lic += 1
            if c_val and nonempty(row.get(c_val)):
                with_val += 1
            parcelish = False
            if c_parcel and nonempty(row.get(c_parcel)):
                parcelish = True
            if c_block and c_lot and nonempty(row.get(c_block)) and nonempty(row.get(c_lot)):
                parcelish = True
            if parcelish:
                with_parcel += 1
            if c_complete and nonempty(row.get(c_complete)):
                with_complete += 1
            if c_filed:
                d = (row.get(c_filed) or "").strip()
                if d:
                    filed_min = d if not filed_min or d < filed_min else filed_min
                    filed_max = d if not filed_max or d > filed_max else filed_max
    return {
        "grain": "permit at an address (source-native; permit numbers may repeat)",
        "rows": rows,
        "distinct_permit_numbers": len(permits),
        "permit_type_top": types.most_common(15),
        "status_top": statuses.most_common(15),
        "rows_with_contractor_name": with_name,
        "rows_with_contractor_license_on_permit_file": with_lic,
        "rows_with_valuation": with_val,
        "rows_with_parcel_or_block_lot": with_parcel,
        "rows_with_completed_date": with_complete,
        "filed_date_min": filed_min,
        "filed_date_max": filed_max,
        "columns": columns,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "semantics": [
            "PERMIT APPLICATION != ISSUED PERMIT",
            "ISSUED != COMPLETED",
            "COMPLETED != PASSED EVERY INSPECTION",
            "PERMIT HOLDER != PROPERTY OWNER",
            "PERMIT VALUE != FINAL PROJECT COST",
            "PERMIT COUNT != QUALITY",
            "NO PERMIT FOUND != NO WORK PERFORMED",
        ],
    }


def profile_sf_contacts(path: Path, spine: dict) -> dict:
    rows = 0
    with_lic = 0
    licenses = set()
    names = set()
    roles = Counter()
    exact = 0
    missing_spine = 0
    name_only = 0
    permits_with_lic = set()
    sample_exact = []
    with path.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows += 1
            roles[get_field(row, "role", "Role").strip() or "(blank)"] += 1
            firm = get_field(row, "firm_name", "Firm Name")
            person = f"{get_field(row, 'first_name', 'First Name')} {get_field(row, 'last_name', 'Last Name')}".strip()
            names.add(norm_name(firm or person))
            permit = get_field(row, "permit_number", "Permit Number").strip()
            raw_lics = []
            for key in ("license1", "License1", "license2", "License2"):
                raw = get_field(row, key).strip()
                if raw:
                    raw_lics.extend(LICENSE_RE.findall(raw))
            if raw_lics:
                with_lic += 1
                if permit:
                    permits_with_lic.add(permit)
                for lic in raw_lics:
                    licenses.add(lic)
                    if lic in spine["by_license"]:
                        exact += 1
                        if len(sample_exact) < 12:
                            rec = spine["by_license"][lic]
                            sample_exact.append(
                                {
                                    "permit_number": permit,
                                    "license": lic,
                                    "canonical": f"CA-CSLB:{lic}",
                                    "firm_name": firm,
                                    "role": row.get("role"),
                                    "cslb_name": rec["full_name"],
                                    "cslb_status": rec["status"],
                                    "class": "EXACT_MATCH_ACQUIRED_CSLB",
                                }
                            )
                    else:
                        missing_spine += 1
            else:
                if firm or person:
                    name_only += 1
    names.discard("")
    return {
        "grain": "permit contact / agent row",
        "rows": rows,
        "rows_with_license1_or_license2": with_lic,
        "distinct_license_ids": len(licenses),
        "distinct_contact_names": len(names),
        "distinct_permits_with_license": len(permits_with_lic),
        "role_top": roles.most_common(12),
        "exact_license_tokens_in_acquired_spine": exact,
        "exact_license_tokens_absent_from_partial_spine": missing_spine,
        "name_only_contact_rows": name_only,
        "no_name_only_auto_attach": True,
        "sample_exact": sample_exact,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "columns_identity": ["permit_number", "license1", "license2", "firm_name", "role", "sf_business_license_number"],
    }


def profile_sf_inspections(path: Path) -> dict:
    rows = 0
    types = Counter()
    results = Counter()
    with_ref = 0
    with_parcel = 0
    with path.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        cols = reader.fieldnames or []
        for row in reader:
            rows += 1
            types[(row.get("reference_number_type") or "").strip() or "(blank)"] += 1
            results[(row.get("result") or "").strip() or "(blank)"] += 1
            if nonempty(row.get("reference_number")):
                with_ref += 1
            if nonempty(row.get("parcel_number")) or (nonempty(row.get("block")) and nonempty(row.get("lot"))):
                with_parcel += 1
    return {
        "grain": "inspection event (permit/complaint/address; not contractor-attributed unless source says so)",
        "rows": rows,
        "reference_number_type": dict(types),
        "result_top": results.most_common(15),
        "rows_with_reference_number": with_ref,
        "rows_with_parcel_or_block_lot": with_parcel,
        "contractor_license_field": False,
        "attribution": "PERMIT_OR_PROPERTY_GRAIN",
        "do_not_translate_to_contractor_passed": True,
        "join_keys": ["reference_number", "parcel_number", "block", "lot"],
        "columns": cols,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def profile_sd_approvals(path: Path, spine: dict) -> dict:
    rows = 0
    projects = set()
    approvals = set()
    types = Counter()
    statuses = Counter()
    holders = Counter()
    with_holder = 0
    with_apn = 0
    with_val = 0
    with_lic = 0
    exact = Counter()
    create_min = create_max = None
    sample_holders = []
    with path.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        cols = reader.fieldnames or []
        for row in reader:
            rows += 1
            pid = (row.get("PROJECT_ID") or row.get("project_id") or "").strip()
            aid = (row.get("APPROVAL_ID") or row.get("approval_id") or "").strip()
            if pid:
                projects.add(pid)
            if aid:
                approvals.add(aid)
            types[(row.get("APPROVAL_TYPE") or row.get("approval_type") or "").strip() or "(blank)"] += 1
            statuses[(row.get("APPROVAL_STATUS") or row.get("approval_status") or "").strip() or "(blank)"] += 1
            holder = (row.get("APPROVAL_PERMIT_HOLDER") or row.get("approval_permit_holder") or "").strip()
            if holder:
                with_holder += 1
                holders[holder] += 1
            apn = (row.get("GIS_APN") or row.get("job_apn") or "").strip()
            if apn:
                with_apn += 1
            val = (row.get("APPROVAL_VALUATION") or row.get("approval_valuation") or "").strip()
            if val:
                with_val += 1
            created = (row.get("APPROVAL_CREATE_DATE") or row.get("date_approval_create") or "").strip()
            if created:
                create_min = created if not create_min or created < create_min else create_min
                create_max = created if not create_max or created > create_max else create_max
            lic_hit = LICENSE_RE.findall(holder)
            addr = row.get("GIS_ADDRESS") or row.get("address_job") or ""
            if lic_hit:
                with_lic += 1
                cls = classify_cslb(lic_hit[0], holder, addr, None, "SAN DIEGO", spine)
            else:
                cls = classify_cslb(None, holder, addr, None, "SAN DIEGO", spine)
            exact[cls] += 1
            if holder and len(sample_holders) < 8:
                sample_holders.append({"approval_id": aid, "permit_holder": holder, "class": cls})
    return {
        "jurisdiction": "CITY_OF_SAN_DIEGO",
        "not_san_diego_county_permits": True,
        "grain": "one approval row (permit/map/agreement); APPROVAL ROW != PROJECT COUNT",
        "rows": rows,
        "distinct_approval_ids": len(approvals),
        "distinct_project_ids": len(projects),
        "approval_type_top": types.most_common(15),
        "approval_status_top": statuses.most_common(15),
        "rows_with_permit_holder": with_holder,
        "distinct_permit_holders": len(holders),
        "rows_with_apn": with_apn,
        "rows_with_valuation": with_val,
        "rows_with_license_like_token_in_holder": with_lic,
        "cslb_match": dict(exact),
        "create_date_min": create_min,
        "create_date_max": create_max,
        "permit_holder_meaning": "Contact name whom the Approval is issued to (official dictionary). Not automatically a licensed contractor.",
        "sample": sample_holders,
        "columns": cols,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def profile_sd_business(path: Path, spine: dict, status_expected: str | None = None) -> dict:
    rows = 0
    accounts = set()
    names = set()
    status = Counter()
    families = Counter()
    construction_rows = 0
    construction_accounts = set()
    match = Counter()
    phones = emails = websites = addresses = 0
    with path.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        cols = reader.fieldnames or []
        for row in reader:
            rows += 1
            acc = str(row.get("account_key") or "").strip()
            if acc:
                accounts.add(acc)
            dba = row.get("dba_name") or ""
            own = row.get("business_owner_name") or ""
            names.add(norm_name(dba) or norm_name(own))
            st = (row.get("account_status") or "").strip()
            status[st or "(blank)"] += 1
            fam = naics_family(row.get("naics_code"), row.get("naics_description"))
            if fam:
                families[fam] += 1
            parts = [
                row.get("address_no") or "",
                row.get("address_pd") or "",
                row.get("address_road") or "",
                row.get("address_sfx") or "",
            ]
            addr = " ".join(p for p in parts if p).strip()
            if addr:
                addresses += 1
            phone = row.get("phone") or row.get("business_phone") or ""
            if nonempty(phone):
                phones += 1
            if nonempty(row.get("email")):
                emails += 1
            if nonempty(row.get("website") or row.get("url")):
                websites += 1
            if fam == "construction":
                construction_rows += 1
                if acc:
                    construction_accounts.add(acc)
                cls = classify_cslb(None, dba or own, addr, row.get("address_zip"), row.get("address_city"), spine)
                match[cls] += 1
    names.discard("")
    return {
        "jurisdiction": "CITY_OF_SAN_DIEGO",
        "grain": "business tax certificate / account",
        "not_trade_license": True,
        "rows": rows,
        "distinct_accounts": len(accounts),
        "distinct_names": len(names),
        "status": dict(status),
        "family_rows": dict(families),
        "construction_related_rows": construction_rows,
        "construction_related_accounts": len(construction_accounts),
        "cslb_match": dict(match),
        "contacts": {
            "phones": phones,
            "emails": emails,
            "websites": websites,
            "addresses": addresses,
            "address_eligibility": "PUBLIC_ELIGIBLE",
            "phone_eligibility": "PUBLIC_ELIGIBLE" if phones else "INTERNAL_ONLY",
        },
        "columns": cols,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "status_filter_expected": status_expected,
    }


def write_fixture(path: Path, rows: list[dict], n: int = 12) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows[:n], indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    FIX_SF.mkdir(parents=True, exist_ok=True)
    FIX_SD.mkdir(parents=True, exist_ok=True)
    print("loading CSLB spine", flush=True)
    spine = load_cslb()
    print("cslb", spine["count"], flush=True)
    report: dict = {
        "ticket": "CA-CON-COUNTY-001A",
        "as_of": datetime.now(timezone.utc).date().isoformat(),
        "cslb_spine": {
            "rows": spine["count"],
            "coverage": "ACQUIRED_PARTIAL_STREAM_TRUNCATED",
            "complete_denominator": "UNKNOWN",
            "non_match_is_not_unlicensed": True,
        },
        "no_public_county_routes": True,
        "no_shared_county_loader": True,
    }
    sf_biz = RAW_SF / "g8m3-pdis-registered-business-locations.csv"
    sf_perm = RAW_SF / "i98e-djp9-building-permits.csv"
    sf_con = RAW_SF / "3pee-9qhc-building-permit-contacts.csv"
    sf_ins = RAW_SF / "vckc-dh2h-building-inspections.csv"
    sd_app = RAW_SD / "approvals_created_datasd.csv"
    sd_act = RAW_SD / "sd_businesses_active_datasd.csv"
    sd_inact = RAW_SD / "sd_businesses_inactive_2015tocurr_datasd.csv"
    sd_rent = RAW_SD / "rental_unit_business_tax_datasd.csv"

    def require(path: Path, label: str) -> None:
        if not path.exists():
            raise FileNotFoundError(f"missing {label}: {path}")

    print("SF business", flush=True)
    require(sf_biz, "sf business")
    report["sf_registered_business"] = profile_sf_business(sf_biz, spine)
    report["sf_registered_business"]["file"]["columns"] = next(
        csv.reader(sf_biz.open(encoding="utf-8", errors="replace"))
    )
    if sf_perm.exists():
        print("SF permits", flush=True)
        report["sf_building_permits"] = profile_sf_permits(sf_perm)
    else:
        report["sf_building_permits"] = {"acquired": False, "reason": "raw file not present"}
    print("SF contacts", flush=True)
    require(sf_con, "sf contacts")
    report["sf_permit_contacts"] = profile_sf_contacts(sf_con, spine)
    write_fixture(FIX_SF / "exact-cslb-permit-contacts.json", report["sf_permit_contacts"]["sample_exact"])
    if sf_ins.exists():
        print("SF inspections", flush=True)
        report["sf_inspections"] = profile_sf_inspections(sf_ins)
    else:
        report["sf_inspections"] = {"acquired": False, "reason": "raw file not present"}
    if sd_app.exists():
        print("SD approvals", flush=True)
        report["sd_city_approvals"] = profile_sd_approvals(sd_app, spine)
    else:
        report["sd_city_approvals"] = {"acquired": False, "reason": "use year-filtered created files; full 653MB skipped for disk"}
    if sd_act.exists():
        print("SD business active", flush=True)
        report["sd_business_tax_active"] = profile_sd_business(sd_act, spine, "Active")
    else:
        report["sd_business_tax_active"] = {"acquired": False}
    if sd_inact.exists():
        print("SD business inactive 2015+", flush=True)
        report["sd_business_tax_inactive_2015"] = profile_sd_business(sd_inact, spine, "Inactive")
    if sd_rent.exists() and sd_rent.stat().st_size > 100:
        print("SD rental", flush=True)
        rent = profile_csv(sd_rent)
        report["sd_rental_unit_business_tax"] = {
            "jurisdiction": "CITY_OF_SAN_DIEGO",
            "hub_value": "Lender/Investor property context; not contractor attribution",
            "no_owner_dossiers": True,
            **rent,
        }
    else:
        report["sd_rental_unit_business_tax"] = {
            "acquired": False,
            "reason": "optional file missing or empty after bounded download",
        }

    (OUT / "harvest-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("WROTE", OUT / "harvest-report.json")


if __name__ == "__main__":
    main()
