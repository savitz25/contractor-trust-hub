"""Prepare the Evidence-certified NY DOL credential wave; no database connection."""

from __future__ import annotations

import csv
import hashlib
import json
import uuid
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/TH-EA-UNPUBLISHED-2026-10-01-NY-CREDENTIALS"
MANIFEST = json.loads((OUT / "source-manifest.json").read_text(encoding="utf-8"))
SOURCES = {item["id"]: item for item in MANIFEST["sources"]}
WAVE_ID = "TH-NY-CREDENTIALS-2026-10-01-PACKET-REFRESH"
SPECS = {
    "ny_dol_mold": ("ikqx-ispy.csv", 2511, 774, 2483),
    "ny_elevator": ("jrac-r9vc.csv", 302, 90, 302),
}
FIELDS = (
    "source_dataset", "source_line", "source_system", "external_key", "license_type",
    "license_number", "holder_name", "dba_name", "address", "address_2", "city",
    "address_state", "zip_code", "issued_date", "expiration_date", "source_status",
    "source_sha256", "source_url", "batch_id", "raw_payload",
)


def batch_id(dataset: str, sha256: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{WAVE_ID}:{dataset}:{sha256}"))


def prepare() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    staged: list[dict] = []
    receipt = {"ticket": WAVE_ID, "sources": {},
               "canonical_business_count_change": 0, "production_mutations": False}
    for dataset, (filename, expected, expired, unique_numbers) in SPECS.items():
        source = SOURCES[dataset]
        path = OUT / source["filename"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != source["sha256"]:
            raise ValueError(f"{dataset}: pinned certified source hash changed")
        with path.open(newline="", encoding="utf-8-sig") as stream:
            rows = list(csv.DictReader(stream))
        keys = [(row["license_type"].strip(), row["license_number"].strip()) for row in rows]
        numbers = {row["license_number"].strip() for row in rows}
        statuses = Counter(row["license_status"] for row in rows)
        if (len(rows), statuses["Expired"], len(numbers), len(set(keys))) != (expected, expired, unique_numbers, expected):
            raise ValueError(f"{dataset}: certified row, status, or native-key invariant changed")
        if set(statuses) != {"Active", "Expired"} or any(not kind or not number for kind, number in keys):
            raise ValueError(f"{dataset}: missing key or unexpected source status")
        identity = batch_id(dataset, digest)
        for line, row in enumerate(rows, 2):
            kind, number = keys[line - 2]
            raw = {**row, "_source_dataset": dataset, "_source_line": line,
                   "_source_sha256": digest, "_source_url": source["official_url"],
                   "_grain": "standalone regulator credential"}
            staged.append({
                "source_dataset": dataset, "source_line": line, "source_system": "ny_dol",
                "external_key": f"{dataset}:{kind}:{number}", "license_type": kind,
                "license_number": number, "holder_name": row["business_name"],
                "dba_name": row["dba_name"], "address": row["address"],
                "address_2": row["address_2"], "city": row["city"],
                "address_state": row["state"], "zip_code": row["zip_code"],
                "issued_date": row["issued_date"][:10],
                "expiration_date": row["expiration_date"][:10],
                "source_status": row["license_status"], "source_sha256": digest,
                "source_url": source["official_url"], "batch_id": identity,
                "raw_payload": json.dumps(raw, ensure_ascii=False, sort_keys=True),
            })
        receipt["sources"][dataset] = {
            "official_url": source["official_url"], "filename": filename,
            "certified_sha256": digest, "rows": len(rows), "license_numbers": len(numbers),
            "compound_native_keys": len(set(keys)), "statuses": dict(statuses),
            "batch_id": identity, "duplicate_native_keys": len(rows) - len(set(keys)),
        }
    if len({(row["source_system"], row["external_key"]) for row in staged}) != 2813:
        raise ValueError("Cross-source credential key collision")
    target = OUT / "ny-credentials-stage.csv"
    with target.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(staged)
    receipt["stage_file"] = str(target.relative_to(ROOT)).replace("\\", "/")
    receipt["stage_sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
    receipt["rows"] = len(staged)
    receipt["unique_external_keys"] = len({row["external_key"] for row in staged})
    (OUT / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return receipt


if __name__ == "__main__":
    print(json.dumps(prepare(), indent=2))
