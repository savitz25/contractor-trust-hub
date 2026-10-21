"""Name, ZIP, county, and date normalization shared by the matcher."""

from __future__ import annotations

import re
from datetime import datetime

# Executable suffix contract from CON-OSHA-001 match_fl.py and match_nj.py.
# FL and FLORIDA are the only state tokens. Other state names stay in the name.
ORIGINAL_SUFFIX = (
    r"\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LLP|PA|PLLC|THE|OF|AND|DBA|FL|FLORIDA)\b"
)
SUFFIX_RE = re.compile(ORIGINAL_SUFFIX)
CA_SOURCE_SYSTEM = "ca_cslb"
CA_NAME_SOURCE = "licensee_name_raw"

_DROP_COUNTY_WORDS = {"COUNTY", "PARISH", "BOROUGH", "CENSUS", "AREA"}
_EMPTY_DATES = {"", "NAT", "NONE", "NULL", "0", "00000000"}


def normalize_name(value: str, suffix_re: re.Pattern[str] = SUFFIX_RE) -> str:
    text = (value or "").upper().replace("&", " AND ")
    text = re.sub(r"[^A-Z0-9 ]", " ", text)
    text = suffix_re.sub(" ", text)
    return " ".join(text.split())


def is_person_name(value: str, suffix_re: re.Pattern[str] = SUFFIX_RE) -> bool:
    """Cap comma-form personal names that do not carry a company suffix."""
    text = value or ""
    if "," not in text:
        return False
    return suffix_re.search(text.upper()) is None


def zip5(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) < 5:
        return ""
    return digits[:5]


def county_key(value: str) -> str:
    text = (value or "").upper().replace("&", " AND ").replace(".", " ")
    text = re.sub(r"[^A-Z0-9 ]", " ", text)
    tokens = []
    parts = text.split()
    for index, token in enumerate(parts):
        if token in _DROP_COUNTY_WORDS:
            continue
        if token == "ST" and index < len(parts) - 1:
            token = "SAINT"
        elif token == "STE":
            token = "SAINTE"
        tokens.append(token)
    return " ".join(tokens)


def iso_date(value: str) -> str:
    raw = (value or "").strip()
    if raw.upper() in _EMPTY_DATES:
        return ""
    head = raw.split()[0].split("T")[0]
    if head.upper() in _EMPTY_DATES:
        return ""
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(head, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def activity_number(value: str) -> str:
    raw = (value or "").strip()
    if raw.endswith(".0"):
        raw = raw[:-2]
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    return str(int(digits))


# ca_cslb stores BusinessType in dba_name_raw and BusinessName in licensee_name_raw.
ENTITY_TYPE_LABELS = {
    "CORPORATION",
    "SOLE OWNER",
    "LIMITED LIABILITY",
    "LIMITED LIABILITY COMPANY",
    "PARTNERSHIP",
    "LIMITED PARTNERSHIP",
    "JOINT VENTURE",
    "JOINTVENTURE",
    "LLC",
    "INC",
    "LLP",
}


def display_name(dba_name: str, licensee_name: str, source_system: str = "") -> str:
    """Use the licensee name for ca_cslb. Otherwise prefer a real DBA."""
    if source_system == CA_SOURCE_SYSTEM:
        return (licensee_name or "").strip()
    dba = (dba_name or "").strip()
    label = " ".join(dba.upper().replace("-", " ").split())
    if dba and label not in ENTITY_TYPE_LABELS:
        return dba
    return (licensee_name or "").strip()
