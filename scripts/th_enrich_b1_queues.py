"""Materialize exact unresolved and duplicate native-key queues from B1 staging."""
from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "data/staging/th_enrich_b1"
qa = json.loads((ROOT / "docs/TH-ENRICH-2026-09-30-B1-qa.json").read_text(encoding="utf-8"))["datasets"]
unresolved = set()
collisions = []
for dataset in qa:
    name = dataset["dataset"]
    records = [json.loads(line) for line in (STAGE / f"{name}.jsonl").read_text(encoding="utf-8").splitlines()]
    counts = Counter(row["native_key"] for row in records)
    for record in records:
        key = (name, record["native_key"], record.get("credential_class", ""))
        if record.get("identity_eligible"):
            unresolved.add(key)
    collisions += [(name, key, count) for key, count in counts.items() if count > 1]
with (STAGE / "unresolved_identity_queue.csv").open("w", newline="", encoding="utf-8") as fh:
    writer = csv.writer(fh)
    writer.writerow(["source_dataset", "native_key", "credential_class", "reason"])
    writer.writerows((*row, "no exact cross-regulator entity bridge") for row in sorted(unresolved))
with (STAGE / "collision_queue.csv").open("w", newline="", encoding="utf-8") as fh:
    writer = csv.writer(fh)
    writer.writerow(["source_dataset", "native_key", "raw_row_count", "resolution"])
    writer.writerows((*row, "held for regulator record review") for row in sorted(collisions))
assert len(unresolved) == sum(row["identity_eligible_native_keys"] for row in qa)
assert len(collisions) == sum(row["collision_key_count"] for row in qa)
print(f"unresolved_keys={len(unresolved)} collision_keys={len(collisions)}")
