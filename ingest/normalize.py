"""Shared name/address normalization for high-confidence matching."""

from __future__ import annotations

import re


_LEGAL_SUFFIXES = re.compile(
    r"\b(INCORPORATED|INC|LLC|L\.?L\.?C\.?|L\.?L\.?P\.?|LLP|LP|LTD|CO|CORP|"
    r"CORPORATION|COMPANY|PLLC|PA|P\.A\.|PLC|PC|P\.C\.)\b",
    re.I,
)


def clean(value: str | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_entity_name(name: str | None) -> str:
    """
    Uppercase, strip punctuation, collapse whitespace.
    Keeps legal suffixes (INC/LLC) so exact compares stay strict.
    """
    s = clean(name).upper()
    if not s:
        return ""
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_name_loose(name: str | None) -> str:
    """Same as normalize_entity_name but drops common legal suffixes (still exact, not fuzzy)."""
    s = normalize_entity_name(name)
    if not s:
        return ""
    s = _LEGAL_SUFFIXES.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def zip5(postal: str | None) -> str:
    digits = re.sub(r"\D", "", clean(postal))
    return digits[:5] if len(digits) >= 5 else digits


def normalize_city(city: str | None) -> str:
    s = clean(city).upper()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_address_line(addr: str | None) -> str:
    """Strict address key: upper, strip punct, collapse space, expand a few tokens."""
    s = clean(addr).upper()
    if not s:
        return ""
    s = s.replace("#", " ")
    repl = {
        r"\bSTREET\b": "ST",
        r"\bAVENUE\b": "AVE",
        r"\bBOULEVARD\b": "BLVD",
        r"\bDRIVE\b": "DR",
        r"\bROAD\b": "RD",
        r"\bLANE\b": "LN",
        r"\bCOURT\b": "CT",
        r"\bPLACE\b": "PL",
        r"\bSUITE\b": "STE",
        r"\bAPARTMENT\b": "APT",
        r"\bNORTH\b": "N",
        r"\bSOUTH\b": "S",
        r"\bEAST\b": "E",
        r"\bWEST\b": "W",
    }
    for pat, rep in repl.items():
        s = re.sub(pat, rep, s)
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_person_name(name: str | None) -> str:
    """Person names often appear as LAST FIRST with extra spaces."""
    s = clean(name).upper()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def fei_digits(fei: str | None) -> str:
    d = re.sub(r"\D", "", clean(fei))
    return d if len(d) >= 9 else ""
