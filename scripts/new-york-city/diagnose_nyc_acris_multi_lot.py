#!/usr/bin/env python3
"""Frozen-artifact condo / multi-lot diagnostics. No network."""
from __future__ import annotations

import gzip
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "new-york" / "nyc-con-003"


def load_gz(path: Path) -> list[dict]:
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def norm_bbl(borough, block, lot) -> str | None:
    try:
        b = int(float(str(borough).strip()))
        k = int(float(str(block).strip()))
        t = int(float(str(lot).strip()))
    except (TypeError, ValueError):
        return None
    if b < 1 or b > 5 or k < 0 or t < 0:
        return None
    return f"{b}{k:05d}{t:04d}"


def main() -> None:
    report_path = OUT / "acquire-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    legals = load_gz(OUT / "acris-legals.json.gz")

    legal_rows_by_doc: dict[str, int] = Counter()
    bbls_by_doc: dict[str, set[str]] = defaultdict(set)
    docs_with_unit: set[str] = set()
    bbls_with_unit: set[str] = set()
    property_types = Counter()
    unit_lot_convention_rows = 0
    unit_lot_convention_bbls: set[str] = set()
    docs_unit_lot: set[str] = set()
    addr_bbls: dict[tuple[str, str, str], set[str]] = defaultdict(set)
    rows_with_unit = 0

    for row in legals:
        did = str(row.get("document_id") or "").strip()
        legal_rows_by_doc[did] += 1
        pt = str(row.get("property_type") or "").strip() or "(blank)"
        property_types[pt] += 1
        unit = str(row.get("unit") or "").strip()
        bbl = norm_bbl(row.get("borough"), row.get("block"), row.get("lot"))
        if bbl:
            bbls_by_doc[did].add(bbl)
        if unit:
            rows_with_unit += 1
            docs_with_unit.add(did)
            if bbl:
                bbls_with_unit.add(bbl)
        try:
            lot = int(float(str(row.get("lot") or "").strip()))
        except (TypeError, ValueError):
            lot = 0
        if lot >= 1001:
            unit_lot_convention_rows += 1
            if bbl:
                unit_lot_convention_bbls.add(bbl)
            docs_unit_lot.add(did)
        street_no = str(row.get("street_number") or "").strip()
        street = str(row.get("street_name") or "").strip().upper()
        borough = str(row.get("borough") or "").strip()
        if street_no and street and borough and bbl:
            addr_bbls[(borough, street_no, street)].add(bbl)

    multi_legal = {d: n for d, n in legal_rows_by_doc.items() if n > 1}
    one_legal = sum(1 for n in legal_rows_by_doc.values() if n == 1)
    same_addr_multi = {k: v for k, v in addr_bbls.items() if len(v) > 1}

    diag = {
        "documents_with_1_legal_row": one_legal,
        "documents_with_gt1_legal_row": len(multi_legal),
        "max_legal_rows_per_document": max(legal_rows_by_doc.values()) if legal_rows_by_doc else 0,
        "documents_with_1_bbl": sum(1 for s in bbls_by_doc.values() if len(s) == 1),
        "documents_with_gt1_bbl": sum(1 for s in bbls_by_doc.values() if len(s) > 1),
        "max_bbls_per_document": max((len(s) for s in bbls_by_doc.values()), default=0),
        "legal_rows_with_unit": rows_with_unit,
        "documents_with_unit_legal_row": len(docs_with_unit),
        "distinct_bbls_with_unit": len(bbls_with_unit),
        "property_type_counts": dict(property_types.most_common(30)),
        "addresses_with_gt1_bbl": len(same_addr_multi),
        "max_bbls_per_address": max((len(v) for v in same_addr_multi.values()), default=1),
        "nyc_unit_lot_convention_lot_ge_1001_rows": unit_lot_convention_rows,
        "nyc_unit_lot_convention_distinct_bbls": len(unit_lot_convention_bbls),
        "documents_with_unit_lot_convention_bbl": len(docs_unit_lot),
        "no_source_native_condo_flag": True,
        "note": "ACRIS Legals has unit and property_type, not a condo_flag. Unit-populated legal rows are the source-native condo/unit signal. Lot >= 1001 is a NYC billing-lot convention diagnostic only, not a source field.",
    }
    report["multi_lot"] = diag
    report["legals"]["rows_with_unit"] = rows_with_unit
    report["legals"]["property_type_counts"] = diag["property_type_counts"]
    report["linking"]["documents_with_gt1_legal_row"] = diag["documents_with_gt1_legal_row"]
    report["linking"]["max_legal_rows_per_document"] = diag["max_legal_rows_per_document"]
    report["linking"]["documents_with_unit_legal_row"] = diag["documents_with_unit_legal_row"]
    report["linking"]["addresses_with_gt1_bbl"] = diag["addresses_with_gt1_bbl"]
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in diag.items() if k != "property_type_counts"}, indent=2))
    print("property_types", json.dumps(diag["property_type_counts"], indent=2))


if __name__ == "__main__":
    main()
