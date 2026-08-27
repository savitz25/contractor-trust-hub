"""City of Miami AHJ permit audit/parser. Distinct from Miami-Dade RER."""
from __future__ import annotations

from typing import Any

from ingest.enhanced_county import parse_money
from ingest.mdc_contractor_number import classify_contractor_number, identity_from_namespace

PARSER_VERSION = "city-of-miami-permits-v1"
SOURCE_SYSTEM = "city_of_miami_ibuild"
SOURCE_JURISDICTION = "miami"
COUNTY_SLUG = "miami-dade"
COVERAGE = "CITY OF MIAMI AHJ ONLY — not Miami-Dade County permits"


def parse_city_row(rec: dict[str, Any]) -> dict[str, Any]:
    number = str(rec.get("PermitNumber") or rec.get("PERMITNUMBER") or rec.get("permit_number") or "").strip()
    status = str(
        rec.get("BuildingPermitStatusDescription")
        or rec.get("PermitStatus")
        or rec.get("Status")
        or rec.get("APPLICATIONSTATUS")
        or "unknown"
    ).strip()
    lic = rec.get("ContractorLicense") or rec.get("LICENSE_NO") or rec.get("ContractorNumber") or ""
    name = rec.get("CompanyName") or rec.get("ContractorName") or rec.get("CONTRACTOR") or rec.get("COMPANY") or ""
    ns = classify_contractor_number(str(lic) if lic else None, str(name) if name else None)
    state, method = identity_from_namespace(
        ns["namespace"],
        dbpr_exists=False,
        has_name=bool(name),
    )
    val = None
    for k in ("TotalCost", "NewAdditionCost", "RemodelingCost", "EstimatedValue", "JOBVALUE", "Cost", "PERMITVALUE", "Valuation"):
        if rec.get(k) not in (None, ""):
            _, val = parse_money(rec.get(k))
            break
    return {
        "source_system": SOURCE_SYSTEM,
        "source_jurisdiction": SOURCE_JURISDICTION,
        "county_slug": COUNTY_SLUG,
        "coverage": COVERAGE,
        "permit_number": number,
        "status_raw": status or "unknown",
        "contractor_name_raw": name or None,
        "contractor_license_raw": str(lic).strip() or None,
        "contractor_namespace": ns["namespace"],
        "identity_state": state,
        "identity_method": method,
        "valuation": val,
        "property_address": rec.get("FULLADDR") or rec.get("Address") or rec.get("SITEADDRESS"),
        "parcel_id": rec.get("FOLIO") or rec.get("Folio"),
        "parser_version": PARSER_VERSION,
        "raw_payload": rec,
    }
