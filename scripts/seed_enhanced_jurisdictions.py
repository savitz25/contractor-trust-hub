#!/usr/bin/env python3
"""Seed AHJ metadata only. Not permit activity. Idempotent upserts."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402

BROWARD_CITIES = [
    ("coconut-creek", "Coconut Creek"),
    ("cooper-city", "Cooper City"),
    ("coral-springs", "Coral Springs"),
    ("dania-beach", "Dania Beach"),
    ("davie", "Davie"),
    ("deerfield-beach", "Deerfield Beach"),
    ("fort-lauderdale", "Fort Lauderdale"),
    ("hallandale-beach", "Hallandale Beach"),
    ("hillsboro-beach", "Hillsboro Beach"),
    ("hollywood", "Hollywood"),
    ("lauderdale-by-the-sea", "Lauderdale-by-the-Sea"),
    ("lauderdale-lakes", "Lauderdale Lakes"),
    ("lauderhill", "Lauderhill"),
    ("lazy-lake", "Lazy Lake"),
    ("lighthouse-point", "Lighthouse Point"),
    ("margate", "Margate"),
    ("miramar", "Miramar"),
    ("north-lauderdale", "North Lauderdale"),
    ("oakland-park", "Oakland Park"),
    ("parkland", "Parkland"),
    ("pembroke-park", "Pembroke Park"),
    ("pembroke-pines", "Pembroke Pines"),
    ("plantation", "Plantation"),
    ("pompano-beach", "Pompano Beach"),
    ("sea-ranch-lakes", "Sea Ranch Lakes"),
    ("southwest-ranches", "Southwest Ranches"),
    ("sunrise", "Sunrise"),
    ("tamarac", "Tamarac"),
    ("west-park", "West Park"),
    ("weston", "Weston"),
    ("wilton-manors", "Wilton Manors"),
]

PBC_CITIES = [
    ("atlantis", "Atlantis"),
    ("belle-glade", "Belle Glade"),
    ("boca-raton", "Boca Raton"),
    ("boynton-beach", "Boynton Beach"),
    ("briny-breezes", "Briny Breezes"),
    ("cloud-lake", "Cloud Lake"),
    ("delray-beach", "Delray Beach"),
    ("glen-ridge", "Glen Ridge"),
    ("greenacres", "Greenacres"),
    ("gulf-stream", "Gulf Stream"),
    ("haverhill", "Haverhill"),
    ("highland-beach", "Highland Beach"),
    ("hypoluxo", "Hypoluxo"),
    ("juno-beach", "Juno Beach"),
    ("jupiter", "Jupiter"),
    ("jupiter-inlet-colony", "Jupiter Inlet Colony"),
    ("lake-clarke-shores", "Lake Clarke Shores"),
    ("lake-park", "Lake Park"),
    ("lake-worth-beach", "Lake Worth Beach"),
    ("lantana", "Lantana"),
    ("loxahatchee-groves", "Loxahatchee Groves"),
    ("manalapan", "Manalapan"),
    ("mangonia-park", "Mangonia Park"),
    ("ocean-ridge", "Ocean Ridge"),
    ("pahokee", "Pahokee"),
    ("palm-beach", "Palm Beach"),
    ("palm-beach-gardens", "Palm Beach Gardens"),
    ("palm-beach-shores", "Palm Beach Shores"),
    ("riviera-beach", "Riviera Beach"),
    ("south-bay", "South Bay"),
    ("tequesta", "Tequesta"),
    ("south-palm-beach", "Town of South Palm Beach"),
    ("village-of-golf", "Village of Golf"),
    ("north-palm-beach", "Village of North Palm Beach"),
    ("palm-springs", "Village of Palm Springs"),
    ("royal-palm-beach", "Village of Royal Palm Beach"),
    ("wellington", "Wellington"),
    ("west-palm-beach", "West Palm Beach"),
    ("westlake", "Westlake"),
]


def rows() -> list[dict]:
    out = [
        {
            "county_slug": "broward",
            "jurisdiction_slug": "bmsd",
            "jurisdiction_label": "Broward Municipal Services District / unincorporated",
            "kind": "unincorporated",
            "permitting_authority": "Broward County Building Code Division",
            "agency": "Broward County Building Code Division",
            "coverage_type": "unincorporated",
            "source": "Prompt 7 Stage A / county building pages",
            "expected_permit_authority": "County BCS",
            "data_availability": "pra_pending",
            "metadata_status": "seeded",
            "onestop_participation": True,
            "notes": "County-issued building permits for BMSD. Not municipal histories. METADATA ONLY — not activity.",
        },
        {
            "county_slug": "palm-beach",
            "jurisdiction_slug": "unincorporated",
            "jurisdiction_label": "Unincorporated Palm Beach County",
            "kind": "unincorporated",
            "permitting_authority": "PZB Building Division",
            "agency": "Palm Beach County PZB",
            "coverage_type": "unincorporated",
            "source": "PZB Open Permit Search published boundary",
            "expected_permit_authority": "PZB Building (PCN 00)",
            "data_availability": "pra_pending",
            "metadata_status": "seeded",
            "onestop_participation": None,
            "notes": "HARD unincorporated boundary. Do not label Palm Beach County permits. METADATA ONLY.",
        },
    ]
    for slug, label in BROWARD_CITIES:
        out.append(
            {
                "county_slug": "broward",
                "jurisdiction_slug": slug,
                "jurisdiction_label": label,
                "kind": "municipal",
                "permitting_authority": f"{label} Building Department",
                "agency": f"{label}",
                "coverage_type": "municipal",
                "source": "Prompt 7 municipality inventory",
                "expected_permit_authority": "Municipal AHJ",
                "data_availability": "none",
                "metadata_status": "seeded",
                "onestop_participation": None,
                "notes": "Municipal building permits are not county BCS history. OneStop may route associated county approvals. METADATA ONLY.",
            }
        )
    for slug, label in PBC_CITIES:
        note = "Municipal AHJ. Not Unincorporated PZB."
        if slug == "loxahatchee-groves":
            note = "BPS footnote: county unincorporated system may also cover this town — disclose if extract confirms. METADATA ONLY."
        if slug == "westlake":
            note = "Own permit system since 2017. METADATA ONLY."
        out.append(
            {
                "county_slug": "palm-beach",
                "jurisdiction_slug": slug,
                "jurisdiction_label": label,
                "kind": "municipal",
                "permitting_authority": f"{label} Building Department",
                "agency": label,
                "coverage_type": "municipal",
                "source": "PBC Property Appraiser municipality list",
                "expected_permit_authority": "Municipal AHJ",
                "data_availability": "none",
                "metadata_status": "seeded",
                "onestop_participation": None,
                "notes": note,
            }
        )
    return out


SQL = """
INSERT INTO enhanced_jurisdictions (
  county_slug, jurisdiction_slug, jurisdiction_label, kind, permitting_authority,
  agency, coverage_type, source, expected_permit_authority, data_availability,
  metadata_status, onestop_participation, notes
) VALUES (
  %(county_slug)s, %(jurisdiction_slug)s, %(jurisdiction_label)s, %(kind)s, %(permitting_authority)s,
  %(agency)s, %(coverage_type)s, %(source)s, %(expected_permit_authority)s, %(data_availability)s,
  %(metadata_status)s, %(onestop_participation)s, %(notes)s
)
ON CONFLICT (county_slug, jurisdiction_slug) DO UPDATE SET
  jurisdiction_label = EXCLUDED.jurisdiction_label,
  kind = EXCLUDED.kind,
  permitting_authority = EXCLUDED.permitting_authority,
  agency = EXCLUDED.agency,
  coverage_type = EXCLUDED.coverage_type,
  source = EXCLUDED.source,
  expected_permit_authority = EXCLUDED.expected_permit_authority,
  data_availability = EXCLUDED.data_availability,
  metadata_status = EXCLUDED.metadata_status,
  onestop_participation = EXCLUDED.onestop_participation,
  notes = EXCLUDED.notes,
  updated_at = now();
"""


def main() -> int:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL missing", file=sys.stderr)
        return 2
    from urllib.parse import quote, urlparse

    parsed = urlparse(url)
    if parsed.password:
        user = quote(parsed.username or "", safe="")
        pw = quote(parsed.password, safe="")
        host = parsed.hostname or ""
        port = f":{parsed.port}" if parsed.port else ""
        url = f"{parsed.scheme}://{user}:{pw}@{host}{port}{parsed.path}"
        if parsed.query:
            url += f"?{parsed.query}"
    import psycopg

    data = rows()
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            for r in data:
                cur.execute(SQL, r)
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT county_slug, count(*) FROM enhanced_jurisdictions GROUP BY 1 ORDER BY 1")
            print("seeded", cur.fetchall())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
