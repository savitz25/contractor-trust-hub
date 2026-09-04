"""Paginate official Fort Worth Development Permits FeatureServer to CSV."""
from __future__ import annotations

import csv
import hashlib
import json
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

LAYER = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0"
DEST = Path(r"S:\ath-raw\tx-con-local-001a\fort-worth-tarrant\cfw-development-permits.csv")
CTX = ssl.create_default_context()
UA = "ContractorTrustHub/TX-CON-LOCAL-001A"
PAGE = 32000
FIELDS = [
    "Unique_ID",
    "Permit_No",
    "Permit_Type",
    "Permit_SubType",
    "Permit_Category",
    "B1_SPECIAL_TEXT",
    "B1_WORK_DESC",
    "Full_Street_Address",
    "Zip_Code",
    "B1_LOT",
    "B1_BLOCK",
    "B1_TRACT",
    "B1_LEGAL_DESC",
    "Owner_Full_Name",
    "File_Date",
    "Current_Status",
    "Status_Date",
    "Location_1",
    "JobValue",
    "Use_Type",
    "Specific_Use",
    "Units",
    "SqFt",
    "ObjectId",
]


def get(url: str, attempts: int = 6) -> dict:
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, context=CTX, timeout=180) as res:
                return json.loads(res.read().decode("utf-8", "replace"))
        except Exception as exc:
            last = exc
            time.sleep(2 + i)
    raise last  # type: ignore[misc]


def main() -> None:
    DEST.parent.mkdir(parents=True, exist_ok=True)
    offset = 0
    rows = 0
    with DEST.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        while True:
            q = urllib.parse.urlencode(
                {
                    "where": "1=1",
                    "outFields": ",".join(FIELDS),
                    "f": "json",
                    "resultOffset": offset,
                    "resultRecordCount": PAGE,
                    "orderByFields": "ObjectId",
                    "resultType": "standard",
                    "maxRecordCountFactor": 32,
                }
            )
            data = get(f"{LAYER}/query?{q}")
            feats = data.get("features") or []
            if not feats:
                break
            for feat in feats:
                w.writerow(feat.get("attributes") or {})
            rows += len(feats)
            offset += len(feats)
            print(f"fw rows {rows} batch {len(feats)} offset {offset} exceeded={data.get('exceededTransferLimit')}", flush=True)
            if not data.get("exceededTransferLimit"):
                break
    h = hashlib.sha256()
    with DEST.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    (DEST.parent / f"{DEST.name}.sha256").write_text(h.hexdigest() + "\n", encoding="utf-8")
    print(json.dumps({"rows": rows, "bytes": DEST.stat().st_size, "sha256": h.hexdigest()}))


if __name__ == "__main__":
    main()
