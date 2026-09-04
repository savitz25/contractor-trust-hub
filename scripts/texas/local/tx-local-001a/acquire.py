"""TX-CON-LOCAL-001A — download official Austin/Fort Worth/Travis/Tarrant bulk files.

Raw files land on S:/ath-raw/tx-con-local-001a (C: is too small). Gitignored.
"""
from __future__ import annotations

import hashlib
import json
import ssl
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
RAW_ROOT = Path(r"S:\ath-raw\tx-con-local-001a")
AUSTIN_RAW = RAW_ROOT / "austin-travis"
FTW_RAW = RAW_ROOT / "fort-worth-tarrant"
CTX = ssl.create_default_context()
UA = "ContractorTrustHub/TX-CON-LOCAL-001A (research; official open-data harvest)"


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch(url: str, dest: Path | None = None, timeout: int = 600) -> tuple[int, bytes | None]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=CTX, timeout=timeout) as res:
        if dest is None:
            return res.status, res.read()
        dest.parent.mkdir(parents=True, exist_ok=True)
        h = hashlib.sha256()
        n = 0
        with dest.open("wb") as out:
            while True:
                chunk = res.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
                h.update(chunk)
                n += len(chunk)
                if n % (50 * 1024 * 1024) < 1024 * 1024:
                    print(f"  {dest.name}: {n / 1e6:.1f} MB", flush=True)
        (dest.parent / f"{dest.name}.sha256").write_text(h.hexdigest() + "\n", encoding="utf-8")
        return res.status, None


def json_get(url: str, timeout: int = 120) -> dict:
    status, body = fetch(url, timeout=timeout)
    if status != 200 or not body:
        raise RuntimeError(f"{status} {url}")
    return json.loads(body.decode("utf-8", "replace"))


FILES = [
    {
        "id": "austin_issued_construction_permits",
        "jurisdiction": "austin-travis",
        "url": "https://data.austintexas.gov/api/views/3syk-w9eu/rows.csv?accessType=DOWNLOAD",
        "path": AUSTIN_RAW / "3syk-w9eu-issued-construction-permits.csv",
        "agency": "City of Austin Development Services",
        "access_class": "OPEN_SOCRATA",
        "dataset_id": "3syk-w9eu",
    },
    {
        "id": "travis_cad_export_layout",
        "jurisdiction": "austin-travis",
        "url": "https://traviscad.org/wp-content/largefiles/Website_Legacy8.0.33-AppraisalExportLayout_06182026.zip",
        "path": AUSTIN_RAW / "tcad-export-layout-06182026.zip",
        "agency": "Travis Central Appraisal District",
        "access_class": "OPEN_BULK_DOWNLOAD",
    },
    {
        "id": "travis_cad_2026_certified_appraisal_export",
        "jurisdiction": "austin-travis",
        "url": "https://traviscad.org/wp-content/largefiles/2026%20Certified%20Appraisal%20Export%20Supp%200_07182026.zip",
        "path": AUSTIN_RAW / "tcad-2026-certified-appraisal-export-supp0-07182026.zip",
        "agency": "Travis Central Appraisal District",
        "access_class": "OPEN_BULK_DOWNLOAD",
    },
]


def download_listed() -> list[dict]:
    out = []
    for spec in FILES:
        dest: Path = spec["path"]
        print(f"GET {spec['id']} -> {dest}", flush=True)
        t0 = time.time()
        try:
            status, _ = fetch(spec["url"], dest=dest)
            sha = (dest.parent / f"{dest.name}.sha256").read_text(encoding="utf-8").strip()
            rec = {
                **{k: spec[k] for k in ("id", "jurisdiction", "url", "agency", "access_class") if k in spec},
                "path": str(dest),
                "bytes": dest.stat().st_size,
                "sha256": sha,
                "http_status": status,
                "retrieved_at": utcnow(),
                "seconds": round(time.time() - t0, 1),
                "ok": status == 200 and dest.stat().st_size > 0,
            }
        except Exception as exc:
            rec = {
                "id": spec["id"],
                "url": spec["url"],
                "ok": False,
                "error": str(exc),
                "retrieved_at": utcnow(),
            }
            print(f"  FAIL {spec['id']}: {exc}", flush=True)
        out.append(rec)
        print(f"  {'OK' if rec.get('ok') else 'FAIL'} {spec['id']} {rec.get('bytes', 0)} bytes", flush=True)
    return out


def fort_worth_probe() -> dict:
    layer = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0"
    info = json_get(f"{layer}?f=json")
    count = json_get(f"{layer}/query?where=1%3D1&returnCountOnly=true&f=json")
    fields = [
        {
            "name": f.get("name"),
            "alias": f.get("alias"),
            "type": f.get("type"),
        }
        for f in info.get("fields") or []
    ]
    csv_url = (
        "https://www.arcgis.com/sharing/rest/content/items/"
        "d2740f4d746b4bfaa03e25de0376238b/data"
    )
    hub_csv = (
        "https://data.fortworthtexas.gov/api/download/v1/items/"
        "d2740f4d746b4bfaa03e25de0376238b/csv?layers=0"
    )
    dest = FTW_RAW / "cfw-development-permits.csv"
    print("GET fort_worth development permits CSV", flush=True)
    rec = {
        "id": "fort_worth_development_permits",
        "jurisdiction": "fort-worth-tarrant",
        "agency": "City of Fort Worth Development Services",
        "access_class": "OPEN_GIS_SERVICE",
        "feature_layer": layer,
        "item_id": "d2740f4d746b4bfaa03e25de0376238b",
        "official_full_download_page": "https://data.fortworthtexas.gov/Development-Infrastructure/Development-Permits/quz7-xnsy",
        "max_record_count": info.get("maxRecordCount"),
        "current_version": info.get("currentVersion"),
        "geometry_type": info.get("geometryType"),
        "display_field": info.get("displayField"),
        "fields": fields,
        "service_count": count.get("count"),
        "retrieved_at": utcnow(),
    }
    last_err = None
    for url in (hub_csv, csv_url):
        try:
            t0 = time.time()
            status, _ = fetch(url, dest=dest, timeout=1800)
            rec.update(
                {
                    "url": url,
                    "path": str(dest),
                    "bytes": dest.stat().st_size,
                    "sha256": (dest.parent / f"{dest.name}.sha256").read_text(encoding="utf-8").strip(),
                    "http_status": status,
                    "seconds": round(time.time() - t0, 1),
                    "ok": status == 200 and dest.stat().st_size > 1000,
                }
            )
            if rec["ok"]:
                break
        except Exception as exc:
            last_err = str(exc)
            rec["error"] = last_err
            rec["ok"] = False
    return rec


def main() -> int:
    AUSTIN_RAW.mkdir(parents=True, exist_ok=True)
    FTW_RAW.mkdir(parents=True, exist_ok=True)
    listed = download_listed()
    ftw = fort_worth_probe()
    report = {
        "ticket": "TX-CON-LOCAL-001A",
        "retrieved_at": utcnow(),
        "raw_root": str(RAW_ROOT),
        "files": listed + [ftw],
    }
    out = ROOT / "data" / "texas" / "local" / "tx-local-001a" / "acquire-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": all(f.get("ok") for f in report["files"]), "n": len(report["files"])}, indent=2))
    return 0 if all(f.get("ok") for f in report["files"]) else 2


if __name__ == "__main__":
    sys.exit(main())
