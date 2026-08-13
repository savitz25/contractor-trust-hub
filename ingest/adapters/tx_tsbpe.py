"""
Texas TSBPE plumbing license adapter.

Source: official free daily CSVs from
https://tsbpe.texas.gov/free-licensee-list/

Default consumer set: Responsible Master Plumber (RMP) + Master Plumber (MP).
Journeyman / Tradesman are optional secondary files.

Texas has NO statewide general contractor license. This adapter only
normalizes TSBPE plumbing credentials.

Usage:
  python -m ingest.adapters.tx_tsbpe --raw-dir data/raw/tx_tsbpe
  python -m ingest.adapters.tx_tsbpe --input data/samples/tx_tsbpe_rmp_sample.csv --kind rmp
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SOURCE_SYSTEM = "tx_tsbpe"
SOURCE_BOARD = "TSBPE"
SOURCE_URL = "https://tsbpe.texas.gov/free-licensee-list/"

# kind → occupation
KIND_META: dict[str, dict[str, str]] = {
    "rmp": {
        "occupation_code": "TRMP",
        "occupation_description": "Responsible Master Plumber",
        "class_code": "RMP",
        "default_file": "tsbpe_rmp.csv",
    },
    "mp": {
        "occupation_code": "TMP",
        "occupation_description": "Master Plumber",
        "class_code": "MP",
        "default_file": "tsbpe_mp.csv",
    },
    "jp": {
        "occupation_code": "TJP",
        "occupation_description": "Journeyman Plumber",
        "class_code": "JP",
        "default_file": "tsbpe_jp.csv",
    },
    "tp": {
        "occupation_code": "TTP",
        "occupation_description": "Tradesman Plumber-Limited",
        "class_code": "TP",
        "default_file": "tsbpe_tp.csv",
    },
}

LICENSE_OUT_FIELDS = [
    "source_system",
    "source_board",
    "external_key",
    "occupation_code",
    "occupation_description",
    "license_number",
    "class_code",
    "licensee_name_raw",
    "dba_name_raw",
    "primary_status",
    "secondary_status",
    "status_normalized",
    "original_licensure_date",
    "effective_date",
    "expiration_date",
    "address_line_1",
    "address_line_2",
    "address_line_3",
    "city",
    "state",
    "postal_code",
    "county_code",
    "county_name",
    "board_number",
    "raw_payload_json",
]

CONTRACTOR_SEED_FIELDS = [
    "slug",
    "display_name",
    "legal_name",
    "dba_name",
    "home_state",
    "primary_city",
    "primary_county",
    "license_external_key",
]


def _clean(value: str | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _parse_date(value: str | None) -> str:
    v = _clean(value)
    if not v:
        return ""
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            d = datetime.strptime(v, fmt).date()
            # TSBPE uses 01/01/1901 as a missing-date sentinel
            if d.year <= 1901:
                return ""
            return d.isoformat()
        except ValueError:
            continue
    return ""


def _norm_status(raw: str) -> str:
    s = _clean(raw).lower()
    if s in {"current", "active"}:
        return "current" if s == "current" else "active"
    if s in {"expired", "inactive", "lapsed"}:
        return "inactive"
    return s or "unknown"


def _person_name(row: dict[str, str]) -> str:
    parts = [
        _clean(row.get("FIRST_NAME") or row.get("first_name")),
        _clean(row.get("MIDDLE_NAME") or row.get("middle_name")),
        _clean(row.get("LAST_NAME") or row.get("last_name")),
        _clean(row.get("SUFFIX") or row.get("suffix")),
    ]
    return " ".join(p for p in parts if p)


def _slugify(*parts: str, max_len: int = 120) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return (s or "unknown")[:max_len]


def _iter_csv(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield {k: _clean(v) if isinstance(v, str) else "" for k, v in row.items()}


def _detect_kind(path: Path, explicit: str | None) -> str:
    if explicit:
        return explicit.lower()
    name = path.name.lower()
    for key, meta in KIND_META.items():
        if key in name or meta["class_code"].lower() in name:
            return key
    return "rmp"


def normalize_row(row: dict[str, str], kind: str) -> dict[str, str] | None:
    meta = KIND_META[kind]
    lic = _clean(row.get("LICENSE_NBR") or row.get("license_nbr") or row.get("LICENSE_NUMBER"))
    if not lic:
        return None
    person = _person_name(row)
    company = _clean(row.get("PLUMB_COMPANY") or row.get("plumb_company"))
    display = company or person
    if not display:
        return None

    status_raw = _clean(row.get("LIC_STATUS") or row.get("lic_status"))
    county = _clean(row.get("COUNTY") or row.get("county"))
    city = _clean(row.get("CITY") or row.get("city"))
    state = (_clean(row.get("STATE") or row.get("state")) or "TX")[:2].upper()
    class_code = meta["class_code"]
    external_key = f"TX-TSBPE:{class_code}:{lic}"

    payload = {k: v for k, v in row.items() if v}
    payload["tsbpe_list"] = kind

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": meta["occupation_code"],
        "occupation_description": meta["occupation_description"],
        "license_number": lic,
        "class_code": class_code,
        "licensee_name_raw": person or display,
        "dba_name_raw": company,
        "primary_status": status_raw,
        "secondary_status": "",
        "status_normalized": _norm_status(status_raw),
        "original_licensure_date": _parse_date(row.get("LICENSE_DATE") or row.get("license_date")),
        "effective_date": "",
        "expiration_date": _parse_date(row.get("EXPIRATION_DTE") or row.get("expiration_dte")),
        "address_line_1": _clean(row.get("ADDR1") or row.get("addr1")),
        "address_line_2": _clean(row.get("ADDR2") or row.get("addr2")),
        "address_line_3": _clean(row.get("ADDR3") or row.get("addr3")),
        "city": city,
        "state": state,
        "postal_code": _clean(row.get("ZIP") or row.get("zip")),
        "county_code": "",
        "county_name": county.title() if county else "",
        "board_number": "TSBPE",
        "raw_payload_json": json.dumps(payload, ensure_ascii=False),
        "_display": display,
        "_legal": person or display,
        "_dba": company,
        "_slug": _slugify(external_key, display),
    }


def write_outputs(
    rows: list[dict[str, str]],
    out_dir: Path,
    *,
    sources: list[dict[str, Any]],
) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    lic_path = out_dir / "licenses_normalized.csv"
    seed_path = out_dir / "contractors_seed.csv"

    with lic_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=LICENSE_OUT_FIELDS, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow(row)

    with seed_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CONTRACTOR_SEED_FIELDS)
        w.writeheader()
        for row in rows:
            w.writerow(
                {
                    "slug": row["_slug"],
                    "display_name": row["_display"],
                    "legal_name": row["_legal"],
                    "dba_name": row["_dba"],
                    "home_state": row.get("state") or "TX",
                    "primary_city": row.get("city") or "",
                    "primary_county": row.get("county_name") or "",
                    "license_external_key": row["external_key"],
                }
            )

    by_type: dict[str, int] = {}
    for row in rows:
        label = row["occupation_description"]
        by_type[label] = by_type.get(label, 0) + 1

    manifest = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": "tsbpe_free_licensee_lists",
        "source_url": SOURCE_URL,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "row_count_licenses": len(rows),
        "by_type": by_type,
        "sources": sources,
        "coverage_note": (
            "Texas plumbing is licensed by TSBPE. Responsible Master Plumbers may "
            "contract with the public. Not a statewide general contractor directory."
        ),
        "outputs": {
            "licenses_normalized.csv": str(lic_path).replace("\\", "/"),
            "contractors_seed.csv": str(seed_path).replace("\\", "/"),
        },
    }
    man_path = out_dir / "batch_manifest.json"
    man_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def run_files(
    files: list[tuple[Path, str]],
    out_dir: Path,
    limit: int | None,
) -> dict[str, Any]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    sources: list[dict[str, Any]] = []
    skipped_no_key = 0
    skipped_dup = 0

    for path, kind in files:
        if not path.exists():
            print(f"skip missing {path}", file=sys.stderr)
            continue
        src = {
            "kind": kind,
            "file": str(path).replace("\\", "/"),
            "sha256": _sha256_file(path),
        }
        n_in = 0
        for raw in _iter_csv(path):
            n_in += 1
            row = normalize_row(raw, kind)
            if row is None:
                skipped_no_key += 1
                continue
            key = row["external_key"]
            if key in seen:
                skipped_dup += 1
                continue
            seen.add(key)
            out.append(row)
            if limit is not None and len(out) >= limit:
                break
        src["row_count_in"] = n_in
        sources.append(src)
        if limit is not None and len(out) >= limit:
            break

    return write_outputs(out, out_dir, sources=sources)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize TSBPE plumbing CSVs")
    p.add_argument("--raw-dir", type=Path, default=Path("data/raw/tx_tsbpe"))
    p.add_argument("--input", type=Path, default=None, help="Single CSV instead of raw-dir")
    p.add_argument("--kind", choices=list(KIND_META), default=None)
    p.add_argument("--include-secondary", action="store_true")
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/tx_tsbpe"))
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    files: list[tuple[Path, str]] = []
    if args.input:
        files.append((args.input, _detect_kind(args.input, args.kind)))
    else:
        kinds = ["rmp", "mp"]
        if args.include_secondary:
            kinds.extend(["jp", "tp"])
        for kind in kinds:
            files.append((args.raw_dir / KIND_META[kind]["default_file"], kind))

    present = [(path, kind) for path, kind in files if path.exists()]
    if not present:
        print("No TSBPE inputs found. Run: python scripts/download_tx_tsbpe.py", file=sys.stderr)
        return 1

    manifest = run_files(present, args.out_dir, args.limit)
    print(json.dumps(manifest, indent=2))
    print(f"OK: {manifest['row_count_licenses']} licenses")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
