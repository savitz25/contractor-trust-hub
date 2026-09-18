"""Analyze SFM fire-protection company and individual rosters."""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/ohio/sfm/raw"
OUT = ROOT / "data/ohio/sfm/analysis.json"


def load(name: str) -> tuple[list[dict], str, int]:
    path = RAW / name
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    sha_path = path.with_suffix(".csv.sha256") if False else RAW / (path.stem + ".sha256")
    claimed = sha_path.read_text(encoding="utf-8").strip() if sha_path.exists() else digest
    if digest != claimed:
        raise SystemExit(f"checksum mismatch {name}: {digest} != {claimed}")
    rows = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
    return rows, digest, len(data)


def main() -> None:
    companies, csha, cbytes = load("sfm_fire_companies_roster.csv")
    individuals, isha, ibytes = load("sfm_fire_individuals_roster.csv")

    def colset(rows):
        return list(rows[0].keys()) if rows else []

    c_cred = [(r.get("Credential") or "").strip() for r in companies]
    c_status = Counter((r.get("License Status") or "").strip().upper() for r in companies)
    c_type = Counter((r.get("Licensee Type") or "").strip() for r in companies)
    c_reason = Counter((r.get("Status Reason") or "").strip() or "(blank)" for r in companies)

    i_cred = [(r.get("Credential") or "").strip() for r in individuals]
    i_status = Counter((r.get("License Status") or "").strip().upper() for r in individuals)
    i_type = Counter((r.get("Licensee Type") or "").strip() for r in individuals)
    i_cat = Counter((r.get("Category") or "").strip() or "(blank)" for r in individuals)
    i_cat_type = Counter((r.get("Category Type") or "").strip() or "(blank)" for r in individuals)
    i_cat_status = Counter((r.get("Category Status") or "").strip() or "(blank)" for r in individuals)
    i_names = {(r.get("Name") or "").strip().upper() for r in individuals}

    analysis = {
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "companies": {
            "path": "data/ohio/sfm/raw/sfm_fire_companies_roster.csv",
            "sha256": csha,
            "bytes": cbytes,
            "rows": len(companies),
            "columns": colset(companies),
            "distinct_credentials": len(set(c_cred) - {""}),
            "blank_credentials": sum(1 for x in c_cred if not x),
            "license_status": dict(c_status),
            "licensee_type": dict(c_type),
            "status_reason_top": dict(c_reason.most_common(15)),
            "sample_credentials": sorted(set(c_cred))[:5],
        },
        "individuals": {
            "path": "data/ohio/sfm/raw/sfm_fire_individuals_roster.csv",
            "sha256": isha,
            "bytes": ibytes,
            "rows": len(individuals),
            "columns": colset(individuals),
            "distinct_credentials": len(set(i_cred) - {""}),
            "distinct_names": len(i_names - {""}),
            "blank_credentials": sum(1 for x in i_cred if not x),
            "license_status": dict(i_status),
            "licensee_type": dict(i_type),
            "category": dict(i_cat),
            "category_type": dict(i_cat_type),
            "category_status": dict(i_cat_status),
            "sample_credentials": sorted(set(i_cred))[:5],
        },
        "notes": {
            "company_ne_individual": True,
            "sfm_ne_ocilb": True,
            "category_rows_may_exceed_distinct_certs": True,
        },
    }
    OUT.write_text(json.dumps(analysis, indent=2), encoding="utf-8")
    print(json.dumps(analysis, indent=2)[:8000])


if __name__ == "__main__":
    main()
