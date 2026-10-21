"""Board parameters for the Group 1 OSHA matcher."""

from __future__ import annotations

STATES = {
    "VA": {"source_system": "va_dpor", "fips": "51"},
    "AZ": {"source_system": "az_roc", "fips": "04"},
    "NV": {"source_system": "nv_nscb", "fips": "32"},
    "LA": {"source_system": "la_lslbc", "fips": "22"},
    "CA": {"source_system": "ca_cslb", "fips": "06"},
}

STATE_ORDER = ("VA", "AZ", "NV", "LA", "CA")
FIPS_TO_STATE = {spec["fips"]: code for code, spec in STATES.items()}
SOURCE_TO_STATE = {spec["source_system"]: code for code, spec in STATES.items()}
