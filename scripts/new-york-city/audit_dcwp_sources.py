#!/usr/bin/env python3
"""One-time live schema/category audit for NYC DCWP Open Data. No full ingest."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts" / "nyc-con-001"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://data.cityofnewyork.us"
DATASETS = {
    "licenses": "w7w3-xahh",
    "complaints": "nre2-6m2s",
    "charges": "5fn4-dr26",
    "inspections": "jzhd-m6uv",
}


def get_json(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": "ContractorTrustHub-NYC-CON-001A/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
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
    return {
        "id": dataset_id,
        "name": meta.get("name"),
        "attribution": meta.get("attribution"),
        "rowsUpdatedAt": meta.get("rowsUpdatedAt"),
        "viewLastModified": meta.get("viewLastModified"),
        "createdAt": meta.get("createdAt"),
        "columns": cols,
        "sample": get_json(f"{BASE}/resource/{dataset_id}.json?$limit=2"),
    }


def main() -> None:
    report: dict = {"datasets": {}}
    for key, dataset_id in DATASETS.items():
        print(f"META {key} {dataset_id}")
        report["datasets"][key] = view_meta(dataset_id)

    cats = get_json(
        f"{BASE}/resource/w7w3-xahh.json?"
        + urllib.parse.urlencode(
            {
                "$select": "business_category,count(*) as n",
                "$group": "business_category",
                "$order": "n DESC",
                "$limit": "500",
            }
        )
    )
    report["license_business_categories"] = cats
    hic = [row for row in cats if "home" in str(row.get("business_category", "")).lower()]
    report["home_improvement_category_candidates"] = hic
    print(json.dumps({"hic_candidates": hic, "category_count": len(cats)}, indent=2))

    # complaint/inspection/charge category samples if present
    for key, dataset_id, field in [
        ("complaints", "nre2-6m2s", "business_category"),
        ("inspections", "jzhd-m6uv", "business_category"),
        ("charges", "5fn4-dr26", "business_category"),
    ]:
        cols = {c["fieldName"] for c in report["datasets"][key]["columns"]}
        if field not in cols:
            report[f"{key}_has_{field}"] = False
            continue
        report[f"{key}_has_{field}"] = True
        report[f"{key}_{field}_top"] = get_json(
            f"{BASE}/resource/{dataset_id}.json?"
            + urllib.parse.urlencode(
                {
                    "$select": f"{field},count(*) as n",
                    "$group": field,
                    "$order": "n DESC",
                    "$limit": "50",
                }
            )
        )

    (OUT / "source-audit.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT / "source-audit.json")


if __name__ == "__main__":
    main()
