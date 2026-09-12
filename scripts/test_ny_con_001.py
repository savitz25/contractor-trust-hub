"""NY-CON-001A New York public-work registry invariants."""
from __future__ import annotations

import copy
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/new-york-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
ACQ = json.loads((ROOT / "data/new-york/ny-con-001/acquire-report.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/new-york-intelligence/publication.ts").read_text(encoding="utf-8")
UI = (ROOT / "components/new-york/ny-state-intel-page.tsx").read_text(encoding="utf-8")
PAGE = (ROOT / "app/new-york/page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
HEADER = (ROOT / "lib/nav/header-nav.ts").read_text(encoding="utf-8")
CLAIM = (ROOT / "lib/claim/eligibility.ts").read_text(encoding="utf-8")
JSONLD = (ROOT / "lib/new-york-intelligence/jsonld.ts").read_text(encoding="utf-8")
INTERPRET = (ROOT / "lib/ask/interpret.ts").read_text(encoding="utf-8")
FINGERPRINT = "27f39aad84544a1ecfb4db74934ddbac55f94bd087b2a9cf3b5de20305685f14"
OLD_FINGERPRINT = "fac09b35e5329c3f55e2b2baea5554e22bc3814dd4f0fd4762e97df657ec1de6"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    out = {}
    for key, value in body.items():
        if key in {"fingerprint", "generated_at"}:
            continue
        if key == "clocks" and isinstance(value, dict):
            out[key] = {ck: cv for ck, cv in value.items() if ck != "generatedAt"}
        else:
            out[key] = value
    return hashlib.sha256(dump(out).encode("utf-8")).hexdigest()


class SourceTests(unittest.TestCase):
    def test_official_bulk_acquired(self):
        self.assertEqual(ACQ["dataset_id"], "i4jv-zkey")
        self.assertEqual(ACQ["http_status"], 200)
        self.assertEqual(ACQ["raw_sha256"], SNAP["registry"]["raw_sha256"])
        self.assertEqual(len(ACQ["raw_sha256"]), 64)
        self.assertGreater(ACQ["raw_bytes"], 1_000_000)
        self.assertTrue(ACQ["no_tableau_reverse_engineer"])
        self.assertTrue(ACQ["no_nyc_local_acquisition"])
        self.assertEqual(ACQ["raw_sha256"], "4070cf175286d2fcbbfa260c8e34fa7d2ba62746e8b219b0dfff3c48bd203ecb")
        self.assertEqual(ACQ["retrievedAt"], "2026-09-11")
        self.assertEqual(ACQ["retrievedAt_precision"], "date")
        self.assertTrue(ACQ["acquisition_frozen"])
        self.assertEqual(ACQ["mold_bulk"], "SOURCE_NOT_ACQUIRED")
        self.assertEqual(ACQ["asbestos_bulk"], "SOURCE_NOT_ACQUIRED")
        self.assertEqual(ACQ["edlist_bulk"], "SOURCE_NOT_ACQUIRED")


class GrainTests(unittest.TestCase):
    def test_registry_not_statewide_gc_or_hic(self):
        self.assertTrue(SNAP["not_statewide_gc_or_hic_license"])
        self.assertTrue(SNAP["not_all_new_york_contractors"])
        self.assertTrue(SNAP["registry"]["not_statewide_gc"])
        self.assertTrue(SNAP["registry"]["not_residential_hic_roster"])
        self.assertTrue(SNAP["registry"]["absence_ne_illegal_residential_contractor"])
        compact = " ".join(UI.lower().split())
        self.assertIn("not a statewide general-contractor license", compact)
        self.assertIn("not automatically unlicensed", compact)

    def test_jurisdiction_ne_address(self):
        self.assertTrue(SNAP["geography"]["registration_jurisdiction_ne_business_address"])
        self.assertTrue(SNAP["geography"]["did_not_filter_to_ny_addresses"])
        self.assertEqual(SNAP["geography"]["ny_mailing_address_rows"], 12352)
        self.assertEqual(SNAP["geography"]["out_of_state_mailing_address_rows"], 2299)
        self.assertGreater(SNAP["geography"]["out_of_state_mailing_address_rows"], 0)
        self.assertNotEqual(SNAP["hero"]["universe_value"], SNAP["hero"]["ny_address_value"])

    def test_application_ne_certificate_and_source_status(self):
        self.assertTrue(SNAP["registry"]["application_ne_certificate"])
        self.assertTrue(SNAP["registry"]["status_is_source_native"])
        self.assertTrue(SNAP["registry"]["did_not_manufacture_active_from_dates"])
        self.assertTrue(SNAP["registry"]["all_source_status_active"])
        self.assertEqual(SNAP["registry"]["source_status_counts"]["Active"], 14665)

    def test_row_ne_unique_org_and_ids(self):
        self.assertTrue(SNAP["identity"]["certificate_ne_unique_legal_organization"])
        self.assertEqual(SNAP["identity"]["namespace"], "NY-DOL-PW:{certificateNumber}")
        self.assertEqual(SNAP["registry"]["parsed_rows"], 14665)
        self.assertEqual(SNAP["registry"]["distinct_certificate_ids"], 14665)
        self.assertEqual(SNAP["registry"]["rows_without_certificate_id"], 0)
        self.assertEqual(SNAP["registry"]["identifier_conflicts"], 0)
        self.assertTrue(SNAP["identity"]["blank_id_mints_no_identity"])
        self.assertTrue(SNAP["identity"]["conflicting_id_does_not_merge_subjects"])

    def test_specialty_not_summed(self):
        self.assertIsNone(SNAP["expansion_ledger"]["NY_MOLD_BUSINESS_LICENSE_ROWS"])
        self.assertIsNone(SNAP["expansion_ledger"]["NY_ASBESTOS_CONTRACTOR_LICENSE_ROWS"])
        self.assertEqual(SNAP["mold"]["result"], "SOURCE_NOT_ACQUIRED")
        self.assertEqual(SNAP["asbestos"]["result"], "SOURCE_NOT_ACQUIRED")
        self.assertTrue(SNAP["mold"]["business_license_ne_individual_credential"])
        self.assertTrue(SNAP["asbestos"]["contractor_license_ne_individual_certificate_of_competence"])
        self.assertNotIn("14,665 mold", UI.lower())

    def test_debarment_scope(self):
        self.assertEqual(SNAP["debarment"]["edlist_coverage"], "OPEN_SEARCH_ONLY")
        self.assertEqual(SNAP["debarment"]["registry_field_has_been_debarred_yes"], 36)
        self.assertEqual(SNAP["debarment"]["registry_debarment_period_ended_before_snapshot"], 36)
        self.assertEqual(SNAP["debarment"]["registry_debarment_current_by_end_date"], 0)
        self.assertTrue(SNAP["debarment"]["historical_ne_current"])
        self.assertTrue(SNAP["debarment"]["debarment_ne_criminal_conviction"])
        self.assertEqual(SNAP["debarment"]["name_only_attachment"], "UNSAFE")
        self.assertEqual(SNAP["debarment"]["exact_profile_attachments"], 0)

    def test_name_only_and_missing_not_zero(self):
        self.assertEqual(SNAP["identity"]["name_only"], "UNSAFE")
        self.assertEqual(SNAP["mold"]["coverage_state"], "OPEN_SEARCH_ONLY")
        self.assertNotEqual(SNAP["mold"]["result"], 0)
        self.assertIsNone(SNAP["expansion_ledger"]["NY_MOLD_BUSINESS_LICENSE_ROWS"])

    def test_no_local_and_claim(self):
        self.assertTrue(SNAP["no_local_new_york_routes"])
        self.assertIn("NOT_STARTED", SNAP["nyc_phase"])
        self.assertFalse((ROOT / "app/new-york/manhattan").exists())
        self.assertFalse((ROOT / "app/new-york/brooklyn").exists())
        self.assertFalse((ROOT / "app/new-york/queens").exists())
        self.assertFalse((ROOT / "app/new-york/bronx").exists())
        self.assertFalse((ROOT / "app/new-york/staten-island").exists())
        self.assertTrue((ROOT / "app/new-york/new-york-city").exists())
        self.assertIn("/new-york/new-york-city", SITEMAP)
        self.assertNotIn("/new-york/manhattan", SITEMAP)
        self.assertIn("/new-york", SITEMAP)
        self.assertIn('href: "/new-york"', HEADER)
        self.assertNotIn("ny_dol", CLAIM)
        self.assertNotIn("NY-DOL-PW", CLAIM)
        self.assertFalse(SNAP["claim_eligibility"]["broadened"])
        self.assertEqual(SNAP["expansion_ledger"]["EXISTING_ORGANIZATIONS_ENRICHED"], 0)
        self.assertTrue(SNAP["expansion_ledger"]["pre_existing_ny_overlay_ne_enrichment"])

    def test_featured_metrics_rendered(self):
        self.assertEqual(SNAP["hero"]["universe_value"], 14665)
        self.assertIn("s.hero.universe_value", UI)
        self.assertIn("s.hero.distinct_ids_value", UI)
        self.assertIn("s.hero.universe_label", UI)
        self.assertIn("Do not add specialty licenses", UI)
        self.assertIn("robotsIndex: true", PUB)
        self.assertIn("NEW_YORK_INTELLIGENCE_GATE", PAGE)

    def test_fingerprint_twice_and_mutations(self):
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertEqual(fingerprint(SNAP), FINGERPRINT)
        self.assertEqual(fingerprint(SNAP), fingerprint(SNAP))
        self.assertIn(FINGERPRINT, PUB)
        mut = copy.deepcopy(SNAP)
        mut["registry"]["parsed_rows"] = 1
        self.assertNotEqual(fingerprint(mut), FINGERPRINT)
        mut2 = copy.deepcopy(SNAP)
        mut2["geography"]["did_not_filter_to_ny_addresses"] = False
        self.assertNotEqual(fingerprint(mut2), FINGERPRINT)
        mut3 = copy.deepcopy(SNAP)
        mut3["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"] = 1
        self.assertNotEqual(fingerprint(mut3), FINGERPRINT)
        mut4 = copy.deepcopy(SNAP)
        mut4["mold"]["result"] = 0
        self.assertNotEqual(fingerprint(mut4), FINGERPRINT)
        self.assertIn("WebPage", JSONLD)
        self.assertIn("nyJsonLdHasForbiddenRatings", JSONLD)
        ny_ask = (ROOT / "lib/ask/ny-public-work.ts").read_text(encoding="utf-8")
        self.assertIn("ny-pw-registry-aggregate", ny_ask)
        self.assertIn("does not assume New York", ny_ask)
        self.assertNotIn('href: ny ? "/new-york" : "/new-york"', INTERPRET)
        mut5 = copy.deepcopy(SNAP)
        mut5["clocks"]["sourceAsOf"] = "1999-01-01"
        self.assertNotEqual(fingerprint(mut5), FINGERPRINT)
        mut6 = copy.deepcopy(SNAP)
        mut6["identity"]["namespace"] = "OTHER"
        self.assertNotEqual(fingerprint(mut6), FINGERPRINT)
        mut7 = copy.deepcopy(SNAP)
        mut7["registry"]["coverage_state"] = "OPEN_SEARCH_ONLY"
        self.assertNotEqual(fingerprint(mut7), FINGERPRINT)
        mut8 = copy.deepcopy(SNAP)
        mut8["expansion_ledger"]["NY_PW_REGISTRY_ROWS"] = 1
        self.assertNotEqual(fingerprint(mut8), FINGERPRINT)
        self.assertNotEqual(FINGERPRINT, OLD_FINGERPRINT)

    def test_independent_rebuild_ignores_generation_time(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "ny_build", ROOT / "scripts" / "new-york" / "build_ny_con_001_snapshot.py"
        )
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        first = dict(SNAP)
        second = copy.deepcopy(SNAP)
        second["generated_at"] = "2099-01-01T00:00:00Z"
        second["clocks"] = dict(SNAP["clocks"])
        second["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(mod.fingerprint(first), FINGERPRINT)
        self.assertEqual(mod.fingerprint(second), FINGERPRINT)
        self.assertEqual(ACQ["raw_sha256"], "4070cf175286d2fcbbfa260c8e34fa7d2ba62746e8b219b0dfff3c48bd203ecb")
        self.assertTrue(ACQ["acquisition_frozen"])
        self.assertEqual(SNAP["clocks"]["retrievedAt"], "2026-09-11")
        self.assertEqual(SNAP["clocks"]["snapshotAsOf"], "2026-09-11")
        self.assertEqual(SNAP["debarment"]["registry_field_has_been_debarred_yes"], 36)
        self.assertEqual(SNAP["debarment"]["registry_debarment_current_by_end_date"], 0)
        self.assertTrue(SNAP["debarment"]["do_not_infer_zero_currently_debarred_contractors"])
        self.assertEqual(SNAP["expansion_ledger"]["NET_NEW_STATE_RESEARCH_IDENTITIES"], 14665)
        self.assertEqual(SNAP["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"], 0)


if __name__ == "__main__":
    unittest.main()
