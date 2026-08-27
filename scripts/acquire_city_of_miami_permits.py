#!/usr/bin/env python3
"""Acquire City of Miami GIS building permits. City of Miami AHJ only. No production load."""
from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HUB = "https://datahub-miamigis.opendata.arcgis.com/datasets/1d6fc60b087c4bcaa22345f429a2ec5a"
ITEM = "1d6fc60b087c4bcaa22345f429a2ec5a"
# Resolved at runtime from the item; fallback MapServer if the FeatureServer URL is in the item.
FALLBACK_LAYER = "https://gis.miami.gov/gis/rest/services/Maps/iBuildPermits/MapServer/0"
OUT = ROOT / "data" / "raw" / "city_of_miami_permits"
PAGE = 2000


def get_json(url: str, retries: int = 6) -> dict:
    last: Exception | None = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ContractorTrustHub/research"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise SystemExit(f"GET failed {url}: {last}")


def resolve_layer() -> str:
    item = get_json(f"https://www.arcgis.com/sharing/rest/content/items/{ITEM}?f=json")
    url = (item.get("url") or "").rstrip("/")
    (OUT / "item.json").write_text(json.dumps(item, indent=2), encoding="utf-8")
    if url and "MapServer" in url and not url.endswith("/0"):
        return url + "/0"
    if url and "FeatureServer" in url and not url.endswith("/0"):
        return url + "/0"
    if url:
        return url
    return FALLBACK_LAYER


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    retrieved_at = datetime.now(timezone.utc).isoformat()
    layer = resolve_layer()
    meta = get_json(layer + "?f=json")
    fields = [f["name"] for f in meta.get("fields", [])]
    count = get_json(layer + "/query?where=1%3D1&returnCountOnly=true&f=json").get("count")
    print(f"layer={layer} fields={len(fields)} rest_count={count}", flush=True)

    jsonl = OUT / "permits.jsonl"
    offset = 0
    rows = 0
    with jsonl.open("w", encoding="utf-8", newline="\n") as fh:
        while True:
            qs = urllib.parse.urlencode(
                {
                    "where": "1=1",
                    "outFields": "*",
                    "returnGeometry": "false",
                    "resultOffset": offset,
                    "resultRecordCount": PAGE,
                    "f": "json",
                }
            )
            payload = get_json(layer + "/query?" + qs)
            feats = payload.get("features") or []
            if payload.get("error"):
                raise SystemExit(f"query error at offset {offset}: {payload['error']}")
            if not feats:
                break
            for feat in feats:
                attrs = feat.get("attributes") or {}
                fh.write(json.dumps(attrs, ensure_ascii=False, separators=(",", ":")) + "\n")
                rows += 1
            print(f"offset={offset} got={len(feats)} total={rows}", flush=True)
            offset += len(feats)
            if len(feats) < PAGE:
                break
            time.sleep(0.15)

    raw = jsonl.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    sample = []
    with jsonl.open(encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            if i >= 3:
                break
            sample.append(json.loads(line))
    contractor_like = [
        f
        for f in fields
        if any(tok in f.lower() for tok in ("contract", "license", "qualif", "phone", "company", "applicant"))
    ]
    manifest = {
        "source_name": "City of Miami Building Permits Since 2014",
        "canonical_hub_url": HUB,
        "layer": layer,
        "retrieved_at": retrieved_at,
        "coverage": "CITY OF MIAMI AHJ ONLY — not Miami-Dade municipal permits, not Miami-Dade County permits",
        "raw_file": str(jsonl.relative_to(ROOT)).replace("\\", "/"),
        "raw_format": "jsonl_attributes_no_geometry",
        "row_count": rows,
        "column_count": len(fields),
        "fields": fields,
        "contractor_like_fields": contractor_like,
        "sha256": sha,
        "rest_count_at_start": count,
        "full_extraction_completed": rows == count,
        "sample_keys": list(sample[0].keys()) if sample else [],
        "stage_e": "NOT_LOADED",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({k: manifest[k] for k in ("row_count", "column_count", "sha256", "full_extraction_completed", "contractor_like_fields", "layer")}, indent=2))
    return 0 if manifest["full_extraction_completed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
