"""CA-CON-COUNTY-001A — download official SF/SD bulk files (gitignored raw)."""
from __future__ import annotations

import hashlib
import json
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
RAW_SF = ROOT / "data" / "raw" / "california" / "counties" / "san-francisco"
RAW_SD = ROOT / "data" / "raw" / "california" / "counties" / "san-diego"
CTX = ssl.create_default_context()
UA = "ContractorTrustHub/CA-CON-COUNTY-001A (research; official open-data harvest)"

FILES = [
    {
        "jurisdiction": "san-francisco",
        "id": "sf_registered_business_locations",
        "url": "https://data.sfgov.org/api/views/g8m3-pdis/rows.csv?accessType=DOWNLOAD",
        "path": RAW_SF / "g8m3-pdis-registered-business-locations.csv",
        "agency": "Treasurer & Tax Collector / DataSF",
        "access_class": "OPEN_SOCRATA",
    },
    {
        "jurisdiction": "san-francisco",
        "id": "sf_building_permits",
        "url": "https://data.sfgov.org/api/views/i98e-djp9/rows.csv?accessType=DOWNLOAD",
        "path": RAW_SF / "i98e-djp9-building-permits.csv",
        "agency": "Department of Building Inspection / DataSF",
        "access_class": "OPEN_SOCRATA",
    },
    {
        "jurisdiction": "san-francisco",
        "id": "sf_building_permit_contacts",
        "url": "https://data.sfgov.org/api/views/3pee-9qhc/rows.csv?accessType=DOWNLOAD",
        "path": RAW_SF / "3pee-9qhc-building-permit-contacts.csv",
        "agency": "Department of Building Inspection / DataSF",
        "access_class": "OPEN_SOCRATA",
    },
    {
        "jurisdiction": "san-francisco",
        "id": "sf_building_inspections",
        "url": "https://data.sfgov.org/api/views/vckc-dh2h/rows.csv?accessType=DOWNLOAD",
        "path": RAW_SF / "vckc-dh2h-building-inspections.csv",
        "agency": "Department of Building Inspection / DataSF",
        "access_class": "OPEN_SOCRATA",
    },
    {
        "jurisdiction": "city-of-san-diego",
        "id": "sd_approvals_created_2024",
        "url": "https://seshat.datasd.org/development_permits/approvals_created_2024_datasd.csv",
        "path": RAW_SD / "approvals_created_2024_datasd.csv",
        "agency": "City of San Diego Development Services",
        "access_class": "OPEN_BULK_DOWNLOAD",
        "note": "Year-filtered created approvals. Full 653MB created file skipped (disk). CITY OF SAN DIEGO, not county.",
    },
    {
        "jurisdiction": "city-of-san-diego",
        "id": "sd_approvals_created_2025",
        "url": "https://seshat.datasd.org/development_permits/approvals_created_2025_datasd.csv",
        "path": RAW_SD / "approvals_created_2025_datasd.csv",
        "agency": "City of San Diego Development Services",
        "access_class": "OPEN_BULK_DOWNLOAD",
    },
    {
        "jurisdiction": "city-of-san-diego",
        "id": "sd_approvals_created_2026",
        "url": "https://seshat.datasd.org/development_permits/approvals_created_2026_datasd.csv",
        "path": RAW_SD / "approvals_created_2026_datasd.csv",
        "agency": "City of San Diego Development Services",
        "access_class": "OPEN_BULK_DOWNLOAD",
    },
    {
        "jurisdiction": "city-of-san-diego",
        "id": "sd_approvals_dictionary",
        "url": "https://seshat.datasd.org/development_permits_set2/permits_set2_datasd_dict.csv",
        "path": RAW_SD / "permits_set2_datasd_dict.csv",
        "agency": "City of San Diego Development Services",
        "access_class": "OPEN_BULK_DOWNLOAD",
    },
    {
        "jurisdiction": "city-of-san-diego",
        "id": "sd_business_tax_active",
        "url": "https://seshat.datasd.org/business_tax_certificates/sd_businesses_active_datasd.csv",
        "path": RAW_SD / "sd_businesses_active_datasd.csv",
        "agency": "City of San Diego Treasurer",
        "access_class": "OPEN_BULK_DOWNLOAD",
    },
    {
        "jurisdiction": "city-of-san-diego",
        "id": "sd_business_tax_inactive_2015",
        "url": "https://seshat.datasd.org/business_tax_certificates/sd_businesses_inactive_2015tocurr_datasd.csv",
        "path": RAW_SD / "sd_businesses_inactive_2015tocurr_datasd.csv",
        "agency": "City of San Diego Treasurer",
        "access_class": "OPEN_BULK_DOWNLOAD",
    },
    {
        "jurisdiction": "city-of-san-diego",
        "id": "sd_business_tax_dictionary",
        "url": "https://seshat.datasd.org/business_tax_certificates/sd_businesses_dictionary_datasd.csv",
        "path": RAW_SD / "sd_businesses_dictionary_datasd.csv",
        "agency": "City of San Diego Treasurer",
        "access_class": "OPEN_BULK_DOWNLOAD",
    },
    {
        "jurisdiction": "city-of-san-diego",
        "id": "sd_rental_unit_business_tax",
        "url": "https://seshat.datasd.org/rtax_accounts/rtax_accounts_datasd.csv",
        "path": RAW_SD / "rtax_accounts_datasd.csv",
        "agency": "City of San Diego Treasurer",
        "access_class": "OPEN_BULK_DOWNLOAD",
        "optional": True,
    },
]


def download(url: str, dest: Path) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    h = hashlib.sha256()
    n = 0
    t0 = time.time()
    with urllib.request.urlopen(req, context=CTX, timeout=180) as r:
        status = r.status
        ctype = r.headers.get("Content-Type", "")
        with tmp.open("wb") as out:
            while True:
                chunk = r.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
                h.update(chunk)
                n += len(chunk)
    tmp.replace(dest)
    return {
        "http_status": status,
        "content_type": ctype,
        "bytes": n,
        "sha256": h.hexdigest(),
        "seconds": round(time.time() - t0, 2),
        "path": str(dest.relative_to(ROOT)).replace("\\", "/"),
    }


def main() -> int:
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    report = {
        "ticket": "CA-CON-COUNTY-001A",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for spec in FILES:
        if only and spec["id"] not in only:
            continue
        dest: Path = spec["path"]
        print(f"GET {spec['id']} -> {dest.name}", flush=True)
        try:
            meta = download(spec["url"], dest)
            meta.update({k: spec[k] for k in ("id", "url", "agency", "access_class", "jurisdiction")})
            if spec.get("note"):
                meta["note"] = spec["note"]
            print(f"  {meta['http_status']} {meta['bytes']} {meta['sha256'][:16]} {meta['seconds']}s", flush=True)
        except Exception as exc:
            meta = {
                "id": spec["id"],
                "url": spec["url"],
                "error": str(exc),
                "optional": bool(spec.get("optional")),
            }
            print(f"  FAIL {exc}", flush=True)
            if not spec.get("optional"):
                report["files"].append(meta)
                Path(ROOT / "artifacts" / "ca-con-county-001a").mkdir(parents=True, exist_ok=True)
                (ROOT / "artifacts" / "ca-con-county-001a" / "acquire-report.json").write_text(
                    json.dumps(report, indent=2) + "\n", encoding="utf-8"
                )
                return 1
        report["files"].append(meta)
    out_dir = ROOT / "artifacts" / "ca-con-county-001a"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "acquire-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("WROTE artifacts/ca-con-county-001a/acquire-report.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
