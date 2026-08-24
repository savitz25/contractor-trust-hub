from __future__ import annotations

import random
import tempfile
import unittest
from pathlib import Path

from ingest.regulatory.fl_dfs_stop_work import (
    FIELDS, build_contract, normalized_snapshot_fingerprint, parse_snapshot,
    semantic_assertions,
)


def html_report(rows, *, wrapper=""):
    header="".join(f"<th>{x}</th>" for x in FIELDS)
    body="".join("<tr>"+"".join(f"<td>{v}</td>" for v in row)+"</tr>" for row in rows)
    return f"<html><body>{wrapper}<table><tr>{header}</tr>{body}</table></body></html>"


ROW=("ACME LLC","LEON","TALLAHASSEE","1/2/2020","2/3/2020","Not Reinstated","FAILURE TO OBTAIN COVERAGE")
ROW2=("BETA INC","ORANGE","ORLANDO","3/4/2021","4/5/2021","5/6/2021","SITE SPECIFIC")


class StopWorkTests(unittest.TestCase):
    def parse(self, text):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"report.html"; path.write_text(text,encoding="utf-8")
            return parse_snapshot(path)

    def test_row_order_wrapper_and_occurrence_identity_invariance(self):
        rows1,_=self.parse(html_report([ROW,ROW2,ROW],wrapper="<p>layout one</p>"))
        rows2,_=self.parse(html_report([ROW,ROW,ROW2],wrapper="<div>layout two</div>"))
        self.assertEqual(normalized_snapshot_fingerprint(rows1),normalized_snapshot_fingerprint(rows2))
        one,e1=build_contract(rows1,"2026-08-24T20:09:45Z",{"bytes":1,"raw_sha256":"sha256:"+"a"*64,"schema_fingerprint":"test"})
        two,e2=build_contract(rows2,"2026-08-24T20:09:45Z",{"bytes":1,"raw_sha256":"sha256:"+"a"*64,"schema_fingerprint":"test"})
        self.assertEqual(one,two); self.assertEqual(e1,e2)
        self.assertEqual(sorted(x["multiplicity"] for x in e1),[1,2])

    def test_true_value_change_changes_snapshot(self):
        rows1,_=self.parse(html_report([ROW]))
        changed=(*ROW[:-1],"SITE SPECIFIC")
        rows2,_=self.parse(html_report([changed]))
        self.assertNotEqual(normalized_snapshot_fingerprint(rows1),normalized_snapshot_fingerprint(rows2))

    def test_unknown_reason_fails_closed(self):
        with self.assertRaisesRegex(ValueError,"SEMANTIC_SOURCE_DRIFT"):
            self.parse(html_report([(*ROW[:-1],"NEW REASON")]))

    def test_schema_and_duplicate_header_fail_closed(self):
        bad=list(FIELDS); bad[-1]="Changed Meaning"
        text="<table><tr>"+"".join(f"<th>{x}</th>" for x in bad)+"</tr></table>"
        with self.assertRaisesRegex(ValueError,"schema"):
            self.parse(text)
        header="".join(f"<th>{x}</th>" for x in FIELDS)
        with self.assertRaisesRegex(ValueError,"header count"):
            self.parse(f"<table><tr>{header}</tr><tr>{header}</tr></table>")

    def test_bad_date_fails_closed(self):
        bad=(ROW[0],ROW[1],ROW[2],"2020-01-02",*ROW[4:])
        with self.assertRaisesRegex(ValueError,"date shape"):
            self.parse(html_report([bad]))

    def test_semantic_non_inferences(self):
        self.assertEqual(set(semantic_assertions().values()),{False})

    def test_executor_static_insert_only(self):
        text=(Path(__file__).with_name("ingest_fl_stop_work.py")).read_text(encoding="utf-8").upper()
        self.assertNotIn("UPDATE DISCIPLINE_ACTIONS",text)
        self.assertNotIn("DELETE FROM",text)
        self.assertNotIn("ON CONFLICT DO UPDATE",text)
        for table in ("INGEST_BATCHES","DISCIPLINE_ACTIONS","REGULATORY_SOURCE_OBSERVATIONS","REGULATORY_SOURCE_OCCURRENCES"):
            self.assertIn(f"INSERT INTO {table}",text)
        self.assertIn("PG_ADVISORY_XACT_LOCK",text)
        self.assertIn("REPEATABLE READ",text)


if __name__ == "__main__":
    unittest.main()
