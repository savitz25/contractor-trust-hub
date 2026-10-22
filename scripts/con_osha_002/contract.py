"""CON-OSHA-002 source contract.

Eligible identities come from B2 package rows. This module pins the column
contract from PR #167 (commit c07b930) and does not implement name, ZIP, or
county matching. Tennessee is configured for a later B2 package and is not a
public identity source until that contract includes tn_blc.
"""

from __future__ import annotations

B2_CONTRACT_COMMIT = "c07b9301b88050640d9b44312a0f7ee7041bb865"

# scripts/osha/package.py PACKAGE_FIELDS at the commit above.
B2_PACKAGE_FIELDS = (
    "state",
    "source_system",
    "license_key",
    "match_tier",
    "person_name_licensee",
    "norm_name",
    "postal_code",
    "county_name",
    "n_inspections",
    "osha_activity_nrs",
    "first_open",
    "last_open",
    "n_citation_items",
    "n_serious",
    "n_willful_repeat",
    "current_penalty_amount",
    "initial_penalty_amount",
    "n_with_final_order",
    "n_contested",
)

B2_SOURCE_SYSTEMS = {
    "VA": "va_dpor",
    "AZ": "az_roc",
    "NV": "nv_nscb",
    "LA": "la_lslbc",
    "CA": "ca_cslb",
}

CA_NAME_SOURCE = "licensee_name_raw"
PUBLIC_TIERS = frozenset({"exact", "strong"})
EXPANSION_STATES = ("CA", "VA", "LA", "NV", "AZ", "TN")
EXCLUDED_STATES = frozenset({"MA", "GA", "OH", "NC"})
MATCH_SOURCE_SYSTEM = "us_dol_osha"
EXPANSION_BATCH_SOURCE = "us_dol_osha_expansion"
GO_PHRASE = "CON-OSHA-002-EXPANSION-LOAD-GO"
FLNJ_GO_PHRASE = "CON-OSHA-001B-DETAIL-LOAD-GO"

# Pinned extras zip hashes. MA, GA, OH, and NC hashes are intentionally absent.
SOURCE_ZIP_SHA256 = {
    "AZ": ("c08eaa271f3e768c159435f0988f4f2e0679de62db8874d1d7005efe69c1164a",),
    "CA": (
        "a9f2f405ae4b9bc62d0f8c6538c5aaea54c54ff8d9c151398c9d310f56e32aeb",
        "dbaaeeb6986908645567dca8f3cd26ea5a71f838296f3e2dd20385ef3ed1ba45",
    ),
    "LA": ("e4d0b8722f56142754d6ec73e4da1367b64d9fa22688c4d5922121d85badb301",),
    "NV": ("9eb9b1577234d0dcd136d9ae0507e49e605040bccc20286eff0f4ba062fc09be",),
    "TN": ("1d9066e6e1b840f2652f733f00fafb991eff5afd504de90f3e967eb4ca56f956",),
    "VA": ("92a367f2021c0f1ff4c7e4acec9159929bc6535be2c865e335c1c9b54e3d7739",),
}

# Package bytes observed for the committed matcher. Unit tests use fixtures.
VERIFIED_B2_PACKAGE_SHA256 = {
    "VA": "302eb02bf03b40aad7cb5b61efd0edb519533ac873deff5c3d39cb96eb3297f9",
    "AZ": "748095d7d14b28635c88753ce95da31a8cbfc66bf4d70803f14e6e2320611505",
    "NV": "7b41ba640655d6b6d92345c3269d359bf79fb4fc0ca5e888975ec8e02f2223c6",
    "LA": "be39d900b5240378b0b6784cc34f69fb7ab5a0b908f43201e5fbb53a8e5fe5d7",
    "CA": "72d8470c7f2395bb865f5a36435ea6b2b8b428fcc701179394962e64297c789d",
}

OPTIONAL_INSPECTION_FIELDS = ("inspection_type", "close_date", "closing_conference_date")
CITATION_TYPES = frozenset({"S", "W", "R", "O", "U"})
DELETE_MARKER = "X"
MISSING_LINK_STATUSES = frozenset({"missing", "missing_citation_context"})


def matcher_authorized(state: str) -> bool:
    return state in B2_SOURCE_SYSTEMS
