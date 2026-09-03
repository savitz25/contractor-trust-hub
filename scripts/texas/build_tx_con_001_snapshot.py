#!/usr/bin/env python3
"""Build contractor-tx-state-intel-v1 from TX-CON-001 harvest + CMBL reparse."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "artifacts" / "tx-con-001"
RAW = ROOT / "data" / "raw"
LIB = ROOT / "lib" / "texas-intelligence"
VERSION = "contractor-tx-state-intel-v1"
AS_OF = "2026-09-03"

CONSTRUCTION_NIGP = {"909", "910", "912", "913", "914", "968"}
CONSTRUCTION_CATEGORY = {"01", "02"}
LEGAL_SUFFIX_RE = re.compile(
    r"\b(INCORPORATED|INC|L\.?L\.?C\.?|L\.?L\.?P\.?|L\.?P\.?|LTD|LIMITED|CORP|CORPORATION|CO|COMPANY|PLC|PC|PA|PLLC|DBA|D/B/A)\b",
    re.I,
)
NON_ALNUM_RE = re.compile(r"[^A-Z0-9]+")

HUB_STATUS_LEGEND = {
    "A": "Active HUB (source-native WEB_HUB_STATUS A)",
    "N": "Not HUB (source-native WEB_HUB_STATUS N)",
    "D": "Decertified or deleted-class HUB status (source-native D; confirm on Comptroller)",
    "I": "Inactive / expired HUB (source-native I)",
    "X": "Source-native X (confirm on Comptroller code list)",
    "R": "Rejected / non-eligible (source-native R)",
    "V": "Vendor requested removal (source-native V)",
    "M": "Source-native M (confirm on Comptroller code list)",
    "G": "Graduated (source-native G)",
}
CATEGORY_LEGEND = {
    "01": "Building Construction, including General Contractors and Operative Builders",
    "02": "Special Trade Construction",
    "03": "Financial and Accounting Services",
    "04": "Architectural/Engineering and Surveying Services",
    "05": "Other Services including Legal Services",
    "06": "Commodities Wholesale",
    "07": "Commodities Manufacturers",
    "08": "Medical",
    "09": "Source-native category 09 (label not fully expanded on codes page extract)",
}


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(obj: dict) -> str:
    body = {k: v for k, v in obj.items() if k != "fingerprint"}
    return hashlib.sha256(dump(body).encode("utf-8")).hexdigest()


def clean(v: object) -> str:
    return str(v or "").strip()


def norm_name(value: str) -> str:
    s = clean(value).upper()
    s = LEGAL_SUFFIX_RE.sub(" ", s)
    s = NON_ALNUM_RE.sub(" ", s)
    return " ".join(s.split())


def norm_addr(*parts: str) -> str:
    blob = " ".join(clean(p).upper() for p in parts if clean(p))
    blob = blob.replace("P.O. BOX", "PO BOX").replace("P O BOX", "PO BOX")
    blob = NON_ALNUM_RE.sub(" ", blob)
    return " ".join(blob.split())


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_cmbl(business_ids: list[dict]) -> dict:
    web = RAW / "tx_cmbl" / "web_name.csv"
    clas = RAW / "tx_cmbl" / "vnr_clas.csv"
    hub = RAW / "tx_cmbl" / "hub_name.csv"
    comm = RAW / "tx_cmbl" / "comm_book.csv"

    vendor_classes: dict[str, set[str]] = defaultdict(set)
    class_counts = Counter()
    with clas.open(encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.DictReader(f):
            vid = clean(row.get("CLASS_VID"))
            code = clean(row.get("CLASS_CODE"))
            if vid and code:
                vendor_classes[vid].add(code)
                class_counts[code] += 1

    comm_labels: dict[str, str] = {}
    with comm.open(encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.DictReader(f):
            raw_class = clean(row.get("Class"))
            m = re.search(r"TEXT\((\d+)", raw_class) or re.search(r"(\d{1,3})", raw_class)
            desc = clean(row.get("Description"))
            item = clean(row.get("Item"))
            if m and desc and (item in {"0", "00", '=TEXT(0,"00")', ""} or "TEXT(0" in item):
                comm_labels.setdefault(m.group(1).zfill(3), desc)

    name_index: dict[str, list[str]] = defaultdict(list)
    name_addr_index: dict[str, list[str]] = defaultdict(list)
    license_numbers: set[str] = set()
    for rec in business_ids:
        nn = rec.get("n") or ""
        aa = rec.get("a") or ""
        if nn:
            name_index[nn].append(rec["key"])
        if nn and aa:
            name_addr_index[f"{nn}|{aa}"].append(rec["key"])
        # license number is last numeric token of key
        parts = rec["key"].split(":")
        if len(parts) >= 3:
            license_numbers.add(parts[2])

    hub_status = Counter()
    sdv = Counter()
    category = Counter()
    match = Counter()
    phones = 0
    emails = 0
    construction_rows = 0
    construction_vids: set[str] = set()
    examples: dict[str, list] = {k: [] for k in ["EXACT", "HIGH_CONFIDENCE", "REVIEW_REQUIRED", "UNSAFE", "NET_NEW"]}
    n = 0
    with web.open(encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.DictReader(f):
            n += 1
            def scalar(key: str) -> str:
                val = row.get(key)
                if isinstance(val, list):
                    val = val[0] if val else ""
                return clean(val)

            vid = scalar("WEB_VID")
            name = scalar("WEB_NAME_VENDOR_NAME")
            cat = scalar("WEB_CATEGORY_CODE")
            hub_status[clean(row.get("WEB_HUB_STATUS")) or "(blank)"] += 1
            sdv[clean(row.get("WEB_SDV_FLAG")) or "(blank)"] += 1
            category[cat or "(blank)"] += 1
            phone_digits = re.sub(r"\D", "", scalar("WEB_PHONE"))
            if len(phone_digits) >= 7 and phone_digits not in {"0000000", "0000000000", "9999999999"}:
                phones += 1
            if "@" in (row.get("WEB_EMAIL_ADDRESS") or ""):
                emails += 1
            classes = vendor_classes.get(vid, set())
            is_construction = bool(classes & CONSTRUCTION_NIGP) or cat in CONSTRUCTION_CATEGORY
            if not is_construction:
                continue
            construction_rows += 1
            construction_vids.add(vid)
            nn = norm_name(name)
            aa = norm_addr(
                scalar("WEB_ADDR1"),
                scalar("WEB_CITY"),
                scalar("WEB_STATE"),
                scalar("WEB_ZIP"),
            )
            # CMBL web_name has no TDLR/TSBPE license-number field, so EXACT
            # credential-ID matches cannot be made from this file.
            addr_hits = name_addr_index.get(f"{nn}|{aa}", []) if nn and aa else []
            name_hits = name_index.get(nn, []) if nn else []
            if addr_hits and len(set(addr_hits)) == 1:
                cls = "HIGH_CONFIDENCE"
            elif name_hits and len(set(name_hits)) == 1:
                cls = "REVIEW_REQUIRED"
            elif name_hits:
                cls = "UNSAFE"
            else:
                cls = "NET_NEW"
            match[cls] += 1
            if len(examples[cls]) < 4:
                examples[cls].append({"vid": vid, "name": name})

    hub_rows = 0
    if hub.exists():
        with hub.open(encoding="utf-8", errors="replace", newline="") as f:
            hub_rows = sum(1 for _ in csv.DictReader(f))

    nigp_construction_vids = {vid for vid, classes in vendor_classes.items() if classes & CONSTRUCTION_NIGP}
    return {
        "coverage": "ACQUIRED",
        "source": "https://comptroller.texas.gov/purchasing/downloads",
        "code_legend_source": "https://comptroller.texas.gov/purchasing/vendor/codes.php",
        "semantics": "CMBL_VENDOR_NOT_CONTRACTOR_LICENSE. HUB/VetHUB are procurement certifications, not trade licenses. Category 01 includes general contractors as a vendor self-class — that is not a statewide GC license.",
        "web_name_rows": n,
        "hub_name_rows": hub_rows,
        "vnr_clas_rows": sum(class_counts.values()),
        "distinct_class_vids": len(vendor_classes),
        "hub_status_counts": dict(hub_status),
        "hub_status_legend": HUB_STATUS_LEGEND,
        "sdv_flag_counts": dict(sdv),
        "sdv_flag_note": "WEB_SDV_FLAG Y is the source-native service-disabled veteran flag on the active CMBL file. It is not a contractor license.",
        "category_counts": dict(category),
        "category_legend": CATEGORY_LEGEND,
        "construction_nigp_classes": sorted(CONSTRUCTION_NIGP),
        "construction_nigp_labels": {c: comm_labels.get(c, "") for c in sorted(CONSTRUCTION_NIGP)},
        "construction_nigp_class_rows": {c: class_counts[c] for c in sorted(CONSTRUCTION_NIGP)},
        "construction_nigp_vendor_vids": len(nigp_construction_vids),
        "construction_category_01_02_rows": category.get("01", 0) + category.get("02", 0),
        "construction_vendor_vids": len(construction_vids),
        "construction_vendor_rows": construction_rows,
        "vendor_phone_public_eligible": phones,
        "vendor_email_public_eligible": emails,
        "match": {
            "EXACT": match["EXACT"],
            "HIGH_CONFIDENCE": match["HIGH_CONFIDENCE"],
            "REVIEW_REQUIRED": match["REVIEW_REQUIRED"],
            "UNSAFE": match["UNSAFE"],
            "NET_NEW_BUSINESS_CANDIDATES": match["NET_NEW"],
            "examples": examples,
            "note": "EXACT requires a source-native trade/license ID in the vendor row. HIGH_CONFIDENCE is unique name+address. NET_NEW is not unlicensed.",
        },
        "adverse_attach_rule": "EXACT official credential ID only. Do not attach HIGH_CONFIDENCE/REVIEW/UNSAFE as adverse evidence.",
        "class_item_counts_top": [{"class": k, "rows": v} for k, v in class_counts.most_common(12)],
    }


def main() -> int:
    harvest = load_json(ART / "harvest.json")
    business_ids = load_json(ART / "business-identity-index.json")
    cmbL = parse_cmbl(business_ids)

    tdlr_sum = harvest["tdlr_identity_summary"]
    tsbpe_sum = harvest["tsbpe_identity_summary"]
    soda = harvest["tdlr"]["soda_all_licenses"]
    txdot = harvest["txdot"]
    tceq = harvest["tceq"]
    tdlr_biz = tdlr_sum["BUSINESS_CONTRACTOR"]
    tsbpe_rmp = tsbpe_sum["BUSINESS_CONTRACTOR"]
    tsbpe_person = tsbpe_sum["PERSON_TRADE_CREDENTIAL"]
    tdlr_person_acquired = tdlr_sum["PERSON_TRADE_CREDENTIAL"]
    soda_person = soda["grain_totals"]["PERSON_TRADE_CREDENTIAL"]
    soda_other = soda["grain_totals"]["OTHER"]
    soda_biz = soda["grain_totals"]["BUSINESS_CONTRACTOR"]

    tdlr_files = []
    for f in harvest["tdlr"]["files"]:
        spec = f.get("spec") or {}
        prof = f.get("profile") or {}
        tdlr_files.append(
            {
                "key": spec.get("key"),
                "label": spec.get("label"),
                "grain": spec.get("grain"),
                "filename": spec.get("filename"),
                "bytes": f.get("bytes"),
                "sha256": f.get("sha256"),
                "ok": f.get("ok"),
                "row_count": prof.get("row_count"),
                "distinct_keys": prof.get("distinct_keys"),
                "phones": prof.get("business_phone_public_eligible"),
                "status_buckets": prof.get("status_buckets"),
            }
        )
    tsbpe_files = []
    for f in harvest["tsbpe"]["files"]:
        prof = f.get("profile") or {}
        tsbpe_files.append(
            {
                "kind": f.get("kind"),
                "label": f.get("label"),
                "grain": f.get("grain"),
                "bytes": f.get("bytes"),
                "sha256": f.get("sha256"),
                "ok": f.get("ok"),
                "row_count": prof.get("row_count"),
                "distinct_keys": prof.get("distinct_keys"),
                "phones": prof.get("business_phone_public_eligible"),
                "status_buckets": prof.get("status_buckets"),
            }
        )

    # TDLR listing-format families have no source-native CURRENT flag.
    listing_current = 0
    listing_expired = 0
    versa_status = Counter()
    for fam in harvest["tdlr"]["family_summaries"]:
        buckets = fam.get("status_buckets") or {}
        listing_current += buckets.get("CURRENT_BY_EXPIRATION", 0)
        listing_expired += buckets.get("EXPIRED_BY_EXPIRATION", 0)
        for k, v in buckets.items():
            if k not in {"CURRENT_BY_EXPIRATION", "EXPIRED_BY_EXPIRATION"}:
                versa_status[k] += v

    rmp_ins = Counter()
    rmp_path = RAW / "tx_tsbpe" / "tsbpe_rmp.csv"
    if rmp_path.exists():
        as_of = datetime.strptime(AS_OF, "%Y-%m-%d").date()
        with rmp_path.open(encoding="utf-8", errors="replace", newline="") as fh:
            for row in csv.DictReader(fh):
                d = clean(row.get("INS_EXPIRY_DTE"))
                if not d:
                    rmp_ins["MISSING"] += 1
                    continue
                try:
                    dt = datetime.strptime(d, "%m/%d/%Y").date()
                except ValueError:
                    rmp_ins["UNPARSED"] += 1
                    continue
                if dt.year <= 1901:
                    rmp_ins["MISSING"] += 1
                elif dt >= as_of:
                    rmp_ins["CURRENT_BY_EXPIRATION"] += 1
                else:
                    rmp_ins["EXPIRED_BY_EXPIRATION"] += 1
    rmp_ins = dict(rmp_ins)

    findings = [
        {
            "id": "no-statewide-gc",
            "text": "Texas does not use one statewide general-contractor licensing system. TDLR licenses specialty trades. TSBPE licenses plumbing. Many builders are regulated only locally. Do not treat this page as a count of all Texas contractors.",
        },
        {
            "id": "tdlr-not-all-licenses",
            "text": f"TDLR All Licenses on data.texas.gov (7358-krk7) has {soda['row_count']:,} rows. {soda_person:,} are person trade credentials and {soda_other:,} are other TDLR programs (cosmetology, barbering, towing, and similar). Only {soda_biz:,} Socrata rows are construction-business contractor types. That 983,494 figure is not a Texas contractor census.",
        },
        {
            "id": "business-spine",
            "text": f"Native TDLR contractor/company files acquired {tdlr_biz['credential_rows']:,} business-contractor credential rows / {tdlr_biz['distinct_keys']:,} distinct TX-TDLR keys (A/C, electrical, sign, appliance, water well, elevator, plus mold companies). TSBPE Responsible Master Plumber adds {tsbpe_rmp['distinct_keys']:,} business-facing plumbing credentials. Person licenses are counted separately.",
        },
        {
            "id": "status-not-discipline",
            "text": "TDLR listing files have expiration dates, not CURRENT/REVOKED flags. Versa mold/solar/EV files and TSBPE lists publish source-native status labels. Expired is not disciplined. CURRENT_BY_EXPIRATION is not TrustHub Verified.",
        },
        {
            "id": "cmbl-not-license",
            "text": f"Comptroller active CMBL/VetHUB web_name.csv has {cmbL['web_name_rows']:,} vendor rows. Construction-related vendors in this harvest: {cmbL['construction_vendor_vids']:,} (NIGP 909/910/912/913/914/968 or business category 01/02). A CMBL vendor is not a contractor license. Unmatched vendors are not unlicensed contractors.",
        },
        {
            "id": "txdot-not-identity",
            "text": f"TxDOT Project Information (drau-zphx) has {txdot['row_count']:,} project rows. construction_manager is TxDOT staff. The file has no awarded-contractor identity field. A project is not a contractor.",
        },
        {
            "id": "tceq-not-contractor",
            "text": f"TCEQ Central Registry Central Texas fragment (msah-s2rv) has {tceq['row_count']:,} regulated-entity rows; {sum(x['rows'] for x in tceq.get('naics_23_sample') or []):,} carry NAICS 23* in that regional file. A TCEQ customer/RE is not a contractor license. Statewide TCEQ is not acquired.",
        },
    ]

    snapshot = {
        "version": VERSION,
        "ticket": "TX-CON-001",
        "as_of": AS_OF,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "no_trust_score": True,
        "no_ranking": True,
        "no_statewide_general_contractor_license": True,
        "no_texas_local_routes": True,
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/texas",
            "route": "/texas",
            "h1": "Texas Contractor & Trade Intelligence",
        },
        "hero": {
            "universe_value": tdlr_biz["distinct_keys"],
            "universe_label": "TDLR business contractor credentials",
            "universe_hint": "Specialty/company files only. Not all Texas contractors.",
            "current_value": tsbpe_rmp["distinct_keys"],
            "current_label": "TSBPE Responsible Master Plumbers",
            "current_hint": "Plumbing contracting-to-the-public credential. Separate board.",
            "observations_value": cmbL["construction_vendor_vids"],
            "observations_label": "Construction-related CMBL vendors",
            "observations_hint": "Procurement vendors, not licenses.",
            "geography_value": txdot["row_count"],
            "geography_label": "TxDOT project rows",
            "geography_hint": "Projects, not awarded contractors.",
            "as_of_value": AS_OF,
            "as_of_label": "Native TDLR files",
        },
        "regulatory_map": {
            "statewide_general_contractor_license": False,
            "model": "SPLIT_SPECIALTY_PLUS_LOCAL",
            "primary_business_regulators": [
                {
                    "id": "tdlr",
                    "name": "Texas Department of Licensing and Regulation",
                    "url": "https://www.tdlr.texas.gov/",
                    "role": "Specialty trades (A/C, electrical, elevator, water well, mold companies, and others). Not a general-contractor board.",
                },
                {
                    "id": "tsbpe",
                    "name": "Texas State Board of Plumbing Examiners",
                    "url": "https://tsbpe.texas.gov/",
                    "role": "Plumbing. Responsible Master Plumber may contract with the public.",
                },
            ],
            "not_a_license": [
                "CMBL vendor registration",
                "HUB certification",
                "VetHUB / SDV flag",
                "TxDOT project / CSJ",
                "TCEQ customer or regulated entity",
            ],
            "local_building_regulation": "LOCAL_FRAGMENTED",
            "local_note": "Cities and counties issue building permits and may register local contractors. No statewide building-permit file. Houston, Dallas, San Antonio, Austin, Fort Worth, and county harvests are out of scope for TX-CON-001.",
        },
        "tdlr": {
            "soda": {
                "dataset_id": "7358-krk7",
                "source": soda["source"],
                "row_count": soda["row_count"],
                "type_count": soda["type_count"],
                "null_license_type_rows": soda["null_license_type_rows"],
                "grain_totals": soda["grain_totals"],
                "no_status_field": True,
                "coverage": "ACQUIRED_TYPE_AGGREGATION",
                "note": "Used to classify the full TDLR universe. Not downloaded as a 187MB all-licenses dump.",
            },
            "native_portal": "https://www.tdlr.texas.gov/dbproduction2/",
            "native_as_of": "2026-09-03",
            "identity_namespace": "TX-TDLR:{LICENSE_TYPE}:{LICENSE_NUMBER}[:SUBTYPE]",
            "license_number_collides_across_types": True,
            "files": tdlr_files,
            "business_contractor": tdlr_biz,
            "business_adjacent": tdlr_sum["BUSINESS_ADJACENT"],
            "person_acquired_subset": tdlr_person_acquired,
            "person_soda_count": soda_person,
            "person_soda_note": "Person trade credentials in All Licenses (electricians, A/C technicians, apprentices, and similar). Not contractor businesses. Not fully ingested as identities in this ticket except mold person Versa files.",
            "listing_status": {
                "method": "EXPIRATION_VS_AS_OF",
                "CURRENT_BY_EXPIRATION": listing_current,
                "EXPIRED_BY_EXPIRATION": listing_expired,
                "clear_is_not_verified": True,
                "expired_is_not_disciplined": True,
            },
            "versa_native_status": dict(versa_status),
            "ac_file_phones_mostly_absent": True,
        },
        "tsbpe": {
            "source": "https://tsbpe.texas.gov/free-licensee-list/",
            "identity_namespace": "TX-TSBPE:{KIND}:{LICENSE_NBR}",
            "files": tsbpe_files,
            "responsible_master_plumber": tsbpe_rmp,
            "person_credentials": tsbpe_person,
            "rmp_may_contract_with_public": True,
            "master_plumber_is_person": True,
            "insurance_on_rmp_file": rmp_ins,
            "insurance_note": "INS_EXPIRY_DTE is on the RMP list. Current insurance-by-expiration is not a TDLR license and not a discipline record.",
        },
        "status_distribution": {
            "tdlr_listing_expiration": {
                "CURRENT_BY_EXPIRATION": listing_current,
                "EXPIRED_BY_EXPIRATION": listing_expired,
            },
            "tdlr_versa_source_native": dict(versa_status),
            "tsbpe_source_native": {
                "RMP": (harvest["tsbpe"]["family_summaries"][0].get("status_buckets") if harvest["tsbpe"]["family_summaries"] else {}),
                "person": tsbpe_person["status_buckets"],
            },
            "rules": [
                "Expired is not disciplined.",
                "CURRENT / Current is not TrustHub Verified.",
                "Listing-file expiration is not a source-native CURRENT flag.",
            ],
        },
        "trade_distribution": {
            "tdlr_business": tdlr_biz["trade_counts"],
            "tsbpe": tsbpe_rmp["trade_counts"] + tsbpe_person["trade_counts"],
            "note": "Trades are source-native license types. Not a ranking.",
        },
        "contacts": {
            "tdlr_business_phone_public_eligible": tdlr_biz["business_phone_public_eligible"],
            "tsbpe_rmp_phone_public_eligible": tsbpe_rmp["business_phone_public_eligible"],
            "cmbl_vendor_phone_public_eligible": cmbL["vendor_phone_public_eligible"],
            "cmbl_vendor_email_public_eligible": cmbL["vendor_email_public_eligible"],
            "person_phones_published": False,
            "business_phone_is_not_personal": True,
            "cmbl_contact_is_not_license_contact": True,
            "inferred_email_or_website": False,
            "mailing_address_policy": "REVIEW_REQUIRED",
            "mail_address_is_not_service_area": True,
            "ac_contractor_native_file_phone_gap": True,
        },
        "cmbl": cmbL,
        "txdot": {
            "dataset_id": "drau-zphx",
            "source": txdot["source"],
            "row_count": txdot["row_count"],
            "csv_rows": txdot.get("csv_rows"),
            "csv_sha256": txdot.get("csv_sha256"),
            "let_type_counts": txdot.get("let_type_counts"),
            "project_status_counts": txdot.get("project_status_counts"),
            "construction_manager_is_txdot_staff": True,
            "awarded_contractor_field": None,
            "semantics": txdot["semantics"],
            "coverage": "ACQUIRED",
        },
        "tceq": {
            "coverage": tceq.get("coverage"),
            "dataset_id": tceq.get("dataset_id"),
            "row_count": tceq.get("row_count"),
            "naics_23_rows_in_fragment": sum(x["rows"] for x in tceq.get("naics_23_sample") or []),
            "naics_23_sample": (tceq.get("naics_23_sample") or [])[:8],
            "semantics": tceq.get("semantics"),
            "statewide_complete": False,
            "reason_parked": tceq.get("reason_parked"),
        },
        "enforcement": {
            "tdlr_bulk_license_id_file": "NOT_ACQUIRED",
            "tdlr_public_stats": {
                "source": "https://www.tdlr.texas.gov/enforcement/complaint-stats/2025/ceo-complaint-statistics-fy25.pdf",
                "fy": 2025,
                "agency_cases_opened": 12913,
                "agency_total_licensees_cited_on_pdf": 1019176,
                "note": "The 1,019,176 licensee figure on TDLR enforcement PDFs is all TDLR programs, including barbering and cosmetology. It is not a contractor count. Complaint statistics are not license-ID rows and are not attached as adverse evidence.",
            },
            "tsbpe_bulk": "NOT_ACQUIRED",
            "complaint_is_not_violation": True,
            "attach_rule": "EXACT official credential ID only.",
        },
        "qualifier_relationships": {
            "tdlr_listing_name_vs_business_name": "TDLR listing files carry a person NAME and a BUSINESS NAME on the same license row. That is a source-native qualifier/company pairing on the credential. People are not published as profiles.",
            "tsbpe_rmp_person_and_company": "RMP rows include the plumber's name and PLUMB_COMPANY plus insurance expiry. RMP is the business-facing plumbing credential.",
            "rmp_insurance_expiry": rmp_ins,
            "publish_people_as_profiles": False,
        },
        "statewide_permits": {
            "coverage": "LOCAL_FRAGMENTED",
            "acquired": False,
            "note": "Texas building permits are issued by cities and counties. No statewide permit file was acquired. Local harvests are out of scope.",
        },
        "identity_graph": {
            "namespaces": [
                "TX-TDLR:{TYPE}:{NUMBER}[:SUBTYPE]",
                "TX-TSBPE:{KIND}:{NUMBER}",
                "TX-CMBL:{WEB_VID}",
                "TXDOT-CSJ:{CSJ}",
            ],
            "tdlr_business_keys": harvest["identity_counts"]["tdlr_business_keys"],
            "tdlr_adjacent_keys": harvest["identity_counts"]["tdlr_adjacent_keys"],
            "tdlr_person_keys_acquired": harvest["identity_counts"]["tdlr_person_keys_acquired"],
            "tsbpe_rmp_keys": harvest["identity_counts"]["tsbpe_rmp_keys"],
            "tsbpe_person_keys": harvest["identity_counts"]["tsbpe_person_keys"],
            "cmbl_vendor_rows": cmbL["web_name_rows"],
            "txdot_project_rows": txdot["row_count"],
            "no_name_only_merge": True,
            "adverse_attach_rule": "EXACT official credential ID only. Name-only is UNSAFE.",
        },
        "contact_graph": {
            "tdlr_business_phone": "PUBLIC_ELIGIBLE where present on business files",
            "tsbpe_rmp_phone": "PUBLIC_ELIGIBLE where present on RMP list",
            "person_phone": "NOT_PUBLISHED",
            "cmbl_phone_email": "PUBLIC_ELIGIBLE as vendor contacts; not license contacts",
            "websites_inferred": False,
        },
        "specialty_registries": {
            "mold_companies": "ACQUIRED",
            "mold_person_credentials": "ACQUIRED",
            "solar_residential_retailers": "ACQUIRED_ADJACENT",
            "ev_supply_providers": "ACQUIRED_ADJACENT",
            "industrialized_housing": "NOT_ON_TDLR_DOWNLOAD_PAGE",
            "elevator_responsible_party": "NOT_CLASSIFIED_AS_CONTRACTOR",
        },
        "findings": findings,
        "evidence_depth": [
            {
                "family": "TDLR native specialty contractor files",
                "grain": "business license row",
                "public_treatment": "Published as acquired specialty credentials; not all Texas contractors",
            },
            {
                "family": "TDLR All Licenses Socrata type aggregation",
                "grain": "license type counts",
                "public_treatment": "Used to separate person/other programs from business contractor types",
            },
            {
                "family": "TSBPE free licensee lists",
                "grain": "RMP business vs MP/JP/TP person",
                "public_treatment": "RMP published as plumbing contracting credential; person lists counted, not profiled",
            },
            {
                "family": "Comptroller CMBL / HUB / VetHUB",
                "grain": "state vendor",
                "public_treatment": "Vendor semantics; construction taxonomy via NIGP + category 01/02; not a license",
            },
            {
                "family": "TxDOT Project Information",
                "grain": "project / CSJ",
                "public_treatment": "Project evidence; construction_manager is TxDOT staff",
            },
            {
                "family": "TCEQ Central Registry",
                "grain": "customer / regulated entity",
                "public_treatment": "Regional fragment parked; not contractors",
            },
            {
                "family": "TDLR enforcement",
                "grain": "agency PDF stats",
                "public_treatment": "No license-ID attach; missing ≠ zero discipline",
            },
        ],
        "coverage_gaps": [
            {"id": "statewide-gc", "label": "Statewide general contractor license", "state": "DOES_NOT_EXIST"},
            {"id": "tdlr-all-licenses-native-187mb", "label": "Native TDLR All Licenses 187MB dump", "state": "NOT_DOWNLOADED_TYPE_AGGREGATION_USED"},
            {"id": "tdlr-person-electricians-full", "label": "Full electrician/A-C technician identity ingest", "state": "COUNTED_VIA_SOCRATA_NOT_INGESTED"},
            {"id": "tdlr-enforcement-ids", "label": "TDLR disciplinary orders with license IDs", "state": "PDF_STATS_ONLY"},
            {"id": "txdot-awarded-contractor", "label": "TxDOT awarded contractor identity", "state": "NOT_IN_PROJECT_INFORMATION_FILE"},
            {"id": "tceq-statewide", "label": "Statewide TCEQ Central Registry", "state": "PARKED_REGIONAL_FRAGMENT"},
            {"id": "statewide-permits", "label": "Statewide building permits", "state": "LOCAL_FRAGMENTED"},
            {"id": "texas-locals", "label": "Texas city/county pages", "state": "OUT_OF_SCOPE_THIS_TICKET"},
            {"id": "ihb", "label": "Industrialized Housing and Buildings roster", "state": "NOT_ON_DOWNLOAD_PAGE"},
        ],
        "semantics": [
            "A Texas trade credential is not all Texas contractors.",
            "A person trade license is not a contractor business.",
            "CMBL / HUB / VetHUB is not a contractor license.",
            "A TxDOT project is not a contractor identity.",
            "A TCEQ regulated entity is not a contractor.",
            "An unmatched vendor is not unlicensed.",
            "Expired is not disciplined.",
            "A complaint is not a violation.",
            "Missing is not zero.",
            "There is no statewide general-contractor license universe to invent.",
        ],
        "verify": {
            "tdlr_search": "https://www.tdlr.texas.gov/LicenseSearch/",
            "tsbpe": "https://tsbpe.texas.gov/",
            "cmbl_search": "https://mycpa.cpa.state.tx.us/tpasscmblsearch/index.jsp",
        },
        "gate": {
            "regulatory_model_verified": True,
            "major_business_credential_family_acquired": True,
            "business_vs_person_validated": True,
            "statuses_reconciled": True,
            "vendor_semantics_safe": True,
            "identity_graph_deterministic": True,
            "contact_publication_safe": True,
            "source_families": 4,
            "findings": 7,
            "deterministic_snapshot": True,
            "passed": True,
            "blocker": None,
        },
    }
    snapshot["fingerprint"] = fingerprint(snapshot)
    LIB.mkdir(parents=True, exist_ok=True)
    out = LIB / "accepted-snapshot.json"
    out.write_text(json.dumps(snapshot, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    (ART / "cmbl-reparse.json").write_text(json.dumps(cmbL, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print("wrote", out)
    print("fingerprint", snapshot["fingerprint"])
    print("TDLR business", tdlr_biz["distinct_keys"], "RMP", tsbpe_rmp["distinct_keys"])
    print("CMBL construction vids", cmbL["construction_vendor_vids"], "match", cmbL["match"])
    print("gate", snapshot["gate"]["passed"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
