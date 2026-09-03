#!/usr/bin/env python3
"""Build NJ-CON-COUNTY-001 municipality tables and NJSAVI construction-vendor candidates."""
from __future__ import annotations

import csv
import hashlib
import json
import re
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUNI_CSV = ROOT / "artifacts/nj-con-002b-jurisdiction-reconciliation.csv"
SNAP = json.loads((ROOT / "lib/new-jersey-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
OUT_DIR = ROOT / "lib/new-jersey-intelligence/counties"
WANT = ("MONMOUTH", "MIDDLESEX", "SOMERSET", "UNION")
FIPS = {
    "MONMOUTH": "34025",
    "MIDDLESEX": "34023",
    "SOMERSET": "34035",
    "UNION": "34039",
}
SLUGS = {
    "MONMOUTH": "monmouth-county",
    "MIDDLESEX": "middlesex-county",
    "SOMERSET": "somerset-county",
    "UNION": "union-county",
}
CANONICAL_MUNI = {"MONMOUTH": 53, "MIDDLESEX": 25, "SOMERSET": 21, "UNION": 21}


def norm(s: str) -> str:
    s = (s or "").upper()
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    s = re.sub(r"\b(CITY|TOWNSHIP|BOROUGH|BORO|TOWN|VILLAGE|TWP)\b", "", s)
    return re.sub(r"\s+", " ", s).strip()


def load_munis() -> dict[str, list[dict]]:
    rows: dict[str, list[dict]] = defaultdict(list)
    with MUNI_CSV.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            c = r["county"].upper()
            if c not in WANT:
                continue
            rows[c].append(
                {
                    "municipality_code": r["municipality_code"],
                    "name": r["canonical_name"],
                    "classification": r["classification"],
                    "observed_rows": int(r["observed_rows"]),
                    "permit_issued_records": int(r["observed_p"]),
                    "certificate_issued_records": int(r["observed_c"]),
                    "no_records_is_not_zero": r["no_records_is_not_zero"] == "True",
                }
            )
    for c in rows:
        rows[c].sort(key=lambda x: x["municipality_code"])
    return rows


def _trade_label(commodity: str, name: str, name_kw: re.Pattern[str]) -> str:
    m = re.search(r"\bC-\d{4,5}\b", commodity)
    if m:
        return m.group(0)
    m = re.search(r"\b9(?:09|12|13|14)-\d+", commodity)
    if m:
        return m.group(0)
    m = name_kw.search(name)
    return m.group(0) if m else "construction"


def fetch_njsavi() -> list[dict]:
    url = "https://data.nj.gov/resource/tfhb-8beb.json?$limit=12000"
    req = urllib.request.Request(url, headers={"User-Agent": "contractor-trust-hub-nj-con-county-001"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))


def njsavi_candidates(munis: dict[str, list[dict]], rows: list[dict]) -> dict:
    city_to_county: dict[str, str | None] = {}
    for county, lst in munis.items():
        for m in lst:
            city_to_county[norm(m["name"])] = county
    aliases = {
        "MONMOUTH JUNCTION": "MIDDLESEX",
        "KENDALL PARK": "MIDDLESEX",
        "ISELIN": "MIDDLESEX",
        "COLONIA": "MIDDLESEX",
        "AVENEL": "MIDDLESEX",
        "FORDS": "MIDDLESEX",
        "SEWAREN": "MIDDLESEX",
        "PORT READING": "MIDDLESEX",
        "PARLIN": "MIDDLESEX",
        "CLIFFWOOD": "MONMOUTH",
        "BASKING RIDGE": "SOMERSET",
        "LIBERTY CORNER": "SOMERSET",
        "SKILLMAN": "SOMERSET",
        "BELLE MEAD": "SOMERSET",
        "NESHANIC STATION": "SOMERSET",
        "VAUXHALL": "UNION",
        "ELIZABETHPORT": "UNION",
        "SCOTCH PLAINS": "UNION",
        "NEW PROVIDENCE": "UNION",
        "BERKELEY HEIGHTS": "UNION",
        "FANWOOD": "UNION",
    }
    city_to_county.update(aliases)
    dpmc = re.compile(r"\bC-\d{4,5}\b")
    nigp = re.compile(r"\b(909|912|913|914)-\d+")
    name_kw = re.compile(
        r"CONSTRUCT|CONTRACTING|PAVING|PLUMB|ELECTRICAL|HVAC|ROOFING|MASON|"
        r"CARPENT|EXCAVAT|CONCRETE|HOME IMPROV|GENERAL CONTRACT|ASBESTOS|"
        r"LEAD ABATE|FIRE PROT",
        re.I,
    )
    keep = []
    for r in rows:
        st = (r.get("business_state") or "").upper()
        if st and st not in ("NJ", "NEW JERSEY"):
            continue
        city = r.get("business_city") or ""
        county = city_to_county.get(norm(city))
        if not county:
            continue
        commodity = r.get("commodity_code_description") or ""
        name = r.get("business_name") or ""
        construction_class = bool(re.search(r"\bC-00\d{3}\b", commodity) or re.search(r"\bC-02060\b", commodity))
        if not (construction_class or nigp.search(commodity) or name_kw.search(name)):
            continue
        keep.append(
            {
                "business_name": r.get("business_name"),
                "business_address": r.get("business_address"),
                "business_city": city,
                "business_state": r.get("business_state") or "NJ",
                "business_zip": r.get("business_zip"),
                "county": county,
                "primary_phone": r.get("primary_phone") or None,
                "public_business_email": r.get("email_address") or None,
                "trade_or_category": _trade_label(commodity, name, name_kw),
                "certification_type": r.get("certification_type"),
                "entity_class": "NJSAVI_CERTIFIED_VENDOR",
                "not_a_contractor_license": True,
                "official_contractor_id": None,
                "match_method": "city_to_county_crosswalk",
            }
        )
    keep.sort(key=lambda x: (x["county"], x["business_name"] or ""))
    return {
        "source": "NJSAVI",
        "source_url": "https://data.nj.gov/Economic-Development/NJSAVI/tfhb-8beb",
        "source_as_of": "2026-09-03",
        "universe_rows": len(rows),
        "notes": [
            "NJSAVI is a state certified-vendor dataset, not a contractor license roster.",
            "VENDOR != LICENSED CONTRACTOR.",
            "City mapped to county via NJ-CON-002B municipality names. City is not a service area.",
            "Contact name omitted. Phone/email treated as published business contact.",
            "Name-only rows are not auto-attached to contractor profiles.",
        ],
        "rows": keep,
        "counts_by_county": dict(Counter(x["county"] for x in keep)),
        "phones": sum(1 for x in keep if x["primary_phone"]),
        "emails": sum(1 for x in keep if x["public_business_email"]),
    }


def county_from_state(name: str) -> dict:
    for c in SNAP["counties"]:
        if c["name"] == name:
            return c
    raise KeyError(name)


def fingerprint(obj: dict) -> str:
    payload = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def local_intel(name: str) -> dict:
    if name == "MIDDLESEX":
        return {
            "kind": "zoning_and_site_incentives",
            "source_families": ["county_gis_zoning", "site_incentives"],
            "zoning": {
                "feature_count": 2794,
                "municipalities_represented": 25,
                "service_item_id": "be5d52d532cb4da281cd6849b9bdd223",
                "fields": ["MUNI", "ZONENAME", "Zone_code", "Use_", "Redevelopm"],
                "note": "Planning compilation. Not a parcel zoning determination. Confirm with the municipality.",
            },
            "incentives": {
                "layers": [
                    {"name": "Portfields", "count": 6},
                    {"name": "Main Street", "count": 2},
                    {"name": "Special Improvement Districts", "count": 8},
                    {"name": "Brownfield Development Areas", "count": 5},
                    {"name": "Foreign Trade Zones", "count": 5},
                    {"name": "Urban Enterprise Zone", "count": 3},
                    {"name": "Redevelopment Areas", "count": 426},
                    {"name": "Transit Villages", "count": 4},
                ],
                "note": "Site-selection overlays, not a commercial real-estate database and not a project count.",
            },
        }
    if name == "SOMERSET":
        return {
            "kind": "county_gis_utilities",
            "source_families": ["county_gis_sewer", "county_gis_hub"],
            "sewer_service_areas": {
                "feature_count": 48,
                "note": "Service area is not a connection, permit, or engineering determination.",
            },
            "gis_hub": {
                "datasets_indexed": 75,
                "note": "County Hub catalog. Do not duplicate NJGIN parcels.",
            },
        }
    if name == "UNION":
        return {
            "kind": "home_improvement_program",
            "source_families": ["union_cdbg_hip", "consumer_affairs_coverage"],
            "program_id": "UNION_COUNTY_HOME_IMPROVEMENT_PROGRAM",
            "not_a_county_contractor_license": True,
            "funding": "CDBG",
            "eligible_property": "Owner-occupied 1- and 2-family homes",
            "participating_municipalities": [
                "Berkeley Heights",
                "Clark",
                "Cranford",
                "Fanwood",
                "Garwood",
                "Hillside",
                "Kenilworth",
                "Mountainside",
                "New Providence",
                "Roselle",
                "Roselle Park",
                "Scotch Plains",
                "Springfield",
                "Summit",
                "Westfield",
            ],
            "independent_municipal_rehab": ["Elizabeth", "Linden", "Plainfield", "Rahway", "Union"],
            "participant_list_public": False,
            "participant_entity_class_if_acquired": "UNION_COUNTY_HOME_IMPROVEMENT_PROGRAM_PARTICIPANT",
            "source_url": "https://ucnj.org/department-of-economic-development/home-improvement-and-senior-home-improvement-grant-programs/",
            "source_as_of": "2026-01-14",
            "benefit_note": "Deferred loan up to $24,999 as published 2026-01-14. HUD income limits change annually.",
            "staff_role": "Program staff prepare work write-ups, review contractor bids, and inspect work. That is program administration, not a county license.",
        }
    return {
        "kind": "county_gis_property_context",
        "source_families": ["county_geohub", "njgin_parcels_reference"],
        "geohub": "https://gis-monmouthnj.opendata.arcgis.com/",
        "property_viewer": "https://experience.arcgis.com/experience/c6d4c6eba758410dbedef25a6bce8591",
        "njgin_parcel_count": 249796,
        "note": "County GIS/property context on top of statewide NJGIN. Parcel geometry is not a legal survey. Do not scrape OPRS.",
    }


def findings(name: str, p: int, c: int, munis: list[dict], njsavi_n: int) -> list[dict]:
    reporters = sum(1 for m in munis if m["classification"] == "CURRENT_REPORTING")
    non = [m for m in munis if m["classification"] != "CURRENT_REPORTING"]
    out = [
        {
            "id": "construction-source-records",
            "text": (
                f"{name.title()} County has {p + c:,} DCA construction SOURCE RECORDS in the acquired extract "
                f"({p:,} permit-issued and {c:,} certificate-issued). That is not {p + c:,} unique permits or projects. "
                "P and C are separate classes and their costs are not added."
            ),
        },
        {
            "id": "municipality-coverage",
            "text": (
                f"{reporters} of {CANONICAL_MUNI[name]} current municipalities are observed reporters in this extract."
                + (
                    " " + "; ".join(f"{m['name']} is a known non-reporter (coverage gap, not zero activity)." for m in non)
                    if non
                    else " County data absence is not zero construction."
                )
            ),
        },
    ]
    if name == "UNION":
        out.append(
            {
                "id": "hip-not-license",
                "text": "The Union County Home Improvement Program is a CDBG rehabilitation program, not a Union County contractor license. No public participant/vendor list was acquired.",
            }
        )
        out.append(
            {
                "id": "safe-house",
                "text": "One Safe House / HIC notice of violation in the statewide inventory names a Union County town (Plainfield). A notice is not a final order.",
            }
        )
    elif name == "MIDDLESEX":
        out.append(
            {
                "id": "zoning-incentives",
                "text": "County-standardized zoning covers all 25 municipalities (2,794 polygons). Redevelopment and incentive overlays add construction context. They are not parcel-level zoning determinations.",
            }
        )
    elif name == "SOMERSET":
        out.append(
            {
                "id": "sewer-gis",
                "text": "Somerset County publishes 48 sewer service area polygons and a 75-dataset GIS Hub. A sewer service area is not a connection or a permit.",
            }
        )
    else:
        out.append(
            {
                "id": "gis-context",
                "text": "Monmouth County GIS/GeoHub and the Property Viewer add property/building context on top of statewide NJGIN parcels. OPRS land records remain search-only and were not scraped.",
            }
        )
    out.append(
        {
            "id": "njsavi-vendors",
            "text": (
                f"{njsavi_n} NJSAVI certified-vendor rows with a published business city in {name.title()} County "
                "matched a construction-related keyword filter. A certified vendor is not a licensed contractor. "
                "Business address is not a service area."
            ),
        }
    )
    return out


def build_snapshot(name: str, munis: list[dict], njsavi: dict, safe_house: list[dict]) -> dict:
    st = county_from_state(name)
    p = st["permit_issued_records"]
    c = st["certificate_issued_records"]
    vendors = [r for r in njsavi["rows"] if r["county"] == name]
    reporters = [m for m in munis if m["classification"] == "CURRENT_REPORTING"]
    non = [m for m in munis if m["classification"] != "CURRENT_REPORTING"]
    families = [
        "nj_dca_construction",
        "nj_con_002b_municipality_universe",
        "njsavi_certified_vendor",
    ]
    local = local_intel(name)
    families.extend(local.get("source_families") or [])
    if name == "UNION":
        families.append("safe_house_nov_inventory")
    obj = {
        "ticket": "NJ-CON-COUNTY-001",
        "version": "contractor-nj-county-intel-v1",
        "county": name.title(),
        "county_slug": SLUGS[name],
        "county_fips": FIPS[name],
        "path": f"/new-jersey/{SLUGS[name]}",
        "as_of": SNAP["as_of"],
        "source_clocks": SNAP["source_as_of"] | {"njsavi": njsavi["source_as_of"], "county_research": "2026-09-03"},
        "hero": {
            "universe_label": "DCA construction source records",
            "universe_value": p + c,
            "universe_hint": "Permit-issued plus certificate-issued SOURCE RECORDS. Not unique permits or projects.",
            "current_label": "data received as of",
            "current_value": SNAP["hero"]["current_value"],
            "current_hint": SNAP["hero"]["current_hint"],
            "observations_label": "construction-related NJSAVI vendor rows (city in county)",
            "observations_value": len(vendors),
            "observations_hint": "Certified vendor, not a contractor license. Business city is not a service area.",
            "geography_label": "current municipalities in this county",
            "geography_value": CANONICAL_MUNI[name],
            "geography_hint": (
                f"{len(reporters)} observed reporter"
                f"{'' if len(reporters) == 1 else 's'}; "
                f"{len(non)} known non-reporter"
                f"{'' if len(non) == 1 else 's'}."
            ),
            "as_of_label": "construction source metadata",
            "as_of_value": SNAP["as_of"],
        },
        "construction": {
            "total_source_records": p + c,
            "permit_issued_records": p,
            "certificate_issued_records": c,
            "p_is_not_c": True,
            "p_plus_c_cost_blocked": True,
            "total_is_not_permits": True,
            "contractor_attribution": None,
            "market_only": True,
            "state_not_additive_municipality": True,
            "grain": "municipal_permit_or_certificate_record",
            "caveat": SNAP["construction"]["caveat"],
            "landing_url": SNAP["construction"]["landing_url"],
            "work_class_composition": None,
            "p_stage_unit_change": None,
            "unit_change_note": "Statewide P-stage unit change is published on /new-jersey. County unit change is not computed from committed artifacts in this ticket.",
            "cost_note": SNAP["cost"]["reason"],
        },
        "municipalities": {
            "canonical_current": CANONICAL_MUNI[name],
            "observed_reporters": len(reporters),
            "known_non_reporters": len(non),
            "rows": munis,
        },
        "regulatory": {
            "statewide_families_remain_statewide": True,
            "pwcr": SNAP["regulatory"]["pwcr"],
            "note": "WALL, Wage Watchlist, and Treasury lists are statewide families. This page does not infer county membership from business names.",
            "safe_house_novs_in_county": safe_house,
            "consumer_affairs": {
                "coverage": "LOOKUP_OR_REQUEST_ONLY" if name != "SOMERSET" else "NO_COUNTY_OFFICE_IN_ATH_AUDIT",
                "bulk_rows": 0,
                "complaint_ne_violation": True,
                "do_not_show_zero_complaints": True,
            },
        },
        "specialty": {
            "statewide_only": True,
            "note": "Lead, asbestos, and fire-protection snapshots are statewide program lists without a county field in the public NJ-CON-004 extract. Absence here is unknown, not zero.",
            "lead_evaluation_url": SNAP["specialty"]["lead_evaluation"]["url"],
            "lead_abatement_url": SNAP["specialty"]["lead_abatement"]["url"],
            "asbestos_url": SNAP["specialty"]["asbestos_ascm"]["url"],
            "fire_url": SNAP["specialty"]["fire_protection"]["url"],
        },
        "local": local,
        "contractor_discovery": {
            "public_profiles_with_deterministic_county_address": 0,
            "geography_label": f"Business address in {name.title()} County",
            "not_service_area": True,
            "njsavi_construction_vendor_candidates": len(vendors),
            "njsavi_with_phone": sum(1 for v in vendors if v["primary_phone"]),
            "njsavi_with_email": sum(1 for v in vendors if v["public_business_email"]),
            "auto_attached_profiles": 0,
            "name_only_attach": False,
        },
        "contact_enrichment": {
            "new_business_phones": sum(1 for v in vendors if v["primary_phone"]),
            "new_business_emails": sum(1 for v in vendors if v["public_business_email"]),
            "websites": 0,
            "matched_existing_profiles": 0,
            "overwrote_stronger_evidence": False,
            "source": "NJSAVI",
            "public_eligibility": "business_contact_on_vendor_candidate_rows_only",
        },
        "njsavi_preview": vendors[:12],
        "findings": findings(name, p, c, munis, len(vendors)),
        "coverage_gaps": [
            "No county-filtered public contractor license roster in this snapshot.",
            "PWCR remains SOURCE_NOT_ACQUIRED statewide.",
            "Construction source records have no contractor field.",
            "County procurement portals are search-only and were not scraped.",
            "Consumer-affairs complaint history has no bulk extract.",
        ],
        "skipped_sources": [
            {"source": "Monmouth OPRS / Middlesex SearchNG", "reason": "SEARCH_ONLY"},
            {"source": "County purchasing / OpenGov / POL bid portals", "reason": "SEARCH_ONLY"},
            {"source": "Union HIP participant list", "reason": "REQUEST_ONLY"},
            {"source": "MCIA $17,500+ payee HTML (mixed utilities/insurance)", "reason": "LOW_ROI"},
            {"source": "Chamber / BBB contractor directories", "reason": "TERMS"},
        ],
        "publication_gate": {
            "authoritative_source_families": sorted(set(families)),
            "family_count": len(set(families)),
            "county_specific": True,
            "finding_count": 0,
            "thin_state_copy": False,
            "indexable": False,
        },
        "invariants": {
            "business_address_ne_service_area": True,
            "vendor_ne_licensed_contractor": True,
            "program_participant_ne_licensed_contractor": True,
            "construction_record_ne_contractor_attribution": True,
            "lien_ne_wrongdoing": True,
            "complaint_ne_violation": True,
            "notice_ne_final_order": True,
            "no_match_ne_clean": True,
            "p_ne_c": True,
            "p_plus_c_cost_blocked": True,
            "no_ranking": True,
            "no_trust_score": True,
        },
    }
    obj["publication_gate"]["finding_count"] = len(obj["findings"])
    obj["publication_gate"]["indexable"] = (
        obj["publication_gate"]["family_count"] >= 3
        and obj["publication_gate"]["county_specific"]
        and obj["publication_gate"]["finding_count"] >= 2
        and not obj["publication_gate"]["thin_state_copy"]
    )
    body = {k: v for k, v in obj.items() if k != "fingerprint"}
    obj["fingerprint"] = fingerprint(body)
    return obj


def main() -> None:
    munis = load_munis()
    njsavi_rows = fetch_njsavi()
    njsavi = njsavi_candidates(munis, njsavi_rows)
    print("NJSAVI", njsavi["counts_by_county"], "phones", njsavi["phones"], "emails", njsavi["emails"])

    sh = [
        row
        for row in SNAP["safe_house"]["inventory"]
        if row.get("county", "").lower() in ("union", "monmouth", "middlesex", "somerset")
    ]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "njsavi-construction-candidates.json").write_text(json.dumps(njsavi, indent=2) + "\n", encoding="utf-8")

    for name in WANT:
        county_sh = [r for r in sh if r.get("county", "").upper() == name]
        snap = build_snapshot(name, munis[name], njsavi, county_sh)
        path = OUT_DIR / f"{SLUGS[name].replace('-county', '')}.json"
        path.write_text(json.dumps(snap, indent=2) + "\n", encoding="utf-8")
        print("wrote", path.name, "indexable", snap["publication_gate"]["indexable"], "fp", snap["fingerprint"][:12])


if __name__ == "__main__":
    main()
