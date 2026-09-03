"""CSLB License Master adapter (CA-CON-001).

Source: CSLB Public Data Portal statewide License Master CSV.
Primary identity: CA-CSLB:{LicenseNo}
Does not publish /california.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

SOURCE_SYSTEM = "ca_cslb"
SOURCE_DATASET = "cslb_public_data_portal_license_master"
SOURCE_URL = "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList"

CLEAR_STATUSES = {"CLEAR"}
SUSP_STATUSES = {
    "Contr Bond Susp",
    "Work Comp Susp",
    "Judgement Susp",
    "Family Sup Susp",
    "SOS Suspension",
    "Susp - No Qualifier",
    "Out Liab Susp",
    "Liab Ins Susp",
    "EMP/WK Bnd Susp",
    "J V Entity Susp",
    "QUAL Bond SUSP",
    "JDG Entity Susp",
    "O/L Entity Susp",
    "BOND Pay Susp",
    "BND Pay EN Susp",
    "Discp Bond SUSP",
    "Cit Entity Susp",
    "ARB Suspension",
    "Citation Susp",
    "ARB Entity Susp",
}


def normalize_status(source_status: str) -> str:
    s = (source_status or "").strip()
    if s == "CLEAR":
        return "clear"
    if "Susp" in s or "SUSP" in s:
        return "suspended"
    if not s:
        return "unknown"
    return "other"


def class_tokens(raw: str) -> list[str]:
    parts = [re.sub(r"[^A-Z0-9]", "", p.strip().upper()) for p in re.split(r"[|,]", raw or "") if p.strip()]
    return [p for p in parts if p]


def iter_master_rows(path: Path):
    with path.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        for row in csv.DictReader(fh):
            lic = (row.get("LicenseNo") or "").strip()
            if not lic.isdigit():
                continue
            yield {
                "source_system": SOURCE_SYSTEM,
                "source_dataset": SOURCE_DATASET,
                "source_url": SOURCE_URL,
                "external_key": f"CA-CSLB:{lic}",
                "license_number": lic,
                "business_name": (row.get("BusinessName") or "").strip(),
                "full_business_name": (row.get("FullBusinessName") or "").strip(),
                "source_status": (row.get("PrimaryStatus") or "").strip(),
                "secondary_status": (row.get("SecondaryStatus") or "").strip(),
                "normalized_status": normalize_status(row.get("PrimaryStatus") or ""),
                "classifications": class_tokens(row.get("Classifications(s)") or ""),
                "business_phone": (row.get("BusinessPhone") or "").strip(),
                "mailing_address": (row.get("MailingAddress") or "").strip(),
                "city": (row.get("City") or "").strip(),
                "state": (row.get("State") or "").strip(),
                "postal_code": (row.get("ZIPCode") or "").strip(),
                "county": (row.get("County") or "").strip(),
                "business_type": (row.get("BusinessType") or "").strip(),
                "issue_date": (row.get("IssueDate") or "").strip(),
                "reissue_date": (row.get("ReissueDate") or "").strip(),
                "expiration_date": (row.get("ExpirationDate") or "").strip(),
                "public_email": None,
                "website": None,
                "email_eligibility": "NOT_IN_SOURCE",
                "phone_eligibility": "PUBLIC_ELIGIBLE",
                "address_eligibility": "REVIEW_REQUIRED",
                "identity_tier": "EXACT",
            }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--out-dir", default="data/staging/ca_cslb_master")
    args = ap.parse_args()
    rows = list(iter_master_rows(Path(args.input)))
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    dest = out / "licenses.jsonl"
    with dest.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=True) + "\n")
    print(f"wrote {len(rows)} rows to {dest}")


if __name__ == "__main__":
    main()
