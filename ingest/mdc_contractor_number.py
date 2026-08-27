"""Miami-Dade Open Data ContractorNumber mixed-namespace classifier.

P0 identity gate. Never confirm a contractor from numeric core alone.
OWNER / OWNER-BUILDER is not a company match.
County COC numbers are not DBPR licenses.
"""
from __future__ import annotations

import re
from typing import Any

# CILB certified + registered (board 06) plus ECLB / fire prefixes observed
# on official Miami-Dade issued-permit rows. Prefix must be occupation-coded;
# numeric core alone is never DBPR.
DBPR_OCCUPATION_PREFIXES = frozenset(
    {
        "CAC",
        "CBC",
        "CCC",
        "CFC",
        "CGC",
        "CMC",
        "CPC",
        "CRC",
        "CSC",
        "CUC",
        "CVC",
        "SCC",
        "PCC",
        "RA",
        "RB",
        "RC",
        "RF",
        "RG",
        "RM",
        "RP",
        "RQ",
        "RR",
        "RS",
        "RU",
        "RV",
        "RX",
        "EC",
        "ES",
        "ER",
        "EF",
        "EG",
        "ET",
        "EY",
        "LE",
        "FPC",
        "FSC",
    }
)

OWNER_TOKENS = frozenset(
    {
        "OWNER",
        "OWNERBUILDER",
        "OWNERBUILT",
        "OWNERBUILD",
        "OB",
        "O/B",
        "O-B",
    }
)

PREFIXED = re.compile(r"^([A-Z]{2,6})(\d{4,})$")
# Observed county COC forms: 11P000450, 19B000138, 15E000494, 95BS00368
MDC_COC = re.compile(r"^\d{2}[A-Z]{1,3}\d{4,}$")
AGENCY_PHONES = frozenset(
    {
        "7863152880",
        "3053752877",
        "7863152000",
        "3053755143",
        "3053752512",
        "311",
        "7863152340",
        "7863152590",
        "7275823100",
        "7274643888",
        "7275826767",
    }
)

NAMESPACE_DBPR = "DBPR_FULL_PREFIXED"
NAMESPACE_COC = "MIAMI_DADE_COC"
NAMESPACE_OWNER = "OWNER_BUILDER"
NAMESPACE_OTHER = "OTHER_LOCAL_IDENTIFIER"
NAMESPACE_AMBIGUOUS = "AMBIGUOUS"
NAMESPACE_BLANK = "BLANK"


def normalize_full_license(raw: str | None) -> str:
    if not raw:
        return ""
    return re.sub(r"[\s\-_.]", "", str(raw)).upper()


def normalize_name(raw: str | None) -> str:
    if not raw:
        return ""
    return re.sub(r"[^A-Z0-9]+", "", str(raw).upper())


def is_owner_builder(name: str | None, number: str | None = None) -> bool:
    n = normalize_name(name)
    if n in OWNER_TOKENS or n.startswith("OWNER"):
        return True
    num = normalize_full_license(number)
    return num in OWNER_TOKENS


def is_agency_phone(raw: str | None) -> bool:
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return False
    return digits in AGENCY_PHONES or digits[-10:] in AGENCY_PHONES


def classify_contractor_number(raw: str | None, contractor_name: str | None = None) -> dict[str, Any]:
    """Return namespace class for one ContractorNumber value."""
    if is_owner_builder(contractor_name, raw):
        return {
            "namespace": NAMESPACE_OWNER,
            "normalized": normalize_full_license(raw) or "OWNER",
            "prefix": None,
            "dbpr_eligible": False,
        }
    n = normalize_full_license(raw)
    if not n:
        return {
            "namespace": NAMESPACE_BLANK,
            "normalized": "",
            "prefix": None,
            "dbpr_eligible": False,
        }
    m = PREFIXED.match(n)
    if m:
        prefix = m.group(1)
        if prefix in DBPR_OCCUPATION_PREFIXES:
            return {
                "namespace": NAMESPACE_DBPR,
                "normalized": n,
                "prefix": prefix,
                "dbpr_eligible": True,
            }
        return {
            "namespace": NAMESPACE_AMBIGUOUS,
            "normalized": n,
            "prefix": prefix,
            "dbpr_eligible": False,
        }
    if MDC_COC.match(n):
        return {
            "namespace": NAMESPACE_COC,
            "normalized": n,
            "prefix": None,
            "dbpr_eligible": False,
        }
    return {
        "namespace": NAMESPACE_OTHER,
        "normalized": n,
        "prefix": None,
        "dbpr_eligible": False,
    }


def identity_from_namespace(
    ns: str,
    *,
    dbpr_exists: bool = False,
    local_crosswalk: bool = False,
    has_name: bool = False,
) -> tuple[str, str]:
    """Map namespace + evidence to CONFIRMED / HIGH_CONFIDENCE / REVIEW_REQUIRED / UNRESOLVED."""
    if ns == NAMESPACE_OWNER:
        return "UNRESOLVED", "OWNER_BUILDER"
    if ns == NAMESPACE_BLANK:
        if has_name:
            return "REVIEW_REQUIRED", "REVIEW_REQUIRED"
        return "UNRESOLVED", "UNRESOLVED"
    if ns == NAMESPACE_DBPR and dbpr_exists:
        return "CONFIRMED", "FULL_DBPR_LICENSE"
    if ns == NAMESPACE_DBPR and not dbpr_exists:
        # Occupation-prefixed but not in our licenses table (ECLB gap, expired, typo).
        return "REVIEW_REQUIRED", "DBPR_PREFIX_NOT_IN_WAREHOUSE"
    if ns == NAMESPACE_COC and local_crosswalk:
        return "CONFIRMED", "LOCAL_LICENSE_CROSSWALK"
    if ns == NAMESPACE_COC:
        return "UNRESOLVED", "LOCAL_CREDENTIAL_CANDIDATE"
    if ns == NAMESPACE_AMBIGUOUS:
        return "UNRESOLVED", "UNRESOLVED"
    if ns == NAMESPACE_OTHER:
        if re.fullmatch(r"\d{4,}", ns) or True:
            # Numeric-looking or other local id: never CONFIRMED via DBPR path.
            return "UNRESOLVED", "UNRESOLVED"
    if has_name:
        return "REVIEW_REQUIRED", "REVIEW_REQUIRED"
    return "UNRESOLVED", "UNRESOLVED"
