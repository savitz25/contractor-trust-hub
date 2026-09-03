"""Build CA-CON-002 public snapshot, compact inventory, and hash manifest.

Does not commit the giant raw CSLB CSV. Compact public inventory is the
search payload. Snapshot metrics are the page contract.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "ca_cslb_master"
MASTER = RAW / "license_master.part"
ASB_HTML = ROOT / "data" / "raw" / "ca_dosh_asbestos" / "acrulist.html"
DLSE_HTML = ROOT / "data" / "raw" / "ca_dlse_debarment" / "debar.html"
CA001 = json.loads((ROOT / "artifacts" / "ca-con-001" / "acquisition-summary.json").read_text(encoding="utf-8"))
CLASS_DICT = json.loads((ROOT / "artifacts" / "ca-con-001" / "classification-dictionary.json").read_text(encoding="utf-8"))
ART = ROOT / "artifacts" / "ca-con-002"
LIB = ROOT / "lib" / "california-intelligence"
PUBLIC_INV = ROOT / "public" / "california-inventory.json"
VERSION = "contractor-ca-state-intel-v1"
INSTANT = "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx"
DETAIL = "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum="
PORTAL = "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList"

PHONE_RE = re.compile(r"\d{7,}")
LICENSE_ID_RE = re.compile(
    r"(?:CSLB(?:\s+License)?\s*(?:Number|#)|CSLB#|CSB\s*#)\s*:?\s*#?\s*(\d{5,8})",
    re.I,
)


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(obj: dict) -> str:
    body = {k: v for k, v in obj.items() if k != "fingerprint"}
    return hashlib.sha256(dump(body).encode("utf-8")).hexdigest()


def sha256(path: Path) -> str | None:
    if not path.exists():
        return None
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def class_tokens(raw: str) -> list[str]:
    parts = [re.sub(r"[^A-Z0-9]", "", p.strip().upper()) for p in re.split(r"[|,]", raw or "") if p.strip()]
    return [p for p in parts if p]


def phone_ok(value: str | None) -> bool:
    digits = re.sub(r"\D", "", value or "")
    return len(digits) >= 7


def parse_master(path: Path) -> dict:
    rows = []
    with path.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames or []
        for row in reader:
            lic = (row.get("LicenseNo") or "").strip()
            if not lic.isdigit():
                continue
            rows.append(row)
    statuses = Counter((r.get("PrimaryStatus") or "").strip() or "UNKNOWN" for r in rows)
    secondary = Counter((r.get("SecondaryStatus") or "").strip() for r in rows if (r.get("SecondaryStatus") or "").strip())
    types = Counter((r.get("BusinessType") or "").strip() or "UNKNOWN" for r in rows)
    counties = Counter((r.get("County") or "").strip() or "UNKNOWN" for r in rows)
    cities = Counter((r.get("City") or "").strip().upper() or "UNKNOWN" for r in rows)
    class_counts: Counter[str] = Counter()
    multi_class = 0
    for r in rows:
        parts = class_tokens(r.get("Classifications(s)") or r.get("Classifications") or "")
        if len(parts) > 1:
            multi_class += 1
        if not parts:
            class_counts["UNKNOWN"] += 1
        for p in parts:
            class_counts[p] += 1
    phones = sum(1 for r in rows if phone_ok(r.get("BusinessPhone")))
    addr = sum(1 for r in rows if (r.get("MailingAddress") or "").strip() and (r.get("City") or "").strip())
    names = sum(1 for r in rows if (r.get("FullBusinessName") or r.get("BusinessName") or "").strip())
    unique_name_addr = {
        (
            (r.get("FullBusinessName") or r.get("BusinessName") or "").strip().upper(),
            (r.get("MailingAddress") or "").strip().upper(),
            (r.get("ZIPCode") or "").strip()[:5],
        )
        for r in rows
        if (r.get("FullBusinessName") or r.get("BusinessName") or "").strip()
    }
    unique_lic = {(r.get("LicenseNo") or "").strip() for r in rows}
    first_name = (rows[0].get("FullBusinessName") or rows[0].get("BusinessName") or "") if rows else ""
    last_name = (rows[-1].get("FullBusinessName") or rows[-1].get("BusinessName") or "") if rows else ""
    wc_type = Counter((r.get("WorkersCompCoverageType") or "").strip() or "UNKNOWN" for r in rows)
    wc_susp_field = sum(1 for r in rows if (r.get("WCSuspendDate") or "").strip())
    asb_reg = sum(1 for r in rows if (r.get("AsbestosReg") or "").strip())
    return {
        "rows": rows,
        "fieldnames": fieldnames,
        "license_rows": len(rows),
        "distinct_license_numbers": len(unique_lic),
        "distinct_business_name_address_zip": len(unique_name_addr),
        "named_rows": names,
        "rows_with_business_phone": phones,
        "rows_with_mailing_address": addr,
        "primary_status_counts": dict(statuses),
        "secondary_status_counts": dict(secondary.most_common(20)),
        "business_type_counts": dict(types.most_common()),
        "county_counts": dict(counties.most_common()),
        "county_count": len(counties),
        "city_count": len(cities),
        "classification_token_counts": dict(class_counts.most_common()),
        "distinct_classification_tokens": len(class_counts),
        "multi_class_license_rows": multi_class,
        "first_business_name": first_name,
        "last_business_name": last_name,
        "wc_coverage_type_counts": dict(wc_type.most_common()),
        "rows_with_wc_suspend_date": wc_susp_field,
        "rows_with_asbestos_reg_field": asb_reg,
        "license_set": unique_lic,
    }


def parse_debarment(html: str) -> dict:
    text = re.sub(r"<[^>]+>", "\n", html)
    compact = re.sub(r"[ \t]+", " ", text)
    ids = LICENSE_ID_RE.findall(compact)
    exact_ids = sorted(set(ids))
    stayed = len(re.findall(r"currently stayed", compact, flags=re.I))
    return {
        "source": "https://www.dir.ca.gov/dlse/debar.html",
        "source_as_of_note": "Page footer July 2025; individual orders have their own dates.",
        "license_id_mentions": len(ids),
        "distinct_cslb_ids": len(exact_ids),
        "exact_cslb_ids": exact_ids,
        "stayed_mentions": stayed,
        "grain": "DEBARMENT_ORDER_LISTING",
        "identity_tier_for_listed_ids": "EXACT",
        "semantics": (
            "DLSE public works debarment is not CSLB license status. "
            "A stayed order is not a current debarment. "
            "Name-only rows without a CSLB number are UNSAFE. "
            "Do not invent a currently-debarred count from ambiguous dates."
        ),
    }


def parse_asbestos(html: str) -> dict:
    as_of = None
    m = re.search(r"last updated on ([0-9/]+)", html, flags=re.I)
    if m:
        as_of = m.group(1)
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", html, flags=re.I | re.S):
        if "column_labels" in tr or "<th" in tr.lower():
            continue
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.I | re.S)
        if len(tds) < 6:
            continue
        clean = [
            re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", td)).replace("\xa0", " ").strip() for td in tds
        ]
        regno = re.search(r"(\d+)", clean[0] or "")
        cslb = re.sub(r"\D", "", clean[1] or "")
        if not regno:
            continue
        rows.append(
            {
                "reg_no": regno.group(1),
                "cslb_license_number": cslb if cslb else None,
            }
        )
    exact = [r["cslb_license_number"] for r in rows if r["cslb_license_number"]]
    return {
        "source": "https://www.dir.ca.gov/databases/doshacru/acrulist.asp",
        "source_as_of": as_of,
        "rows": len(rows),
        "rows_with_exact_cslb_id": len(exact),
        "distinct_cslb_ids": len(set(exact)),
        "exact_cslb_ids": sorted(set(exact)),
        "grain": "ASBESTOS_REGISTRANT",
        "semantics": (
            "Cal/OSHA asbestos registrant is not CSLB license status "
            "and not a C-22 classification proof by itself."
        ),
    }


def compact_inventory(rows: list[dict], asb_ids: set[str]) -> list[list[str]]:
    out = []
    for r in rows:
        lic = (r.get("LicenseNo") or "").strip()
        name = (r.get("FullBusinessName") or r.get("BusinessName") or "").strip()
        city = (r.get("City") or "").strip()
        zip5 = (r.get("ZIPCode") or "").strip()[:5]
        county = (r.get("County") or "").strip()
        status = (r.get("PrimaryStatus") or "").strip()
        classes = ",".join(class_tokens(r.get("Classifications(s)") or ""))
        phone = re.sub(r"\D", "", r.get("BusinessPhone") or "")
        if len(phone) < 7:
            phone = ""
        flag = "1" if lic in asb_ids else ""
        out.append([lic, name, city, zip5, county, status, classes, phone, flag])
    return out


def main() -> None:
    ART.mkdir(parents=True, exist_ok=True)
    LIB.mkdir(parents=True, exist_ok=True)
    PUBLIC_INV.parent.mkdir(parents=True, exist_ok=True)

    attempts_path = ART / "acquisition-attempts.json"
    attempts = json.loads(attempts_path.read_text(encoding="utf-8")) if attempts_path.exists() else None

    master_path = MASTER
    if not master_path.exists():
        raise SystemExit(f"missing {master_path}")

    parsed = parse_master(master_path)
    rows = parsed.pop("rows")
    license_set: set[str] = parsed.pop("license_set")
    src_sha = sha256(master_path)
    src_bytes = master_path.stat().st_size

    asb = parse_asbestos(ASB_HTML.read_text(encoding="utf-8", errors="replace")) if ASB_HTML.exists() else {
        "rows": CA001["dosh_asbestos"]["rows"],
        "rows_with_exact_cslb_id": CA001["dosh_asbestos"]["rows_with_exact_cslb_id"],
        "distinct_cslb_ids": CA001["dosh_asbestos"]["distinct_cslb_ids"],
        "exact_cslb_ids": [],
        "source": CA001["dosh_asbestos"]["source"],
        "source_as_of": CA001["dosh_asbestos"]["source_as_of"],
        "grain": "ASBESTOS_REGISTRANT",
        "semantics": CA001["dosh_asbestos"]["semantics"],
    }
    dlse = parse_debarment(DLSE_HTML.read_text(encoding="utf-8", errors="replace")) if DLSE_HTML.exists() else {
        **CA001["dlse_debarment"],
    }

    asb_ids = set(asb.get("exact_cslb_ids") or [])
    asb_in = sorted(asb_ids & license_set)
    asb_out = len(asb_ids) - len(asb_in)
    dlse_ids = set(dlse.get("exact_cslb_ids") or [])
    dlse_in = sorted(dlse_ids & license_set)
    dlse_out = sorted(dlse_ids - license_set)

    official_options = CLASS_DICT.get("options") or CA001["official_classification_dictionary"]["options"]
    option_count = CLASS_DICT.get("option_count") or CA001["official_classification_dictionary"]["option_count"]

    inventory_rows = compact_inventory(rows, asb_ids)
    inventory = {
        "version": VERSION,
        "coverage": "ACQUIRED_PARTIAL_STREAM_TRUNCATED",
        "label": "Acquired CSLB public-data rows",
        "as_of": "2026-09-02",
        "count": len(inventory_rows),
        "fields": ["license", "name", "city", "zip", "county", "status", "classes", "phone", "asbestos_exact"],
        "phone_eligibility": "PUBLIC_ELIGIBLE",
        "address_eligibility": "REVIEW_REQUIRED_NOT_IN_INVENTORY",
        "rows": inventory_rows,
    }
    PUBLIC_INV.write_text(json.dumps(inventory, separators=(",", ":"), ensure_ascii=True), encoding="utf-8")
    inv_bytes = PUBLIC_INV.stat().st_size
    inv_sha = sha256(PUBLIC_INV)

    clear = parsed["primary_status_counts"].get("CLEAR", 0)
    county_counts = parsed["county_counts"]
    unknown_county = county_counts.get("UNKNOWN", 0)
    named_counties = parsed["county_count"] - (1 if "UNKNOWN" in county_counts else 0)
    class_counts = parsed["classification_token_counts"]
    top_classes = [{"token": k, "rows": v} for k, v in list(class_counts.items())[:12]]
    top_counties = [{"county": k, "rows": v} for k, v in list(county_counts.items())[:15]]
    susp_total = parsed["license_rows"] - clear - parsed["primary_status_counts"].get("UNKNOWN", 0)

    findings = [
        {
            "id": "acquired-rows",
            "text": (
                f"This page searched {parsed['license_rows']:,} acquired CSLB public-data rows "
                f"from the official License Master as of 2026-09-02. The download stream ended "
                f"before the file finished (last observed business name starts {parsed['last_business_name'][:12]!r}). "
                f"The complete renewable-license denominator is UNKNOWN. This is not "
                f"{parsed['license_rows']:,} contractors in California."
            ),
        },
        {
            "id": "clear-not-verified",
            "text": (
                f"{clear:,} acquired rows have source-native PrimaryStatus CLEAR. "
                "CLEAR is a CSLB status label. It is not TrustHub Verified and not an endorsement."
            ),
        },
        {
            "id": "class-b",
            "text": (
                f"In this truncated extract, {class_counts.get('B', 0):,} license rows hold classification B "
                f"(General Building). {parsed['multi_class_license_rows']:,} acquired rows hold more than one class. "
                "This is not a consumer ranking."
            ),
        },
        {
            "id": "phones-not-email",
            "text": (
                f"{parsed['rows_with_business_phone']:,} acquired rows have a public-eligible business phone. "
                "Emails are not in this source (Business & Professions Code § 27). "
                "A business phone is not a personal phone. A mailing address is not a proven service area."
            ),
        },
        {
            "id": "asbestos-exact",
            "text": (
                f"Cal/OSHA asbestos registrant table: {asb['rows']} rows / {asb['distinct_cslb_ids']} exact CSLB IDs; "
                f"{len(asb_in)} join this extract on exact license number. "
                "Asbestos registration is not general CSLB license status."
            ),
        },
        {
            "id": "dlse-not-revocation",
            "text": (
                f"DIR DLSE public-works debarment listings name {dlse['distinct_cslb_ids']} exact CSLB IDs. "
                f"{len(dlse_in)} of those IDs appear in this renewable extract "
                f"({len(dlse_out)} are absent, which is expected when cancelled/revoked licenses are excluded). "
                "DLSE debarment is not CSLB revocation. A stayed order is not a current debarment."
            ),
        },
    ]

    snapshot = {
        "version": VERSION,
        "as_of": "2026-09-02",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/california",
            "path": "/california",
            "sitemap": True,
        },
        "hero": {
            "universe_value": parsed["license_rows"],
            "universe_label": "acquired rows",
            "universe_hint": "Stream ended before the official file finished. Complete renewable count is UNKNOWN.",
            "current_value": clear,
            "current_label": "CLEAR in extract",
            "current_hint": "CLEAR is a CSLB status label. Not TrustHub Verified. Not an endorsement.",
            "observations_value": parsed["rows_with_business_phone"],
            "observations_label": "public business phones",
            "observations_hint": "Business phone, not personal phone. Emails are not in this source (BPC 27).",
            "geography_value": named_counties,
            "geography_label": "named counties in extract",
            "geography_hint": f"{unknown_county:,} rows have county UNKNOWN. Mailing county is not a service area.",
            "as_of_value": "2026-09-02",
            "as_of_label": "License Master",
        },
        "coverage": {
            "status": "ACQUIRED_PARTIAL_STREAM_TRUNCATED",
            "complete_universe_claimed": False,
            "complete_renewable_count": None,
            "complete_historical_count": None,
            "source_url": PORTAL,
            "source_as_of": "2026-09-02",
            "source_bytes": src_bytes,
            "source_sha256": src_sha,
            "first_business_name": parsed["first_business_name"],
            "last_business_name": parsed["last_business_name"],
            "truncation_note": (
                "Official CSV stream ended prematurely. Last incomplete row dropped. "
                "Alphabetical tail after the last observed business name is not in this extract."
            ),
            "inventory_label": "Acquired CSLB public-data rows",
            "inventory_bytes": inv_bytes,
            "inventory_sha256": inv_sha,
            "inventory_path": "/california-inventory.json",
        },
        "license_master": {
            "license_rows": parsed["license_rows"],
            "distinct_license_numbers": parsed["distinct_license_numbers"],
            "distinct_business_name_address_zip": parsed["distinct_business_name_address_zip"],
            "named_rows": parsed["named_rows"],
            "primary_status_counts": parsed["primary_status_counts"],
            "secondary_status_counts": parsed["secondary_status_counts"],
            "business_type_counts": parsed["business_type_counts"],
            "clear_is_not_verified": True,
            "suspension_is_not_revocation": True,
            "expired_renewable_is_not_cancelled": True,
            "unknown_status_rows": parsed["primary_status_counts"].get("UNKNOWN", 0),
            "suspension_rows_in_extract": susp_total,
        },
        "classifications": {
            "official_option_count": option_count,
            "observed_token_count": parsed["distinct_classification_tokens"],
            "multi_class_license_rows": parsed["multi_class_license_rows"],
            "top": top_classes,
            "token_counts": parsed["classification_token_counts"],
            "official_options": official_options,
            "note": "Observed tokens are not a ranking. Official dictionary is the 78 form options.",
        },
        "contacts": {
            "business_phone_public_eligible": parsed["rows_with_business_phone"],
            "business_phone_policy": "PUBLIC_ELIGIBLE",
            "mailing_address_rows": parsed["rows_with_mailing_address"],
            "mailing_address_policy": "REVIEW_REQUIRED",
            "email_rows": 0,
            "email_policy": "NOT_PROVIDED_BPC_27",
            "website_rows": 0,
            "website_policy": "NOT_IN_SOURCE",
            "business_phone_is_not_personal": True,
            "mail_address_is_not_service_area": True,
        },
        "geography": {
            "named_counties": named_counties,
            "unknown_county_rows": unknown_county,
            "city_count": parsed["city_count"],
            "top_counties": top_counties,
            "no_california_county_pages": True,
        },
        "personnel": {
            "acquired": False,
            "coverage": "NOT_ACQUIRED",
            "page_blocker": False,
            "publish_people_as_profiles": False,
            "note": "Personnel file was not acquired. Qualifiers are not published as people profiles.",
        },
        "workers_comp": {
            "standalone_file_acquired": False,
            "standalone_coverage": "NOT_ACQUIRED",
            "page_blocker": False,
            "clear_is_not_current_wc": True,
            "source_native_work_comp_susp": parsed["primary_status_counts"].get("Work Comp Susp", 0),
            "rows_with_wc_suspend_date": parsed["rows_with_wc_suspend_date"],
            "coverage_type_counts_from_master": parsed["wc_coverage_type_counts"],
            "note": (
                "Workers' Compensation standalone portal file was not acquired. "
                "Master-list WC fields are source labels, not a live certificate check. "
                "CLEAR is not proof of current workers' compensation."
            ),
        },
        "asbestos": {
            "source": asb.get("source"),
            "source_as_of": asb.get("source_as_of"),
            "rows": asb.get("rows"),
            "rows_with_exact_cslb_id": asb.get("rows_with_exact_cslb_id"),
            "distinct_cslb_ids": asb.get("distinct_cslb_ids"),
            "exact_joins_to_extract": len(asb_in),
            "exact_ids_not_in_extract": asb_out,
            "grain": asb.get("grain"),
            "semantics": asb.get("semantics"),
            "attach_rule": "EXACT CSLB ID only. Name-only is UNSAFE.",
        },
        "dlse": {
            "source": dlse.get("source"),
            "source_as_of_note": dlse.get("source_as_of_note"),
            "distinct_cslb_ids": dlse.get("distinct_cslb_ids"),
            "exact_cslb_ids": dlse.get("exact_cslb_ids"),
            "exact_joins_to_extract": len(dlse_in),
            "exact_ids_not_in_extract": dlse_out,
            "stayed_mentions": dlse.get("stayed_mentions"),
            "grain": dlse.get("grain"),
            "semantics": dlse.get("semantics"),
            "currently_debarred_count": None,
            "attach_rule": "EXACT CSLB ID only. Do not invent currently-debarred totals.",
        },
        "electrician": {
            "certified_rows": CA001["dir_electrician"]["certified"]["rows"],
            "trainee_rows": CA001["dir_electrician"]["trainee"]["rows"],
            "grain": "PERSON_CERTIFICATE",
            "has_cslb_license_id": False,
            "net_new_contractor_businesses": 0,
            "note": "Electrician certificate is not a contractor business. No CSLB ID in the DIR ECU files.",
        },
        "pwcr": {
            "coverage": "SEARCH_ONLY",
            "acquired": False,
            "note": "DIR Public Works Contractor Registration is not a CSLB license. Missing roster is not zero registrants.",
        },
        "vendor": {
            "coverage": "SEARCH_ONLY",
            "acquired": False,
            "note": "Cal eProcure / SCPRS vendor identity is not a licensed contractor.",
        },
        "paid_full_file": {
            "decision": "DO_NOT_BUY_FOR_CA_CON_002",
            "price_usd": 235,
            "historical_rows_described": "700,000 to 830,000+",
            "page_blocker": False,
            "reason": (
                "The free portal already supplies a deterministic 75,572-row renewable extract "
                "sufficient to publish an honest statewide research page. The paid Full File is "
                "historical (cancelled/revoked/expired-nonrenewable). Buy later only if a "
                "revocation/cancellation research product is separately authorized."
            ),
        },
        "findings": findings,
        "evidence_depth": [
            {
                "family": "CSLB License Master",
                "grain": "license row (renewed or expired-renewable)",
                "public_treatment": "Published as acquired rows; complete universe UNKNOWN",
            },
            {
                "family": "PrimaryStatus",
                "grain": "source-native status label",
                "public_treatment": "CLEAR / suspension labels preserved; CLEAR ≠ verified",
            },
            {
                "family": "Classifications",
                "grain": "normalized class token on a license",
                "public_treatment": "Counts in extract; 78 official options; not a ranking",
            },
            {
                "family": "Business phone",
                "grain": "license-row business phone",
                "public_treatment": "PUBLIC_ELIGIBLE; not a personal phone",
            },
            {
                "family": "Mailing address",
                "grain": "license-row mailing location",
                "public_treatment": "REVIEW_REQUIRED; not a proven service area; not in inventory",
            },
            {
                "family": "Cal/OSHA asbestos",
                "grain": "registrant with optional CSLB ID",
                "public_treatment": "Exact-ID overlay only; not general license status",
            },
            {
                "family": "DLSE debarment",
                "grain": "debarment order listing",
                "public_treatment": "Exact CSLB IDs stored; not CSLB revocation; no currently-debarred invention",
            },
            {
                "family": "DIR ECU electrician",
                "grain": "person certificate",
                "public_treatment": "Counts only; not contractor businesses",
            },
            {
                "family": "Personnel / WC files / PWCR / vendor",
                "grain": "not acquired or search-only",
                "public_treatment": "Coverage statement; missing ≠ zero",
            },
        ],
        "coverage_gaps": [
            {"id": "complete-portal-master", "label": "Complete CSLB portal License Master", "state": "STREAM_TRUNCATED"},
            {"id": "personnel", "label": "CSLB Personnel file", "state": "NOT_ACQUIRED"},
            {"id": "workers-comp-file", "label": "CSLB Workers' Compensation file", "state": "NOT_ACQUIRED"},
            {"id": "cancelled-revoked", "label": "Cancelled / revoked / expired-nonrenewable licenses", "state": "EXCLUDED_BY_PORTAL"},
            {"id": "pwcr", "label": "DIR PWCR machine-readable roster", "state": "SEARCH_ONLY"},
            {"id": "vendor", "label": "Cal eProcure vendor dump", "state": "SEARCH_ONLY"},
            {"id": "permits", "label": "Statewide building permits", "state": "LOCAL_FRAGMENTED"},
            {"id": "paid-full-file", "label": "Paid CSLB Full File", "state": "REQUEST_ONLY_NOT_PURCHASED"},
            {"id": "emails", "label": "Public emails", "state": "NOT_PROVIDED_BPC_27"},
            {"id": "california-counties", "label": "California county pages", "state": "OUT_OF_SCOPE_THIS_TICKET"},
        ],
        "identity": {
            "primary": "CA-CSLB:{LicenseNo}",
            "tiers": ["EXACT", "HIGH_CONFIDENCE", "REVIEW_REQUIRED", "UNSAFE"],
            "adverse_attach_rule": "EXACT license ID only. Name-only is UNSAFE.",
        },
        "semantics": [
            "ACQUIRED ROWS != COMPLETE CALIFORNIA CONTRACTOR UNIVERSE",
            "CLEAR != TRUSTHUB VERIFIED",
            "CLEAR != ENDORSEMENT",
            "SUSPENSION != REVOCATION",
            "EXPIRED-RENEWABLE != CANCELLED",
            "VENDOR != LICENSED CONTRACTOR",
            "PWCR != CSLB LICENSE",
            "ASBESTOS REGISTRATION != GENERAL LICENSE STATUS",
            "ELECTRICIAN CERTIFICATE != CONTRACTOR BUSINESS",
            "BUSINESS PHONE != PERSONAL PHONE",
            "MAIL ADDRESS != PROVEN SERVICE AREA",
            "DLSE DEBARMENT != CSLB REVOCATION",
            "MISSING != ZERO",
            "NO TRUST SCORE",
            "NO PAID RANKING",
        ],
        "verify": {
            "instant_check": INSTANT,
            "license_detail_prefix": DETAIL,
        },
        "acquisition_attempts": attempts["attempts"] if attempts and "attempts" in attempts else [],
        "no_trust_score": True,
        "no_paid_ranking": True,
        "no_review_schema": True,
        "no_aggregate_rating": True,
    }
    snapshot["fingerprint"] = fingerprint(snapshot)
    out = LIB / "accepted-snapshot.json"
    out.write_text(json.dumps(snapshot, indent=2, sort_keys=True, ensure_ascii=True) + "\n", encoding="utf-8")

    manifest = {
        "ticket": "CA-CON-002",
        "generated_at": snapshot["generated_at"],
        "source_sha256": src_sha,
        "source_bytes": src_bytes,
        "license_rows": parsed["license_rows"],
        "inventory_sha256": inv_sha,
        "inventory_bytes": inv_bytes,
        "snapshot_fingerprint": snapshot["fingerprint"],
        "coverage": "ACQUIRED_PARTIAL_STREAM_TRUNCATED",
    }
    (ART / "hash-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (ART / "snapshot-summary.json").write_text(
        json.dumps(
            {
                "fingerprint": snapshot["fingerprint"],
                "license_rows": parsed["license_rows"],
                "clear": clear,
                "phones": parsed["rows_with_business_phone"],
                "asbestos_joins": len(asb_in),
                "dlse_joins": len(dlse_in),
                "inventory_bytes": inv_bytes,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print("snapshot", out)
    print("fingerprint", snapshot["fingerprint"])
    print("inventory", PUBLIC_INV, inv_bytes)
    print("rows", parsed["license_rows"], "clear", clear, "asb_joins", len(asb_in), "dlse_joins", len(dlse_in))


if __name__ == "__main__":
    main()
