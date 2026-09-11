#!/usr/bin/env python3
"""Acquire IDFPR ROOFING CONTRACTOR slice only. Never the full pzzh-kp68 universe."""
from __future__ import annotations

import hashlib
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGE = ROOT / "data" / "illinois" / "il-con-001"
SODA = "https://data.illinois.gov/resource/pzzh-kp68.json"
META = "https://data.illinois.gov/api/views/pzzh-kp68.json"
WHERE = "upper(license_type)='ROOFING CONTRACTOR'"
ORDER = "license_number,description,license_status,case_number,lastmodifieddate"
PAGE = 1000
UA = {"User-Agent": "ContractorTrustHub/il-con-001"}


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def get_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def soda(params: dict):
    url = SODA + "?" + urllib.parse.urlencode(params)
    return get_json(url)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    STAGE.mkdir(parents=True, exist_ok=True)
    started = iso_now()
    st, meta = get_json(META)
    source_updated = datetime.fromtimestamp(int(meta["rowsUpdatedAt"]), tz=timezone.utc).isoformat().replace("+00:00", "Z")
    st_c, count_start = soda({"$select": "count(*)", "$where": WHERE})
    start_count = int(count_start[0]["count"])
    pages = []
    rows: list[dict] = []
    offset = 0
    page_n = 0
    while True:
        page_n += 1
        st_p, chunk = soda(
            {
                "$where": WHERE,
                "$order": ORDER,
                "$limit": str(PAGE),
                "$offset": str(offset),
            }
        )
        pages.append({"page": page_n, "offset": offset, "http_status": st_p, "rows": len(chunk)})
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < PAGE:
            break
        offset += PAGE
        time.sleep(0.15)
    st_e, count_end = soda({"$select": "count(*)", "$where": WHERE})
    end_count = int(count_end[0]["count"])
    ended = iso_now()
    raw_bytes = json.dumps(rows, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    raw_path = STAGE / "roofing-rows.json"
    raw_path.write_bytes(raw_bytes)
    report = {
        "ticket": "IL-CON-001",
        "dataset_id": "pzzh-kp68",
        "filter": WHERE,
        "order": ORDER,
        "page_size": PAGE,
        "soda": SODA,
        "dataset_page": "https://data.illinois.gov/Business-and-Workforce/Professional-Licensing/pzzh-kp68",
        "full_professional_csv_access": "CONFIRMED",
        "full_professional_dataset_acquisition": "NOT_PERFORMED",
        "roofing_only_acquisition": True,
        "http_status_meta": st,
        "http_status_count_start": st_c,
        "http_status_count_end": st_e,
        "rowsUpdatedAt_unix": meta.get("rowsUpdatedAt"),
        "sourceAsOf": source_updated[:10],
        "sourceUpdatedAt": source_updated,
        "retrievedAt_start": started,
        "retrievedAt_end": ended,
        "retrievedAt": started,
        "retrievedAt_precision": "second",
        "count_at_start": start_count,
        "count_at_end": end_count,
        "count_consistent": start_count == end_count == len(rows),
        "acquired_rows": len(rows),
        "pages": pages,
        "page_count": len(pages),
        "raw_bytes": len(raw_bytes),
        "raw_sha256": sha256_bytes(raw_bytes),
        "raw_path": "data/illinois/il-con-001/roofing-rows.json",
    }
    (STAGE / "acquire-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (STAGE / "roofing-rows.sha256").write_text(report["raw_sha256"] + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["acquired_rows", "count_at_start", "count_at_end", "count_consistent", "raw_sha256", "sourceUpdatedAt", "retrievedAt", "page_count"]}, indent=2))
    if not report["count_consistent"]:
        raise SystemExit("roofing count changed during pagination or row total mismatch")


if __name__ == "__main__":
    main()
