"""DPOR regulant-list TSV parser.

Official files are ASCII tab-delimited with a header row and 20 columns.
A small set of source rows contain an extra tab inside BUSINESS NAME, producing
21 fields and shifting CITY/STATE/ZIP/dates/rank/specialty by one column.

License number fields (BOARD, OCCUPATION, CERTIFICATE #) sit before the
name/address block and remain independently verifiable on shifted rows.
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Any

DATE = re.compile(r"^\d{2}/\d{2}/\d{4}$")
DIGITS = re.compile(r"^\d+$")
HEADER_TOKENS = {"BOARD", "OCCUPATION", "CERTIFICATE #", "BUSINESS NAME"}
CONTRACTOR_RANKS = {"A", "B", "C"}
OTHER_RANKS = {"TRAD", "RETR", "RBEA", "UNKNOWN"}
US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN",
    "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV",
    "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN",
    "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
}

FIELDS = [
    "BOARD",
    "OCCUPATION",
    "CERTIFICATE #",
    "INDIVIDUAL NAME",
    "BUSINESS NAME",
    "FIRST LINE ADDRESS",
    "SECOND LINE ADDRESS",
    "P O BOX #",
    "CITY",
    "STATE",
    "FIVE DIGIT ZIP CODE",
    "ZIP CODE EXTENSION",
    "PROVINCE",
    "COUNTRY",
    "POSTAL CODE",
    "EXPIRATION DATE",
    "CERTIFICATION DATE",
    "LICENSE RANK",
    "LICENSE SPECIALTY",
    "EMAILADDRESS",
]


def is_header(parts: list[str]) -> bool:
    joined = {p.strip().upper() for p in parts[:5]}
    return bool(joined & HEADER_TOKENS)


def license_number(rec: dict[str, Any]) -> str:
    board = str(rec.get("BOARD") or "").zfill(2)
    occ = str(rec.get("OCCUPATION") or "").zfill(2)
    cert = str(rec.get("CERTIFICATE #") or "").zfill(6)
    return f"{board}{occ}{cert}"


def specialties(rec: dict[str, Any]) -> list[str]:
    raw = rec.get("LICENSE SPECIALTY") or ""
    if rec.get("parse_status") == "PARSE_UNRESOLVED":
        return []
    return [p for p in re.split(r"\s+", raw.strip()) if p]


def _record(parts: list[str], status: str, expected_rank: str | None) -> dict[str, Any]:
    rec = {FIELDS[i]: (parts[i].strip() if i < len(parts) else "") for i in range(len(FIELDS))}
    rec["parse_status"] = status
    rec["source_width"] = len(parts)
    rank = rec["LICENSE RANK"]
    state = rec["STATE"]
    rank_ok = rank in CONTRACTOR_RANKS or rank in OTHER_RANKS
    id_ok = bool(
        DIGITS.match(rec["BOARD"] or "")
        and DIGITS.match(rec["OCCUPATION"] or "")
        and DIGITS.match(rec["CERTIFICATE #"] or "")
    )
    if expected_rank and rank and rank != expected_rank and status == "VALID":
        rec["source_native_rank_differs_from_file_label"] = True
    if state and state not in US_STATES:
        rec["non_us_or_unrecognized_state"] = True
    if not rec.get("CITY") or not state:
        rec["address_incomplete"] = True
    if not id_ok or (status == "STRUCTURALLY_REPAIRED" and not rank_ok):
        rec["parse_status"] = "PARSE_UNRESOLVED"
        if not rank_ok:
            rec["LICENSE RANK"] = "UNKNOWN"
            rec["LICENSE SPECIALTY"] = ""
            rec["rank_uncertain"] = True
            rec["specialty_uncertain"] = True
        if not id_ok:
            rec["address_uncertain"] = True
    elif not rank_ok:
        rec["parse_status"] = "PARSE_UNRESOLVED"
        rec["LICENSE RANK"] = "UNKNOWN"
        rec["rank_uncertain"] = True
        rec["specialty_uncertain"] = True
        rec["LICENSE SPECIALTY"] = ""
    return rec


def parse_row(parts: list[str], expected_rank: str | None = None) -> dict[str, Any] | None:
    if is_header(parts):
        return None
    if len(parts) < 11:
        return None
    board, occ, cert = parts[0].strip(), parts[1].strip(), parts[2].strip()
    if not (DIGITS.match(board) and DIGITS.match(occ) and DIGITS.match(cert)):
        return None

    # Canonical 20-column layout: rank token in the LICENSE RANK slot.
    if len(parts) >= 19 and (
        parts[17].strip() in CONTRACTOR_RANKS or parts[17].strip() in OTHER_RANKS
    ):
        return _record(parts[:20] if len(parts) >= 20 else parts, "VALID", expected_rank)

    # Extra tab inside BUSINESS NAME: 21 fields, rank token at index 18, state at 10.
    if (
        len(parts) >= 21
        and parts[10].strip() in US_STATES
        and parts[18].strip() in CONTRACTOR_RANKS
        and (DATE.match(parts[16].strip()) or DATE.match(parts[17].strip()) or parts[17].strip() == "")
    ):
        merged = parts[:4] + [" ".join(p for p in (parts[4], parts[5]) if p.strip())] + parts[6:]
        rec = _record(merged[:20], "STRUCTURALLY_REPAIRED", expected_rank)
        rec["repair"] = "merge_split_business_name_extra_tab"
        rec["source_width"] = len(parts)
        return rec

    # License identity still recoverable from the first three fields.
    rec = {
        "BOARD": board,
        "OCCUPATION": occ,
        "CERTIFICATE #": cert,
        "INDIVIDUAL NAME": parts[3].strip() if len(parts) > 3 else "",
        "BUSINESS NAME": parts[4].strip() if len(parts) > 4 else "",
        "FIRST LINE ADDRESS": "",
        "SECOND LINE ADDRESS": "",
        "P O BOX #": "",
        "CITY": "UNKNOWN",
        "STATE": "UNKNOWN",
        "FIVE DIGIT ZIP CODE": "",
        "ZIP CODE EXTENSION": "",
        "PROVINCE": "",
        "COUNTRY": "",
        "POSTAL CODE": "",
        "EXPIRATION DATE": "",
        "CERTIFICATION DATE": "",
        "LICENSE RANK": "UNKNOWN",
        "LICENSE SPECIALTY": "",
        "EMAILADDRESS": "",
        "parse_status": "PARSE_UNRESOLVED",
        "rank_uncertain": True,
        "specialty_uncertain": True,
        "address_uncertain": True,
        "source_width": len(parts),
    }
    return rec


def parse_tsv(text: str, expected_rank: str | None = None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for ln in text.splitlines():
        if not ln.strip():
            continue
        rec = parse_row(ln.split("\t"), expected_rank=expected_rank)
        if rec:
            rows.append(rec)
    return rows


def profile_rows(rows: list[dict[str, Any]], grain: str) -> dict[str, Any]:
    licenses = [license_number(r) for r in rows]
    ranks = Counter((r.get("LICENSE RANK") or "").strip() or "UNKNOWN" for r in rows)
    status = Counter(r.get("parse_status") or "VALID" for r in rows)
    spec_rows = 0
    spec_counts: Counter[str] = Counter()
    multi = 0
    for r in rows:
        specs = specialties(r)
        if specs:
            spec_rows += 1
            spec_counts.update(specs)
            if len(specs) > 1:
                multi += 1
    names = [(r.get("BUSINESS NAME") or r.get("INDIVIDUAL NAME") or "").strip() for r in rows]
    valid = status.get("VALID", 0)
    repaired = status.get("STRUCTURALLY_REPAIRED", 0)
    unresolved = status.get("PARSE_UNRESOLVED", 0)
    return {
        "grain": grain,
        "rows": len(rows),
        "distinct_license_numbers": len(set(licenses)),
        "duplicate_license_rows": len(licenses) - len(set(licenses)),
        "rank_counts": dict(ranks),
        "parse_audit": {
            "total_rows": len(rows),
            "valid_expected_or_source_native_rank_rows": valid,
            "structurally_repaired_rows": repaired,
            "unresolved_malformed_rows": unresolved,
        },
        "rows_with_specialty": spec_rows,
        "rows_with_multiple_specialties": multi,
        "top_specialties": spec_counts.most_common(25),
        "blank_business_name": sum(1 for n in names if not n),
        "row_ne_unique_business": True,
        "specialty_row_ne_unique_contractor": True,
        "acquired": True,
    }
