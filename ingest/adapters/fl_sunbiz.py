"""
Florida Sunbiz (Division of Corporations) fixed-width corporate file adapter.

Parses official corporate data files (daily or quarterly extracts) into a
normalized staging CSV that maps cleanly onto the `entities` table.

File format (Corporate Data File):
  - Fixed width, 1440 characters per record
  - No header row
  - Definitions: https://dos.sunbiz.org/data-definitions/cor.html

Usage:
  python -m ingest.adapters.fl_sunbiz --input data/raw/sunbiz/daily/20260809c.txt
  python -m ingest.adapters.fl_sunbiz --input path/to/cordata0.txt --limit 5000
  python -m ingest.adapters.fl_sunbiz --input data/raw/sunbiz/quarterly/extracted/ --glob 'cordata*.txt'

Matching to DBPR contractors is intentionally deferred — see docs/SUNBIZ.md.
High-confidence linker rules only; no fuzzy merges in this adapter.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import zipfile
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SOURCE_SYSTEM = "fl_sunbiz"
SOURCE_URL = "https://dos.fl.gov/sunbiz/other-services/data-downloads/"
RECORD_LENGTH = 1440

# Fixed-width field specs: (name, start_1based, length)
# Source: https://dos.sunbiz.org/data-definitions/cor.html
COR_FIELDS: list[tuple[str, int, int]] = [
    ("document_number", 1, 12),
    ("entity_name", 13, 192),
    ("status", 205, 1),
    ("filing_type", 206, 15),
    ("address_1", 221, 42),
    ("address_2", 263, 42),
    ("city", 305, 28),
    ("state", 333, 2),
    ("zip", 335, 10),
    ("country", 345, 2),
    ("mail_address_1", 347, 42),
    ("mail_address_2", 389, 42),
    ("mail_city", 431, 28),
    ("mail_state", 459, 2),
    ("mail_zip", 461, 10),
    ("mail_country", 471, 2),
    ("file_date", 473, 8),
    ("fei_number", 481, 14),
    ("more_than_six_officers", 495, 1),
    ("last_transaction_date", 496, 8),
    ("state_country", 504, 2),
    ("report_year_1", 506, 4),
    ("report_date_1", 511, 8),
    ("report_year_2", 519, 4),
    ("report_date_2", 524, 8),
    ("report_year_3", 532, 4),
    ("report_date_3", 537, 8),
    ("registered_agent_name", 545, 42),
    ("registered_agent_type", 587, 1),
    ("registered_agent_address", 588, 42),
    ("registered_agent_city", 630, 28),
    ("registered_agent_state", 658, 2),
    ("registered_agent_zip", 660, 9),
]

# Officer blocks: title(4) type(1) name(42) address(42) city(28) state(2) zip(9) = 128
# Officer 1 starts at position 669
OFFICER_START = 669
OFFICER_BLOCK = 128
OFFICER_COUNT = 6

FILING_TYPE_LABELS = {
    "DOMP": "Domestic Profit",
    "DOMNP": "Domestic Non-Profit",
    "FORP": "Foreign Profit",
    "FORNP": "Foreign Non-Profit",
    "DOMLP": "Domestic Limited Partnership",
    "FORLP": "Foreign Limited Partnership",
    "FLAL": "Florida Limited Liability Co.",
    "FORL": "Foreign Limited Liability Co.",
    "NPREG": "Non-Profit Registration",
    "TRUST": "Declaration of Trust",
    "AGENT": "Designation of Registered Agent",
}

STATUS_MAP = {
    "A": "active",
    "I": "inactive",
}

ENTITY_OUT_FIELDS = [
    "source_system",
    "external_key",
    "legal_name",
    "entity_type",
    "entity_type_label",
    "status_raw",
    "status",
    "formation_date",
    "last_transaction_date",
    "fei_number",
    "principal_address",
    "principal_address_2",
    "city",
    "state",
    "postal_code",
    "country",
    "mail_address",
    "mail_city",
    "mail_state",
    "mail_postal_code",
    "registered_agent_name",
    "registered_agent_type",
    "registered_agent_address",
    "registered_agent_city",
    "registered_agent_state",
    "registered_agent_postal_code",
    "officers_json",
    "more_than_six_officers",
    "name_normalized",
    "raw_payload_json",
]


def _slice(line: str, start_1: int, length: int) -> str:
    # Convert 1-based inclusive start to 0-based slice
    a = start_1 - 1
    b = a + length
    if len(line) < b:
        # pad short rows so bad records don't crash
        line = line.ljust(b)
    return line[a:b]


def _clean(value: str) -> str:
    return value.strip()


def _parse_sunbiz_date(value: str) -> str:
    """
    Sunbiz 8-char dates appear as MMDDYYYY in current daily extracts
    (e.g. 08102026 → 2026-08-10). Older notes mention YYYYMMDD — try both.
    """
    v = _clean(value)
    if not v or set(v) <= {"0", " "}:
        return ""
    if not re.fullmatch(r"\d{8}", v):
        return ""
    for fmt in ("%m%d%Y", "%Y%m%d"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def parse_officers(line: str) -> list[dict[str, str]]:
    officers: list[dict[str, str]] = []
    for i in range(OFFICER_COUNT):
        base = OFFICER_START + i * OFFICER_BLOCK
        title = _clean(_slice(line, base, 4))
        otype = _clean(_slice(line, base + 4, 1))
        name = _clean(_slice(line, base + 5, 42))
        addr = _clean(_slice(line, base + 47, 42))
        city = _clean(_slice(line, base + 89, 28))
        state = _clean(_slice(line, base + 117, 2))
        zipc = _clean(_slice(line, base + 119, 9))
        if not name:
            continue
        officers.append(
            {
                "title": title,
                "type": otype,
                "name": name,
                "address": addr,
                "city": city,
                "state": state,
                "postal_code": zipc,
            }
        )
    return officers


def normalize_entity_name(name: str) -> str:
    """
    High-confidence name key for later matching (not fuzzy).
    Uppercase, strip punctuation/legal suffixes lightly, collapse whitespace.
    """
    s = name.upper().strip()
    s = re.sub(r"[^\w\s]", " ", s)
    # Common legal endings — keep them for exact compares, only collapse space
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_corporate_line(line: str) -> dict[str, Any] | None:
    # Drop CR; keep as-is length validation
    line = line.rstrip("\r\n")
    if not line.strip():
        return None

    # Official length is 1440; tolerate slightly longer (trailing junk) / shorter with pad
    if len(line) < 220:
        # too short for document number + name + status
        return None

    raw: dict[str, str] = {}
    for name, start, length in COR_FIELDS:
        raw[name] = _clean(_slice(line, start, length))

    doc = raw["document_number"]
    entity_name = raw["entity_name"]
    if not doc or not entity_name:
        return None

    officers = parse_officers(line)
    filing = raw["filing_type"].upper()
    status_raw = raw["status"].upper()
    principal = raw["address_1"]
    city = raw["city"]
    state = raw["state"].upper()[:2]
    postal = raw["zip"]

    payload = {
        **raw,
        "officers": officers,
        "record_length": len(line),
    }

    return {
        "source_system": SOURCE_SYSTEM,
        "external_key": doc,
        "legal_name": entity_name,
        "entity_type": filing,
        "entity_type_label": FILING_TYPE_LABELS.get(filing, filing),
        "status_raw": status_raw,
        "status": STATUS_MAP.get(status_raw, status_raw.lower() or "unknown"),
        "formation_date": _parse_sunbiz_date(raw["file_date"]),
        "last_transaction_date": _parse_sunbiz_date(raw["last_transaction_date"]),
        "fei_number": raw["fei_number"],
        "principal_address": principal,
        "principal_address_2": raw["address_2"],
        "city": city,
        "state": state,
        "postal_code": postal,
        "country": raw["country"],
        "mail_address": " ".join(
            x for x in [raw["mail_address_1"], raw["mail_address_2"]] if x
        ).strip(),
        "mail_city": raw["mail_city"],
        "mail_state": raw["mail_state"].upper()[:2],
        "mail_postal_code": raw["mail_zip"],
        "registered_agent_name": raw["registered_agent_name"],
        "registered_agent_type": raw["registered_agent_type"],
        "registered_agent_address": raw["registered_agent_address"],
        "registered_agent_city": raw["registered_agent_city"],
        "registered_agent_state": raw["registered_agent_state"].upper()[:2],
        "registered_agent_postal_code": raw["registered_agent_zip"],
        "officers_json": json.dumps(officers, ensure_ascii=False),
        "more_than_six_officers": raw["more_than_six_officers"],
        "name_normalized": normalize_entity_name(entity_name),
        "raw_payload_json": json.dumps(payload, ensure_ascii=False),
    }


def iter_input_files(path: Path, glob_pat: str | None) -> list[Path]:
    if path.is_file():
        if path.suffix.lower() == ".zip":
            return [path]
        return [path]
    if path.is_dir():
        pattern = glob_pat or "*.txt"
        return sorted(path.rglob(pattern))
    raise FileNotFoundError(path)


def iter_lines_from_path(path: Path) -> Iterator[tuple[str, str]]:
    """Yield (source_label, line)."""
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path, "r") as zf:
            members = [n for n in zf.namelist() if not n.endswith("/")]
            for name in sorted(members):
                # Quarterly cordata.zip contains multiple fixed-width text parts
                with zf.open(name, "r") as raw:
                    # text mode via incremental decode
                    import io

                    text = io.TextIOWrapper(raw, encoding="latin-1", errors="replace")
                    for line in text:
                        yield f"{path.name}:{name}", line
        return

    with path.open("r", encoding="latin-1", errors="replace") as f:
        for line in f:
            yield path.name, line


def run_parse(
    inputs: list[Path],
    out_dir: Path,
    *,
    limit: int | None = None,
    active_only: bool = False,
) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "entities_normalized.csv"
    officers_path = out_dir / "officers_normalized.csv"
    manifest_path = out_dir / "batch_manifest.json"

    stats = {
        "rows_in": 0,
        "rows_out": 0,
        "skipped_short": 0,
        "skipped_inactive": 0,
        "skipped_bad": 0,
        "officers_out": 0,
        "sources": [],
    }

    officer_fields = [
        "document_number",
        "entity_name",
        "officer_index",
        "title",
        "type",
        "name",
        "address",
        "city",
        "state",
        "postal_code",
    ]

    seen_keys: set[str] = set()

    with out_path.open("w", encoding="utf-8", newline="") as ef, officers_path.open(
        "w", encoding="utf-8", newline=""
    ) as of:
        ew = csv.DictWriter(ef, fieldnames=ENTITY_OUT_FIELDS, extrasaction="ignore")
        ow = csv.DictWriter(of, fieldnames=officer_fields)
        ew.writeheader()
        ow.writeheader()

        for src in inputs:
            stats["sources"].append(str(src).replace("\\", "/"))
            for label, line in iter_lines_from_path(src):
                stats["rows_in"] += 1
                if limit is not None and stats["rows_out"] >= limit:
                    break
                line_stripped = line.rstrip("\r\n")
                if len(line_stripped) < 220:
                    stats["skipped_short"] += 1
                    continue
                row = parse_corporate_line(line)
                if row is None:
                    stats["skipped_bad"] += 1
                    continue
                if active_only and row["status"] != "active":
                    stats["skipped_inactive"] += 1
                    continue
                key = row["external_key"]
                if key in seen_keys:
                    # Prefer first occurrence; quarterly parts should be unique by doc#
                    continue
                seen_keys.add(key)
                ew.writerow(row)
                stats["rows_out"] += 1

                officers = json.loads(row["officers_json"] or "[]")
                for idx, off in enumerate(officers, start=1):
                    ow.writerow(
                        {
                            "document_number": key,
                            "entity_name": row["legal_name"],
                            "officer_index": idx,
                            **off,
                        }
                    )
                    stats["officers_out"] += 1
            if limit is not None and stats["rows_out"] >= limit:
                break

    checksums = {}
    for p in inputs:
        if p.is_file() and p.suffix.lower() != ".zip":
            h = hashlib.sha256()
            with p.open("rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    h.update(chunk)
            checksums[str(p).replace("\\", "/")] = h.hexdigest()

    manifest = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": "corporate_entities",
        "source_url": SOURCE_URL,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "record_length_expected": RECORD_LENGTH,
        "inputs": stats["sources"],
        "checksums_sha256": checksums,
        "row_count_in": stats["rows_in"],
        "row_count_out": stats["rows_out"],
        "officers_out": stats["officers_out"],
        "skipped_short": stats["skipped_short"],
        "skipped_inactive": stats["skipped_inactive"],
        "skipped_bad": stats["skipped_bad"],
        "active_only": active_only,
        "outputs": [
            str(out_path).replace("\\", "/"),
            str(officers_path).replace("\\", "/"),
        ],
        "entities_table_mapping": {
            "source_system": "fl_sunbiz",
            "external_key": "document_number",
            "legal_name": "entity_name",
            "entity_type": "filing_type",
            "status": "status (active|inactive)",
            "formation_date": "file_date",
            "principal_address": "address_1 + city/state/zip",
            "raw_payload": "full parse + officers",
        },
        "matching_notes": (
            "Do not fuzzy-merge to DBPR contractors here. Later linker should prefer: "
            "(1) exact name_normalized + principal city/state, "
            "(2) FEI when both sides present, "
            "(3) officer/licensee name exact match with address corroboration. "
            "See docs/SUNBIZ.md."
        ),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Parse Florida Sunbiz corporate fixed-width files")
    p.add_argument("--input", type=Path, required=True, help="File, .zip, or directory")
    p.add_argument(
        "--glob",
        default=None,
        help="When --input is a directory, glob for text parts (default: *.txt)",
    )
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/fl_sunbiz"))
    p.add_argument("--limit", type=int, default=None)
    p.add_argument(
        "--active-only",
        action="store_true",
        help="Keep status=A only (smaller staging for product wave-1)",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    inputs = iter_input_files(args.input, args.glob)
    if not inputs:
        print(f"No input files found under {args.input}", file=sys.stderr)
        return 1
    manifest = run_parse(
        inputs,
        args.out_dir,
        limit=args.limit,
        active_only=args.active_only,
    )
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
