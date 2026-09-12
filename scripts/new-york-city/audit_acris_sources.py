#!/usr/bin/env python3
"""Live schema/metadata audit for ACRIS Real Property Master and Legals."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts" / "nyc-con-003"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://data.cityofnewyork.us"
UA = "ContractorTrustHub-NYC-CON-003A/1.0"
DATASETS = {"master": "bnx9-e6tj", "legals": "8h5j-fqxa"}


def get_json(url: str, timeout: int = 180):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def view_meta(dataset_id: str) -> dict:
    meta = get_json(f"{BASE}/api/views/{dataset_id}.json", timeout=60)
    cols = [
        {"fieldName": c.get("fieldName"), "name": c.get("name"), "dataTypeName": c.get("dataTypeName")}
        for c in meta.get("columns", [])
        if c.get("fieldName") and not str(c.get("fieldName")).startswith(":@")
    ]
    sample = None
    sample_err = None
    fields = ",".join(c["fieldName"] for c in cols[:12])
    try:
        q = urllib.parse.urlencode({"$select": fields, "$limit": "1"})
        sample = get_json(f"{BASE}/resource/{dataset_id}.json?{q}", timeout=180)
    except Exception as exc:
        sample_err = str(exc)
    return {
        "id": dataset_id,
        "name": meta.get("name"),
        "attribution": meta.get("attribution"),
        "description": (meta.get("description") or "")[:1500],
        "rowsUpdatedAt": meta.get("rowsUpdatedAt"),
        "rowsUpdatedAt_iso": (
            datetime.fromtimestamp(int(meta["rowsUpdatedAt"]), tz=timezone.utc).isoformat()
            if meta.get("rowsUpdatedAt")
            else None
        ),
        "viewLastModified": meta.get("viewLastModified"),
        "columns": cols,
        "sample": sample,
        "sample_error": sample_err,
    }


def main() -> None:
    report = {"audited_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")}
    for key, dataset_id in DATASETS.items():
        print("META", key, dataset_id)
        report[key] = view_meta(dataset_id)
        print("  title", report[key]["name"], "cols", len(report[key]["columns"]))
    (OUT / "source-audit.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT / "source-audit.json")


if __name__ == "__main__":
    main()
