"""Offline, state-scoped OSHA-to-existing-license matcher for CON-OSHA-002 G1.

This tool never creates contractor rows. It reads an exported licenses.csv and
an OSHA inspection CSV, and writes private candidate files only to the caller's
chosen output directory.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable


STATES = {
    "VA": {"source_system": "va_dpor", "fips": "51"},
    "AZ": {"source_system": "az_roc", "fips": "04"},
    "NV": {"source_system": "nv_nscb", "fips": "32"},
    "LA": {"source_system": "la_lslbc", "fips": "22"},
    "CA": {"source_system": "ca_cslb", "fips": "06"},
}

ENTITY_WORDS = re.compile(
    r"\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LLP|PA|PLLC|PC|LP|DBA)\b",
    re.I,
)
COUNTY_SUFFIX = re.compile(r"\b(COUNTY|PARISH|INDEPENDENT CITY|CITY AND BOROUGH|BOROUGH|CITY)\b", re.I)
ZIP_RE = re.compile(r"(?<!\d)(\d{5})(?:-\d{4})?(?!\d)")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize_name(value: str | None) -> str:
    value = (value or "").upper().replace("&", " AND ")
    value = re.sub(r"[^A-Z0-9 ]", " ", value)
    value = ENTITY_WORDS.sub(" ", value)
    return " ".join(value.split())


def zip5(value: str | None) -> str:
    match = ZIP_RE.search(value or "")
    return match.group(1) if match else ""


def county_key(value: str | None) -> str:
    value = (value or "").upper().replace("&", " AND ")
    value = COUNTY_SUFFIX.sub(" ", value)
    return " ".join(re.sub(r"[^A-Z0-9 ]", " ", value).split())


def is_person_name(licensee_name: str, selected_name: str) -> bool:
    # Preserve the established conservative rule for LAST, FIRST licensees.
    candidate = selected_name.strip()
    return bool("," in candidate and not ENTITY_WORDS.search(licensee_name or candidate))


def load_zcta_counties(path: Path, state: str) -> tuple[dict[str, str], dict[str, str]]:
    """Map each in-state ZCTA to its greatest-land-area county deterministically."""
    fips = STATES[state]["fips"]
    totals: dict[tuple[str, str], int] = defaultdict(int)
    county_name_by_geoid: dict[str, str] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream, delimiter="|")
        required = {"GEOID_ZCTA5_20", "GEOID_COUNTY_20", "NAMELSAD_COUNTY_20", "AREALAND_PART"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"crosswalk missing columns: {sorted(required - set(reader.fieldnames or []))}")
        for row in reader:
            zcta = (row.get("GEOID_ZCTA5_20") or "").strip()
            county_geoid = (row.get("GEOID_COUNTY_20") or "").strip()
            county_name = (row.get("NAMELSAD_COUNTY_20") or "").strip()
            if not zcta or not county_geoid.startswith(fips) or not county_geoid.isdigit():
                continue
            if county_name:
                county_name_by_geoid[county_geoid] = county_name
            try:
                area = int(row.get("AREALAND_PART") or 0)
            except ValueError:
                area = 0
            totals[(zcta, county_geoid)] += area
    by_zip: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for (zcta, county_geoid), area in totals.items():
        by_zip[zcta].append((area, county_geoid))
    # Largest land-area share; GEOID is a stable tie break.
    zip_to_county = {
        zcta: max(choices, key=lambda item: (item[0], item[1]))[1]
        for zcta, choices in by_zip.items()
    }
    return zip_to_county, {county_key(name): geoid for geoid, name in county_name_by_geoid.items()}


def read_licenses(path: Path, state: str) -> tuple[list[dict[str, str]], Counter[str]]:
    expected_source = STATES[state]["source_system"]
    stats: Counter[str] = Counter()
    licenses: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        required = {"id", "contractor_id", "source_system", "state", "dba_name_raw", "licensee_name_raw", "postal_code", "county_name"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"licenses input missing columns: {sorted(required - set(reader.fieldnames or []))}")
        for source in reader:
            if (source.get("state") or "").strip().upper() != state:
                stats["excluded_wrong_state"] += 1
                continue
            if (source.get("source_system") or "").strip() != expected_source:
                stats["excluded_wrong_source"] += 1
                continue
            stats["source_rows"] += 1
            dba = (source.get("dba_name_raw") or "").strip()
            selected = dba
            normalized = normalize_name(selected)
            if not normalized:
                selected = (source.get("licensee_name_raw") or "").strip()
                normalized = normalize_name(selected)
                if dba:
                    stats["fallback_unusable_dba"] += 1
            if not normalized:
                stats["excluded_missing_name"] += 1
                continue
            licenses.append({
                "license_id": (source.get("id") or "").strip(),
                "contractor_id": (source.get("contractor_id") or "").strip(),
                "source_system": expected_source,
                "state": state,
                "selected_name": selected,
                "licensee_name_raw": (source.get("licensee_name_raw") or "").strip(),
                "normalized_name": normalized,
                "postal_code": (source.get("postal_code") or "").strip(),
                "zip5": zip5(source.get("postal_code")),
                "county_name": (source.get("county_name") or "").strip(),
                "county_key": county_key(source.get("county_name")),
                "person_name": is_person_name(source.get("licensee_name_raw") or "", selected),
            })
    if not licenses:
        raise ValueError(f"no usable {state}/{expected_source} licenses in input")
    return licenses, stats


def read_inspections(path: Path, state: str) -> tuple[list[dict[str, str]], Counter[str]]:
    stats: Counter[str] = Counter()
    rows: list[dict[str, str]] = []
    opener = gzip.open if path.suffix.lower() == ".gz" else open
    with opener(path, "rt", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        required = {"activity_nr", "estab_name", "site_state", "site_zip", "mail_zip", "open_date"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"inspections input missing columns: {sorted(required - set(reader.fieldnames or []))}")
        for row in reader:
            if (row.get("site_state") or "").strip().upper() != state:
                stats["excluded_wrong_site_state"] += 1
                continue
            name = normalize_name(row.get("estab_name"))
            if not name:
                stats["excluded_missing_name"] += 1
                continue
            row = dict(row)
            row["normalized_name"] = name
            row["site_zip5"] = zip5(row.get("site_zip"))
            row["mail_zip5"] = zip5(row.get("mail_zip"))
            rows.append(row)
    return rows, stats


def classify(license: dict[str, str | bool], inspection: dict[str, str], zcta_counties: dict[str, str]) -> str:
    if license["normalized_name"] != inspection["normalized_name"]:
        return "none"
    license_zip = license["zip5"]
    osha_zips = {inspection["site_zip5"], inspection["mail_zip5"]} - {""}
    tier = "weak"
    # A missing license ZIP cannot be exact, even if an OSHA ZIP happens to exist.
    if license_zip and license_zip in osha_zips:
        tier = "exact"
    else:
        county_geoid = license.get("county_geoid", "")
        if county_geoid and any(zcta_counties.get(zip_value) == county_geoid for zip_value in osha_zips):
            tier = "strong"
    if license["person_name"]:
        return "weak"
    return tier


def build_matches(licenses: list[dict[str, str]], inspections: list[dict[str, str]], zcta_counties: dict[str, str]) -> list[dict[str, str]]:
    # Join by exact normalized string only. No edit distance or fuzzy publication match.
    by_name: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in inspections:
        by_name[row["normalized_name"]].append(row)
    matches: list[dict[str, str]] = []
    for license in licenses:
        candidates: dict[str, str] = {}
        details: dict[str, dict[str, str]] = {}
        for inspection in by_name.get(license["normalized_name"], []):
            tier = classify(license, inspection, zcta_counties)
            if tier != "none":
                activity = inspection["activity_nr"]
                rank = {"weak": 1, "strong": 2, "exact": 3}
                if activity not in candidates or rank[tier] > rank[candidates[activity]]:
                    candidates[activity] = tier
                    details[activity] = inspection
        if not candidates:
            continue
        best_rank = max({"weak": 1, "strong": 2, "exact": 3}[tier] for tier in candidates.values())
        best_tier = {1: "weak", 2: "strong", 3: "exact"}[best_rank]
        for inspection_id, tier in sorted(candidates.items()):
            inspection = details[inspection_id]
            # Preserve the strongest association per inspection for each license.
            matches.append({
                "state": license["state"],
                "source_system": license["source_system"],
                "license_id": license["license_id"],
                "contractor_id": license["contractor_id"],
                "business_name": license["selected_name"],
                "license_zip": license["zip5"],
                "county_name": license["county_name"],
                "activity_nr": inspection_id,
                "estab_name": inspection["estab_name"],
                "site_state": inspection["site_state"],
                "site_zip": inspection["site_zip"],
                "mail_zip": inspection["mail_zip"],
                "open_date": inspection["open_date"],
                "match_tier": tier,
                "license_best_tier": best_tier,
            })
    return sorted(matches, key=lambda row: (row["state"], row["license_id"], row["activity_nr"], row["match_tier"]))


def package_state(state: str, matches: list[dict[str, str]], output_dir: Path, receipt: dict[str, object]) -> str:
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_buffer = io.StringIO(newline="")
    fields = list(matches[0]) if matches else ["state", "source_system", "license_id", "contractor_id", "business_name", "license_zip", "county_name", "activity_nr", "estab_name", "site_state", "site_zip", "mail_zip", "open_date", "match_tier", "license_best_tier"]
    writer = csv.DictWriter(csv_buffer, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(matches)
    csv_bytes = csv_buffer.getvalue().encode("utf-8")
    data_path = output_dir / f"{state.lower()}_matches.csv.gz"
    with data_path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as zipped:
            zipped.write(csv_bytes)
    spot_paths: list[Path] = []
    spot_manifest: dict[str, dict[str, object]] = {}
    for tier in ("exact", "strong", "weak"):
        seen: set[str] = set()
        selected = []
        for row in matches:
            license_id = row["license_id"]
            if row["license_best_tier"] == tier and license_id not in seen:
                selected.append(row)
                seen.add(license_id)
                if len(selected) == 25:
                    break
        spot_path = output_dir / f"{state.lower()}_spot_{tier}.csv.gz"
        spot_buf = io.StringIO(newline="")
        spot_writer = csv.DictWriter(spot_buf, fieldnames=fields, lineterminator="\n")
        spot_writer.writeheader()
        spot_writer.writerows(selected)
        with spot_path.open("wb") as raw:
            with gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as zipped:
                zipped.write(spot_buf.getvalue().encode("utf-8"))
        spot_paths.append(spot_path)
        spot_manifest[tier] = {"path": spot_path.name, "rows": len(selected), "sha256": sha256_file(spot_path)}
    receipt = dict(receipt)
    receipt["state"] = state
    best_by_license = {row["license_id"]: row["license_best_tier"] for row in matches}
    receipt["counts"] = dict(Counter(best_by_license.values()))
    receipt["distinct_inspections"] = len({row["activity_nr"] for row in matches if row["match_tier"] in {"exact", "strong"}})
    receipt["match_csv_sha256"] = sha256_file(data_path)
    receipt["spot_reviews"] = spot_manifest
    receipt_path = output_dir / f"{state.lower()}_receipt.json"
    receipt_path.write_text(json.dumps(receipt, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    package_path = output_dir / f"{state.lower()}_package.zip"
    with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for path in (data_path, *spot_paths, receipt_path):
            info = zipfile.ZipInfo(path.name, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            package.writestr(info, path.read_bytes())
    return sha256_file(package_path)


def run(state: str, licenses_path: Path, inspections_path: Path, crosswalk_path: Path, output_dir: Path) -> dict[str, object]:
    state = state.upper()
    if state not in STATES:
        raise ValueError(f"unsupported state: {state}")
    county_map, county_name_to_geoid = load_zcta_counties(crosswalk_path, state)
    licenses, license_stats = read_licenses(licenses_path, state)
    for license in licenses:
        key = county_key(license["county_name"])
        # Some state source feeds do not populate county_name. Their existing
        # license ZIP can still resolve to the same county geography through
        # the supplied Census ZCTA crosswalk.
        license["county_geoid"] = county_name_to_geoid.get(key, "") or county_map.get(license["zip5"], "")
    inspections, inspection_stats = read_inspections(inspections_path, state)
    matches = build_matches(licenses, inspections, county_map)
    input_receipt = {
        "source_system": STATES[state]["source_system"],
        "licenses_input_sha256": sha256_file(licenses_path),
        "inspections_input_sha256": sha256_file(inspections_path),
        "crosswalk_sha256": sha256_file(crosswalk_path),
        "crosswalk_method": "2020 ZCTA-to-county relationship; largest AREALAND_PART per in-state ZCTA, county GEOID tie-break",
        "license_input_rows": dict(license_stats),
        "inspection_input_rows": dict(inspection_stats),
        "filtered_license_rows": len(licenses),
        "filtered_inspection_rows": len(inspections),
    }
    package_sha = package_state(state, matches, output_dir, input_receipt)
    counts = Counter({row["license_id"]: row["license_best_tier"] for row in matches}.values())
    return {
        "state": state,
        "exact": counts["exact"],
        "strong": counts["strong"],
        "weak": counts["weak"],
        "inspections_exact_strong": len({row["activity_nr"] for row in matches if row["match_tier"] in {"exact", "strong"}}),
        "package_sha256": package_sha,
        "output_dir": str(output_dir.resolve()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", required=True, choices=sorted(STATES))
    parser.add_argument("--licenses", required=True, type=Path, help="read-only export of existing licenses fields")
    parser.add_argument("--inspections", required=True, type=Path, help="public OSHA inspection CSV")
    parser.add_argument("--crosswalk", required=True, type=Path, help="Census 2020 ZCTA-to-county relationship text")
    parser.add_argument("--output-dir", required=True, type=Path, help="private output directory outside Git")
    args = parser.parse_args()
    print(json.dumps(run(args.state, args.licenses, args.inspections, args.crosswalk, args.output_dir), sort_keys=True))


if __name__ == "__main__":
    main()
