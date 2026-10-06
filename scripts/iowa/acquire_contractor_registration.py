"""Acquire the Iowa DIAL active construction registration release."""

import csv
import hashlib
import io
import json
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import requests


ROOT = Path(__file__).resolve().parents[2]
URL = "https://idh-be.iowa.gov/api/v1/datasets/1052/rows.csv"
DEST = ROOT / "data/iowa/ia-con-001"


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    response = requests.get(URL, timeout=90)
    response.raise_for_status()
    archive = response.content
    with zipfile.ZipFile(io.BytesIO(archive)) as zf:
        names = zf.namelist()
        assert len(names) == 1 and names[0].endswith(".csv"), names
        csv_bytes = zf.read(names[0])
    rows = list(csv.DictReader(io.StringIO(csv_bytes.decode("utf-8-sig"))))
    ids = [row["registration_number"].strip() for row in rows]
    assert all(ids) and len(set(ids)) == len(ids)
    assert all(row["expire_date"] for row in rows)
    retrieved = datetime.now(timezone.utc).isoformat()
    snapshot = {
        "contract": "iowa-contractor-registrations-v1",
        "source": URL,
        "catalog": "https://data.iowa.gov/catalog/dataset/1052",
        "regulator": "Iowa Department of Inspections, Appeals, and Licensing",
        "grain": "Active construction contractor registration number; includes individuals and businesses, not a trade license",
        "retrievedAt": retrieved,
        "sourceAsOf": None,
        "downloadSha256": hashlib.sha256(archive).hexdigest(),
        "csvSha256": hashlib.sha256(csv_bytes).hexdigest(),
        "rawRows": len(rows),
        "distinctRegistrationNumbers": len(set(ids)),
        "rowsWithBusinessName": sum(bool(row["business_name"].strip()) for row in rows),
        "rowsWithPersonName": sum(bool(row["first_name"].strip() or row["last_name"].strip()) for row in rows),
        "primaryActivities": [{"activity": name, "registrations": count} for name, count in Counter(row["primary_activity"].strip() or "Unspecified" for row in rows).most_common()],
        "graphWrites": 0,
    }
    (DEST / "active-construction-registration-release.zip").write_bytes(archive)
    (DEST / "registration-snapshot.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: snapshot[k] for k in ("rawRows", "distinctRegistrationNumbers", "downloadSha256", "retrievedAt")}, indent=2))


if __name__ == "__main__":
    main()
