"""Freeze B1 source facts after acquisition and parsing; refuses overwrite."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / "docs/TH-ENRICH-2026-09-30-B1-preingest.json").read_text(encoding="utf-8"))
retrieval = {row["id"]: row for row in json.loads((ROOT / "docs/TH-ENRICH-2026-09-30-B1-retrieval.json").read_text(encoding="utf-8"))}
qa = {row["dataset"]: row for row in json.loads((ROOT / "docs/TH-ENRICH-2026-09-30-B1-qa.json").read_text(encoding="utf-8"))["datasets"]}
output = ROOT / "docs/TH-ENRICH-2026-09-30-B1-source-manifest.json"
if output.exists():
    raise SystemExit(f"Immutable source manifest already exists: {output}")
rows = []
for record in source["sources"]:
    item = dict(record)
    downloaded = retrieval[record["id"]]
    item.update({key: downloaded[key] for key in ("retrieved_at", "bytes", "sha256") if key in downloaded})
    item["raw_row_count"] = qa[record["id"]]["raw_rows"]
    item["parsed_row_count"] = qa[record["id"]]["parsed_rows"]
    item["unique_native_keys"] = qa[record["id"]]["unique_native_keys"]
    if record["id"] == "nj_dfs_fire_business":
        raw = ROOT / "data/raw/th_enrich_b1/nj_fire_permitted_business_2026.pdf"
        item["retrieved_at"] = datetime.fromtimestamp(raw.stat().st_mtime, timezone.utc).isoformat()
        item["bytes"] = raw.stat().st_size
        item["sha256"] = qa[record["id"]]["sha256"]
    rows.append(item)
output.write_text(json.dumps({"ticket": source["ticket"], "immutable_snapshot_manifest": True,
                              "sources": rows}, indent=2), encoding="utf-8")
print(output)
