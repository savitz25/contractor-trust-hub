"""CO-CON-001: acquire DORA master extract once via official Socrata CSV.

Does not scrape search pages. Does not download per prefix.
Raw CSV is gitignored; manifest + staged aggregates are committed.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import ssl
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "co_dora"
STAGE = ROOT / "data" / "colorado" / "co-con-001"
TYPES_URL = "https://data.colorado.gov/resource/349y-twqi.json?$limit=5000"
MASTER_CSV = "https://data.colorado.gov/api/views/7s5z-vewr/rows.csv?accessType=DOWNLOAD"
DATASET_ID = "7s5z-vewr"
TYPES_ID = "349y-twqi"
UA = {"User-Agent": "ContractorTrustHub/CO-CON-001 (research; official SODA)"}
CTX = ssl.create_default_context()

BUSINESS_PREFIXES = ("EC", "PC")
PERSON_TRADE_PREFIXES = ("ME", "JW", "RW", "MP", "JP", "RP")
APPRENTICE_PREFIXES = ("APE", "AP")
AELS_PREFIXES = ("PE", "ARC", "PLS", "LA")
CONTRACTOR_PREFIXES = BUSINESS_PREFIXES + PERSON_TRADE_PREFIXES + APPRENTICE_PREFIXES + AELS_PREFIXES
ACTIVE_EXACT = "Active"
ACTIVE_PREFIX = "Active"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=600, context=CTX) as resp:
        return resp.read()


def stream_csv(url: str, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha256()
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=600, context=CTX) as resp, dest.open("wb") as out:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            h.update(chunk)
            out.write(chunk)
    return h.hexdigest()


def norm_status(value: str) -> str:
    return (value or "").strip()


def is_active_exact(status: str) -> bool:
    return status == ACTIVE_EXACT


def is_active_family(status: str) -> bool:
    return status.startswith(ACTIVE_PREFIX)


def public_name(row: dict) -> str:
    entity = (row.get("entityName") or "").strip()
    if entity:
        return entity
    parts = [row.get("firstName") or "", row.get("middleName") or "", row.get("lastName") or "", row.get("suffix") or ""]
    return " ".join(p.strip() for p in parts if p and p.strip()).strip()


def main() -> None:
    retrieved = utc_now()
    RAW.mkdir(parents=True, exist_ok=True)
    STAGE.mkdir(parents=True, exist_ok=True)

    types_raw = json.loads(fetch(TYPES_URL).decode("utf-8"))
    types_path = STAGE / "license-types.json"
    types_path.write_text(json.dumps(types_raw, indent=2), encoding="utf-8")
    type_by_prefix = {}
    for row in types_raw:
        prefix = (row.get("licenseprefix") or "").strip()
        if prefix:
            type_by_prefix[prefix] = {
                "category": row.get("licensecategory"),
                "type": row.get("licensetype"),
                "prefix": prefix,
                "business_or_individual": row.get("businessorindividual"),
                "renewal_cycle": row.get("renewalcycle"),
            }

    csv_path = RAW / "professional-occupational-licenses.csv"
    sha256 = stream_csv(MASTER_CSV, csv_path)
    size = csv_path.stat().st_size

    master_rows = 0
    discipline_rows = 0
    prefix_all: Counter[str] = Counter()
    prefix_active: Counter[str] = Counter()
    prefix_active_family: Counter[str] = Counter()
    prefix_status: dict[str, Counter[str]] = defaultdict(Counter)
    action_dist: Counter[str] = Counter()
    case_all: set[str] = set()
    case_contractor: set[str] = set()
    discipline_contractor_rows = 0
    ec_pc_index: list[dict] = []
    contractor_discipline: list[dict] = []
    ec_pc_names: Counter[str] = Counter()
    identity_keys: set[str] = set()
    duplicate_identity_rows = 0

    with csv_path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            master_rows += 1
            prefix = (row.get("licensePrefix") or row.get("licensetype") or "").strip()
            number = (row.get("licenseNumber") or row.get("licensenumber") or "").strip()
            status = norm_status(row.get("licenseStatusDescription") or row.get("licensestatusdescription") or "")
            case = (row.get("caseNumber") or row.get("casenumber") or "").strip()
            action = (row.get("programAction") or row.get("programaction") or "").strip()
            prefix_all[prefix] += 1
            prefix_status[prefix][status or "BLANK"] += 1
            if is_active_exact(status):
                prefix_active[prefix] += 1
            if is_active_family(status):
                prefix_active_family[prefix] += 1
            if case:
                discipline_rows += 1
                case_all.add(case)
                action_dist[action or "BLANK"] += 1
            ident = f"{prefix}:{number}" if prefix and number else ""
            if prefix in CONTRACTOR_PREFIXES and ident:
                if ident in identity_keys:
                    duplicate_identity_rows += 1
                else:
                    identity_keys.add(ident)
            if prefix in BUSINESS_PREFIXES:
                name = public_name(row)
                if name:
                    ec_pc_names[name.casefold()] += 1
                ec_pc_index.append(
                    {
                        "p": prefix,
                        "n": number,
                        "e": name,
                        "s": status,
                        "c": (row.get("city") or "").strip(),
                        "st": (row.get("state") or "").strip(),
                        "z": (row.get("mailZipCode") or row.get("mailzipcode") or "").strip(),
                        "i": (row.get("licenseFirstIssueDate") or "").strip()[:10],
                        "x": (row.get("licenseExpirationDate") or "").strip()[:10],
                        "v": (row.get("linkToVerifyLicense") or {}).get("url")
                        if isinstance(row.get("linkToVerifyLicense"), dict)
                        else (row.get("linkToVerifyLicense") or "").strip(),
                    }
                )
            if prefix in CONTRACTOR_PREFIXES and case:
                discipline_contractor_rows += 1
                case_contractor.add(case)
                contractor_discipline.append(
                    {
                        "p": prefix,
                        "n": number,
                        "case": case,
                        "action": action,
                        "effective": (row.get("disciplineEffectiveDate") or "").strip(),
                        "complete": (row.get("disciplineCompleteDate") or "").strip(),
                    }
                )

    def pack_prefix(prefix: str) -> dict:
        info = type_by_prefix.get(prefix, {})
        return {
            "prefix": prefix,
            "type": info.get("type"),
            "category": info.get("category"),
            "business_or_individual": info.get("business_or_individual"),
            "all_rows": prefix_all.get(prefix, 0),
            "active_exact": prefix_active.get(prefix, 0),
            "active_family": prefix_active_family.get(prefix, 0),
            "status_counts": dict(prefix_status.get(prefix, {})),
        }

    report = {
        "ticket": "CO-CON-001",
        "retrieved_at": retrieved,
        "dataset_id": DATASET_ID,
        "types_dataset_id": TYPES_ID,
        "source_url": "https://data.colorado.gov/Regulations/Professional-and-Occupational-Licenses-in-Colorado/7s5z-vewr",
        "csv_url": MASTER_CSV,
        "types_url": "https://data.colorado.gov/Regulations/Professional-and-Occupational-License-Types-in-Col/349y-twqi",
        "soda_resource": f"https://data.colorado.gov/resource/{DATASET_ID}.json",
        "update_description": "Official CIM/DORA extract. Dataset metadata: nightly after midnight. CIM 'Expected Update Frequency: Never' is catalog noise.",
        "license": "Public Domain",
        "access": "SOCRATA_API / BULK_CSV",
        "raw_csv": str(csv_path.relative_to(ROOT)).replace("\\", "/"),
        "raw_bytes": size,
        "raw_sha256": sha256,
        "master_rows": master_rows,
        "type_rows": len(types_raw),
        "distinct_prefixes_in_master": len(prefix_all),
        "discipline_flagged_rows": discipline_rows,
        "distinct_case_numbers_all": len(case_all),
        "contractor_relevant": {p: pack_prefix(p) for p in CONTRACTOR_PREFIXES},
        "ec_pc_index_rows": len(ec_pc_index),
        "ec_pc_distinct_normalized_names": len(ec_pc_names),
        "ec_pc_names_with_multiple_credentials": sum(1 for n, c in ec_pc_names.items() if c > 1),
        "contractor_identity_keys": len(identity_keys),
        "duplicate_contractor_identity_rows": duplicate_identity_rows,
        "contractor_discipline_rows": discipline_contractor_rows,
        "contractor_distinct_cases": len(case_contractor),
        "top_discipline_actions": action_dist.most_common(25),
        "no_statewide_gc": True,
    }
    (STAGE / "acquire-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (STAGE / "ec-pc-identity-index.json").write_text(json.dumps({"version": "co-con-001-ec-pc-v1", "rows": ec_pc_index}, separators=(",", ":")), encoding="utf-8")
    (STAGE / "contractor-discipline.json").write_text(json.dumps({"version": "co-con-001-discipline-v1", "rows": contractor_discipline}, separators=(",", ":")), encoding="utf-8")
    (RAW / "manifest.json").write_text(
        json.dumps(
            {
                "ticket": "CO-CON-001",
                "dataset_id": DATASET_ID,
                "retrieved_at": retrieved,
                "csv": "professional-occupational-licenses.csv",
                "sha256": sha256,
                "bytes": size,
                "rows": master_rows,
                "source": MASTER_CSV,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"ok": True, "master_rows": master_rows, "sha256": sha256, "bytes": size, "discipline_rows": discipline_rows}, indent=2))


if __name__ == "__main__":
    main()
