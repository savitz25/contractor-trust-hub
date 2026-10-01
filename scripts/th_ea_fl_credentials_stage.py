"""Build the frozen, person-credential-only Florida DBPR wave. No database access."""
from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/th_enrich_b1"
OUT = ROOT / "artifacts/th-ea-fl-credentials"
SOURCES = (
    ("lic08el.csv", "08", "fl_dbpr_eclb_08", {"EC", "EF", "EG", "ES", "ER", "EY", "EZ", "ET", "EH", "EI", "EJ"}, 17976,
     "b1bbbd8f6c707869376357ec914ce98a3fb1269669e4b79ebe61442b74540754"),
    ("lic07mold.csv", "07", "fl_dbpr_mold_07", {"MRSA", "MRSR"}, 6558,
     "705bcf08e2b82f71c79fa0afffc906c5f853362dd9232d6506efdb546b3cd08e"),
    ("lic04home.csv", "04", "fl_dbpr_home_04", {"HI"}, 8026,
     "d403712866922381a124ec6def6c0f61e57a7cc3f51b46708029eecfd9b93cf1"),
)
RETRIEVED_AT = {
    "lic08el.csv": "2026-09-30T13:17:47.909697+00:00",
    "lic07mold.csv": "2026-09-30T13:17:47.844312+00:00",
    "lic04home.csv": "2026-09-30T13:17:47.873149+00:00",
}
FIELDS = (
    "board_number", "occupation_code", "licensee_name", "dba_name", "class_code",
    "address_1", "address_2", "address_3", "city", "state", "postal_code",
    "county_code", "license_number_core", "primary_status", "secondary_status",
    "original_licensure_date", "effective_date", "expiration_date", "unknown_18",
    "unknown_19", "alternate_license_number", "ce_note",
)
STAGE_FIELDS = (
    "source_dataset", "source_file", "source_sha256", "source_line", "board_number",
    "occupation_code", "external_key", "license_number", "class_code",
    "licensee_name_raw", "dba_name_raw", "primary_status", "secondary_status",
    "status_normalized", "original_licensure_date", "effective_date", "expiration_date",
    "address_line_1", "address_line_2", "address_line_3", "city", "state",
    "postal_code", "county_code",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def date_value(value: str) -> str:
    if not value.strip():
        return ""
    return datetime.strptime(value.strip(), "%m/%d/%Y").date().isoformat()


def build() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    staged = []
    sources = []
    all_keys = set()
    for filename, board, dataset, eligible, expected, expected_hash in SOURCES:
        path = RAW / filename
        source_hash = digest(path)
        if source_hash != expected_hash:
            raise ValueError(f"{filename}: frozen official source checksum changed")
        raw_count = 0
        selected = []
        key_counts: Counter[str] = Counter()
        class_counts: Counter[str] = Counter()
        status_counts: Counter[str] = Counter()
        with path.open(encoding="utf-8-sig", newline="") as stream:
            for source_line, values in enumerate(csv.reader(stream), 1):
                raw_count += 1
                if len(values) != len(FIELDS):
                    raise ValueError(f"{filename}:{source_line}: source width changed")
                row = dict(zip(FIELDS, values))
                if row["board_number"] != board:
                    raise ValueError(f"{filename}:{source_line}: wrong board")
                code = row["occupation_code"].strip()
                if code not in eligible:
                    continue
                native = row["alternate_license_number"].strip() or code + row["license_number_core"].strip()
                if not native:
                    raise ValueError(f"{filename}:{source_line}: missing native key")
                key = (board, code, native)
                key_counts[str(key)] += 1
                if native in all_keys:
                    raise ValueError(f"{filename}:{source_line}: cross-board external key collision")
                all_keys.add(native)
                primary, secondary = row["primary_status"].strip(), row["secondary_status"].strip()
                status = "active" if (primary, secondary) == ("C", "A") else "inactive" if secondary == "I" else "other"
                record = {
                    "source_dataset": dataset, "source_file": filename, "source_sha256": source_hash,
                    "source_line": source_line, "board_number": board, "occupation_code": code,
                    "external_key": native, "license_number": row["license_number_core"].strip(),
                    "class_code": row["class_code"].strip(), "licensee_name_raw": row["licensee_name"].strip(),
                    "dba_name_raw": row["dba_name"].strip(), "primary_status": primary,
                    "secondary_status": secondary, "status_normalized": status,
                    "original_licensure_date": date_value(row["original_licensure_date"]),
                    "effective_date": date_value(row["effective_date"]),
                    "expiration_date": date_value(row["expiration_date"]),
                    "address_line_1": row["address_1"].strip(), "address_line_2": row["address_2"].strip(),
                    "address_line_3": row["address_3"].strip(), "city": row["city"].strip(),
                    "state": row["state"].strip(), "postal_code": row["postal_code"].strip(),
                    "county_code": row["county_code"].strip(),
                }
                selected.append(record)
                class_counts[code] += 1
                status_counts[f"{primary or '-'}|{secondary or '-'}"] += 1
        if len(selected) != expected or len(key_counts) != expected or max(key_counts.values(), default=0) != 1:
            raise ValueError(f"{filename}: certified set or native uniqueness changed")
        staged.extend(selected)
        sources.append({
            "source_file": filename, "official_url": f"https://www2.myfloridalicense.com/sto/file_download/extracts/{filename}",
            "retrieved_at": RETRIEVED_AT[filename],
            "source_sha256": source_hash, "raw_rows": raw_count, "certified_rows": len(selected),
            "board": board, "source_dataset": dataset, "classes": dict(sorted(class_counts.items())),
            "status_codes": dict(sorted(status_counts.items())), "duplicate_native_keys": 0,
        })
    if len(staged) != 32560:
        raise ValueError("certified wave must contain exactly 32560 credentials")
    stage_file = OUT / "fl-certified-person-credentials.csv"
    with stage_file.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=STAGE_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(staged)
    manifest = {
        "ticket": "TH-EA-UNPUBLISHED-2026-10-01-FL-CREDENTIALS",
        "grain": "person credential, never canonical business", "contractor_id": None,
        "canonical_business_denominator_change": 0, "total_certified": len(staged),
        "stage_file": str(stage_file.relative_to(ROOT)).replace("\\", "/"),
        "stage_sha256": digest(stage_file), "stage_fields": list(STAGE_FIELDS),
        "native_key": "Florida DBPR board + occupation code + alternate license number (or code + numeric core)",
        "sources": sources,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
