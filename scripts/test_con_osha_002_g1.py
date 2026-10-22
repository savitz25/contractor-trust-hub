import unittest
from pathlib import Path

from scripts.osha.crosswalk import MULTICOUNTY_SELECTION, TIE_BREAKER, parse_crosswalk
from scripts.osha.match import (
    BEST_TIER_ONLY,
    FUZZY_MATCHING,
    LICENSE_ZIP_CAN_INFER_COUNTY,
    distinct_public_activities,
    match_state,
)
from scripts.osha.normalize import CA_NAME_SOURCE, ORIGINAL_SUFFIX, SUFFIX_RE, normalize_name
from scripts.osha.package import package_bytes, sha256_bytes
from scripts.osha.states import STATES, STATE_ORDER

CROSSWALK = """\
OID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|AREALAND_ZCTA5_20|AREAWATER_ZCTA5_20|MTFCC_ZCTA5_20|CLASSFP_ZCTA5_20|FUNCSTAT_ZCTA5_20|OID_COUNTY_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_COUNTY_20|AREAWATER_COUNTY_20|MTFCC_COUNTY_20|CLASSFP_COUNTY_20|FUNCSTAT_COUNTY_20|AREALAND_PART|AREAWATER_PART
1|23220|ZCTA5 23220|1|0|G6350|B5|S|1|51760|Richmond city|1|0|G4020|C7|A|1|0
2|23223|ZCTA5 23223|1|0|G6350|B5|S|2|51760|Richmond city|1|0|G4020|C7|A|1|0
3|22030|ZCTA5 22030|1|0|G6350|B5|S|3|51059|Fairfax County|1|0|G4020|H1|A|1|0
4|90001|ZCTA5 90001|1|0|G6350|B5|S|4|06037|Los Angeles County|1|0|G4020|H1|A|1|0
5|90002|ZCTA5 90002|1|0|G6350|B5|S|5|06037|Los Angeles County|1|0|G4020|H1|A|1|0
6|70801|ZCTA5 70801|1|0|G6350|B5|S|6|22033|East Baton Rouge Parish|1|0|G4020|H1|A|1|0
7|70802|ZCTA5 70802|1|0|G6350|B5|S|7|22033|East Baton Rouge Parish|1|0|G4020|H1|A|1|0
"""


def _license(**overrides):
    row = {
        "source_system": "va_dpor",
        "external_key": "VA-1",
        "licensee_name_raw": "Acme Builders LLC",
        "dba_name_raw": "",
        "postal_code": "23220",
        "county_name": "",
        "state": "VA",
    }
    row.update(overrides)
    return row


def _inspection(**overrides):
    row = {
        "activity_nr": "100",
        "estab_name": "Acme Builders LLC",
        "site_zip": "23220",
        "mail_zip": "00000",
        "site_state": "VA",
        "open_date": "2020-01-15",
    }
    row.update(overrides)
    return row


def _violation(**overrides):
    row = {
        "activity_nr": "100",
        "delete_flag": "",
        "viol_type": "S",
        "current_penalty": "100.4",
        "initial_penalty": "50",
        "contest_date": "",
        "final_order_date": "",
    }
    row.update(overrides)
    return row


class Group1MatcherTests(unittest.TestCase):
    def setUp(self):
        self.crosswalk = parse_crosswalk(CROSSWALK)

    def _match(self, state, licenses, inspections, violations=None):
        return match_state(state, licenses, inspections, violations or [], self.crosswalk)

    def test_parameterization_uses_the_board_source_only(self):
        self.assertEqual(
            [STATES[code]["source_system"] for code in STATE_ORDER],
            ["va_dpor", "az_roc", "nv_nscb", "la_lslbc", "ca_cslb", "tn_blc"],
        )
        result = self._match(
            "VA",
            [
                _license(external_key="VA-KEEP"),
                _license(source_system="ca_cslb", external_key="CA-SKIP", state="CA", postal_code="90001"),
            ],
            [_inspection()],
        )
        self.assertEqual([row["license_key"] for row in result["matches"]], ["VA-KEEP"])
        self.assertEqual(result["matches"][0]["source_system"], "va_dpor")

    def test_exact_zip_uses_site_or_mail_zip(self):
        site = self._match("VA", [_license(external_key="SITE")], [_inspection(site_zip="23220", mail_zip="99999")])
        mail = self._match(
            "VA",
            [_license(external_key="MAIL", postal_code="22030")],
            [_inspection(activity_nr="101", site_zip="11111", mail_zip="22030-1234")],
        )
        self.assertEqual(site["matches"][0]["match_tier"], "exact")
        self.assertEqual(mail["matches"][0]["match_tier"], "exact")

    def test_county_strong_rule_and_recorded_county(self):
        blank = self._match(
            "VA",
            [_license(postal_code="23220", county_name="")],
            [_inspection(site_zip="23223", mail_zip="11111")],
        )
        self.assertEqual(blank["matches"][0]["match_tier"], "weak")
        city = self._match(
            "VA",
            [_license(postal_code="22030", county_name="Richmond city")],
            [_inspection(site_zip="23223", mail_zip="11111")],
        )
        self.assertEqual(city["matches"][0]["match_tier"], "strong")
        recorded = self._match(
            "CA",
            [
                _license(
                    source_system="ca_cslb",
                    external_key="CA-1",
                    state="CA",
                    postal_code="10001",
                    county_name="Los Angeles",
                )
            ],
            [_inspection(activity_nr="200", site_state="CA", site_zip="90002", mail_zip="11111", estab_name="Acme Builders LLC")],
        )
        self.assertEqual(recorded["matches"][0]["match_tier"], "strong")
        blocked = self._match(
            "LA",
            [
                _license(
                    source_system="la_lslbc",
                    external_key="LA-1",
                    state="LA",
                    postal_code="70801",
                    county_name="Out-of-State",
                )
            ],
            [_inspection(activity_nr="300", site_state="LA", site_zip="70802", mail_zip="11111")],
        )
        self.assertEqual(blocked["matches"][0]["match_tier"], "weak")

    def test_person_name_caps_exact_zip_at_weak(self):
        person = self._match("VA", [_license(licensee_name_raw="Smith, John", dba_name_raw="")], [_inspection(estab_name="Smith, John")])
        company = self._match(
            "VA",
            [_license(licensee_name_raw="Smith, John LLC")],
            [_inspection(estab_name="Smith John LLC")],
        )
        self.assertEqual(person["matches"][0]["match_tier"], "weak")
        self.assertEqual(person["matches"][0]["person_name_licensee"], "yes")
        self.assertEqual(company["matches"][0]["match_tier"], "exact")

    def test_missing_license_creates_no_row(self):
        result = self._match("VA", [], [_inspection(activity_nr="404", estab_name="Nobody Roofing LLC")])
        self.assertEqual(result["matches"], [])
        keys = {"VA-1"}
        produced = self._match("VA", [_license()], [_inspection(), _inspection(activity_nr="405", estab_name="Other Roofing LLC")])
        self.assertTrue(set(row["license_key"] for row in produced["matches"]).issubset(keys))

    def test_cross_state_osha_row_is_ignored(self):
        result = self._match(
            "VA",
            [_license()],
            [_inspection(site_state="CA", site_zip="23220", estab_name="Acme Builders LLC")],
        )
        self.assertEqual(result["matches"], [])
        self.assertEqual(result["inspections_in_state"], 0)

    def test_fuzzy_matching_is_off(self):
        self.assertIs(FUZZY_MATCHING, False)
        self.assertIs(LICENSE_ZIP_CAN_INFER_COUNTY, False)
        self.assertIs(BEST_TIER_ONLY, True)
        source = Path(match_state.__code__.co_filename).read_text(encoding="utf-8")
        self.assertNotIn("SequenceMatcher", source)
        self.assertNotIn("0.92", source)
        result = self._match(
            "VA",
            [_license(licensee_name_raw="Acme Builders LLC")],
            [_inspection(estab_name="Acme Builder LLC", site_zip="23220")],
        )
        self.assertEqual(result["matches"], [])

    def test_same_name_without_zip_or_county_is_weak(self):
        result = self._match(
            "VA",
            [_license(postal_code="30301", county_name="")],
            [_inspection(site_zip="99999", mail_zip="88888")],
        )
        self.assertEqual(result["matches"][0]["match_tier"], "weak")
        self.assertEqual(result["matches"][0]["norm_name"], "ACME BUILDERS")

    def test_license_zip_does_not_infer_county(self):
        result = self._match(
            "VA",
            [_license(postal_code="23220", county_name="")],
            [_inspection(site_zip="23223", mail_zip="11111")],
        )
        self.assertEqual(result["matches"][0]["match_tier"], "weak")

    def test_blank_or_unrecognized_county_cannot_become_strong(self):
        blank = self._match(
            "VA",
            [_license(postal_code="10001", county_name="   ")],
            [_inspection(site_zip="23223", mail_zip="11111")],
        )
        unknown = self._match(
            "VA",
            [_license(postal_code="23220", county_name="Not A County")],
            [_inspection(site_zip="23223", mail_zip="11111")],
        )
        self.assertEqual(blank["matches"][0]["match_tier"], "weak")
        self.assertEqual(unknown["matches"][0]["match_tier"], "weak")

    def test_census_osha_zip_matches_stored_license_county(self):
        result = self._match(
            "VA",
            [_license(postal_code="10001", county_name="Richmond city")],
            [_inspection(site_zip="11111", mail_zip="23223")],
        )
        self.assertEqual(result["matches"][0]["match_tier"], "strong")
        self.assertEqual(result["matches"][0]["n_inspections"], 1)

    def test_exact_beats_strong_and_drops_the_lower_tier(self):
        result = self._match(
            "VA",
            [_license(postal_code="23220", county_name="Richmond city")],
            [
                _inspection(activity_nr="100", site_zip="23220", mail_zip="11111"),
                _inspection(activity_nr="200", site_zip="23223", mail_zip="11111"),
            ],
        )
        self.assertEqual(len(result["matches"]), 1)
        row = result["matches"][0]
        self.assertEqual(row["match_tier"], "exact")
        self.assertEqual(row["n_inspections"], 1)
        self.assertEqual(row["osha_activity_nrs"], "100")
        self.assertNotIn("200", row["osha_activity_nrs"])

    def test_strong_beats_weak_and_drops_the_lower_tier(self):
        result = self._match(
            "VA",
            [_license(postal_code="10001", county_name="Richmond city")],
            [
                _inspection(activity_nr="100", site_zip="23223", mail_zip="11111"),
                _inspection(activity_nr="200", site_zip="30301", mail_zip="88888"),
            ],
        )
        self.assertEqual(len(result["matches"]), 1)
        row = result["matches"][0]
        self.assertEqual(row["match_tier"], "strong")
        self.assertEqual(row["n_inspections"], 1)
        self.assertEqual(row["osha_activity_nrs"], "100")

    def test_distinct_public_activities_do_not_sum_shared_inspections(self):
        result = self._match(
            "VA",
            [
                _license(external_key="VA-1", postal_code="23220"),
                _license(external_key="VA-2", postal_code="23220"),
            ],
            [
                _inspection(activity_nr="100", site_zip="23220"),
                _inspection(activity_nr="101", site_zip="23220"),
            ],
        )
        self.assertEqual(sum(row["n_inspections"] for row in result["matches"]), 4)
        self.assertEqual(distinct_public_activities(result["matches"]), {"100", "101"})

    def test_person_name_never_exact_or_strong(self):
        result = self._match(
            "VA",
            [_license(licensee_name_raw="Smith, John", county_name="Richmond city", postal_code="23220")],
            [
                _inspection(activity_nr="100", estab_name="Smith, John", site_zip="23220"),
                _inspection(activity_nr="101", estab_name="Smith, John", site_zip="23223", mail_zip="11111"),
            ],
        )
        self.assertEqual(len(result["matches"]), 1)
        row = result["matches"][0]
        self.assertEqual(row["match_tier"], "weak")
        self.assertEqual(row["person_name_licensee"], "yes")
        self.assertEqual(row["osha_activity_nrs"], "100;101")
        self.assertEqual(distinct_public_activities(result["matches"]), set())

    def test_ca_uses_licensee_name_even_when_dba_is_a_different_company(self):
        self.assertEqual(CA_NAME_SOURCE, "licensee_name_raw")
        license_row = _license(
            source_system="ca_cslb",
            external_key="CA-NAME",
            state="CA",
            county_name="Los Angeles",
            postal_code="90001",
            dba_name_raw="Other Roofing LLC",
            licensee_name_raw="Acme Builders LLC",
        )
        stolen = self._match(
            "CA",
            [license_row],
            [_inspection(activity_nr="901", site_state="CA", site_zip="90001", estab_name="Other Roofing LLC")],
        )
        kept = self._match(
            "CA",
            [license_row],
            [_inspection(activity_nr="902", site_state="CA", site_zip="90001", estab_name="Acme Builders LLC")],
        )
        labeled = self._match(
            "CA",
            [
                _license(
                    source_system="ca_cslb",
                    external_key="CA-LABEL",
                    state="CA",
                    postal_code="90001",
                    dba_name_raw="JointVenture",
                    licensee_name_raw="Acme Builders LLC",
                )
            ],
            [_inspection(activity_nr="903", site_state="CA", site_zip="90001", estab_name="JointVenture")],
        )
        self.assertEqual(stolen["matches"], [])
        self.assertEqual(labeled["matches"], [])
        self.assertEqual(kept["matches"][0]["match_tier"], "exact")
        self.assertEqual(kept["matches"][0]["norm_name"], "ACME BUILDERS")

    def test_tennessee_board_and_profile_eligibility(self):
        self.assertEqual(STATES["TN"], {"source_system": "tn_blc", "fips": "47"})
        text = CROSSWALK + "8|37201|ZCTA5 37201|1|0|G6350|B5|S|8|47037|Davidson County|1|0|G4020|H1|A|80|0\n"
        text += "9|37201|ZCTA5 37201|1|0|G6350|B5|S|9|47165|Sumner County|1|0|G4020|H1|A|20|0\n"
        crosswalk = parse_crosswalk(text)
        self.assertEqual(crosswalk.counties_for("TN", "37201"), {"DAVIDSON"})
        eligible = match_state(
            "TN",
            [
                _license(
                    source_system="tn_blc",
                    external_key="TN-1",
                    state="TN",
                    postal_code="37201",
                    county_name="Davidson",
                    contractor_id="profile-1",
                )
            ],
            [_inspection(activity_nr="801", site_state="TN", site_zip="37201")],
            [],
            crosswalk,
        )
        self.assertEqual(eligible["matches"][0]["match_tier"], "exact")
        self.assertEqual(eligible["matches"][0]["profile_eligible"], "yes")
        mismatch = match_state(
            "TN",
            [
                _license(
                    source_system="tn_blc",
                    external_key="TN-2",
                    state="TN",
                    postal_code="99999",
                    county_name="Sumner",
                    contractor_id="profile-2",
                )
            ],
            [_inspection(activity_nr="802", site_state="TN", site_zip="37201", mail_zip="11111")],
            [],
            crosswalk,
        )
        self.assertEqual(mismatch["matches"][0]["match_tier"], "weak")
        self.assertEqual(mismatch["matches"][0]["publication_status"], "weak_held")

    def test_ambiguous_activity_is_held_and_same_profile_is_not(self):
        shared = self._match(
            "VA",
            [
                _license(external_key="A", contractor_id="profile-1"),
                _license(external_key="B", contractor_id="profile-2"),
            ],
            [_inspection(activity_nr="100")],
        )
        self.assertEqual(shared["ambiguous_activities"], {"100"})
        self.assertEqual({row["publication_status"] for row in shared["matches"]}, {"ambiguous_held"})
        self.assertTrue(all(row["profile_eligible"] == "no" for row in shared["matches"]))
        same = self._match(
            "VA",
            [
                _license(external_key="A", contractor_id="profile-1"),
                _license(external_key="B", contractor_id="profile-1"),
            ],
            [_inspection(activity_nr="100")],
        )
        self.assertEqual(same["ambiguous_activities"], set())
        self.assertEqual(sum(row["profile_eligible"] == "yes" for row in same["matches"]), 2)

    def test_one_shared_activity_does_not_drop_the_other(self):
        result = self._match(
            "VA",
            [
                _license(external_key="A", contractor_id="profile-1", postal_code="23220", county_name=""),
                _license(external_key="B", contractor_id="profile-2", postal_code="99999", county_name="Richmond city"),
            ],
            [
                _inspection(activity_nr="100", site_zip="23220", mail_zip="11111"),
                _inspection(activity_nr="101", site_zip="23223", mail_zip="11111"),
            ],
        )
        by_key = {row["license_key"]: row for row in result["matches"]}
        self.assertEqual(result["ambiguous_activities"], {"100"})
        self.assertEqual(by_key["A"]["match_tier"], "exact")
        self.assertEqual(by_key["A"]["publication_status"], "ambiguous_held")
        self.assertEqual(by_key["B"]["match_tier"], "strong")
        self.assertEqual(by_key["B"]["profile_eligible"], "yes")
        self.assertEqual(by_key["B"]["published_activity_nrs"], "101")

    def test_missing_contractor_profile_is_not_eligible(self):
        result = self._match("VA", [_license(contractor_id="")], [_inspection()])
        self.assertEqual(result["matches"][0]["match_tier"], "exact")
        self.assertEqual(result["matches"][0]["profile_eligible"], "no")
        self.assertEqual(result["matches"][0]["publication_status"], "no_profile")

    def test_deleted_citation_is_excluded_and_output_is_deterministic(self):
        licenses = [_license()]
        inspections = [
            _inspection(activity_nr="100"),
            _inspection(activity_nr="100", estab_name="Acme Builders LLC"),
        ]
        violations = [
            _violation(current_penalty="10.5"),
            _violation(delete_flag="X", current_penalty="99", viol_type="W"),
        ]
        first = self._match("VA", licenses, inspections, violations)
        second = self._match("VA", licenses, inspections, violations)
        self.assertEqual(package_bytes(first["matches"]), package_bytes(second["matches"]))
        self.assertEqual(first["duplicate_inspection_rows"], 1)
        self.assertEqual(first["matches"][0]["n_inspections"], 1)
        self.assertEqual(first["matches"][0]["n_citation_items"], 1)
        self.assertEqual(first["matches"][0]["n_serious"], 1)
        self.assertEqual(first["matches"][0]["n_willful_repeat"], 0)
        self.assertEqual(first["matches"][0]["current_penalty_amount"], 10)
        digest = sha256_bytes(package_bytes(first["matches"]))
        self.assertEqual(digest, sha256_bytes(package_bytes(second["matches"])))
        self.assertEqual(len(digest), 64)

    def test_entity_type_label_is_not_used_as_the_business_name(self):
        result = self._match(
            "CA",
            [
                _license(
                    source_system="ca_cslb",
                    external_key="CA-CSLB:1",
                    state="CA",
                    county_name="Los Angeles",
                    postal_code="90001",
                    dba_name_raw="Corporation",
                    licensee_name_raw="Acme Builders LLC",
                )
            ],
            [_inspection(activity_nr="900", site_state="CA", site_zip="90001", estab_name="Acme Builders LLC")],
        )
        self.assertEqual(result["matches"][0]["match_tier"], "exact")
        self.assertEqual(result["matches"][0]["norm_name"], "ACME BUILDERS")

    def test_dba_name_wins_and_short_name_is_not_matched(self):
        dba = self._match(
            "VA",
            [_license(licensee_name_raw="Smith, John", dba_name_raw="Acme Builders LLC")],
            [_inspection(estab_name="Acme Builders LLC")],
        )
        short = self._match("VA", [_license(licensee_name_raw="ABC")], [_inspection(estab_name="ABC")])
        self.assertEqual(dba["matches"][0]["match_tier"], "exact")
        self.assertEqual(dba["matches"][0]["person_name_licensee"], "no")
        self.assertEqual(short["matches"], [])

    def test_state_names_other_than_florida_stay_in_the_name(self):
        louisiana = self._match(
            "LA",
            [
                _license(
                    source_system="la_lslbc",
                    external_key="LA-2",
                    state="LA",
                    county_name="East Baton Rouge",
                    postal_code="70801",
                    licensee_name_raw="Acme Builders of Louisiana LLC",
                )
            ],
            [_inspection(activity_nr="301", site_state="LA", site_zip="70801", estab_name="Acme Builders")],
        )
        florida = self._match(
            "VA",
            [_license(licensee_name_raw="The Acme Company of Florida")],
            [_inspection(estab_name="Acme")],
        )
        self.assertEqual(louisiana["matches"], [])
        self.assertEqual(florida["matches"][0]["match_tier"], "exact")
        self.assertEqual(florida["matches"][0]["norm_name"], "ACME")


class NormalizationTests(unittest.TestCase):
    def test_original_executable_suffix_contract(self):
        self.assertEqual(
            ORIGINAL_SUFFIX,
            r"\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LLP|PA|PLLC|THE|OF|AND|DBA|FL|FLORIDA)\b",
        )
        expected = {
            "Acme & Sons, LLC": "ACME SONS",
            "The Acme Company of Florida": "ACME",
            "A.B. Construction Inc.": "A B CONSTRUCTION",
            "Acme Builders of Virginia LLC": "ACME BUILDERS VIRGINIA",
            "Acme Builders of Louisiana LLC": "ACME BUILDERS LOUISIANA",
            "Acme Builders of California Inc": "ACME BUILDERS CALIFORNIA",
            "ACME FL LLC": "ACME",
            "Acme Florida Corp": "ACME",
            "Acme of Arizona LLC": "ACME ARIZONA",
            "Acme Nevada Co": "ACME NEVADA",
        }
        for raw, norm in expected.items():
            self.assertEqual(normalize_name(raw, SUFFIX_RE), norm, raw)


def _relationship(zcta: str, geoid: str, name: str, area: int, oid: str = "1") -> str:
    return "|".join(
        [
            oid,
            zcta,
            f"ZCTA5 {zcta}",
            "1",
            "0",
            "G6350",
            "B5",
            "S",
            oid,
            geoid,
            name,
            "1",
            "0",
            "G4020",
            "H1",
            "A",
            str(area),
            "0",
        ]
    )


def _selection_crosswalk() -> str:
    header = CROSSWALK.splitlines()[0]
    rows = [
        _relationship("10001", "51001", "Alpha County", 100, "1"),
        _relationship("20001", "51001", "Alpha County", 40, "2"),
        _relationship("20001", "51001", "Alpha County", 40, "3"),
        _relationship("20001", "51059", "Beta County", 70, "4"),
        _relationship("30001", "51001", "Alpha County", 50, "5"),
        _relationship("30001", "51099", "Beta County", 50, "6"),
        _relationship("40001", "51059", "Beta County", 25, "7"),
    ]
    return "\n".join([header, *rows])


class ZctaSingleCountyTests(unittest.TestCase):
    def setUp(self):
        self.text = _selection_crosswalk()
        self.crosswalk = parse_crosswalk(self.text)

    def test_single_county_zcta_keeps_that_county(self):
        self.assertEqual(MULTICOUNTY_SELECTION, "MAX_AREALAND_PART")
        self.assertEqual(TIE_BREAKER, "LEXICOGRAPHICALLY_GREATEST_COUNTY_GEOID")
        self.assertEqual(self.crosswalk.counties_for("VA", "10001"), {"ALPHA"})

    def test_spanning_zcta_keeps_the_largest_summed_area_only(self):
        self.assertEqual(self.crosswalk.counties_for("VA", "20001"), {"ALPHA"})
        self.assertNotIn("BETA", self.crosswalk.counties_for("VA", "20001"))

    def test_equal_area_uses_the_greatest_county_geoid(self):
        forward = self.crosswalk.counties_for("VA", "30001")
        reversed_rows = "\n".join([self.text.splitlines()[0], *reversed(self.text.splitlines()[1:])])
        backward = parse_crosswalk(reversed_rows).counties_for("VA", "30001")
        self.assertEqual(forward, {"BETA"})
        self.assertEqual(backward, forward)

    def test_unselected_overlap_does_not_establish_strong(self):
        result = match_state(
            "VA",
            [_license(postal_code="99999", county_name="Beta County")],
            [_inspection(site_zip="20001", mail_zip="11111")],
            [],
            self.crosswalk,
        )
        self.assertEqual(result["matches"][0]["match_tier"], "weak")

    def test_selected_county_establishes_strong(self):
        result = match_state(
            "VA",
            [_license(postal_code="99999", county_name="Alpha County")],
            [_inspection(site_zip="20001", mail_zip="11111")],
            [],
            self.crosswalk,
        )
        self.assertEqual(result["matches"][0]["match_tier"], "strong")

    def test_blank_stored_county_cannot_establish_strong(self):
        result = match_state(
            "VA",
            [_license(postal_code="99999", county_name="")],
            [_inspection(site_zip="10001", mail_zip="11111")],
            [],
            self.crosswalk,
        )
        self.assertEqual(result["matches"][0]["match_tier"], "weak")

    def test_license_zip_does_not_supply_the_missing_county(self):
        result = match_state(
            "VA",
            [_license(postal_code="20001", county_name="")],
            [_inspection(site_zip="10001", mail_zip="11111")],
            [],
            self.crosswalk,
        )
        self.assertEqual(result["matches"][0]["match_tier"], "weak")
        self.assertIs(LICENSE_ZIP_CAN_INFER_COUNTY, False)


if __name__ == "__main__":
    unittest.main()

