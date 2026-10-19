"""NJ-ENRICH-005 Mercer loader tests. Synthetic rows only — no package contact data."""
from __future__ import annotations

import importlib.util
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import load as me  # noqa: E402

_NJ_PATH = ROOT / "scripts" / "nj_enrich_001" / "load.py"
_spec = importlib.util.spec_from_file_location("nj_enrich_001_load_tests_me", _NJ_PATH)
nj = importlib.util.module_from_spec(_spec)
sys.modules["nj_enrich_001_load_tests_me"] = nj
_spec.loader.exec_module(nj)

_MO_PATH = ROOT / "scripts" / "nj_enrich_002" / "load.py"
_mo_spec = importlib.util.spec_from_file_location("nj_enrich_002_load_for_me", _MO_PATH)
mo = importlib.util.module_from_spec(_mo_spec)
sys.modules["nj_enrich_002_load_for_me"] = mo
_mo_spec.loader.exec_module(mo)

CID = "00000000-0000-4000-8000-000000000001"
OTHER = "00000000-0000-4000-8000-000000000002"


def row(**kw):
    base = {
        "contractor_id": CID,
        "license_key": "NJ-HIC:13VH00000100",
        "display_name": "Example Builders LLC",
        "website_url": "https://www.example.test/",
        "phone": "Office: (973) 555-0100 | 973-555-0101 (estimate line)",
        "email": "info@example.test | Sales@Example.test",
        "primary_address": "1 Example St, Example City, NJ 00000",
        "additional_locations": "Example City, NJ | 10 Example Ave, Example City, NJ 00000",
        "specialties": "Electrical | Lighting; Panel upgrades",
        "source_refs": "https://www.example.test/",
        "scout_confidence": "high",
        "scout_confidence_source": "test",
        "review_flags": "",
        "original_label": "publish",
        "decision_ref": "test",
        "check_status": "ok",
    }
    base.update(kw)
    return base


def stamped(**kw):
    return me.stamp_action(row(**kw))


def plan_for(rows, ok=None):
    plan = nj.Plan(county=me.COUNTY, rows=rows)
    me.build_observations(rows, plan, {r["contractor_id"] for r in rows} if ok is None else ok, me.COUNTY.sha)
    return plan


class ConfigTest(unittest.TestCase):
    def test_mercer_pin(self):
        county = me.COUNTY
        self.assertEqual((county.code, county.name), ("me", "mercer"))
        self.assertEqual(county.sha, "b8f6c2206e3e9357870164488af5f79b3bc6c0b2232fe7a83a9cfadff5dec7b6")
        self.assertEqual((county.rows, county.held), (279, 0))
        self.assertEqual(county.batch_id, "me-enrich-001-2026-10-18")
        self.assertEqual(county.source_system, "dot_web_enrich_me_2026_10")
        self.assertEqual(county.observed_at, "2026-10-18T00:00:00-04:00")
        self.assertEqual(county.fill, {"website": 279, "phone": 277, "email": 185, "address_location": 67, "specialty": 279})
        self.assertEqual(county.actions, {"load": 132, "load_flagged": 147})
        self.assertEqual(me.EXPECTED_TOTAL, 2485)
        self.assertEqual(me.GO_PHRASE, "GO CONTRACTOR MERCER ENRICH LOAD")
        self.assertEqual(me.ROLLBACK_SQL_LITERAL, (
            "DELETE FROM contractor_enrichment_observations "
            "WHERE source_system = 'dot_web_enrich_me_2026_10' "
            "AND batch_id = 'me-enrich-001-2026-10-18';"
        ))

    def test_morris_pin_unchanged(self):
        county = mo.COUNTY
        self.assertEqual((county.code, county.name), ("mo", "morris"))
        self.assertEqual(county.batch_id, "mo-enrich-001-2026-10-17")
        self.assertEqual(county.source_system, "dot_web_enrich_mo_2026_10")
        self.assertEqual(county.rows, 571)
        self.assertEqual(mo.GO_PHRASE, "GO CONTRACTOR MORRIS ENRICH LOAD")
        self.assertEqual(mo.EXPECTED_TOTAL, 4862)
        self.assertIsNotNone(mo.ROLLBACK_BATCH_RE.fullmatch("mo-enrich-001-2026-10-17"))
        self.assertIsNone(mo.ROLLBACK_BATCH_RE.fullmatch(me.COUNTY.batch_id))
        self.assertIsNone(me.ROLLBACK_BATCH_RE.fullmatch(mo.COUNTY.batch_id))

    def test_existing_nj_counties_unchanged(self):
        self.assertEqual(set(nj.COUNTIES), {"bg", "mx", "mn", "un"})
        self.assertEqual(nj.LOAD_ORDER, ("un", "mx", "mn", "bg"))
        self.assertEqual(sum(c.rows - c.held for c in nj.COUNTIES.values()), 2742)
        self.assertIsNone(nj.ROLLBACK_BATCH_RE.fullmatch(me.COUNTY.batch_id))
        self.assertIsNone(nj.ROLLBACK_BATCH_RE.fullmatch(mo.COUNTY.batch_id))


class SplitAndIdentityTest(unittest.TestCase):
    def test_pipe_and_semicolon_splits_including_labeled_phones(self):
        plan = plan_for([stamped()])
        phones = [item for item in plan.obs if item.field == "phone"]
        self.assertEqual([item.value_normalized for item in phones], ["9735550100", "9735550101"])
        self.assertEqual(phones[0].value, "Office: (973) 555-0100")
        self.assertEqual(phones[1].value, "973-555-0101 (estimate line)")
        self.assertEqual(
            nj.split_values("phone", "973-555-0100 (Example City; Example 00000)"),
            ["973-555-0100 (Example City; Example 00000)"],
        )
        emails = [item.value_normalized for item in plan.obs if item.field == "email"]
        self.assertEqual(emails, ["info@example.test", "sales@example.test"])
        self.assertEqual(
            [item.value for item in plan.obs if item.field == "specialty"],
            ["Electrical", "Lighting", "Panel upgrades"],
        )
        self.assertEqual(
            [item.value for item in plan.obs if item.field == "address_location"],
            ["Example City, NJ", "10 Example Ave, Example City, NJ 00000"],
        )
        self.assertTrue(all(item.decision_ref.startswith(me.TICKET_REF) for item in plan.obs))
        self.assertTrue(me.nj.TICKET_REF.startswith("NJ-ENRICH-001"))

    def test_ids_outside_csv_get_zero_observations(self):
        rows = [stamped()]
        plan = plan_for(rows, ok={CID, OTHER})
        self.assertEqual(me.outside_csv_observation_count(plan, {CID}), 0)
        self.assertEqual(sum(1 for item in plan.obs if item.contractor_id == OTHER), 0)
        self.assertEqual(plan_for(rows, ok=set()).obs, [])

    def test_short_file_rejected(self):
        with self.assertRaises(SystemExit):
            me.check_ready_rows([row()])

    def test_undeliverable_email_stops(self):
        with self.assertRaises(SystemExit):
            me.stamp_action(row(review_flags="email_undeliverable:mailbox"))

    def test_empty_flags_are_load_and_flags_are_load_flagged(self):
        self.assertEqual(stamped()["package_default_action"], "load")
        self.assertEqual(stamped(review_flags="toll_free_phone")["package_default_action"], "load_flagged")

    def test_identity_gate(self):
        class FakeConn:
            def __init__(self, contractors, licenses):
                self.contractors, self.licenses = contractors, licenses

            def execute(self, sql, params=()):
                class Result:
                    def __init__(self, rows):
                        self.rows = rows

                    def fetchall(self):
                        return self.rows

                if "FROM contractors" in sql:
                    return Result(self.contractors)
                if "contractor_id = ANY" in sql:
                    return Result(self.licenses)
                return Result([(key, contractor) for contractor, key in self.licenses])

        one = [stamped()]
        plan = nj.Plan(county=me.COUNTY, rows=one)
        ok = nj.identity_gate(FakeConn([(CID, None, None, "NJ")], [(CID, "NJ-HIC:13VH00000100")]), one, plan)
        self.assertEqual((ok, plan.excluded), ({CID}, []))

        def reason(contractors, licenses):
            failed = nj.Plan(county=me.COUNTY, rows=one)
            nj.identity_gate(FakeConn(contractors, licenses), one, failed)
            return failed.excluded[0]["reason"]

        self.assertEqual(reason([], []), "contractor_id_missing")
        self.assertEqual(reason([(CID, None, None, "FL")], [(CID, "NJ-HIC:13VH00000100")]), "not_nj")
        self.assertEqual(reason([(CID, None, None, "NJ")], [(CID, "NJ-HIC:99")]), "license_key_mismatch")
        self.assertEqual(
            reason([(CID, None, None, "NJ")], [(CID, "NJ-HIC:13VH00000100"), (OTHER, "NJ-HIC:13VH00000100")]),
            "license_key_owned_by_other_contractor",
        )

    def test_idempotent_plan(self):
        first = plan_for([stamped(review_flags="toll_free_phone")])
        second = plan_for([stamped(review_flags="toll_free_phone")])
        key = lambda plan: [(item.contractor_id, item.field, item.value_normalized, item.ordinal) for item in plan.obs]
        self.assertEqual(key(first), key(second))
        self.assertEqual(len(key(first)), len(set(key(first))))
        idem = [(item.contractor_id, item.field, item.value_normalized) for item in first.obs]
        self.assertEqual(len(idem), len(set(idem)))


class RollbackAndGuardTest(unittest.TestCase):
    def test_rollback_accepts_only_mercer_batch(self):
        me.rollback_guard(me.COUNTY.batch_id)
        rejected = [
            mo.COUNTY.batch_id,
            *(county.batch_id for county in nj.COUNTIES.values()),
            *nj.EXISTING_BATCHES,
            "ps-enrich-001-2026-10-17",
            "bu-enrich-001-2026-10-17",
            "hb-enrich-001-2026-10-17",
            "le-enrich-001-2026-10-17",
            "or-enrich-001-2026-10-17",
            "md-enrich-001-2026-10-06",
            "bw-enrich-001-2026-10-08",
            "pb-enrich-001-2026-10-08",
            "pn-enrich-001-2026-10-08",
            "me-enrich-001-2026-10-17",
            "me-enrich-002-2026-10-18",
            "me-enrich-001-2026-10-18-extra",
            "",
            "%",
            "me-enrich-001-2026-10-18 ",
        ]
        for batch_id in rejected:
            with self.assertRaises(SystemExit):
                me.rollback_guard(batch_id)
        self.assertIn("source_system = %s AND batch_id = %s", me.rollback_sql())

    def test_transaction_name(self):
        self.assertEqual(me.transaction_name(False), "ROLLBACK")
        self.assertEqual(me.transaction_name(True), "COMMIT")

    def test_apply_refuses_another_county_phrase(self):
        me.require_go(False, "")
        me.require_go(True, me.GO_PHRASE)
        for phrase in (
            "",
            "Looks good",
            "GO CONTRACTOR MORRIS ENRICH LOAD",
            "GO CONTRACTOR PASSAIC ENRICH LOAD",
            "GO CONTRACTOR BURLINGTON ENRICH LOAD",
            "GO CONTRACTOR CAMDEN ENRICH LOAD",
            "GO CONTRACTOR BERGEN ENRICH LOAD",
            "GO CONTRACTOR HILLSBOROUGH ENRICH LOAD",
            "GO CONTRACTOR LEE ENRICH LOAD",
            "GO CONTRACTOR ORANGE ENRICH LOAD",
            "GO CONTRACTOR COLLIER ENRICH LOAD",
            "GO CONTRACTOR DUVAL ENRICH LOAD",
            "go contractor mercer enrich load",
        ):
            with self.assertRaises(SystemExit):
                me.require_go(True, phrase)

    def test_package_inside_repo_or_any_git_tree_refused(self):
        with self.assertRaises(SystemExit):
            me.assert_package_outside_git(Path(__file__).resolve().parent)

        def inside_other(_cmd, **_kw):
            class Result:
                returncode = 0
            return Result()

        with mock.patch.object(me.nj.subprocess, "run", inside_other):
            with self.assertRaises(SystemExit):
                me.assert_package_outside_git(Path("C:/trusthub-pkg/dot-enrich-2026-10-18b/nj-mercer"))

        def outside(_cmd, **_kw):
            class Result:
                returncode = 1
            return Result()

        with mock.patch.object(me.nj.subprocess, "run", outside):
            me.assert_package_outside_git(Path("C:/trusthub-pkg/dot-enrich-2026-10-18b/nj-mercer"))

    def test_no_contact_data_in_loader_tree(self):
        folder = Path(__file__).resolve().parent
        self.assertEqual(list(folder.glob("*.csv")), [])
        source = (folder / "load.py").read_text(encoding="utf-8")
        self.assertNotIn("@", source)
        self.assertNotRegex(source, r"https?://")
        tests = (folder / "test_load.py").read_text(encoding="utf-8")
        emails = set(re.findall(r"[\w.+-]+@[\w.-]+", tests))
        self.assertTrue(emails <= {"info@example.test", "sales@example.test", "Sales@Example.test"})
        ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("*dot-enrich-handoff*", ignore)
        self.assertIn("*handoff-1017*", ignore)
        sql = (ROOT / "scripts" / "sql" / "nj-enrich-005-rollback.sql").read_text(encoding="utf-8")
        self.assertIn("-- DELETE FROM contractor_enrichment_observations", sql)
        self.assertNotRegex(sql, r"(?m)^DELETE ")


if __name__ == "__main__":
    unittest.main()
