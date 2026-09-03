"""Download DIR Electrician Certification Unit lists via CKAN datastore API."""
from __future__ import annotations

import csv
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (compatible; ContractorTrustHub/CA-CON-001)"}
RESOURCES = {
    "certified_electrician_list": "291bacb8-2fdb-4d9c-a330-113781ce2f59",
    "electrician_trainee_list": "f0b9e36d-32be-408d-8dd9-4d539becfdc8",
}
OUT = Path("data/raw/ca_dir_ecu")
PAGE = 32000


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    return json.loads(urllib.request.urlopen(req, timeout=120).read())


def dump_resource(name: str, rid: str) -> None:
    offset = 0
    rows: list[dict] = []
    fields: list[str] = []
    total = None
    while True:
        q = urllib.parse.urlencode({"resource_id": rid, "limit": PAGE, "offset": offset})
        payload = fetch(f"https://data.ca.gov/api/3/action/datastore_search?{q}")
        result = payload["result"]
        total = result.get("total", total)
        batch = result.get("records") or []
        if not fields:
            fields = [f["id"] for f in result.get("fields") or [] if f.get("id") != "_id"]
        rows.extend(batch)
        print(name, "got", len(rows), "of", total)
        if not batch or (total is not None and len(rows) >= total):
            break
        offset += PAGE
    dest = OUT / f"{name}.csv"
    with dest.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in fields})
    data = dest.read_bytes()
    print("saved", dest, len(rows), hashlib.sha256(data).hexdigest())


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pkg = fetch("https://data.ca.gov/api/3/action/package_show?id=dir-electrician-certification-unit-ecu")
    (OUT / "package.json").write_text(json.dumps({"success": True, "result": {
        "id": pkg["result"].get("id"),
        "name": pkg["result"].get("name"),
        "metadata_modified": pkg["result"].get("metadata_modified"),
        "resources": [
            {"id": r.get("id"), "name": r.get("name"), "last_modified": r.get("last_modified"), "format": r.get("format")}
            for r in pkg["result"].get("resources", [])
        ],
    }}, indent=2), encoding="utf-8")
    for name, rid in RESOURCES.items():
        dump_resource(name, rid)


if __name__ == "__main__":
    main()
