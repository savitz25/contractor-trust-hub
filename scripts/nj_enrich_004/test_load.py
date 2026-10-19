"""NJ-ENRICH-003 Burlington loader tests. Synthetic rows only. No package contact data."""
from __future__ import annotations

import importlib
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import load  # noqa: E402

nj = load.nj

CID = "00000000-0000-4000-8000-0000000000b1"
OTHER = "00000000-0000-4000-8000-0000000000b2"


def row(**kw):
    base = {
        "contractor_id": CID,
        "license_key": "NJ-HIC:13VH00000100",
        "display_name": "Example Builders LLC",
        "website_url": "https://www.example.test/",
        "phone": "Office: (609) 555-0100 | 609-555-0101 (estimate line)",
        "email": "info@example.test | Sales@Example.test",
        "primary_address": "1 Example St, Mount Holly, NJ 08060",
        "additional_locations": "Mount Holly, NJ | 10 Main St, Moorestown, NJ 08057",
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
    return load.stamp_action(row(**kw))


def plan_for(rows, ok=None):
    plan = nj.Plan(county=load.COUNTY, rows=rows)
    load.build_observations(rows, plan, {item["contractor_id"] for item in rows} if ok is None else ok, load.COUNTY.sha)
    return plan


class ConfigTest(unittest.TestCase):
    def test_burlington_pin(self):
        county = load.COUNTY
        self.assertEqual((county.code, county.name), ("bu", "burlington"))
        self.assertEqual(county.rows, 402)
        self.assertEqual(county.held, 0)
        self.assertTrue(county.sha.startswith("3cbf3e6c"))
        self.assertTrue(county.sha.endswith("a7528ba1"))
        self.assertFalse(county.sha.startswith(load.SUPERSEDED_SHA_PREFIX))
        self.assertEqual(county.batch_id, "bu-enrich-001-2026-10-17")
        self.assertEqual(county.source_system, "dot_web_enrich_bu_2026_10")
        self.assertEqual(county.observed_at, "2026-10-17T00:00:00-04:00")
        self.assertEqual(county.fill, {"website": 402, "phone": 379, "email": 247, "address_location": 134, "specialty": 379})
        self.assertEqual(county.actions, {"load": 183, "load_flagged": 219})
        self.assertEqual(load.EXPECTED_OBS, {"website": 402, "phone": 455, "email": 273, "address_location": 138, "specialty": 1948})
        self.assertEqual(load.EXPECTED_TOTAL, 3216)
        self.assertEqual(load.GO_PHRASE, "GO CONTRACTOR BURLINGTON ENRICH LOAD")
        self.assertEqual(load.ROLLBACK_BATCH_RE.pattern, r"^bu-enrich-001-2026-10-17$")
        self.assertEqual(load.ROLLBACK_SQL_LITERAL, (
            "DELETE FROM contractor_enrichment_observations "
            "WHERE source_system = 'dot_web_enrich_bu_2026_10' "
            "AND batch_id = 'bu-enrich-001-2026-10-17';"
        ))

    def test_superseded_package_is_rejected(self):
        with self.assertRaises(SystemExit):
            load.reject_superseded("871b4a27" + ("0" * 56))
        load.reject_superseded(load.COUNTY.sha)

    def test_morris_and_existing_nj_loaders_stay_unchanged(self):
        morris = importlib.import_module("scripts.nj_enrich_002.load")
        self.assertEqual(morris.GO_PHRASE, "GO CONTRACTOR MORRIS ENRICH LOAD")
        self.assertEqual(morris.ROLLBACK_BATCH_RE.pattern, r"^mo-enrich-001-2026-10-17$")
        self.assertEqual(morris.COUNTY.batch_id, "mo-enrich-001-2026-10-17")
        self.assertEqual(morris.COUNTY.source_system, "dot_web_enrich_mo_2026_10")
        self.assertEqual(morris.EXPECTED_TOTAL, 4862)
        self.assertEqual(set(nj.COUNTIES), {"bg", "mx", "mn", "un"})
        self.assertEqual(nj.ROLLBACK_BATCH_RE.pattern, r"^(bg|mx|mn|un)-enrich-001-2026-10-12$")
        self.assertIsNone(nj.ROLLBACK_BATCH_RE.fullmatch(load.COUNTY.batch_id))
        self.assertIsNone(load.ROLLBACK_BATCH_RE.fullmatch(morris.COUNTY.batch_id))


class SplitAndIdentityTest(unittest.TestCase):
    def test_pipe_split_is_deterministic(self):
        first = plan_for([stamped()])
        second = plan_for([stamped()])
        phones = [obs for obs in first.obs if obs.field == "phone"]
        self.assertEqual([obs.value_normalized for obs in phones], ["6095550100", "6095550101"])
        self.assertEqual(phones[0].value, "Office: (609) 555-0100")
        self.assertEqual(
            nj.split_values("phone", "609-555-0100 (Mount Holly; Moorestown 08057)"),
            ["609-555-0100 (Mount Holly; Moorestown 08057)"],
        )
        self.assertEqual(
            [obs.value_normalized for obs in first.obs if obs.field == "email"],
            ["info@example.test", "sales@example.test"],
        )
        self.assertEqual(
            [obs.value for obs in first.obs if obs.field == "specialty"],
            ["Electrical", "Lighting", "Panel upgrades"],
        )
        self.assertEqual(
            [obs.value for obs in first.obs if obs.field == "address_location"],
            ["Mount Holly, NJ", "10 Main St, Moorestown, NJ 08057"],
        )
        self.assertNotIn("primary_address", {obs.field for obs in first.obs})
        keys = [(obs.contractor_id, obs.field, obs.value_normalized, obs.ordinal) for obs in first.obs]
        self.assertEqual(keys, [(obs.contractor_id, obs.field, obs.value_normalized, obs.ordinal) for obs in second.obs])
        self.assertTrue(all(obs.decision_ref.startswith(load.TICKET_REF) for obs in first.obs))
        self.assertTrue(nj.TICKET_REF.startswith("NJ-ENRICH-001"))

    def test_ids_outside_csv_get_zero_observations(self):
        rows = [stamped()]
        plan = plan_for(rows, ok={CID, OTHER})
        self.assertEqual(load.outside_csv_observation_count(plan, {CID}), 0)
        self.assertEqual([obs for obs in plan.obs if obs.contractor_id == OTHER], [])
        self.assertEqual(plan_for(rows, ok=set()).obs, [])

    def test_short_file_rejected(self):
        with self.assertRaises(SystemExit):
            load.check_ready_rows([row()])

    def test_undeliverable_email_stops(self):
        with self.assertRaises(SystemExit):
            load.stamp_action(row(review_flags="email_undeliverable:mailbox"))

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
                return Result([(key, cid) for cid, key in self.licenses])

        one = [stamped()]
        plan = nj.Plan(county=load.COUNTY, rows=one)
        ok = nj.identity_gate(FakeConn([(CID, None, None, "NJ")], [(CID, "NJ-HIC:13VH00000100")]), one, plan)
        self.assertEqual((ok, plan.excluded), ({CID}, []))

        def reason(contractors, licenses):
            holder = nj.Plan(county=load.COUNTY, rows=one)
            nj.identity_gate(FakeConn(contractors, licenses), one, holder)
            return holder.excluded[0]["reason"]

        self.assertEqual(reason([], []), "contractor_id_missing")
        self.assertEqual(reason([(CID, None, None, "FL")], [(CID, "NJ-HIC:13VH00000100")]), "not_nj")
        self.assertEqual(reason([(CID, None, None, "NJ")], [(CID, "NJ-HIC:99")]), "license_key_mismatch")
        self.assertEqual(
            reason([(CID, None, None, "NJ")], [(CID, "NJ-HIC:13VH00000100"), (OTHER, "NJ-HIC:13VH00000100")]),
            "license_key_owned_by_other_contractor",
        )

    def test_idempotent_plan(self):
        present_plan = plan_for([stamped(review_flags="toll_free_phone")])
        present = {(obs.contractor_id, obs.field, obs.value_normalized, load.COUNTY.batch_id) for obs in present_plan.obs}
        self.assertGreater(len(present), 0)
        again = plan_for([stamped(review_flags="toll_free_phone")])
        proposed = [
            obs for obs in again.obs
            if (obs.contractor_id, obs.field, obs.value_normalized, load.COUNTY.batch_id) not in present
        ]
        self.assertEqual(proposed, [])
        source = Path(load.__file__).read_text(encoding="utf-8")
        self.assertIn("ON CONFLICT ON CONSTRAINT contractor_enrichment_observations_idem DO NOTHING", source)
        self.assertIn("is_suppressed, suppression_reason", source)
        self.assertIn("false, NULL", source)


class RollbackAndGuardTest(unittest.TestCase):
    def test_rollback_accepts_only_burlington_batch(self):
        load.rollback_guard(load.COUNTY.batch_id)
        morris = importlib.import_module("scripts.nj_enrich_002.load")
        rejected = [
            morris.COUNTY.batch_id,
            "ps-enrich-001-2026-10-17",
            "hb-enrich-001-2026-10-17",
            "le-enrich-001-2026-10-17",
            "or-enrich-001-2026-10-17",
            *(county.batch_id for county in nj.COUNTIES.values()),
            *nj.EXISTING_BATCHES,
            "bu-enrich-001-2026-10-12",
            "bu-enrich-002-2026-10-17",
            "bu-enrich-001-2026-10-17-extra",
            "",
            "%",
            "bu-enrich-001-2026-10-17 ",
        ]
        for batch_id in rejected:
            with self.assertRaises(SystemExit):
                load.rollback_guard(batch_id)
        self.assertIn("source_system = %s AND batch_id = %s", load.rollback_sql())

    def test_transaction_name(self):
        self.assertEqual(load.transaction_name(False), "ROLLBACK")
        self.assertEqual(load.transaction_name(True), "COMMIT")

    def test_apply_requires_exact_phrase(self):
        load.require_go(False, "")
        load.require_go(True, load.GO_PHRASE)
        for phrase in ("", "Looks good", "GO CONTRACTOR MORRIS ENRICH LOAD", "GO CONTRACTOR PASSAIC ENRICH LOAD",
                       "go contractor burlington enrich load"):
            with self.assertRaises(SystemExit):
                load.require_go(True, phrase)

    def test_package_inside_repo_or_any_git_tree_refused(self):
        with self.assertRaises(SystemExit):
            load.assert_package_outside_git(Path(__file__).resolve().parent)

        def inside_other(_cmd, **_kw):
            class Result:
                returncode = 0
            return Result()

        with mock.patch.object(load.nj.subprocess, "run", inside_other):
            with self.assertRaises(SystemExit):
                load.assert_package_outside_git(Path("C:/trusthub-pkg/dot-enrich-2026-10-18/nj-burlington"))

    def test_no_contact_data_in_loader_tree(self):
        folder = Path(__file__).resolve().parent
        self.assertEqual(list(folder.glob("*.csv")), [])
        source = (folder / "load.py").read_text(encoding="utf-8")
        self.assertNotIn("@", source)
        self.assertIsNone(re.search(r"https?://", source))
        tests = Path(__file__).read_text(encoding="utf-8")
        emails = set(re.findall(r"[\w.+-]+@[\w.-]+", tests))
        self.assertTrue(emails <= {"info@example.test", "sales@example.test", "Sales@Example.test"})
        ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("*dot-enrich-handoff*", ignore)
        self.assertIn("*handoff-1017*", ignore)
        sql = (ROOT / "scripts" / "sql" / "nj-enrich-004-rollback.sql").read_text(encoding="utf-8")
        self.assertIn(load.COUNTY.batch_id, sql)
        self.assertIsNone(re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", sql))


if __name__ == "__main__":
    unittest.main()
