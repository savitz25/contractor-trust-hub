"""Florida DFS stop-work snapshot parser and immutable identity contract."""

from __future__ import annotations

import hashlib
import html
import json
import re
import uuid
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

from ingest.regulatory.source_observation import (
    canonical_source_row,
    logical_matter_detail_key_v1,
    row_fingerprint_sha256,
    source_observation_key_v2,
)

SOURCE_SYSTEM = "fl_dfs"
SOURCE_DATASET = "fl_dfs_workers_comp_stop_work"
SOURCE_URL = "https://dwcdataportal.fldfs.com/Emp_List.aspx?vEmployerName=&vddSortBy=1"
SEARCH_URL = "https://dwcdataportal.fldfs.com/SWOquery.aspx"
FIELDS = ("Employer Name", "County", "City", "Date Served", "Date Ended*", "Date Reinstated**", "Reason")
LOGICAL_FIELDS = ("Employer Name", "County", "City", "Date Served", "Reason")
REASONS = {
    "FAILURE TO OBTAIN COVERAGE", "FAIL PRODUCE DOCS 5 DAYS", "FAIL PRODUCE DOCS 10 DAYS",
    "FAIL PRODUCE DOCS 21 DAYS", "UNDERSTATE OR CONCEAL PAYROLL", "SITE SPECIFIC",
    "MISREP. OR CONCEAL EE DUTIES", "MISREP. OR CONCEAL INFO. E-MOD", "FAIL PRODUCE DOCS 3 DAYS",
}
IDENTITY_METHOD = "NO_OFFICIAL_IDENTITY_IDENTIFIER"
RESOLVER_VERSION = "fl-dfs-stop-work-identity-v1"
MANIFEST_VERSION = "cth-fl-state-006-stop-work-v1"
TASK_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "contractortrusthub:cth-fl-state-006-stop-work")
SCHEMA_FINGERPRINT = "sha256:" + hashlib.sha256(json.dumps(FIELDS, separators=(",", ":")).encode()).hexdigest()


def digest(value) -> str:
    return "sha256:" + hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _clean(value: str) -> str:
    return html.unescape(value).replace("\xa0", " ").strip()


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_cell = False
        self.kind = ""
        self.parts: list[str] = []
        self.current: list[tuple[str, str]] = []
        self.headers: list[str] = []
        self.header_count = 0
        self.rows: list[tuple[str, ...]] = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() in ("th", "td"):
            self.in_cell = True; self.kind = tag.lower(); self.parts = []

    def handle_data(self, data):
        if self.in_cell: self.parts.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("th", "td") and self.in_cell:
            self.current.append((self.kind, _clean("".join(self.parts))))
            self.in_cell = False
        elif tag == "tr" and self.current:
            kinds = {k for k, _ in self.current}; values = tuple(v for _, v in self.current)
            if kinds == {"th"} and values[:len(FIELDS)] == FIELDS:
                self.headers = list(values[:len(FIELDS)]); self.header_count += 1
            elif kinds == {"td"}:
                # The WebForms page contains small layout tables in addition to
                # the seven-column report. Only report-shaped rows belong here.
                if len(values) == len(FIELDS): self.rows.append(values)
            self.current = []


def parse_snapshot(path: Path) -> tuple[list[dict[str, str]], dict[str, object]]:
    parser = _TableParser()
    decoder = __import__("codecs").getincrementaldecoder("utf-8")("replace")
    hasher = hashlib.sha256(); size = 0; tail = b""
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            hasher.update(chunk); size += len(chunk); tail = (tail + chunk)[-2_000_000:]
            parser.feed(decoder.decode(chunk))
    parser.feed(decoder.decode(b"", final=True)); parser.close()
    if tuple(parser.headers) != FIELDS or parser.header_count != 1:
        raise ValueError(f"unexpected stop-work schema/header count: {parser.headers!r}/{parser.header_count}")
    text_tail = tail.decode("utf-8", "replace")
    reported = re.search(r'id="?lblRecCount"?[^>]*>\s*([0-9,]+)', text_tail, re.I)
    if reported and int(reported.group(1).replace(",", "")) != len(parser.rows): raise ValueError("reported row count mismatch")
    rows = [canonical_source_row(dict(zip(FIELDS, row, strict=True)), FIELDS) for row in parser.rows]
    unknown = sorted({row["Reason"] for row in rows} - REASONS)
    if unknown: raise ValueError(f"SEMANTIC_SOURCE_DRIFT reasons={unknown!r}")
    date_re = re.compile(r"^(?:Not (?:Ended|Reinstated)|\d{1,2}/\d{1,2}/\d{4})$", re.I)
    for row in rows:
        if not all(row.values()): raise ValueError("malformed blank field")
        if not date_re.fullmatch(row["Date Served"]) or not date_re.fullmatch(row["Date Ended*"]) or not date_re.fullmatch(row["Date Reinstated**"]):
            raise ValueError("SEMANTIC_SOURCE_DRIFT date shape")
    return rows, {"bytes": size, "raw_sha256": "sha256:" + hasher.hexdigest(), "schema_fingerprint": SCHEMA_FINGERPRINT}


def observation_key(row):
    return source_observation_key_v2(source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET, row=row, fields=FIELDS)


def logical_key(row):
    return logical_matter_detail_key_v1(source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET, row=row, fields=LOGICAL_FIELDS)


def stable_id(kind: str, identity: str) -> str:
    return str(uuid.uuid5(TASK_NAMESPACE, f"{kind}:{identity}"))


def normalized_snapshot_fingerprint(rows) -> str:
    """Order-independent multiset hash; duplicate multiplicity is significant."""
    counts = Counter(observation_key(row) for row in rows)
    contract = [[key, counts[key]] for key in sorted(counts)]
    return "sha256:" + hashlib.sha256(json.dumps(contract, separators=(",", ":")).encode()).hexdigest()


def build_contract(rows, retrieved_at: str, source_meta: dict[str, object]):
    counts = Counter(observation_key(row) for row in rows)
    normalized = normalized_snapshot_fingerprint(rows)
    batch_id = stable_id("batch", normalized)
    entries = []
    by_key = {observation_key(row): row for row in rows}
    for key in sorted(by_key):
        row = by_key[key]
        entries.append({"source_observation_key": key, "multiplicity": counts[key],
            "discipline_action_id": stable_id("action", key), "observation_id": stable_id("observation", key),
            "occurrence_ids": [stable_id("occurrence", f"{key}:{batch_id}:{n}") for n in range(1, counts[key] + 1)],
            "row_fingerprint_sha256": row_fingerprint_sha256(row, FIELDS), "logical_matter_detail_key": logical_key(row)})
    compact = {"manifest_version": MANIFEST_VERSION, "source_system": SOURCE_SYSTEM, "source_dataset": SOURCE_DATASET,
        "source_url": SOURCE_URL, "retrieved_at_utc": retrieved_at, **source_meta,
        "normalized_snapshot_fingerprint": normalized, "raw_rows": len(rows), "unique_observations": len(entries),
        "duplicate_appearances": len(rows)-len(entries), "batch_id": batch_id,
        "identity": {"EXACT":0,"DETERMINISTIC":0,"REVIEW_REQUIRED":0,"UNRESOLVED":len(entries)},
        "expected_inserts": {"batches":1,"actions":len(entries),"observations":len(entries),"occurrences":len(rows),"total":1+2*len(entries)+len(rows)},
        "algorithms": {"source_observation":"source-observation-key-v2","logical_review":"logical-matter-detail-key-v1","identity":RESOLVER_VERSION},
        "source_key_multiplicity": [[e["source_observation_key"],e["multiplicity"]] for e in entries],
        "id_fingerprints": {k:"sha256:"+hashlib.sha256(json.dumps(v,separators=(",",":"),sort_keys=True).encode()).hexdigest() for k,v in {
            "actions":[e["discipline_action_id"] for e in entries], "observations":[e["observation_id"] for e in entries],
            "occurrences":[x for e in entries for x in e["occurrence_ids"]]}.items()}}
    fingerprint = "sha256:" + hashlib.sha256(json.dumps(compact, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return compact | {"manifest_fingerprint": fingerprint}, entries


def semantic_assertions() -> dict[str, bool]:
    return {
        "served_implies_currently_active": False,
        "ended_implies_penalty_paid": False,
        "ended_implies_generic_compliance": False,
        "reinstated_implies_currently_active": False,
        "failure_to_obtain_coverage_is_current_uninsured": False,
        "conceal_reason_is_generalized_fraud": False,
    }
