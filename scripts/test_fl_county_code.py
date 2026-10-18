"""FL-COUNTY-CODE: ingest mapping, special codes, and Python/TS parity."""

from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from ingest.adapters.fl_dbpr import (
    FL_COUNTY_CODES,
    county_name_for_code,
    normalize_county_code,
    run_licensees,
)

ROOT = Path(__file__).resolve().parents[1]
TABLE_PATH = ROOT / "lib" / "intelligence" / "florida-dbpr-county-codes.json"
TS_PATH = ROOT / "lib" / "intelligence" / "florida-county-codes.ts"

HEADER = [
    "board_number",
    "occupation_code",
    "licensee_name",
    "dba_name",
    "class_code",
    "address_line_1",
    "address_line_2",
    "address_line_3",
    "city",
    "state",
    "zip",
    "county_code",
    "license_number",
    "primary_status",
    "secondary_status",
    "original_licensure_date",
    "effective_date",
    "expiration_date",
    "blank",
    "renewal_period",
    "alternate_license_number",
]


def synthetic_row(code: str, license_number: str) -> dict[str, str]:
    row = {column: "" for column in HEADER}
    row.update(
        {
            "board_number": "06",
            "occupation_code": "CGC",
            "licensee_name": "EXAMPLE COUNTY FIX LLC",
            "class_code": "CGC",
            "address_line_1": "1 EXAMPLE ST",
            "city": "EXAMPLE CITY",
            "state": "FL",
            "zip": "00000",
            "county_code": code,
            "license_number": license_number,
            "primary_status": "C",
            "secondary_status": "A",
        }
    )
    return row


class CountyMapTest(unittest.TestCase):
    def test_representative_codes(self) -> None:
        self.assertEqual(county_name_for_code("74"), "Volusia")
        self.assertEqual(county_name_for_code("15"), "Brevard")
        self.assertEqual(county_name_for_code("63"), "Polk")
        self.assertEqual(county_name_for_code("69"), "Seminole")
        self.assertEqual(county_name_for_code("23"), "Miami-Dade")
        self.assertEqual(county_name_for_code("074"), "Volusia")
        self.assertEqual(normalize_county_code("074"), "74")

    def test_all_standard_counties(self) -> None:
        table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
        self.assertEqual(len(table["counties"]), 67)
        self.assertEqual(FL_COUNTY_CODES, table["counties"])
        self.assertEqual(set(FL_COUNTY_CODES), {str(n) for n in range(11, 78)})
        for code, name in table["counties"].items():
            self.assertEqual(county_name_for_code(code), name)
            self.assertTrue(name)
            self.assertFalse(name.isdigit())

    def test_special_codes_do_not_invent_a_county(self) -> None:
        for code in ("78", "79", "80", "99", "701", "705", "710", "721", "744", "752", "801", "899", "123", ""):
            self.assertEqual(county_name_for_code(code), "")

    def test_python_and_typescript_use_the_same_table(self) -> None:
        source = TS_PATH.read_text(encoding="utf-8")
        self.assertIn("florida-dbpr-county-codes.json", source)
        self.assertNotIn('"74": "Volusia"', source)
        table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
        self.assertEqual(FL_COUNTY_CODES, {str(k): str(v) for k, v in table["counties"].items()})
        self.assertEqual(table["special"]["99"]["kind"], "unknown")
        self.assertEqual(table["ranges"][0]["min"], 701)
        self.assertEqual(table["ranges"][0]["kind"], "out_of_state")

    def test_run_licensees_never_writes_a_bare_code(self) -> None:
        rows = [synthetic_row(code, f"9999{code}") for code in FL_COUNTY_CODES]
        rows.extend(
            synthetic_row(code, f"8888{code}")
            for code in ("99", "752", "801", "123", "074")
        )
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source = folder / "example-extract.csv"
            with source.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=HEADER)
                writer.writeheader()
                writer.writerows(rows)
            out = folder / "out"
            run_licensees(source, out, has_header=True)
            with (out / "contractors_seed.csv").open(encoding="utf-8", newline="") as handle:
                contractors = list(csv.DictReader(handle))
            with (out / "licenses_normalized.csv").open(encoding="utf-8", newline="") as handle:
                licenses = list(csv.DictReader(handle))
        self.assertEqual(len(contractors), len(rows))
        for contractor in contractors:
            self.assertFalse(contractor["primary_county"].isdigit(), contractor["primary_county"])
        by_code = {row["county_code"]: row for row in licenses}
        self.assertEqual(by_code["74"]["county_name"], "Volusia")
        self.assertEqual(by_code["15"]["county_name"], "Brevard")
        self.assertEqual(by_code["63"]["county_name"], "Polk")
        self.assertEqual(by_code["69"]["county_name"], "Seminole")
        self.assertEqual(by_code["074"]["county_code"], "074")
        self.assertEqual(by_code["074"]["county_name"], "Volusia")
        for code in ("99", "752", "801", "123"):
            self.assertEqual(by_code[code]["county_code"], code)
            self.assertEqual(by_code[code]["county_name"], "")
        padded = next(row for row in contractors if row["license_external_key"].endswith("074"))
        self.assertEqual(padded["primary_county"], "Volusia")
        unknown = next(row for row in contractors if row["license_external_key"].endswith("123"))
        self.assertEqual(unknown["primary_county"], "")


if __name__ == "__main__":
    unittest.main()
