"""Freeze OCILB roster grains: trade vs holder vs person vs company; status populations."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/ohio/ocilb/raw"
OUT = ROOT / "data/ohio/ocilb/analysis.json"

TRADES = ["el", "hv", "hy", "pl", "re"]
PREFIX = {"el": "EL", "hv": "HV", "hy": "HY", "pl": "PL", "re": "RE"}


def norm_status(raw: str) -> str:
    s = (raw or "").strip().upper()
    s = re.sub(r"\s+", " ", s)
    return s


def status_bucket(s: str) -> str:
    if s == "ACTIVE":
        return "ACTIVE"
    if "ACTIVE IN RENEWAL" in s or s.startswith("ACTIVE IN RENEWAL"):
        return "ACTIVE_IN_RENEWAL"
    if "INACTIVE" in s or "ESCROW" in s:
        return "INACTIVE"
    if "EXPIRED" in s:
        return "EXPIRED"
    if "SUSPEND" in s:
        return "SUSPENDED"
    if "REVOK" in s:
        return "REVOKED"
    if not s:
        return "BLANK"
    return "OTHER"


def credential_parts(formatted: str) -> tuple[str, str]:
    f = (formatted or "").strip()
    m = re.match(r"^([A-Z]{2})\.(\d+)$", f, re.I)
    if not m:
        return ("", "")
    return (m.group(1).upper(), m.group(2))


def person_key(row: dict) -> str:
    name = (row.get("Name") or "").strip().upper()
    last = (row.get("LastName") or "").strip().upper()
    return f"{name}|{last}"


def company_key(row: dict) -> str:
    return (row.get("Company") or "").strip().upper()


def main() -> None:
    by_trade: dict[str, list[dict]] = {}
    all_rows: list[dict] = []
    file_meta = {}
    for t in TRADES:
        path = RAW / f"ocilb_{t}_roster.csv"
        sha_path = RAW / f"ocilb_{t}_roster.sha256"
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        claimed = sha_path.read_text(encoding="utf-8").strip()
        if digest != claimed:
            raise SystemExit(f"checksum mismatch {t}: {digest} != {claimed}")
        text = data.decode("utf-8-sig")
        rows = list(csv.DictReader(text.splitlines()))
        by_trade[t] = rows
        all_rows.extend(rows)
        file_meta[t] = {
            "path": f"data/ohio/ocilb/raw/ocilb_{t}_roster.csv",
            "sha256": digest,
            "bytes": len(data),
            "data_rows": len(rows),
            "columns": list(rows[0].keys()) if rows else [],
        }

    formatted = []
    numeric_ids = []
    persons = []
    companies = []
    person_to_numeric = defaultdict(set)
    numeric_to_person = defaultdict(set)
    numeric_to_trades = defaultdict(set)
    numeric_to_companies = defaultdict(set)
    person_to_companies = defaultdict(set)
    person_to_formatted = defaultdict(set)
    status_raw = Counter()
    status_bucket_c = Counter()
    type_c = Counter()
    prefix_mismatch = 0
    blank_company = 0
    blank_name = 0
    malformed_cred = 0

    trade_stats = {}
    for t, rows in by_trade.items():
        t_formatted = set()
        t_numeric = set()
        t_persons = set()
        t_companies = set()
        t_status_raw = Counter()
        t_status_bucket = Counter()
        t_blank_company = 0
        for row in rows:
            cred = (row.get("FormattedCredential") or "").strip()
            pref, num = credential_parts(cred)
            if not pref or not num:
                malformed_cred += 1
            else:
                t_formatted.add(cred)
                t_numeric.add(num)
                numeric_to_trades[num].add(pref)
                if pref != PREFIX[t]:
                    prefix_mismatch += 1
            pk = person_key(row)
            if pk == "|":
                blank_name += 1
            else:
                t_persons.add(pk)
                persons.append(pk)
                if num:
                    person_to_numeric[pk].add(num)
                    numeric_to_person[num].add(pk)
                    person_to_formatted[pk].add(cred)
            ck = company_key(row)
            if not ck:
                t_blank_company += 1
                blank_company += 1
            else:
                t_companies.add(ck)
                companies.append(ck)
                if num:
                    numeric_to_companies[num].add(ck)
                if pk != "|":
                    person_to_companies[pk].add(ck)
            st = norm_status(row.get("Status") or "")
            t_status_raw[st or "(blank)"] += 1
            t_status_bucket[status_bucket(st)] += 1
            status_raw[st or "(blank)"] += 1
            status_bucket_c[status_bucket(st)] += 1
            type_c[(row.get("Type") or "").strip()] += 1
            formatted.append(cred)
            if num:
                numeric_ids.append(num)
        trade_stats[t] = {
            "rows": len(rows),
            "distinct_formatted_credentials": len(t_formatted),
            "distinct_numeric_license_ids": len(t_numeric),
            "distinct_licensee_person_keys": len(t_persons),
            "distinct_associated_company_names": len(t_companies),
            "blank_company_rows": t_blank_company,
            "status_raw": dict(t_status_raw),
            "status_bucket": dict(t_status_bucket),
            "sample_formatted": sorted(t_formatted)[:3] + sorted(t_formatted)[-2:],
        }

    # multi-trade holders
    multi_trade_numeric = {n: sorted(tr) for n, tr in numeric_to_trades.items() if len(tr) > 1}
    multi_person_for_numeric = {n: sorted(p) for n, p in numeric_to_person.items() if len(p) > 1}
    multi_numeric_for_person = {p: sorted(n) for p, n in person_to_numeric.items() if len(n) > 1}
    multi_company_for_numeric = {n: sorted(c) for n, c in numeric_to_companies.items() if len(c) > 1}

    # exact person-company bridges from roster (source-native company column)
    exact_bridges = 0
    for row in all_rows:
        if person_key(row) != "|" and company_key(row):
            exact_bridges += 1

    analysis = {
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "files": file_meta,
        "columns": file_meta["el"]["columns"],
        "OH_OCILB_ELECTRICAL_ROWS": trade_stats["el"]["rows"],
        "OH_OCILB_ELECTRICAL_DISTINCT_CREDENTIALS": trade_stats["el"]["distinct_formatted_credentials"],
        "OH_OCILB_HVAC_ROWS": trade_stats["hv"]["rows"],
        "OH_OCILB_HVAC_DISTINCT_CREDENTIALS": trade_stats["hv"]["distinct_formatted_credentials"],
        "OH_OCILB_HYDRONICS_ROWS": trade_stats["hy"]["rows"],
        "OH_OCILB_HYDRONICS_DISTINCT_CREDENTIALS": trade_stats["hy"]["distinct_formatted_credentials"],
        "OH_OCILB_PLUMBING_ROWS": trade_stats["pl"]["rows"],
        "OH_OCILB_PLUMBING_DISTINCT_CREDENTIALS": trade_stats["pl"]["distinct_formatted_credentials"],
        "OH_OCILB_REFRIGERATION_ROWS": trade_stats["re"]["rows"],
        "OH_OCILB_REFRIGERATION_DISTINCT_CREDENTIALS": trade_stats["re"]["distinct_formatted_credentials"],
        "OH_OCILB_ALL_TRADE_CREDENTIAL_ROWS": len(all_rows),
        "OH_OCILB_DISTINCT_FORMATTED_CREDENTIALS": len(set(formatted)),
        "OH_OCILB_DISTINCT_LICENSE_HOLDERS": len(set(numeric_ids)),
        "OH_OCILB_DISTINCT_LICENSEE_PERSONS": len(set(persons) - {""}),
        "OH_OCILB_DISTINCT_ASSOCIATED_COMPANY_NAMES": len(set(companies) - {""}),
        "SOURCE_CREDENTIAL_ROWS": len(all_rows),
        "DISTINCT_FORMATTED_CREDENTIALS": len(set(formatted)),
        "DISTINCT_NUMERIC_LICENSE_HOLDERS": len(set(numeric_ids)),
        "DISTINCT_LICENSEE_PERSONS": len(set(p for p in persons if p and p != "|")),
        "DISTINCT_ASSOCIATED_COMPANIES": len(set(c for c in companies if c)),
        "malformed_credential_rows": malformed_cred,
        "prefix_mismatch_rows": prefix_mismatch,
        "blank_name_rows": blank_name,
        "blank_company_rows": blank_company,
        "status_raw": dict(status_raw),
        "status_bucket": dict(status_bucket_c),
        "OH_OCILB_ACTIVE_CREDENTIAL_ROWS": status_bucket_c.get("ACTIVE", 0),
        "OH_OCILB_ACTIVE_IN_RENEWAL_ROWS": status_bucket_c.get("ACTIVE_IN_RENEWAL", 0),
        "OH_OCILB_INACTIVE_ROWS": status_bucket_c.get("INACTIVE", 0),
        "OH_OCILB_EXPIRED_ROWS": status_bucket_c.get("EXPIRED", 0),
        "OH_OCILB_SUSPENDED_ROWS": status_bucket_c.get("SUSPENDED", 0),
        "OH_OCILB_REVOKED_ROWS": status_bucket_c.get("REVOKED", 0),
        "OH_OCILB_STATUS_OTHER_ROWS": status_bucket_c.get("OTHER", 0) + status_bucket_c.get("BLANK", 0),
        "type_values": dict(type_c),
        "multi_trade_numeric_holders": len(multi_trade_numeric),
        "multi_trade_numeric_examples": dict(list(multi_trade_numeric.items())[:8]),
        "numeric_id_with_multiple_person_keys": len(multi_person_for_numeric),
        "person_key_with_multiple_numeric_ids": len(multi_numeric_for_person),
        "numeric_id_with_multiple_companies": len(multi_company_for_numeric),
        "roster_rows_with_person_and_company": exact_bridges,
        "trade_stats": trade_stats,
        "notes": {
            "formatted_punctuation": "EL.#### with period, source-native",
            "company_column_is_roster_association_not_company_license": True,
            "do_not_sum_trade_rows_as_unique_contractors": True,
            "active_in_renewal_is_not_expired": True,
        },
    }
    OUT.write_text(json.dumps(analysis, indent=2), encoding="utf-8")
    print(json.dumps({k: analysis[k] for k in analysis if k not in {"trade_stats", "files", "multi_trade_numeric_examples"}}, indent=2))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
