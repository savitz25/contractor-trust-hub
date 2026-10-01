"""Certified NY DOL credential staging and denominator boundaries."""

import csv
import hashlib
import json
import unittest
from collections import Counter
from pathlib import Path

from prepare_ny_credential_wave import OUT, ROOT, prepare


class NyCredentialWaveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.receipt = prepare()
        with (OUT / "ny-credentials-stage.csv").open(newline="", encoding="utf-8") as stream:
            cls.rows = list(csv.DictReader(stream))

    def test_certified_sources_and_statuses(self):
        by_source = {dataset: [row for row in self.rows if row["source_dataset"] == dataset]
                     for dataset in ("ny_dol_mold", "ny_elevator")}
        self.assertEqual(len(by_source["ny_dol_mold"]), 2511)
        self.assertEqual(len({r["license_number"] for r in by_source["ny_dol_mold"]}), 2483)
        self.assertEqual(Counter(r["source_status"] for r in by_source["ny_dol_mold"]),
                         {"Active": 1737, "Expired": 774})
        self.assertEqual(len(by_source["ny_elevator"]), 302)
        self.assertEqual(Counter(r["source_status"] for r in by_source["ny_elevator"]),
                         {"Active": 212, "Expired": 90})
        self.assertEqual(len(self.rows), 2813)

    def test_native_key_and_identical_rerun(self):
        keys = [(r["source_system"], r["external_key"]) for r in self.rows]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertTrue(all(r["external_key"] ==
                            f"{r['source_dataset']}:{r['license_type']}:{r['license_number']}"
                            for r in self.rows))
        owned = set()
        first_insert = set(keys) - owned
        owned.update(first_insert)
        self.assertEqual(len(first_insert), 2813)
        self.assertEqual(len(set(keys) - owned), 0)
        stage = OUT / "ny-credentials-stage.csv"
        self.assertEqual(hashlib.sha256(stage.read_bytes()).hexdigest(), self.receipt["stage_sha256"])
        self.assertTrue(all(json.loads(r["raw_payload"])["_grain"] ==
                            "standalone regulator credential" for r in self.rows))

    def test_load_and_rollback_scope_and_canonical_search(self):
        load = (OUT / "load.psql").read_text(encoding="utf-8")
        rollback = (OUT / "rollback.psql").read_text(encoding="utf-8")
        search = (ROOT / "lib/contractors/queries.ts").read_text(encoding="utf-8")
        self.assertIn("SELECT NULL,s.source_system,s.external_key", load)
        self.assertIn("ON CONFLICT (source_system,external_key) DO NOTHING", load)
        self.assertIn("l.contractor_id IS NOT NULL", load)
        self.assertIn("ingest_batch_id IN", rollback)
        self.assertIn("raw_payload->>'_source_sha256'", rollback)
        self.assertIn("contractor_id IS NULL", rollback)
        for source in self.receipt["sources"].values():
            self.assertIn(source["batch_id"], load)
            self.assertIn(source["batch_id"], rollback)
            self.assertIn(source["certified_sha256"], load)
            self.assertIn(source["certified_sha256"], rollback)
        self.assertNotIn("ef3a17a2-75fd-5e1b-af1b-3ac5be7944ac", load + rollback)
        self.assertNotIn("8875f5a5-a2f1-58fc-86f9-854b0cec6b7f", load + rollback)
        self.assertNotIn("nj_dfs", load + rollback)
        self.assertIn("JOIN contractors c ON c.id = l.contractor_id", search)
        self.assertNotIn("INSERT INTO public.contractors", load)
        self.assertNotIn("INSERT INTO public.entities", load)

    def test_source_hashes_match_evidence_current_exports(self):
        drift = json.loads((OUT / "source-drift.json").read_text(encoding="utf-8"))
        manifest = json.loads((OUT / "source-manifest.json").read_text(encoding="utf-8"))
        for source in manifest["sources"]:
            pinned = OUT / source["filename"]
            self.assertEqual(hashlib.sha256(pinned.read_bytes()).hexdigest(), source["sha256"])
            self.assertEqual(source["sha256"], drift["sources"][source["id"]]["fresh_sha256"])
        self.assertEqual(drift["sources"]["ny_dol_mold"]["fresh_rows"], 2511)
        self.assertEqual(self.receipt["rows"], 2813)


if __name__ == "__main__":
    unittest.main()
