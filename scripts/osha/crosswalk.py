"""Census 2020 ZCTA-to-county relationship file.

Each state and ZCTA selects one county. Parts are summed by county GEOID.
The greatest AREALAND_PART wins. An equal area uses the lexicographically
greatest county GEOID. The selected value is that county's county_key.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

from scripts.osha.normalize import county_key, zip5
from scripts.osha.states import FIPS_TO_STATE

MULTICOUNTY_SELECTION = "MAX_AREALAND_PART"
TIE_BREAKER = "LEXICOGRAPHICALLY_GREATEST_COUNTY_GEOID"


class Crosswalk:
    def __init__(self) -> None:
        self.county_by_zip: dict[str, dict[str, str]] = defaultdict(dict)
        self.known_counties: dict[str, set[str]] = defaultdict(set)
        self.rows = 0

    def counties_for(self, state: str, zip_code: str) -> set[str]:
        selected = self.county_by_zip.get(zip_code, {}).get(state, "")
        if not selected:
            return set()
        return {selected}


def _area(value: str) -> int | None:
    text = (value or "").strip()
    if not text.isdigit():
        return None
    return int(text)


def parse_crosswalk(text: str) -> Crosswalk:
    crosswalk = Crosswalk()
    reader = csv.DictReader(text.splitlines(), delimiter="|")
    totals: dict[tuple[str, str, str], int] = defaultdict(int)
    names: dict[tuple[str, str, str], str] = {}
    for row in reader:
        zcta = zip5(row.get("GEOID_ZCTA5_20") or "")
        geoid = (row.get("GEOID_COUNTY_20") or "").strip()
        state = FIPS_TO_STATE.get(geoid[:2])
        name = county_key(row.get("NAMELSAD_COUNTY_20") or "")
        area = _area(row.get("AREALAND_PART") or "")
        if not zcta or len(geoid) < 5 or not state or not name or area is None:
            continue
        key = (zcta, state, geoid)
        totals[key] += area
        names[key] = name
        crosswalk.known_counties[state].add(name)
        crosswalk.rows += 1
    winners: dict[tuple[str, str], tuple[int, str, str]] = {}
    for (zcta, state, geoid), area in totals.items():
        candidate = (area, geoid, names[(zcta, state, geoid)])
        current = winners.get((zcta, state))
        if current is None or (candidate[0], candidate[1]) > (current[0], current[1]):
            winners[(zcta, state)] = candidate
    for (zcta, state), (_area_total, _geoid, name) in winners.items():
        crosswalk.county_by_zip[zcta][state] = name
    return crosswalk


def load_crosswalk(path: Path) -> Crosswalk:
    return parse_crosswalk(path.read_text(encoding="utf-8-sig"))
