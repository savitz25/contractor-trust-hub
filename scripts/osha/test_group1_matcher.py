import csv
import tempfile
import unittest
from pathlib import Path

from group1_matcher import (
    STATES,
    build_matches,
    classify,
    county_key,
    is_person_name,
    load_zcta_counties,
    normalize_name,
    read_inspections,
    read_licenses,
    run,
)


HEADER = [
    "id", "contractor_id", "source_system", "state", "dba_name_raw",
    "licensee_name_raw", "postal_code", "county_name",
]
INSPECTION_HEADER = ["activity_nr", "estab_name", "site_state", "site_zip", "mail_zip", "open_date"]


def write_csv(path: Path, header: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=header, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


class Group1MatcherTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.crosswalk = self.root / "crosswalk.txt"
        self.crosswalk.write_text(
            "OID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|AREALAND_ZCTA5_20|AREAWATER_ZCTA5_20|MTFCC_ZCTA5_20|CLASSFP_ZCTA5_20|FUNCSTAT_ZCTA5_20|OID_COUNTY_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_COUNTY_20|AREAWATER_COUNTY_20|MTFCC_COUNTY_20|CLASSFP_COUNTY_20|FUNCSTAT_COUNTY_20|AREALAND_PART|AREAWATER_PART\n"
            "1|12345|ZCTA5 12345|0|0|G|B5|S|1|51001|Alpha County|0|0|G|H1|A|900|0\n"
            "2|12345|ZCTA5 12345|0|0|G|B5|S|2|51003|Beta County|0|0|G|H1|A|100|0\n"
            "4|12346|ZCTA5 12346|0|0|G|B5|S|4|51001|Alpha County|0|0|G|H1|A|850|0\n"
            "3|85001|ZCTA5 85001|0|0|G|B5|S|3|04013|Maricopa County|0|0|G|H1|A|900|0\n",
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def license(self, **overrides: str) -> dict[str, str]:
        row = {
            "id": "license-1", "contractor_id": "contractor-1", "source_system": "va_dpor",
            "state": "VA", "dba_name_raw": "Acme Builders LLC", "licensee_name_raw": "Acme Builders LLC",
            "postal_code": "12345-6789", "county_name": "Alpha",
        }
        merged = {**row, **overrides}
        selected = (merged["dba_name_raw"] or "").strip() or merged["licensee_name_raw"].strip()
        return {
            **merged,
            "selected_name": selected,
            "normalized_name": normalize_name(selected),
            "zip5": merged["postal_code"][:5],
            "county_key": county_key(merged["county_name"]),
            "person_name": is_person_name(merged["licensee_name_raw"], selected),
        }

    def inspection(self, **overrides: str) -> dict[str, str]:
        row = {
            "activity_nr": "1001", "estab_name": "ACME BUILDERS, INC.", "site_state": "VA",
            "site_zip": "12345", "mail_zip": "77777", "open_date": "2025-01-02",
            "normalized_name": "ACME BUILDERS", "site_zip5": "12345", "mail_zip5": "77777",
        }
        return {**row, **overrides}

    def test_state_parameterization_selects_only_configured_source_and_state(self) -> None:
        self.assertEqual(STATES["VA"]["source_system"], "va_dpor")
        self.assertEqual(STATES["AZ"]["source_system"], "az_roc")
        self.assertEqual(STATES["NV"]["source_system"], "nv_nscb")
        self.assertEqual(STATES["LA"]["source_system"], "la_lslbc")
        self.assertEqual(STATES["CA"]["source_system"], "ca_cslb")
        path = self.root / "licenses.csv"
        write_csv(path, HEADER, [
            self.license(),
            self.license(id="wrong-state", state="AZ", source_system="az_roc"),
            self.license(id="wrong-source", source_system="fl_dbpr"),
        ])
        rows, stats = read_licenses(path, "VA")
        self.assertEqual([row["license_id"] for row in rows], ["license-1"])
        self.assertEqual(stats["excluded_wrong_state"], 1)
        self.assertEqual(stats["excluded_wrong_source"], 1)

    def test_name_selection_falls_back_when_dba_normalizes_empty(self) -> None:
        path = self.root / "licenses.csv"
        write_csv(path, HEADER, [self.license(dba_name_raw="CORPORATION", licensee_name_raw="Fallback Builders LLC")])
        rows, _ = read_licenses(path, "VA")
        self.assertEqual(rows[0]["selected_name"], "Fallback Builders LLC")
        self.assertEqual(rows[0]["normalized_name"], "FALLBACK BUILDERS")

    def test_exact_requires_normalized_name_and_license_zip_equal_to_site_or_mail_zip(self) -> None:
        license = self.license()
        zips, county_names = load_zcta_counties(self.crosswalk, "VA")
        license["county_geoid"] = county_names["ALPHA"]
        self.assertEqual(classify(license, self.inspection(), zips), "exact")
        self.assertEqual(classify(license, self.inspection(site_zip5="99999", mail_zip5="12345"), zips), "exact")
        self.assertEqual(classify(license, self.inspection(normalized_name="ACME BUILDER"), zips), "none")

    def test_strong_uses_zcta_county_relationship_and_dominant_land_area(self) -> None:
        zips, county_names = load_zcta_counties(self.crosswalk, "VA")
        self.assertEqual(zips["12345"], county_names["ALPHA"])
        license = self.license(postal_code="99999", county_name="Alpha")
        license["zip5"] = "99999"
        license["county_geoid"] = county_names["ALPHA"]
        self.assertEqual(classify(license, self.inspection(), zips), "strong")

    def test_blank_license_county_uses_existing_license_zip_crosswalk(self) -> None:
        licenses_path = self.root / "licenses.csv"
        inspections_path = self.root / "inspections.csv"
        write_csv(licenses_path, HEADER, [self.license(county_name="")])
        inspection = self.inspection(activity_nr="1003", site_zip="12346", site_zip5="12346", mail_zip5="99999")
        write_csv(inspections_path, INSPECTION_HEADER, [{key: inspection[key] for key in INSPECTION_HEADER}])
        result = run("VA", licenses_path, inspections_path, self.crosswalk, self.root / "county-fallback")
        self.assertEqual((result["exact"], result["strong"], result["weak"]), (0, 1, 0))

    def test_person_name_licensee_is_capped_at_weak(self) -> None:
        license = self.license(dba_name_raw="", licensee_name_raw="Smith, John")
        license["selected_name"] = "Smith, John"
        license["normalized_name"] = normalize_name("Smith, John")
        license["person_name"] = is_person_name("Smith, John", "Smith, John")
        inspection = self.inspection(estab_name="Smith, John", normalized_name=normalize_name("Smith, John"))
        zips, county_names = load_zcta_counties(self.crosswalk, "VA")
        license["county_geoid"] = county_names["ALPHA"]
        self.assertEqual(classify(license, inspection, zips), "weak")

    def test_missing_license_zip_cannot_become_exact_and_osha_only_rows_do_not_create_candidates(self) -> None:
        license = self.license(postal_code="")
        license["zip5"] = ""
        zips, county_names = load_zcta_counties(self.crosswalk, "VA")
        license["county_geoid"] = county_names["ALPHA"]
        self.assertEqual(classify(license, self.inspection(), zips), "strong")
        self.assertEqual(build_matches([], [self.inspection()], zips), [])

    def test_cross_state_inspection_rows_are_excluded(self) -> None:
        path = self.root / "inspections.csv"
        write_csv(path, INSPECTION_HEADER, [
            {key: self.inspection()[key] for key in INSPECTION_HEADER},
            {**{key: self.inspection()[key] for key in INSPECTION_HEADER}, "activity_nr": "1002", "site_state": "MD"},
        ])
        rows, stats = read_inspections(path, "VA")
        self.assertEqual([row["activity_nr"] for row in rows], ["1001"])
        self.assertEqual(stats["excluded_wrong_site_state"], 1)

    def test_output_is_deterministic_and_package_hashes_repeat(self) -> None:
        licenses_path = self.root / "licenses.csv"
        inspections_path = self.root / "inspections.csv"
        write_csv(licenses_path, HEADER, [self.license()])
        write_csv(inspections_path, INSPECTION_HEADER, [{key: self.inspection()[key] for key in INSPECTION_HEADER}])
        first = run("VA", licenses_path, inspections_path, self.crosswalk, self.root / "one")
        second = run("VA", licenses_path, inspections_path, self.crosswalk, self.root / "two")
        self.assertEqual(first["package_sha256"], second["package_sha256"])
        self.assertEqual((first["exact"], first["strong"], first["weak"]), (1, 0, 0))
        self.assertEqual(first["inspections_exact_strong"], 1)


if __name__ == "__main__":
    unittest.main()
