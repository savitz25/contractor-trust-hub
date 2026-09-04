"""Deterministic Austin permit TCAD ID -> Travis CAD PROP.TXT geo_id join.

Does not extract owner names. Does not write owner dossiers.
PROP.TXT is streamed from the certified zip (4.9GB uncompressed, not extracted).
Positions are 1-indexed from Legacy 8.0.33 layout; Python slices are start-1.
"""
from __future__ import annotations

import csv
import json
import zipfile
from pathlib import Path

AUSTIN_CSV = Path(r"S:\ath-raw\tx-con-local-001a\austin-travis\3syk-w9eu-issued-construction-permits.csv")
TCAD_ZIP = Path(r"S:\ath-raw\tx-con-local-001a\austin-travis\tcad-2026-certified-appraisal-export-supp0-07182026.zip")
OUT = Path(__file__).resolve().parents[4] / "data" / "texas" / "local" / "austin-travis" / "permit-tcad-join.json"


def load_permit_tcads() -> set[str]:
    ids: set[str] = set()
    with AUSTIN_CSV.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            tcad = (row.get("TCAD ID") or row.get("tcad_id") or "").strip()
            if tcad and tcad not in {"0", "WCAD"}:
                ids.add(tcad)
    return ids


def slice1(line: str, start: int, end: int) -> str:
    return line[start - 1 : end].strip()


def main() -> None:
    print("loading permit TCAD IDs", flush=True)
    permit_ids = load_permit_tcads()
    print(f"distinct permit tcad ids {len(permit_ids)}", flush=True)
    matched: set[str] = set()
    prop_rows = 0
    geo_nonempty = 0
    with zipfile.ZipFile(TCAD_ZIP) as zf:
        with zf.open("PROP.TXT") as raw:
            for rec in raw:
                prop_rows += 1
                line = rec.decode("latin-1", "replace")
                geo = slice1(line, 547, 596)
                if geo:
                    geo_nonempty += 1
                    if geo in permit_ids:
                        matched.add(geo)
                if prop_rows % 500000 == 0:
                    print(f"  prop rows {prop_rows} matched {len(matched)}", flush=True)
    out = {
        "permit_rows_with_tcad_id_distinct": len(permit_ids),
        "prop_rows_scanned": prop_rows,
        "prop_rows_with_geo_id": geo_nonempty,
        "exact_geo_id_joins": len(matched),
        "unmatched_permit_tcad_ids": len(permit_ids) - len(matched),
        "join_key": "Austin tcad_id == Travis CAD PROP.TXT geo_id (layout positions 547-596)",
        "owner_fields_not_exported": True,
        "appraisal_value_is_not_sale_price": True,
        "duplicate_note": "PROP.TXT may contain one row per owner; join is on geo_id set, not owner.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
