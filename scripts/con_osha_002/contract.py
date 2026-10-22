"""CON-OSHA-002 source contract.

Eligible identities come from the certified B2 package. This module pins the
24-column contract from PR #167 at 67127bac and does not implement name, ZIP,
or county matching.
"""

from __future__ import annotations

B2_CONTRACT_COMMIT = "67127bac9d6b2b39fa02d07ec08e053c990346ed"

# scripts/osha/package.py PACKAGE_FIELDS at the commit above. Order is significant.
B2_PACKAGE_FIELDS = (
    "state",
    "source_system",
    "license_key",
    "contractor_id",
    "profile_eligible",
    "publication_status",
    "match_tier",
    "person_name_licensee",
    "norm_name",
    "postal_code",
    "county_name",
    "n_inspections",
    "osha_activity_nrs",
    "published_activity_nrs",
    "ambiguous_activity_nrs",
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
    "TN": "tn_blc",
}

CA_NAME_SOURCE = "licensee_name_raw"
PUBLIC_TIERS = frozenset({"exact", "strong"})
PUBLICATION_STATUSES = frozenset({
    "eligible",
    "weak_held",
    "ambiguous_held",
    "no_profile",
    "unproven_held",
})
EXPANSION_STATES = ("CA", "VA", "LA", "NV", "AZ", "TN")
EXCLUDED_STATES = frozenset({"MA", "GA", "OH", "NC", "FL", "NJ"})
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

# Certified package bytes at B2 head 67127bac. These replace the c07b930 pins.
VERIFIED_B2_PACKAGE_SHA256 = {
    "CA": "6c914c00d643f368c72de339bd4bb34b4cd5e9eaa3010b4a4c5fecef9e573539",
    "VA": "9c245e2c8ea69af10e2b86d1035a8c68070935439193f4265cdb4bbcb761bded",
    "LA": "547a2c47ee3588dc5af6916bfcef7dff8654e121c4023a303e4ac85120c12c99",
    "NV": "09b4b5c375df649b824473147adaf2e115b3c8fc2ac0b0e685bed46e60151ad7",
    "AZ": "e2a7db8d828fce8394a2dff5f47acc362b71b74e837453fcf3903a077469f143",
    "TN": "77d7a09eb9a1a83da4307de394b5dc861aea395f04ccd71288d65685b04243c0",
}

# Adapted official inspection and violation extracts in the private repro bundle.
OFFICIAL_INSPECTION_SHA256 = "206abcc8b2f54edd017a9bc64d79100d7fb788d07c44f87c475c14652cb085d4"
OFFICIAL_VIOLATION_SHA256 = "93a12b15332d5e1beaf28ed302059718e7c9c45c37bf62e19a33a95f2d192bbf"

CERTIFIED_ELIGIBLE_PROFILES = {
    "CA": 1706,
    "VA": 745,
    "LA": 392,
    "NV": 188,
    "AZ": 139,
    "TN": 244,
}
CERTIFIED_PUBLISHED_ACTIVITIES = {
    "CA": 2615,
    "VA": 1155,
    "LA": 651,
    "NV": 315,
    "AZ": 173,
    "TN": 370,
}
CERTIFIED_CITATIONS = {
    "CA": 6903,
    "VA": 4847,
    "LA": 1559,
    "NV": 1097,
    "AZ": 704,
    "TN": 1747,
}
CERTIFIED_ELIGIBLE_TOTAL = 3414
CERTIFIED_ACTIVITY_TOTAL = 5279
CERTIFIED_CITATION_TOTAL = 16857

OPTIONAL_INSPECTION_FIELDS = ("inspection_type", "close_date", "closing_conference_date")
CITATION_TYPES = frozenset({"S", "W", "R", "O", "U"})
DELETE_MARKER = "X"
MISSING_LINK_STATUSES = frozenset({"missing", "missing_citation_context"})
STATE_CHECK_NAMES = (
    "contractor_osha_license_matches_state_check",
    "contractor_osha_identity_review_state_check",
    "contractor_osha_inspections_state_check",
    "contractor_osha_match_inspections_state_check",
)


def matcher_authorized(state: str) -> bool:
    return state in B2_SOURCE_SYSTEMS
