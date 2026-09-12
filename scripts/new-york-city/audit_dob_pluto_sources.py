#!/usr/bin/env python3
"""Live schema/metadata audit for NYC DOB NOW, legacy DOB, and PLUTO."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts" / "nyc-con-002"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://data.cityofnewyork.us"
UA = "ContractorTrustHub-NYC-CON-002A/1.0"
DATASETS = {
    "dob_now": "rbx6-tga4",
    "legacy_dob": "ipu4-2q9a",
    "pluto": "64uk-42ks",
}


def get_json(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))


def view_meta(dataset_id: str) -> dict:
    meta = get_json(f"{BASE}/api/views/{dataset_id}.json")
    cols = [
        {
            "fieldName": c.get("fieldName"),
            "name": c.get("name"),
            "dataTypeName": c.get("dataTypeName"),
        }
        for c in meta.get("columns", [])
        if c.get("fieldName") and not str(c.get("fieldName")).startswith(":@")
    ]
    count = get_json(f"{BASE}/resource/{dataset_id}.json?$select=count(*)")
    sample = get_json(f"{BASE}/resource/{dataset_id}.json?$limit=2")
    return {
        "id": dataset_id,
        "name": meta.get("name"),
        "attribution": meta.get("attribution"),
        "description": (meta.get("description") or "")[:800],
        "rowsUpdatedAt": meta.get("rowsUpdatedAt"),
        "rowsUpdatedAt_iso": (
            datetime.fromtimestamp(int(meta["rowsUpdatedAt"]), tz=timezone.utc).isoformat()
            if meta.get("rowsUpdatedAt")
            else None
        ),
        "viewLastModified": meta.get("viewLastModified"),
        "createdAt": meta.get("createdAt"),
        "row_count_soda": count,
        "columns": cols,
        "sample": sample,
    }


def main() -> None:
    report: dict = {"audited_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")}
    for key, dataset_id in DATASETS.items():
        print("META", key, dataset_id)
        report[key] = view_meta(dataset_id)
        print("  title", report[key]["name"], "cols", len(report[key]["columns"]), "count", report[key]["row_count_soda"])
    (OUT / "source-audit.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT / "source-audit.json")


if __name__ == "__main__":
    main()
