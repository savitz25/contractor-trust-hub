"""Board parameters for the Group 1 OSHA matcher."""

from __future__ import annotations

STATES = {
    "VA": {"source_system": "va_dpor", "name_tokens": ("VA", "VIRGINIA"), "fips": "51"},
    "AZ": {"source_system": "az_roc", "name_tokens": ("AZ", "ARIZONA"), "fips": "04"},
    "NV": {"source_system": "nv_nscb", "name_tokens": ("NV", "NEVADA"), "fips": "32"},
    "LA": {"source_system": "la_lslbc", "name_tokens": ("LA", "LOUISIANA"), "fips": "22"},
    "CA": {"source_system": "ca_cslb", "name_tokens": ("CA", "CALIFORNIA"), "fips": "06"},
}

STATE_ORDER = ("VA", "AZ", "NV", "LA", "CA")
FIPS_TO_STATE = {spec["fips"]: code for code, spec in STATES.items()}
SOURCE_TO_STATE = {spec["source_system"]: code for code, spec in STATES.items()}
