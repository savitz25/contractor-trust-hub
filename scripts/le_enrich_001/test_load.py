"""LE-ENRICH-001 loader unit tests. Synthetic rows only; the publish-ready CSV stays outside git."""
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
    def test_lee_pin(self):
        self.assertEqual(load.COUNTY, "le")
        self.assertEqual(load.BATCH_ID, "le-enrich-001-2026-10-17")
        self.assertEqual(load.SOURCE_SYSTEM, "dot_web_enrich_le_2026_10")
        self.assertEqual(load.OBSERVED_AT, "2026-10-17T00:00:00-04:00")
        self.assertEqual(load.READY_NAME, "dot-publish-ready-lee-batch1-2026-10-17.csv")
        self.assertEqual(load.READY_SHA, "a08a2e219511b0093c60085c926e3d1a8fa548c025f5044b9d069f9ba6e82a31")
        self.assertEqual(load.READY_ROWS, 773)
        self.assertEqual(load.EXPECTED_FILL, {"website": 773, "phone": 751, "email": 502, "address_location": 301, "specialty": 771})
        self.assertEqual(load.EXPECTED_OBS, {"website": 773, "phone": 862, "email": 547, "address_location": 322, "specialty": 3751})
        self.assertEqual(load.EXPECTED_OBS_TOTAL, 6255)
        self.assertEqual(load.EXPECTED_ACTIONS, {"load": 392, "load_flagged": 381, "load_suppress_email": 0})
        self.assertEqual(load.ROLLBACK_BATCH_RE.pattern, r"^le-enrich-001-2026-10-17$")
        self.assertEqual(load.GO_PHRASE, "GO CONTRACTOR LEE ENRICH LOAD")
        self.assertEqual(load.GO_ENV, "CONTRACTOR_LEE_GO")
        for protected in (
            "hb-enrich-001-2026-10-17",
            "mo-enrich-001-2026-10-17",
            "ps-enrich-001-2026-10-17",
            "or-enrich-001-2026-10-17",
            "bu-enrich-001-2026-10-17",
        ):
            self.assertIn(protected, load.PROTECTED_BATCHES)
            self.assertIsNone(load.ROLLBACK_BATCH_RE.match(protected))
        self.assertEqual(load.EXPECTED_FLAGS["website_shared_with_other_roster_row"], 138)
        self.assertEqual(load.EXPECTED_FLAGS["email_mx:no_mx_a_fallback"], 3)


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
            "DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_le_2026_10' "
            "AND batch_id = 'le-enrich-001-2026-10-17';",
        )
        for batch in load.PROTECTED_BATCHES:
            self.assertIsNone(load.ROLLBACK_BATCH_RE.match(batch))
            with self.assertRaises(SystemExit):
                load.rollback_guard(batch, load.SOURCE_SYSTEM)
        for source in load.PROTECTED_SOURCE_SYSTEMS:
            with self.assertRaises(SystemExit):
                load.rollback_guard(load.BATCH_ID, source)
        for bad in ("le-enrich-001-2026-10-17-extra", "le-enrich-001-2026-10-1", "md-enrich-001-2026-10-06", "%", ""):
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
        self.assertEqual(md._county_arg(["--county", "le"]), "le")
        self.assertEqual(md._county_arg(["--county", "hb"]), "hb")
        self.assertEqual(len(md.SUPPRESSED_LICENSES), 8)
        source = Path(md.__file__).read_text(encoding="utf-8")
        self.assertIn('== "le"', source)
        self.assertNotIn("hb_enrich_001", source)
        self.assertNotIn("nj_enrich_003", source)

    def test_nj_loader_behavior_is_unchanged(self):
        from scripts.nj_enrich_001 import load as nj

        self.assertEqual(nj.ROLLBACK_BATCH_RE.pattern, r"^(bg|mx|mn|un)-enrich-001-2026-10-12$")
        self.assertEqual(set(nj.COUNTIES), {"bg", "mx", "mn", "un"})
        for batch in ("bw-enrich-001-2026-10-08", "pb-enrich-001-2026-10-08", "pn-enrich-001-2026-10-08",
                      "md-enrich-001-2026-10-06", "md-enrich-002-2026-10-07"):
            self.assertIn(batch, nj.EXISTING_BATCHES)
            self.assertIsNone(nj.ROLLBACK_BATCH_RE.match(batch))


PROTECTED_FIXTURE = (
    ("dot_web_enrich_bg_2026_10", "bg-enrich-001-2026-10-12", 8540),
    ("dot_web_enrich_bw_2026_10", "bw-enrich-001-2026-10-08", 15512),
    ("dot_web_enrich_bu_2026_10", "bu-enrich-001-2026-10-17", 3216),
    ("dot_web_enrich_hb_2026_10", "hb-enrich-001-2026-10-17", 6086),
    ("scout_web_enrich_md_2026_10", "md-enrich-001-2026-10-06", 11691),
    ("dot_web_enrich_md_2026_10", "md-enrich-002-2026-10-07", 16623),
    ("dot_web_enrich_mn_2026_10", "mn-enrich-001-2026-10-12", 7853),
    ("dot_web_enrich_mo_2026_10", "mo-enrich-001-2026-10-17", 4862),
    ("dot_web_enrich_mx_2026_10", "mx-enrich-001-2026-10-12", 4901),
    ("dot_web_enrich_or_2026_10", "or-enrich-001-2026-10-17", 0),
    ("dot_web_enrich_pb_2026_10", "pb-enrich-001-2026-10-08", 15093),
    ("dot_web_enrich_pn_2026_10", "pn-enrich-001-2026-10-08", 11088),
    ("dot_web_enrich_ps_2026_10", "ps-enrich-001-2026-10-17", 3536),
    ("dot_web_enrich_un_2026_10", "un-enrich-001-2026-10-12", 3574),
)


def protected_snapshot(overrides=None):
    overrides = overrides or {}
    rows = [
        {"source_system": source, "batch_id": batch, "rows": overrides.get(batch, count)}
        for source, batch, count in PROTECTED_FIXTURE
    ]
    rows.sort(key=lambda item: (item["batch_id"], item["source_system"]))
    return rows


def le_group(rows):
    return {"source_system": load.SOURCE_SYSTEM, "batch_id": load.BATCH_ID, "rows": rows}


def with_lee(rows):
    combined = protected_snapshot() + [le_group(rows)]
    combined.sort(key=lambda item: (item["batch_id"], item["source_system"]))
    return combined


class PostCommitVerificationTest(unittest.TestCase):
    def test_dry_run_passes_when_lee_stays_zero(self):
        before = protected_snapshot()
        self.assertEqual({row["batch_id"] for row in before}, set(load.PROTECTED_BATCHES))
        load.assert_post_commit_counts(apply=False, before=before, after=protected_snapshot(), le_before=0, le_after=0)
        mutated = protected_snapshot({"bg-enrich-001-2026-10-12": 8541})
        with self.assertRaises(SystemExit) as changed:
            load.assert_post_commit_counts(apply=False, before=before, after=mutated, le_before=0, le_after=0)
        self.assertEqual(changed.exception.code, "HARD STOP: enrichment batch counts changed during the read-only dry run")
        with self.assertRaises(SystemExit) as lee:
            load.assert_post_commit_counts(apply=False, before=before, after=protected_snapshot(), le_before=0, le_after=1)
        self.assertEqual(lee.exception.code, "HARD STOP: Lee batch count changed during the read-only dry run")
        with self.assertRaises(SystemExit):
            load.assert_post_commit_counts(
                apply=False, before=before, after=with_lee(load.EXPECTED_OBS_TOTAL), le_before=0, le_after=load.EXPECTED_OBS_TOTAL)

    def test_apply_passes_when_lee_reaches_6255_and_protected_batches_stay(self):
        before = protected_snapshot()
        after = with_lee(load.EXPECTED_OBS_TOTAL)
        load.assert_post_commit_counts(
            apply=True, before=before, after=after, le_before=0, le_after=load.EXPECTED_OBS_TOTAL)
        stray = after + [{"source_system": "other_source", "batch_id": load.BATCH_ID, "rows": 1}]
        with self.assertRaises(SystemExit) as foreign:
            load.assert_post_commit_counts(
                apply=True, before=before, after=stray, le_before=0, le_after=load.EXPECTED_OBS_TOTAL)
        self.assertEqual(foreign.exception.code, "HARD STOP: Lee batch is not limited to its source_system and batch_id")

    def test_apply_fails_when_lee_post_count_is_not_6255(self):
        before = protected_snapshot()
        for wrong in (0, 6254, 6256):
            with self.assertRaises(SystemExit) as caught:
                load.assert_post_commit_counts(
                    apply=True, before=before, after=with_lee(wrong), le_before=0, le_after=wrong)
            self.assertEqual(caught.exception.code, "HARD STOP: Lee post-commit count differs from EXPECTED_OBS_TOTAL")

    def test_apply_fails_when_any_protected_batch_changes(self):
        before = protected_snapshot()
        counts = {batch: count for _source, batch, count in PROTECTED_FIXTURE}
        for batch in load.PROTECTED_BATCHES:
            changed = with_lee(load.EXPECTED_OBS_TOTAL)
            for row in changed:
                if row["batch_id"] == batch:
                    row["rows"] = counts[batch] + 1
            with self.assertRaises(SystemExit) as caught:
                load.assert_post_commit_counts(
                    apply=True, before=before, after=changed, le_before=0, le_after=load.EXPECTED_OBS_TOTAL)
            self.assertEqual(caught.exception.code, "HARD STOP: a protected enrichment batch count changed")

    def test_second_planner_run_proposes_zero_inserts(self):
        first = plan([row()])
        present = {(obs.contractor_id, obs.field, obs.value_normalized, load.BATCH_ID) for obs in first.obs}
        self.assertGreater(len(present), 0)
        second = plan([row()])
        self.assertEqual(load.proposed_inserts(second.obs, present), [])


class NoContactInGitTest(unittest.TestCase):
    def test_loader_source_has_no_email_and_csv_is_absent(self):
        source = Path(load.__file__).read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", source))
        self.assertIn("jhjztnisugdsuliriajp", source)
        sql = (load.ROOT / "scripts" / "sql" / "le-enrich-001-rollback.sql").read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", sql))
        self.assertIn(load.BATCH_ID, sql)
        found = [path for path in (load.ROOT / "scripts").rglob("*") if path.name == load.READY_NAME]
        self.assertEqual(found, [])
        gitignore = (load.ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("*handoff-1017*", gitignore)
        self.assertIn("*dot-enrich-handoff*", gitignore)
        self.assertIn("*trusthub-pkg*", gitignore)


if __name__ == "__main__":
    unittest.main()
