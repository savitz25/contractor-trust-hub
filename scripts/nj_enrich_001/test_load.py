"""NJ-ENRICH-001 loader unit tests (stdlib only, synthetic rows — no package data)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import load  # noqa: E402

CID = "00000000-0000-4000-8000-000000000001"
OTHER = "00000000-0000-4000-8000-000000000002"


def row(**kw):
    base = {
        "contractor_id": CID,
        "license_key": "NJ-HIC:13VH00000100",
        "display_name": "Example Builders LLC",
        "website_url": "https://www.example.test/",
        "phone": "(732) 555-0100 (Office) | 732-555-0101; 1-800-PAVING-1 | 732.555.0100",
        "email": "info@example.test | Sales@Example.test",
        "primary_address": "1 DCA ST EDISON NJ 08817",
        "additional_locations": "Hackensack, NJ | 10 Main St, Toms River, NJ 08753",
        "specialties": "Paving | Sealcoating; Line striping | paving",
        "source_refs": "https://www.example.test/ | https://www.example.test/contact; https://www.example.test/about",
        "scout_confidence": "high",
        "review_flags": "phone:national_multi_office_list;phone_format:vanity_letters",
        "original_label": "publish",
        "decision_ref": "test",
        "package_default_action": "load_flagged",
    }
    base.update(kw)
    return base


def plan(rows, ok=None):
    p = load.Plan(county=load.COUNTIES["mx"], rows=rows)
    load.build_observations(rows, p, ok if ok is not None else {r["contractor_id"] for r in rows}, "sha")
    return p


def by_field(p):
    out: dict = {}
    for o in p.obs:
        out.setdefault(o.field, []).append(o)
    return out


class SplitTest(unittest.TestCase):
    def test_rose_paving_style_phones(self):
        p = plan([row()])
        phones = by_field(p)["phone"]
        self.assertEqual([o.value_normalized for o in phones], ["7325550100", "7325550101", "8007284641"])
        self.assertEqual(phones[0].value, "(732) 555-0100 (Office)")  # display value kept
        self.assertEqual(p.duplicates_collapsed["phone"], 1)
        for o in phones:  # row-level flags ride on every observation
            self.assertIn("phone:national_multi_office_list", o.review_flags)

    def test_emails_locations_specialties_refs(self):
        f = by_field(plan([row()]))
        self.assertEqual([o.value_normalized for o in f["email"]], ["info@example.test", "sales@example.test"])
        self.assertEqual([o.value for o in f["address_location"]], ["Hackensack, NJ", "10 Main St, Toms River, NJ 08753"])
        self.assertEqual([o.value for o in f["specialty"]], ["Paving", "Sealcoating", "Line striping"])
        self.assertEqual(len(f["website"]), 1)
        self.assertEqual(f["website"][0].source_refs, ["https://www.example.test/", "https://www.example.test/contact",
                                                      "https://www.example.test/about"])
        self.assertNotIn("primary_address", f)

    def test_phone_labels_and_semicolon_inside_parentheses(self):
        self.assertEqual(load.split_values("phone", "732-555-0100 (Toms River; Freehold 07728)"),
                         ["732-555-0100 (Toms River; Freehold 07728)"])
        self.assertEqual(load.normalize("phone", "Office: (732) 555-0100"), "7325550100")
        self.assertEqual(load.normalize("phone", "732-555-0100 ext. 12"), "7325550100")
        self.assertEqual(load.normalize("phone", "(732) 555-PAVE (7283)"), "7325557283")
        self.assertEqual(load.normalize("phone", "+44-20-7946-0958 (London office)"), "+442079460958")

    def test_empty_cells_skipped(self):
        p = plan([row(email="", additional_locations="  ")])
        self.assertFalse(any(o.field in ("email", "address_location") for o in p.obs))
        self.assertEqual(p.skipped_empty["email"], 1)

    def test_non_http_website_hard_stops(self):
        with self.assertRaises(SystemExit):
            plan([row(website_url="ftp://example.test")])


class HeldTest(unittest.TestCase):
    def test_held_union_row_never_loadable(self):
        rows = [row(), row(contractor_id=OTHER, license_key="NJ-ALM:34BA00000000",
                           package_default_action=load.HELD_ACTION)]
        self.assertEqual([r["contractor_id"] for r in load.loadable(rows, {OTHER}, set())], [CID])

    def test_load_row_in_held_file_hard_stops(self):
        with self.assertRaises(ValueError):
            load.loadable([row()], {CID}, set())
        with self.assertRaises(ValueError):
            load.loadable([row()], set(), {"NJ-HIC:13VH00000100"})

    def test_gate_excluded_identity_writes_nothing(self):
        self.assertEqual(plan([row()], ok=set()).obs, [])


class FakeConn:
    def __init__(self, contractors, licenses):
        self.contractors, self.licenses = contractors, licenses

    def execute(self, sql, params=()):
        class R:
            def __init__(self, rows):
                self.rows = rows

            def fetchall(self):
                return self.rows
        if "FROM contractors" in sql:
            return R(self.contractors)
        if "contractor_id = ANY" in sql:
            return R([(c, k) for c, k in self.licenses])
        return R([(k, c) for c, k in self.licenses])


class IdentityGateTest(unittest.TestCase):
    def gate(self, contractors, licenses, rows):
        p = load.Plan(county=load.COUNTIES["un"], rows=rows)
        ok = load.identity_gate(FakeConn(contractors, licenses), rows, p)
        return ok, {e["contractor_id"]: e["reason"] for e in p.excluded}

    def test_pass(self):
        ok, ex = self.gate([(CID, None, None, "NJ")], [(CID, "NJ-HIC:13VH00000100")], [row()])
        self.assertEqual((ok, ex), ({CID}, {}))

    def test_failures(self):
        self.assertEqual(self.gate([], [], [row()])[1], {CID: "contractor_id_missing"})
        self.assertEqual(self.gate([(CID, None, None, "FL")], [(CID, "NJ-HIC:13VH00000100")], [row()])[1], {CID: "not_nj"})
        self.assertEqual(self.gate([(CID, None, None, "NJ")], [(CID, "NJ-HIC:99")], [row()])[1], {CID: "license_key_mismatch"})
        self.assertEqual(self.gate([(CID, None, None, "NJ")], [(CID, "NJ-HIC:13VH00000100"), (OTHER, "NJ-HIC:13VH00000100")],
                                   [row()])[1], {CID: "license_key_owned_by_other_contractor"})

    def test_existing_canonical_is_conflict_not_overwrite(self):
        p = load.Plan(county=load.COUNTIES["un"], rows=[row()])
        load.identity_gate(FakeConn([(CID, "7325550199", None, "NJ")], [(CID, "NJ-HIC:13VH00000100")]), [row()], p)
        self.assertEqual([c["column"] for c in p.conflicts], ["contractors.phone"])


class IdempotencyAndRollbackTest(unittest.TestCase):
    def test_plan_is_deterministic_and_key_unique(self):
        a, b = plan([row()]), plan([row()])
        keys = [(o.contractor_id, o.field, o.value_normalized) for o in a.obs]
        self.assertEqual(keys, [(o.contractor_id, o.field, o.value_normalized) for o in b.obs])
        self.assertEqual(len(keys), len(set(keys)))

    def test_founder_holds_drop_only_matching_observations(self):
        p = plan([row()])
        before = len(p.obs)
        h = {"decision": "C", "county": "middlesex", "contractor_id": CID, "field": "phone",
             "value_sha256": load.value_hash("phone", "7325550101")}
        self.assertEqual(load.apply_holds(p, [h]), {"C": 1})
        self.assertEqual(len(p.obs), before - 1)
        self.assertNotIn("7325550101", [o.value_normalized for o in p.obs])
        with self.assertRaises(SystemExit):  # a hold that matches nothing is a hard stop
            load.apply_holds(p, [h])

    def test_rollback_guard(self):
        for c in load.COUNTIES.values():
            load.rollback_guard(c, c.batch_id)
        for bad in (*load.EXISTING_BATCHES, "bg-enrich-002-2026-10-12", "es-enrich-001-2026-10-12", "%", ""):
            with self.assertRaises(SystemExit):
                load.rollback_guard(load.COUNTIES["bg"], bad)
        with self.assertRaises(SystemExit):  # another county's batch
            load.rollback_guard(load.COUNTIES["bg"], load.COUNTIES["un"].batch_id)
        self.assertIn("source_system = %s AND batch_id = %s", load.rollback_sql())

    def test_config_scope(self):
        self.assertEqual(set(load.COUNTIES), {"bg", "mx", "mn", "un"})
        self.assertEqual(sum(c.rows - c.held for c in load.COUNTIES.values()), 2742)
        self.assertTrue(all(load.ROLLBACK_BATCH_RE.match(c.batch_id) for c in load.COUNTIES.values()))


if __name__ == "__main__":
    unittest.main()
