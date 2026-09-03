"""Analyze acquired California contractor sources. Does not publish /california."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_MASTER = ROOT / "data" / "raw" / "ca_cslb_master" / "license_master.part"
ECU_CERT = ROOT / "data" / "raw" / "ca_dir_ecu" / "certified_electrician_list.csv"
ECU_TRAIN = ROOT / "data" / "raw" / "ca_dir_ecu" / "electrician_trainee_list.csv"
OUT = ROOT / "artifacts" / "ca-con-001"
FIXTURE = ROOT / "data" / "samples" / "ca_cslb_master_sample.csv"

PHONE_RE = re.compile(r"\d{7,}")


def sha256(path: Path) -> str | None:
    if not path.exists():
        return None
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def nonempty(value: str | None) -> bool:
    return bool((value or "").strip())


def phone_ok(value: str | None) -> bool:
    digits = re.sub(r"\D", "", value or "")
    return len(digits) >= 7


def parse_master(path: Path) -> dict:
    if not path.exists():
        return {"acquired": False, "reason": "file_missing"}
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
    types = Counter((r.get("BusinessType") or "").strip() or "UNKNOWN" for r in rows)
    counties = Counter((r.get("County") or "").strip() or "UNKNOWN" for r in rows)
    class_tokens: Counter[str] = Counter()
    multi_class = 0
    for r in rows:
        raw = (r.get("Classifications(s)") or r.get("Classifications") or "").strip()
        parts = [re.sub(r"[^A-Z0-9]", "", p.strip().upper()) for p in re.split(r"[|,]", raw) if p.strip()]
        parts = [p for p in parts if p]
        if len(parts) > 1:
            multi_class += 1
        if not parts:
            class_tokens["UNKNOWN"] += 1
        for p in parts:
            class_tokens[p] += 1
    phones = sum(1 for r in rows if phone_ok(r.get("BusinessPhone")))
    addr = sum(1 for r in rows if nonempty(r.get("MailingAddress")) and nonempty(r.get("City")))
    names = sum(1 for r in rows if nonempty(r.get("FullBusinessName") or r.get("BusinessName")))
    unique_name_addr = {
        (
            (r.get("FullBusinessName") or r.get("BusinessName") or "").strip().upper(),
            (r.get("MailingAddress") or "").strip().upper(),
            (r.get("ZIPCode") or "").strip()[:5],
        )
        for r in rows
        if nonempty(r.get("FullBusinessName") or r.get("BusinessName"))
    }
    unique_lic = {r["LicenseNo"].strip() for r in rows}
    # last row may be truncated; already skipped non-digit licenses
    return {
        "acquired": True,
        "coverage": "ACQUIRED_PARTIAL_STREAM_TRUNCATED",
        "source_as_of": "2026-09-02",
        "source_url": "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList",
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "fieldnames": fieldnames,
        "license_rows": len(rows),
        "distinct_license_numbers": len(unique_lic),
        "distinct_business_name_address_zip": len(unique_name_addr),
        "named_rows": names,
        "rows_with_business_phone": phones,
        "rows_with_mailing_address": addr,
        "rows_with_public_email": 0,
        "rows_with_website": 0,
        "email_policy": "NOT_PROVIDED_BPC_27",
        "website_policy": "NOT_IN_SOURCE",
        "primary_status_counts": dict(statuses),
        "business_type_counts": dict(types.most_common()),
        "county_counts_top": dict(counties.most_common(15)),
        "county_count": len(counties),
        "classification_token_counts": dict(class_tokens.most_common()),
        "distinct_classification_tokens": len(class_tokens),
        "multi_class_license_rows": multi_class,
        "contact_publication": {
            "BusinessPhone": "PUBLIC_ELIGIBLE" if phones else "INTERNAL_ONLY",
            "MailingAddress": "REVIEW_REQUIRED",
            "email": "NOT_IN_SOURCE",
            "website": "NOT_IN_SOURCE",
        },
        "notes": [
            "Official License Master CSV stream ended prematurely; last incomplete row dropped.",
            "This is not the complete renewable universe. Full/Update files are REQUEST_ONLY ($235).",
            "Cancelled, revoked, and expired-nonrenewable licenses are excluded by CSLB from this portal file even when complete.",
        ],
    }


def parse_ecu(path: Path, label: str) -> dict:
    if not path.exists():
        return {"acquired": False, "label": label}
    with path.open("r", encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    return {
        "acquired": True,
        "label": label,
        "rows": len(rows),
        "sha256": sha256(path),
        "fields": list(rows[0].keys()) if rows else [],
        "has_cslb_license_id": False,
        "grain": "PERSON_CERTIFICATE",
        "net_new_contractor_businesses": 0,
        "notes": [
            "Certified electrician / trainee is a person credential, not a CSLB contractor license.",
            "No contractor license number is in this file. Do not auto-create contractor businesses.",
        ],
    }


LICENSE_ID_RE = re.compile(
    r"(?:CSLB(?:\s+License)?\s*(?:Number|#)|CSLB#|CSB\s*#)\s*:?\s*#?\s*(\d{5,8})",
    re.I,
)
PERIOD_RE = re.compile(
    r"(\d{1,2}/\d{1,2}/\d{2,4})\s+through\s+(\d{1,2}/\d{1,2}/\d{2,4})",
    re.I,
)


def parse_debarment_html(html: str) -> dict:
    text = re.sub(r"<[^>]+>", "\n", html)
    compact = re.sub(r"[ \t]+", " ", text)
    ids = LICENSE_ID_RE.findall(compact)
    exact_ids = sorted(set(ids))
    stayed = len(re.findall(r"currently stayed", compact, flags=re.I))
    periods = PERIOD_RE.findall(compact)
    pdfs = re.findall(r'href="([^"]*Decision[^"]+\.pdf)"', html, flags=re.I)
    return {
        "source": "https://www.dir.ca.gov/dlse/debar.html",
        "source_as_of_note": "Page footer July 2025; individual orders have their own dates.",
        "license_id_mentions": len(ids),
        "distinct_cslb_ids": len(exact_ids),
        "exact_cslb_ids": exact_ids,
        "period_mentions": len(periods),
        "decision_pdf_links": len(pdfs),
        "stayed_mentions": stayed,
        "grain": "DEBARMENT_ORDER_LISTING",
        "identity_tier_for_listed_ids": "EXACT",
        "semantics": (
            "DLSE public works debarment is not CSLB license status. "
            "A stayed order is not a current debarment. "
            "Name-only rows without a CSLB number are UNSAFE."
        ),
    }


def parse_asbestos_html(html: str) -> dict:
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
                "employer": clean[2] or None,
                "location": clean[4] or None,
                "expires": clean[5] or None,
                "phone": clean[6] if len(clean) > 6 else None,
                "identity_tier": "EXACT" if cslb else "REVIEW_REQUIRED",
            }
        )
    exact = [r["cslb_license_number"] for r in rows if r["cslb_license_number"]]
    phones = sum(1 for r in rows if phone_ok(r.get("phone")))
    return {
        "source": "https://www.dir.ca.gov/databases/doshacru/acrulist.asp",
        "source_as_of": as_of,
        "rows": len(rows),
        "rows_with_exact_cslb_id": len(exact),
        "distinct_cslb_ids": len(set(exact)),
        "rows_with_phone": phones,
        "grain": "ASBESTOS_REGISTRANT",
        "semantics": "Cal/OSHA asbestos registrant is not CSLB license status and not a C-22 classification proof by itself.",
        "sample": rows[:5],
    }


def write_fixture(master: Path, dest: Path, n: int = 25) -> None:
    if not master.exists():
        return
    with master.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = []
        for row in reader:
            if (row.get("LicenseNo") or "").strip().isdigit():
                rows.append(row)
            if len(rows) >= n:
                break
        fieldnames = reader.fieldnames or []
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = parse_master(RAW_MASTER)
    debar_html = (ROOT / "data" / "raw" / "ca_dlse_debarment" / "debar.html")
    if not debar_html.exists():
        debar_html.parent.mkdir(parents=True, exist_ok=True)
        import urllib.request

        req = urllib.request.Request(
            "https://www.dir.ca.gov/dlse/debar.html",
            headers={"User-Agent": "Mozilla/5.0 (compatible; ContractorTrustHub/CA-CON-001)"},
        )
        html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        debar_html.write_text(html, encoding="utf-8")
    debar = parse_debarment_html(debar_html.read_text(encoding="utf-8", errors="replace"))
    (OUT / "dlse-debarment.json").write_text(json.dumps(debar, indent=2), encoding="utf-8")
    asbestos_html = ROOT / "data" / "raw" / "ca_dosh_asbestos" / "acrulist.html"
    asbestos = parse_asbestos_html(asbestos_html.read_text(encoding="utf-8", errors="replace")) if asbestos_html.exists() else {"acquired": False}
    if asbestos.get("rows"):
        (OUT / "dosh-asbestos-summary.json").write_text(json.dumps({k: v for k, v in asbestos.items() if k != "sample"}, indent=2), encoding="utf-8")
    class_html = ROOT / "data" / "staging" / "cslb_classlist.html"
    official_classes = []
    if class_html.exists():
        official_classes = re.findall(
            r'<option value="([^"]+)">([^<]+)</option>',
            class_html.read_text(encoding="utf-8", errors="replace"),
        )
    ecu = {
        "certified": parse_ecu(ECU_CERT, "certified_electrician"),
        "trainee": parse_ecu(ECU_TRAIN, "electrician_trainee"),
    }
    write_fixture(RAW_MASTER, FIXTURE)
    master_ids = set()
    if RAW_MASTER.exists():
        with RAW_MASTER.open("r", encoding="utf-8", errors="replace", newline="") as fh:
            for row in csv.DictReader(fh):
                lic = (row.get("LicenseNo") or "").strip()
                if lic.isdigit():
                    master_ids.add(lic)
    exact_debar_in_master = [i for i in debar["exact_cslb_ids"] if i in master_ids]
    exact_debar_missing = [i for i in debar["exact_cslb_ids"] if i not in master_ids]
    asbestos_ids = {
        r["cslb_license_number"]
        for r in (asbestos.get("sample") and [])  # placeholder
    }
    # Recompute from full asbestos parser output stored above.
    asbestos_ids = set()
    if asbestos_html.exists():
        full_asb = parse_asbestos_html(asbestos_html.read_text(encoding="utf-8", errors="replace"))
        asbestos = full_asb
        # sample-only in parse; recover IDs from HTML again
        html = asbestos_html.read_text(encoding="utf-8", errors="replace")
        for tr in re.findall(r"<tr>(.*?)</tr>", html, flags=re.I | re.S):
            tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.I | re.S)
            if len(tds) < 2:
                continue
            cslb = re.sub(r"\D", "", re.sub(r"<[^>]+>", "", tds[1]))
            if cslb:
                asbestos_ids.add(cslb)
    asbestos["exact_ids_present_in_acquired_master_count"] = len(asbestos_ids & master_ids)
    asbestos["exact_ids_not_in_acquired_master_count"] = len(asbestos_ids - master_ids)
    summary = {
        "ticket": "CA-CON-001",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "publication": "NOT_PUBLISHED",
        "public_route": None,
        "regulator": {
            "agency": "Contractors State License Board (CSLB), California Department of Consumer Affairs",
            "primary_identifier": "CSLB license number",
            "instant_check": "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx",
            "public_data_portal": "https://www.cslb.ca.gov/onlineservices/dataportal",
            "master_list": "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList",
            "classifications": "https://www.cslb.ca.gov/About_Us/Library/Licensing_Classifications/",
        },
        "license_master": master,
        "dir_electrician": ecu,
        "dlse_debarment": {
            **debar,
            "exact_ids_present_in_acquired_master": exact_debar_in_master,
            "exact_ids_not_in_acquired_master": exact_debar_missing,
        },
        "dosh_asbestos": asbestos,
        "official_classification_dictionary": {
            "source": "https://www.cslb.ca.gov/onlineservices/dataportal/ListByClassification.aspx",
            "option_count": len(official_classes),
            "options": [{"code": code, "label": label.strip()} for code, label in official_classes],
        },
        "identity": {
            "primary": "CA contractor license number",
            "secondary": ["DIR public works registration ID", "DGS/Cal eProcure vendor ID", "SOS entity number", "DIR electrician certificate number"],
            "tiers": ["EXACT", "HIGH_CONFIDENCE", "REVIEW_REQUIRED", "UNSAFE"],
            "adverse_attach_rule": "EXACT license ID only. Name-only is UNSAFE. REVIEW_REQUIRED is not auto-attached.",
        },
    }
    (OUT / "acquisition-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({
        "licenses": master.get("license_rows"),
        "phones": master.get("rows_with_business_phone"),
        "status": master.get("primary_status_counts"),
        "classes": master.get("distinct_classification_tokens"),
        "ecu_cert": ecu["certified"].get("rows"),
        "debar_exact": debar["distinct_cslb_ids"],
        "debar_in_master": len(exact_debar_in_master),
        "asbestos_rows": asbestos.get("rows"),
        "asbestos_with_cslb": asbestos.get("rows_with_exact_cslb_id"),
        "official_class_options": len(official_classes),
    }, indent=2))


if __name__ == "__main__":
    main()
