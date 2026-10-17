"""HB-ENRICH-001 loader unit tests. Synthetic rows only; the publish-ready CSV stays outside git."""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import load  # noqa: E402

CID = "00000000-0000-4000-8000-0000000000a1"
OTHER = "00000000-0000-4000-8000-0000000000a2"
OUTSIDER = "00000000-0000-4000-8000-0000000000a3"


def row(**kw):
    base = {
        "contractor_id": CID,
        "license_key": "CGC0000001",
        "display_name": "Example Builders LLC",
        "website_url": "https://example.test/",
        "phone": "(813) 555-0100 | (813) 555-ALTO; 813-555-0100",
        "email": "jobs@example.test | OFFICE@example.test",
        "primary_address": "1 Example St Tampa FL 33602",
        "additional_locations": "Tampa, FL | 10 Main St, Brandon, FL 33511",
        "specialties": "Roofing | Sheet metal; Gutters",
        "source_refs": "https://example.test/ | https://example.test/contact",
        "scout_confidence": "high",
        "scout_confidence_source": "test",
        "review_flags": "phone_format:vanity_letters",
        "original_label": "publish",
        "decision_ref": "test",
        "check_status": "ok",
    }
    base.update(kw)
    return base


def plan(rows, ok=None):
    holder = load.Plan(rows=rows)
    load.build_observations(rows, holder, ok if ok is not None else {item["contractor_id"] for item in rows}, "sha")
    return holder


def by_field(holder):
    out: dict = {}
    for obs in holder.obs:
        out.setdefault(obs.field, []).append(obs)
    return out


class ConfigTest(unittest.TestCase):
    def test_hillsborough_pin(self):
        self.assertEqual(load.COUNTY, "hb")
        self.assertEqual(load.BATCH_ID, "hb-enrich-001-2026-10-17")
        self.assertEqual(load.SOURCE_SYSTEM, "dot_web_enrich_hb_2026_10")
        self.assertEqual(load.OBSERVED_AT, "2026-10-17T00:00:00-04:00")
        self.assertEqual(load.READY_NAME, "dot-publish-ready-hillsborough-batch1-2026-10-17.csv")
        self.assertEqual(load.READY_SHA, "26125ddde493ebafdf0db9fae174c79816e53e99f3ea1dccb708f819214ca425")
        self.assertEqual(load.READY_ROWS, 680)
        self.assertEqual(load.EXPECTED_FILL, {"website": 680, "phone": 662, "email": 421, "address_location": 282, "specialty": 677})
        self.assertEqual(load.EXPECTED_OBS, {"website": 680, "phone": 835, "email": 506, "address_location": 414, "specialty": 3651})
        self.assertEqual(load.EXPECTED_OBS_TOTAL, 6086)
        self.assertEqual(load.EXPECTED_ACTIONS, {"load": 301, "load_flagged": 378, "load_suppress_email": 1})
        self.assertEqual(load.ROLLBACK_BATCH_RE.pattern, r"^hb-enrich-001-2026-10-17$")
        self.assertEqual(load.GO_PHRASE, "GO CONTRACTOR HILLSBOROUGH ENRICH LOAD")


class SplitTest(unittest.TestCase):
    def test_pipe_semicolon_and_vanity(self):
        holder = plan([row()])
        phones = by_field(holder)["phone"]
        self.assertEqual([obs.value_normalized for obs in phones], ["8135550100", "8135552586"])
        self.assertEqual(phones[1].value, "(813) 555-ALTO")
        self.assertEqual(holder.duplicates_collapsed["phone"], 1)
        self.assertEqual([obs.value_normalized for obs in by_field(holder)["email"]], ["jobs@example.test", "office@example.test"])
        self.assertEqual([obs.value for obs in by_field(holder)["address_location"]],
                         ["Tampa, FL", "10 Main St, Brandon, FL 33511"])
        self.assertEqual([obs.value for obs in by_field(holder)["specialty"]], ["Roofing", "Sheet metal", "Gutters"])
        self.assertEqual(len(by_field(holder)["website"]), 1)
        self.assertNotIn("primary_address", by_field(holder))

    def test_semicolon_inside_parentheses_is_one_phone(self):
        self.assertEqual(load.split_values("phone", "(813) 555-0100 (Tampa; Brandon)"),
                         ["(813) 555-0100 (Tampa; Brandon)"])
        self.assertEqual(load.normalize("phone", "(813) 555-ALTO"), "8135552586")

    def test_empty_cells_skipped(self):
        holder = plan([row(email="", additional_locations="  ")])
        self.assertFalse(any(obs.field in ("email", "address_location") for obs in holder.obs))

    def test_non_http_website_hard_stops(self):
        with self.assertRaises(SystemExit):
            plan([row(website_url="ftp://example.test")])


class SuppressionAndScopeTest(unittest.TestCase):
    def test_nxdomain_email_is_suppressed_and_other_fields_publish(self):
        holder = plan([row(review_flags="email_undeliverable:nxdomain")])
        emails = by_field(holder)["email"]
        self.assertTrue(all(obs.is_suppressed for obs in emails))
        self.assertEqual(emails[0].suppression_reason, "email_cannot_receive_mail:email_undeliverable:nxdomain")
        self.assertTrue(all(not obs.is_suppressed for obs in holder.obs if obs.field != "email"))

    def test_no_mx_fallback_stays_deliverable(self):
        holder = plan([row(review_flags="email_mx:no_mx_a_fallback")])
        self.assertTrue(all(not obs.is_suppressed for obs in by_field(holder)["email"]))

    def test_ids_outside_the_ready_file_get_zero_rows(self):
        ready = {CID}
        suspended = row(contractor_id=OUTSIDER, license_key="CGC0000099", review_flags="suspended")
        kept = load.rows_for_ready([row(), suspended], ready)
        self.assertEqual([item["contractor_id"] for item in kept], [CID])
        holder = plan(kept)
        self.assertEqual([obs for obs in holder.obs if obs.contractor_id == OUTSIDER], [])
        self.assertEqual(plan([row()], ok=set()).obs, [])

    def test_classification_counts_the_suppressed_email_row(self):
        self.assertEqual(load.classify_row(row(review_flags="")), "load")
        self.assertEqual(load.classify_row(row()), "load_flagged")
        self.assertEqual(load.classify_row(row(review_flags="email_undeliverable:nxdomain")), "load_suppress_email")
        self.assertEqual(load.classify_row(row(review_flags="email_undeliverable:null_mx")), "load_suppress_email")
        self.assertEqual(load.classify_row(row(review_flags="field_check_failed:email_not_on_live_site")), "load_suppress_email")


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
            return Result([(cid, key) for cid, key in self.licenses])
        return Result([(key, cid) for cid, key in self.licenses])


class IdentityTest(unittest.TestCase):
    def gate(self, contractors, licenses, rows):
        holder = load.Plan(rows=rows)
        ok = load.identity_gate(FakeConn(contractors, licenses), rows, holder)
        return ok, {item["contractor_id"]: item["reason"] for item in holder.excluded}

    def test_exact_florida_identity(self):
        ok, excluded = self.gate([(CID, None, None, "FL")], [(CID, "CGC0000001")], [row()])
        self.assertEqual((ok, excluded), ({CID}, {}))

    def test_failure_reasons(self):
        self.assertEqual(self.gate([], [], [row()])[1], {CID: "contractor_id_missing"})
        self.assertEqual(self.gate([(CID, None, None, "NJ")], [(CID, "CGC0000001")], [row()])[1], {CID: "not_fl"})
        self.assertEqual(self.gate([(CID, None, None, "FL")], [(CID, "CGC9999999")], [row()])[1], {CID: "license_key_mismatch"})
        self.assertEqual(self.gate([(CID, None, None, "FL")], [(CID, "CGC0000001"), (OTHER, "CGC0000001")], [row()])[1],
                         {CID: "license_key_owned_by_other_contractor"})

    def test_existing_canonical_is_a_conflict_record(self):
        holder = load.Plan(rows=[row()])
        load.identity_gate(FakeConn([(CID, "8135550199", None, "FL")], [(CID, "CGC0000001")]), [row()], holder)
        self.assertEqual([item["column"] for item in holder.conflicts], ["contractors.phone"])
        self.assertNotIn("8135550199", str(holder.conflicts))


class IdempotencyAndRollbackTest(unittest.TestCase):
    def test_plan_is_deterministic_and_unique(self):
        first, second = plan([row()]), plan([row()])
        keys = [(obs.contractor_id, obs.field, obs.value_normalized, load.BATCH_ID) for obs in first.obs]
        self.assertEqual(keys, [(obs.contractor_id, obs.field, obs.value_normalized, load.BATCH_ID) for obs in second.obs])
        self.assertEqual(len(keys), len(set(keys)))

    def test_insert_is_on_conflict_do_nothing(self):
        source = Path(load.__file__).read_text(encoding="utf-8")
        self.assertIn("ON CONFLICT ON CONSTRAINT contractor_enrichment_observations_idem DO NOTHING", source)

    def test_rollback_cannot_touch_prior_fl_or_nj_batches(self):
        load.rollback_guard(load.BATCH_ID, load.SOURCE_SYSTEM)
        self.assertEqual(
            load.rollback_sql(),
            "DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_hb_2026_10' "
            "AND batch_id = 'hb-enrich-001-2026-10-17';",
        )
        for batch in load.PROTECTED_BATCHES:
            self.assertIsNone(load.ROLLBACK_BATCH_RE.match(batch))
            with self.assertRaises(SystemExit):
                load.rollback_guard(batch, load.SOURCE_SYSTEM)
        for source in load.PROTECTED_SOURCE_SYSTEMS:
            with self.assertRaises(SystemExit):
                load.rollback_guard(load.BATCH_ID, source)
        for bad in ("hb-enrich-001-2026-10-17-extra", "hb-enrich-001-2026-10-1", "md-enrich-001-2026-10-06", "%", ""):
            self.assertIsNone(load.ROLLBACK_BATCH_RE.match(bad))

    def test_apply_refuses_without_the_founder_phrase(self):
        previous = load.os.environ.pop(load.GO_ENV, None)
        try:
            with self.assertRaises(SystemExit):
                load.require_go()
        finally:
            if previous is not None:
                load.os.environ[load.GO_ENV] = previous

    def test_package_inside_this_worktree_is_refused(self):
        with self.assertRaises(SystemExit):
            load.assert_outside_git(load.ROOT)
        with self.assertRaises(SystemExit):
            load.assert_outside_git(load.ROOT / "scripts")


class PreservedLoadersTest(unittest.TestCase):
    def test_miami_dade_loader_behavior_is_unchanged(self):
        from scripts.md_enrich_001 import load as md

        self.assertEqual(md.SOURCE_SYSTEM, "scout_web_enrich_md_2026_10")
        self.assertEqual(md.DEFAULT_BATCH_ID, "md-enrich-001-2026-10-06")
        self.assertEqual(md.split_values("phone", "813-555-0100;813-555-0101"), ["813-555-0100", "813-555-0101"])
        self.assertEqual(md.split_values("email", "a@example.test | b@example.test"), ["a@example.test | b@example.test"])
        self.assertEqual(md._county_arg(["--input-dir", "x"]), None)
        self.assertEqual(md._county_arg(["--county", "hb"]), "hb")
        self.assertEqual(len(md.SUPPRESSED_LICENSES), 8)

    def test_nj_loader_behavior_is_unchanged(self):
        from scripts.nj_enrich_001 import load as nj

        self.assertEqual(nj.ROLLBACK_BATCH_RE.pattern, r"^(bg|mx|mn|un)-enrich-001-2026-10-12$")
        self.assertEqual(set(nj.COUNTIES), {"bg", "mx", "mn", "un"})
        for batch in ("bw-enrich-001-2026-10-08", "pb-enrich-001-2026-10-08", "pn-enrich-001-2026-10-08",
                      "md-enrich-001-2026-10-06", "md-enrich-002-2026-10-07"):
            self.assertIn(batch, nj.EXISTING_BATCHES)
            self.assertIsNone(nj.ROLLBACK_BATCH_RE.match(batch))


class NoContactInGitTest(unittest.TestCase):
    def test_loader_source_has_no_email_and_csv_is_absent(self):
        source = Path(load.__file__).read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", source))
        sql = (load.ROOT / "scripts" / "sql" / "hb-enrich-001-rollback.sql").read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", sql))
        self.assertIn(load.BATCH_ID, sql)
        found = [path for path in (load.ROOT / "scripts").rglob("*") if path.name == load.READY_NAME]
        self.assertEqual(found, [])
        gitignore = (load.ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("*handoff-1017*", gitignore)
        self.assertIn("*dot-enrich-handoff*", gitignore)


if __name__ == "__main__":
    unittest.main()
