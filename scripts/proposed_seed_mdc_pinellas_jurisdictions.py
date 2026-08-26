#!/usr/bin/env python3
"""PROPOSED Miami-Dade + Pinellas AHJ metadata. Writes JSON only. Does NOT connect to production."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/intelligence/enhanced-county/proposed-seed-miami-dade-pinellas-jurisdictions.json"

MDC_CITIES = [
    ("miami", "Miami"),
    ("homestead", "Homestead"),
    ("florida-city", "Florida City"),
    ("miami-beach", "Miami Beach"),
    ("coral-gables", "Coral Gables"),
    ("hialeah", "Hialeah"),
    ("north-miami", "North Miami"),
    ("opa-locka", "Opa-locka"),
    ("miami-springs", "Miami Springs"),
    ("south-miami", "South Miami"),
    ("golden-beach", "Golden Beach"),
    ("north-miami-beach", "North Miami Beach"),
    ("miami-shores", "Miami Shores"),
    ("biscayne-park", "Biscayne Park"),
    ("surfside", "Surfside"),
    ("el-portal", "El Portal"),
    ("indian-creek-village", "Indian Creek Village"),
    ("sweetwater", "Sweetwater"),
    ("north-bay-village", "North Bay Village"),
    ("west-miami", "West Miami"),
    ("bay-harbor-islands", "Bay Harbor Islands"),
    ("bal-harbour", "Bal Harbour"),
    ("virginia-gardens", "Virginia Gardens"),
    ("hialeah-gardens", "Hialeah Gardens"),
    ("medley", "Medley"),
    ("key-biscayne", "Key Biscayne"),
    ("aventura", "Aventura"),
    ("pinecrest", "Pinecrest"),
    ("sunny-isles-beach", "Sunny Isles Beach"),
    ("miami-lakes", "Miami Lakes"),
    ("palmetto-bay", "Palmetto Bay"),
    ("miami-gardens", "Miami Gardens"),
    ("doral", "Doral"),
    ("cutler-bay", "Cutler Bay"),
]

PINELLAS_CITIES = [
    ("belleair", "Belleair", "municipal"),
    ("belleair-beach", "Belleair Beach", "bdrs_partner"),
    ("belleair-bluffs", "Belleair Bluffs", "safebuilt_from_2025_08"),
    ("belleair-shore", "Belleair Shore", "bdrs_partner"),
    ("clearwater", "Clearwater", "municipal"),
    ("dunedin", "Dunedin", "municipal"),
    ("gulfport", "Gulfport", "municipal"),
    ("indian-rocks-beach", "Indian Rocks Beach", "bdrs_partner"),
    ("indian-shores", "Indian Shores", "municipal"),
    ("kenneth-city", "Kenneth City", "bdrs_partner"),
    ("largo", "Largo", "municipal"),
    ("madeira-beach", "Madeira Beach", "municipal"),
    ("north-redington-beach", "North Redington Beach", "municipal"),
    ("oldsmar", "Oldsmar", "bdrs_partner"),
    ("pinellas-park", "Pinellas Park", "municipal"),
    ("redington-beach", "Redington Beach", "via_redington_shores"),
    ("redington-shores", "Redington Shores", "municipal"),
    ("safety-harbor", "Safety Harbor", "bdrs_partner"),
    ("st-pete-beach", "St. Pete Beach", "municipal"),
    ("st-petersburg", "St. Petersburg", "municipal"),
    ("seminole", "Seminole", "municipal"),
    ("south-pasadena", "South Pasadena", "municipal"),
    ("tarpon-springs", "Tarpon Springs", "municipal"),
    ("treasure-island", "Treasure Island", "municipal"),
]


def rows() -> list[dict]:
    out = [
        {
            "county_slug": "miami-dade",
            "jurisdiction_slug": "unincorporated",
            "jurisdiction_label": "Unincorporated Miami-Dade County",
            "kind": "unincorporated",
            "permitting_authority": "Miami-Dade RER Building Division",
            "public_search_url": "https://www.miamidade.gov/permits/online-services.asp",
            "vendor": "EPS / e-permitting / Open Data Hub",
            "agency": "Miami-Dade RER",
            "coverage_type": "unincorporated",
            "expected_permit_authority": "RER Building (folio 30)",
            "data_availability": "open_data_partial",
            "metadata_status": "proposed",
            "notes": "PROPOSED SEED. County-issued permits only. Not 34 municipal histories. Islandia abolished 2012.",
        },
        {
            "county_slug": "pinellas",
            "jurisdiction_slug": "unincorporated",
            "jurisdiction_label": "Unincorporated Pinellas County",
            "kind": "unincorporated",
            "permitting_authority": "Pinellas County Building and Development Review Services",
            "public_search_url": "https://aca-prod.accela.com/pinellas/",
            "vendor": "Accela Citizen Access",
            "agency": "Pinellas County BDRS",
            "coverage_type": "unincorporated",
            "expected_permit_authority": "County Accela (unincorporated + partner cities listed on municipal rows)",
            "data_availability": "pra_recommended",
            "metadata_status": "proposed",
            "notes": "PROPOSED SEED. Not countywide. Partner cities remain separate AHJ rows.",
        },
    ]
    for slug, label in MDC_CITIES:
        out.append(
            {
                "county_slug": "miami-dade",
                "jurisdiction_slug": slug,
                "jurisdiction_label": label,
                "kind": "municipal",
                "permitting_authority": f"{label} Building Department",
                "public_search_url": None,
                "vendor": None,
                "agency": label,
                "coverage_type": "municipal",
                "expected_permit_authority": "Municipal AHJ",
                "data_availability": "none",
                "metadata_status": "proposed",
                "notes": "PROPOSED SEED. Municipal building permits are not RER unincorporated history.",
            }
        )
    notes = {
        "bdrs_partner": "Currently administered in Pinellas County Accela per county building-department directory (2026-08-26).",
        "safebuilt_from_2025_08": "BDRS through ~2025-08-15; new permits SAFEbuilt thereafter. Historical Accela vs new vendor must be split.",
        "via_redington_shores": "County directory: building services administered by Town of Redington Shores.",
        "municipal": "Independent municipal building department. Not County Accela warehouse.",
    }
    for slug, label, flag in PINELLAS_CITIES:
        out.append(
            {
                "county_slug": "pinellas",
                "jurisdiction_slug": slug,
                "jurisdiction_label": label,
                "kind": "municipal",
                "permitting_authority": f"{label} Building Department",
                "public_search_url": "https://aca-prod.accela.com/pinellas/" if flag == "bdrs_partner" else None,
                "vendor": "Accela (County BDRS)" if flag == "bdrs_partner" else None,
                "agency": label,
                "coverage_type": "municipal",
                "expected_permit_authority": "County BDRS Accela" if flag == "bdrs_partner" else "Municipal AHJ",
                "data_availability": "pra_recommended" if flag == "bdrs_partner" else "none",
                "metadata_status": "proposed",
                "notes": "PROPOSED SEED. " + notes[flag],
            }
        )
    return out


def main() -> None:
    data = rows()
    mdc = [r for r in data if r["county_slug"] == "miami-dade"]
    pin = [r for r in data if r["county_slug"] == "pinellas"]
    assert len(MDC_CITIES) == 34, len(MDC_CITIES)
    assert len(PINELLAS_CITIES) == 24, len(PINELLAS_CITIES)
    assert len(mdc) == 35, len(mdc)
    assert len(pin) == 25, len(pin)
    payload = {
        "status": "PROPOSED_NOT_APPLIED",
        "do_not_seed_production": True,
        "source": "Official county municipality lists retrieved 2026-08-26",
        "counts": {"miami-dade": 35, "pinellas": 25},
        "rows": data,
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote {OUT} mdc={len(mdc)} pinellas={len(pin)}")


if __name__ == "__main__":
    main()
