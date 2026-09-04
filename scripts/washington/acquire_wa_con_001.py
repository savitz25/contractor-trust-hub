"""WA-CON-001 — acquire official L&I Socrata files + bounded extra sources."""
from __future__ import annotations

import hashlib
import json
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = Path(r"S:\ath-raw\wa-con-001")
if not RAW.parent.exists():
    RAW = ROOT / "data" / "raw" / "washington" / "wa-con-001"
OUT = ROOT / "data" / "washington" / "wa-con-001"
USER_AGENT = "ContractorTrustHub/0.1 (research; https://github.com/savitz25/contractor-trust-hub)"
CTX = ssl.create_default_context()

DATASETS = {
    "general": {
        "id": "m8qx-ubtq",
        "title": "L&I Contractor License Data - General",
        "url": "https://data.wa.gov/Labor/L-I-Contractor-License-Data-General/m8qx-ubtq",
    },
    "bond": {
        "id": "bzff-4fmt",
        "title": "L&I Contractor License Data - Bond",
        "url": "https://data.wa.gov/Labor/L-I-Contractor-License-Data-Bond/bzff-4fmt",
    },
    "insurance": {
        "id": "ciwg-agsx",
        "title": "L&I Contractor License Data - Insurance",
        "url": "https://data.wa.gov/Labor/L-I-Contractor-License-Data-Insurance/ciwg-agsx",
    },
    "principal": {
        "id": "4xk5-x9j6",
        "title": "L&I Contractor License - Principal Data",
        "url": "https://data.wa.gov/Labor/L-I-Contractor-License-Principal-Data/4xk5-x9j6",
    },
}

PROBE = [
    ("authorized_signer", "https://data.wa.gov/api/views.json?query=authorized%20signer%20contractor"),
    ("catalog_labor", "https://data.wa.gov/api/views.json?limit=100"),
]


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def get(url: str, timeout: int = 180) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
        return resp.read()


def sha256_bytes(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_meta(dataset_id: str) -> dict:
    raw = get(f"https://data.wa.gov/api/views/{dataset_id}.json")
    meta = json.loads(raw.decode("utf-8"))
    cols = []
    for c in meta.get("columns") or []:
        cols.append(
            {
                "name": c.get("name"),
                "field": c.get("fieldName"),
                "type": c.get("dataTypeName"),
                "description": (c.get("description") or "")[:400],
            }
        )
    return {
        "id": dataset_id,
        "name": meta.get("name"),
        "description": meta.get("description"),
        "attribution": meta.get("attribution"),
        "attributionLink": meta.get("attributionLink"),
        "rowsUpdatedAt": meta.get("rowsUpdatedAt"),
        "viewLastModified": meta.get("viewLastModified"),
        "createdAt": meta.get("createdAt"),
        "rowCount": (meta.get("viewCount") if False else None),
        "columns": cols,
        "raw_keys": sorted(meta.keys()),
        "rowsUpdatedAt_iso": datetime.fromtimestamp(meta["rowsUpdatedAt"], tz=timezone.utc).isoformat()
        if isinstance(meta.get("rowsUpdatedAt"), int)
        else None,
        "downloadCount": meta.get("downloadCount"),
        "viewCount": meta.get("viewCount"),
        "averageRating": meta.get("averageRating"),
        "displayType": meta.get("displayType"),
        "tags": meta.get("tags"),
        "category": meta.get("category"),
        "rowClass": ((meta.get("metadata") or {}).get("rowLabel")),
        "metadata": meta.get("metadata"),
    }


def download_csv(dataset_id: str, dest: Path) -> dict:
    url = f"https://data.wa.gov/api/views/{dataset_id}/rows.csv?accessType=DOWNLOAD"
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {dataset_id} -> {dest}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    h = hashlib.sha256()
    n = 0
    with urllib.request.urlopen(req, timeout=600, context=CTX) as resp, dest.open("wb") as fh:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            fh.write(chunk)
            h.update(chunk)
            n += len(chunk)
            if n % (8 * 1024 * 1024) < 1024 * 1024:
                print(f"  {dataset_id} {n:,} bytes", flush=True)
    return {"bytes": n, "sha256": h.hexdigest(), "url": url, "path": str(dest)}


def probe_catalog() -> list[dict]:
    print("probing data.wa.gov catalog", flush=True)
    try:
        raw = get("https://data.wa.gov/api/views.json")
        items = json.loads(raw.decode("utf-8"))
    except Exception as e:
        return [{"error": str(e)}]
    keep = []
    needles = (
        "contractor",
        "debar",
        "prevailing",
        "public work",
        "electrical",
        "plumb",
        "infraction",
        "citation",
        "unregistered",
        "bond",
        "insurance",
        "ubi",
        "business license",
        "complaint",
    )
    for it in items:
        name = (it.get("name") or "").lower()
        desc = (it.get("description") or "").lower()
        cat = (it.get("category") or "").lower()
        blob = f"{name} {desc} {cat}"
        if any(n in blob for n in needles):
            keep.append(
                {
                    "id": it.get("id"),
                    "name": it.get("name"),
                    "category": it.get("category"),
                    "description": (it.get("description") or "")[:240],
                    "rowsUpdatedAt": it.get("rowsUpdatedAt"),
                    "displayType": it.get("displayType"),
                    "attribution": it.get("attribution"),
                }
            )
    return keep


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {
        "ticket": "WA-CON-001",
        "retrieved_at": utcnow(),
        "datasets": {},
        "catalog_hits": [],
    }
    for key, spec in DATASETS.items():
        print(f"== {key} {spec['id']}", flush=True)
        meta = fetch_meta(spec["id"])
        csv_path = RAW / f"{key}-{spec['id']}.csv"
        dl = download_csv(spec["id"], csv_path)
        (OUT / f"{key}-meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        report["datasets"][key] = {
            **spec,
            "meta_name": meta.get("name"),
            "rowsUpdatedAt_iso": meta.get("rowsUpdatedAt_iso"),
            "columns": [c["field"] for c in meta.get("columns") or []],
            "column_count": len(meta.get("columns") or []),
            "download": dl,
        }
    report["catalog_hits"] = probe_catalog()
    (OUT / "acquire-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("wrote", OUT / "acquire-report.json", flush=True)
    print("catalog hits", len(report["catalog_hits"]), flush=True)


if __name__ == "__main__":
    main()
