"""NJ-ENRICH-002 Morris loader tests. Synthetic rows only — no package contact data."""
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
import load as mo  # noqa: E402

_NJ_PATH = ROOT / "scripts" / "nj_enrich_001" / "load.py"
_spec = importlib.util.spec_from_file_location("nj_enrich_001_load_tests", _NJ_PATH)
nj = importlib.util.module_from_spec(_spec)
sys.modules["nj_enrich_001_load_tests"] = nj
_spec.loader.exec_module(nj)

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
        "primary_address": "1 Example St, Morristown, NJ 07960",
        "additional_locations": "Morristown, NJ | 10 Main St, Parsippany, NJ 07054",
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
    return mo.stamp_action(row(**kw))


def plan_for(rows, ok=None):
    p = nj.Plan(county=mo.COUNTY, rows=rows)
    mo.build_observations(rows, p, {r["contractor_id"] for r in rows} if ok is None else ok, mo.COUNTY.sha)
    return p


class ConfigTest(unittest.TestCase):
    def test_morris_pin(self):
        c = mo.COUNTY
        self.assertEqual((c.code, c.name), ("mo", "morris"))
        self.assertEqual(c.sha, "241aa1828e7c82b31303c0f9ce55839dbd2e102cbf8ad4b3b4bdf508a235afdf")
        self.assertEqual((c.rows, c.held), (571, 0))
        self.assertEqual(c.batch_id, "mo-enrich-001-2026-10-17")
        self.assertEqual(c.source_system, "dot_web_enrich_mo_2026_10")
        self.assertEqual(c.observed_at, "2026-10-17T00:00:00-04:00")
        self.assertEqual(c.fill, {"website": 571, "phone": 546, "email": 365, "address_location": 181, "specialty": 549})
        self.assertEqual(c.actions, {"load": 239, "load_flagged": 332})
        self.assertEqual(mo.ROLLBACK_SQL_LITERAL, (
            "DELETE FROM contractor_enrichment_observations "
            "WHERE source_system = 'dot_web_enrich_mo_2026_10' "
            "AND batch_id = 'mo-enrich-001-2026-10-17';"
        ))

    def test_existing_nj_counties_unchanged(self):
        self.assertEqual(set(nj.COUNTIES), {"bg", "mx", "mn", "un"})
        self.assertEqual(nj.LOAD_ORDER, ("un", "mx", "mn", "bg"))
        self.assertEqual(sum(c.rows - c.held for c in nj.COUNTIES.values()), 2742)
        self.assertIsNone(nj.ROLLBACK_BATCH_RE.fullmatch(mo.COUNTY.batch_id))
        self.assertTrue(all(nj.ROLLBACK_BATCH_RE.fullmatch(c.batch_id) for c in nj.COUNTIES.values()))
        self.assertIsNone(mo.ROLLBACK_BATCH_RE.fullmatch(nj.COUNTIES["bg"].batch_id))


class SplitAndIdentityTest(unittest.TestCase):
    def test_pipe_split_office_and_estimate_line(self):
        p = plan_for([stamped()])
        phones = [o for o in p.obs if o.field == "phone"]
        self.assertEqual([o.value_normalized for o in phones], ["9735550100", "9735550101"])
        self.assertEqual(phones[0].value, "Office: (973) 555-0100")
        self.assertEqual(phones[1].value, "973-555-0101 (estimate line)")
        self.assertEqual(
            nj.split_values("phone", "973-555-0100 (Parsippany; Denville 07834)"),
            ["973-555-0100 (Parsippany; Denville 07834)"],
        )
        emails = [o.value_normalized for o in p.obs if o.field == "email"]
        self.assertEqual(emails, ["info@example.test", "sales@example.test"])
        self.assertEqual(
            [o.value for o in p.obs if o.field == "specialty"],
            ["Electrical", "Lighting", "Panel upgrades"],
        )
        self.assertTrue(all(o.decision_ref.startswith(mo.TICKET_REF) for o in p.obs))
        self.assertTrue(mo.nj.TICKET_REF.startswith("NJ-ENRICH-001"))

    def test_ids_outside_csv_get_zero_observations(self):
        rows = [stamped()]
        p = plan_for(rows, ok={CID, OTHER})
        self.assertEqual(mo.outside_csv_observation_count(p, {CID}), 0)
        self.assertEqual(sum(1 for o in p.obs if o.contractor_id == OTHER), 0)
        self.assertEqual(plan_for(rows, ok=set()).obs, [])

    def test_short_file_rejected(self):
        with self.assertRaises(SystemExit):
            mo.check_ready_rows([row()])

    def test_undeliverable_email_stops(self):
        with self.assertRaises(SystemExit):
            mo.stamp_action(row(review_flags="email_undeliverable:mailbox"))

    def test_empty_flags_are_load_and_flags_are_load_flagged(self):
        self.assertEqual(stamped()["package_default_action"], "load")
        self.assertEqual(stamped(review_flags="toll_free_phone")["package_default_action"], "load_flagged")

    def test_identity_gate(self):
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
                    return R(self.licenses)
                return R([(k, c) for c, k in self.licenses])

        one = [stamped()]
        p = nj.Plan(county=mo.COUNTY, rows=one)
        ok = nj.identity_gate(FakeConn([(CID, None, None, "NJ")], [(CID, "NJ-HIC:13VH00000100")]), one, p)
        self.assertEqual((ok, p.excluded), ({CID}, []))

        def reason(contractors, licenses):
            plan = nj.Plan(county=mo.COUNTY, rows=one)
            nj.identity_gate(FakeConn(contractors, licenses), one, plan)
            return plan.excluded[0]["reason"]

        self.assertEqual(reason([], []), "contractor_id_missing")
        self.assertEqual(reason([(CID, None, None, "FL")], [(CID, "NJ-HIC:13VH00000100")]), "not_nj")
        self.assertEqual(reason([(CID, None, None, "NJ")], [(CID, "NJ-HIC:99")]), "license_key_mismatch")
        self.assertEqual(
            reason([(CID, None, None, "NJ")], [(CID, "NJ-HIC:13VH00000100"), (OTHER, "NJ-HIC:13VH00000100")]),
            "license_key_owned_by_other_contractor",
        )

    def test_idempotent_plan(self):
        a = plan_for([stamped(review_flags="toll_free_phone")])
        b = plan_for([stamped(review_flags="toll_free_phone")])
        key = lambda p: [(o.contractor_id, o.field, o.value_normalized, o.ordinal) for o in p.obs]
        self.assertEqual(key(a), key(b))
        self.assertEqual(len(key(a)), len(set(key(a))))


class RollbackAndGuardTest(unittest.TestCase):
    def test_rollback_accepts_only_morris_batch(self):
        mo.rollback_guard(mo.COUNTY.batch_id)
        rejected = [
            *(c.batch_id for c in nj.COUNTIES.values()),
            *nj.EXISTING_BATCHES,
            "fl-enrich-001-2026-10-17",
            "hb-enrich-001-2026-10-17",
            "mo-enrich-001-2026-10-12",
            "mo-enrich-002-2026-10-17",
            "mo-enrich-001-2026-10-17-extra",
            "bg-enrich-001-2026-10-17",
            "",
            "%",
            "mo-enrich-001-2026-10-17 ",
        ]
        for batch_id in rejected:
            with self.assertRaises(SystemExit):
                mo.rollback_guard(batch_id)
        self.assertIn("source_system = %s AND batch_id = %s", mo.rollback_sql())

    def test_apply_requires_exact_phrase(self):
        mo.require_go(False, "")
        mo.require_go(True, mo.GO_PHRASE)
        for phrase in ("", "Looks good", "GO CONTRACTOR BERGEN ENRICH LOAD", "go contractor morris enrich load"):
            with self.assertRaises(SystemExit):
                mo.require_go(True, phrase)

    def test_package_inside_repo_or_any_git_tree_refused(self):
        with self.assertRaises(SystemExit):
            mo.assert_package_outside_git(Path(__file__).resolve().parent)

        def inside_other(_cmd, **_kw):
            class R:
                returncode = 0
            return R()

        with mock.patch.object(mo.nj.subprocess, "run", inside_other):
            with self.assertRaises(SystemExit):
                mo.assert_package_outside_git(Path("H:/nj-morris-pkg-2026-10-17"))

        def outside(_cmd, **_kw):
            class R:
                returncode = 1
            return R()

        with mock.patch.object(mo.nj.subprocess, "run", outside):
            mo.assert_package_outside_git(Path("H:/nj-morris-pkg-2026-10-17"))

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


if __name__ == "__main__":
    unittest.main()
