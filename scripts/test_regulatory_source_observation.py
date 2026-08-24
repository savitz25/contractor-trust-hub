#!/usr/bin/env python3
import unittest

from ingest.regulatory.source_observation import (
    FL_DISCIPLINE_FIELDS,
    canonical_source_row,
    classify_observation,
    logical_matter_detail_key_v1,
    row_fingerprint_sha256,
    source_observation_key_v2,
)


def fixture(**changes):
    row = {field: "" for field in FL_DISCIPLINE_FIELDS}
    row.update({
        "License Type": "Certified General Contractor",
        "License Nbr": "0012345",
        "Respondent Name": "Example, A. Contractor",
        "Address Line 1": "10 Main  Street",
        "Complaint Nbr": "2024000001",
        "Classification": "Licensed Activity",
        "Entered Date": "07/01/2024",
        "Disposition": "Final Order",
        "Disposition Date": "01/02/2025",
        "Discipline Date - Description": "01/02/2025 - Costs",
        "Violation Code": "V1",
    })
    row.update(changes)
    return row


def observation_key(row):
    return source_observation_key_v2(
        source_system="fl_dbpr", source_dataset="contractor_disc_lic", row=row
    )


def logical_key(row):
    return logical_matter_detail_key_v1(
        source_system="fl_dbpr", source_dataset="contractor_disc_lic", row=row
    )


class SourceObservationTests(unittest.TestCase):
    def test_exact_row_is_deterministic_and_position_independent(self):
        row = fixture()
        reversed_row = dict(reversed(list(row.items())))
        self.assertEqual(observation_key(row), observation_key(reversed_row))
        self.assertEqual(row_fingerprint_sha256(row), row_fingerprint_sha256(reversed_row))

    def test_canonicalization_is_narrow(self):
        row = fixture(**{"Respondent Name": "  Mixed-Case Name  ", "Address Line 1": "A\r\nB"})
        canonical = canonical_source_row(row)
        self.assertEqual(canonical["Respondent Name"], "Mixed-Case Name")
        self.assertEqual(canonical["Address Line 1"], "A\nB")
        self.assertEqual(canonical["License Nbr"], "0012345")

    def test_changed_mutable_field_is_new_observation_same_review_group(self):
        old = fixture()
        changed = fixture(**{"Disposition": "Dismissed"})
        self.assertNotEqual(observation_key(old), observation_key(changed))
        self.assertEqual(logical_key(old), logical_key(changed))
        self.assertEqual(
            classify_observation(exact_observation_exists=False, logical_group_exists=True),
            "REVISION_REVIEW_REQUIRED",
        )

    def test_exact_reobservation_reuses_observation_and_allows_occurrence(self):
        row = fixture()
        self.assertEqual(observation_key(row), observation_key(dict(row)))
        self.assertEqual(
            classify_observation(exact_observation_exists=True, logical_group_exists=True),
            "EXACT_REOBSERVATION",
        )

    def test_legitimate_multiline_complaint_is_not_collapsed(self):
        first = fixture(**{"Violation Code": "V1", "Discipline Date - Description": "Costs"})
        second = fixture(**{"Violation Code": "V2", "Discipline Date - Description": "Probation"})
        self.assertNotEqual(observation_key(first), observation_key(second))
        self.assertNotEqual(logical_key(first), logical_key(second))

    def test_name_case_and_punctuation_are_not_normalized_away(self):
        self.assertNotEqual(
            observation_key(fixture(**{"Respondent Name": "Example, A. Contractor"})),
            observation_key(fixture(**{"Respondent Name": "EXAMPLE A CONTRACTOR"})),
        )

    def test_complaint_number_is_not_unique_identity(self):
        first = fixture(**{"Violation Code": "V1"})
        second = fixture(**{"Violation Code": "V2"})
        self.assertEqual(first["Complaint Nbr"], second["Complaint Nbr"])
        self.assertNotEqual(observation_key(first), observation_key(second))


if __name__ == "__main__":
    unittest.main()
