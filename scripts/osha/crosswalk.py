"""Census 2020 ZCTA-to-county relationship file."""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

from scripts.osha.normalize import county_key, zip5
from scripts.osha.states import FIPS_TO_STATE


class Crosswalk:
    def __init__(self) -> None:
        self.counties_by_zip: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        self.known_counties: dict[str, set[str]] = defaultdict(set)
        self.rows = 0

    def counties_for(self, state: str, zip_code: str) -> set[str]:
        return set(self.counties_by_zip.get(zip_code, {}).get(state, ()))


def parse_crosswalk(text: str) -> Crosswalk:
    crosswalk = Crosswalk()
    reader = csv.DictReader(text.splitlines(), delimiter="|")
    for row in reader:
        zcta = zip5(row.get("GEOID_ZCTA5_20") or "")
        geoid = (row.get("GEOID_COUNTY_20") or "").strip()
        state = FIPS_TO_STATE.get(geoid[:2])
        name = county_key(row.get("NAMELSAD_COUNTY_20") or "")
        if not zcta or not state or not name:
            continue
        crosswalk.counties_by_zip[zcta][state].add(name)
        crosswalk.known_counties[state].add(name)
        crosswalk.rows += 1
    return crosswalk


def load_crosswalk(path: Path) -> Crosswalk:
    return parse_crosswalk(path.read_text(encoding="utf-8-sig"))
