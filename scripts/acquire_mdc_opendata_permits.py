#!/usr/bin/env python3
"""Acquire Miami-Dade Open Data issued-permits FeatureServer. No production load."""
from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HUB = "https://opendata.miamidade.gov/datasets/6db5f56e886446df88313ca279e59120"
LAYER = (
    "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/"
    "miamidade_permit_data/FeatureServer/0"
)
PAGE = 1000
OUT = ROOT / "data" / "raw" / "mdc_opendata_permits"


def get_json(url: str, retries: int = 6) -> dict:
    last: Exception | None = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ContractorTrustHub/research"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise SystemExit(f"GET failed {url}: {last}")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    retrieved_at = datetime.now(timezone.utc).isoformat()
    meta = get_json(LAYER + "?f=json")
    fields = [f["name"] for f in meta.get("fields", [])]
    count = get_json(LAYER + "/query?where=1%3D1&returnCountOnly=true&f=json").get("count")
    print(f"layer fields={len(fields)} rest_count={count}", flush=True)

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
            payload = get_json(LAYER + "/query?" + qs)
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
    dates = []
    with jsonl.open(encoding="utf-8") as fh:
        for line in fh:
            rec = json.loads(line)
            d = rec.get("PermitIssuedDate")
            if d:
                dates.append(str(d)[:10])
    manifest = {
        "source_name": "Building Permits Issued By Miami-Dade County — 2 Previous Years to Present",
        "canonical_hub_url": HUB,
        "featureserver": LAYER,
        "service_item_id": meta.get("serviceItemId"),
        "retrieved_at": retrieved_at,
        "raw_file": str(jsonl.relative_to(ROOT)).replace("\\", "/"),
        "raw_format": "jsonl_attributes_no_geometry",
        "row_count": rows,
        "column_count": len(fields),
        "fields": fields,
        "sha256": sha,
        "rest_count_at_start": count,
        "full_extraction_completed": rows == count,
        "pagination": {"resultRecordCount": PAGE, "returnGeometry": False},
        "issued_date_min": min(dates) if dates else None,
        "issued_date_max": max(dates) if dates else None,
        "limitations": [
            "ISSUED permits only. Not a raw open/pending/status census.",
            "County-issued (unincorporated folio 30 plus M/MBLD associated reviews).",
            "Not 34 municipal building-permit histories.",
            "Do not infer missing=open, missing=closed, or issued=final.",
        ],
        "stage_e": "NOT_LOADED",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({k: manifest[k] for k in ("row_count", "column_count", "sha256", "full_extraction_completed", "issued_date_min", "issued_date_max")}, indent=2))
    return 0 if manifest["full_extraction_completed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
