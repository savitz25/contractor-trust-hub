"""
Florida DBPR Construction Industry adapter.

Official licensee extract has NO header row. Column order is documented in
docs/DATA_SOURCES.md and matches Construction Industry Public Records layout.

Usage:
  python -m ingest.adapters.fl_dbpr --input path/to/CONSTRUCTIONLICENSE_1.csv
  python -m ingest.adapters.fl_dbpr --input path/to/sample.csv --has-header
  python -m ingest.adapters.fl_dbpr discipline --input path/to/contractor_disc_lic_2425.csv
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
from typing import Any, Iterable, Iterator

SOURCE_SYSTEM = "fl_dbpr"
SOURCE_URL_LICENSEES = (
    "https://www2.myfloridalicense.com/sto/file_download/extracts//CONSTRUCTIONLICENSE_1.csv"
)

# Official order — no header in production extract
LICENSEE_COLUMNS = [
    "board_number",
    "occupation_code",
    "licensee_name",
    "dba_name",
    "class_code",
    "address_line_1",
    "address_line_2",
    "address_line_3",
    "city",
    "state",
    "zip",
    "county_code",
    "license_number",
    "primary_status",
    "secondary_status",
    "original_licensure_date",
    "effective_date",
    "expiration_date",
    "blank",
    "renewal_period",
    "alternate_license_number",
]

# Common FL county FIPS-style DBPR codes seen in extract (partial; unknown stay as code)
# DBPR uses its own county codes; we keep code and optional name when known.
FL_COUNTY_CODES: dict[str, str] = {
    "16": "Broward",
    "21": "Collier",
    "23": "Miami-Dade",
    "26": "Duval",
    "39": "Hillsborough",
    "46": "Lee",
    "51": "Manatee",
    "52": "Marion",
    "58": "Orange",
    "60": "Palm Beach",
    "61": "Pasco",
    "62": "Pinellas",
    "68": "Sarasota",
}

DATE_FMT = "%m/%d/%Y"


def _clean(value: str | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _parse_date(value: str | None) -> str:
    """Return ISO date or empty string."""
    v = _clean(value)
    if not v:
        return ""
    for fmt in (DATE_FMT, "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_status(primary: str, secondary: str) -> str:
    """
    Map board flags to product status.
    Observed: primary ~ C (current), S, P; secondary A (active), I (inactive), blank.
    """
    p = _clean(primary).upper()
    s = _clean(secondary).upper()
    if s == "A":
        return "active"
    if s == "I":
        return "inactive"
    if p == "C" and not s:
        # Many rows are primary C with blank secondary — treat as current/unknown activity
        return "current"
    if p:
        return "other"
    return "unknown"


def compose_external_key(occupation: str, license_number: str, alternate: str) -> str | None:
    alt = _clean(alternate).upper().replace(" ", "")
    if alt:
        return alt
    occ = _clean(occupation).upper().replace(" ", "")
    num = _clean(license_number).upper().replace(" ", "")
    if occ and num:
        # Prefer concatenating as published alternate style when possible
        if num.startswith(occ):
            return num
        return f"{occ}{num}"
    return None


def compose_qb_entity_key(raw: dict[str, str]) -> str:
    """
    Qualifying Business (QB) rows have no license number in the DBPR extract.
    Build a deterministic non-license entity key from identity fields — not a board id.
    """
    parts = [
        _clean(raw.get("licensee_name")).upper(),
        _clean(raw.get("dba_name")).upper(),
        _clean(raw.get("address_line_1")).upper(),
        _clean(raw.get("city")).upper(),
        _clean(raw.get("state")).upper(),
        _clean(raw.get("zip")).upper(),
    ]
    material = "|".join(parts)
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:16]
    return f"QB-ENTITY:{digest}"


def slugify(*parts: str) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return s[:120] if s else ""


def iter_licensee_rows(
    path: Path, *, has_header: bool
) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.reader(f)
        if has_header:
            header = next(reader, None)
            if not header:
                return
            # Map by name if our sample header; else fall back to position
            header_norm = [_clean(h).lower().replace(" ", "_") for h in header]
            for row in reader:
                if not row or all(not _clean(c) for c in row):
                    continue
                if set(header_norm) >= set(LICENSEE_COLUMNS[:5]):
                    d = {
                        col: _clean(row[i]) if i < len(row) else ""
                        for i, col in enumerate(header_norm)
                    }
                    # ensure all keys
                    yield {c: d.get(c, "") for c in LICENSEE_COLUMNS}
                else:
                    padded = list(row) + [""] * max(0, len(LICENSEE_COLUMNS) - len(row))
                    yield dict(zip(LICENSEE_COLUMNS, padded[: len(LICENSEE_COLUMNS)]))
        else:
            for row in reader:
                if not row or all(not _clean(c) for c in row):
                    continue
                padded = list(row) + [""] * max(0, len(LICENSEE_COLUMNS) - len(row))
                yield {
                    k: _clean(v)
                    for k, v in zip(LICENSEE_COLUMNS, padded[: len(LICENSEE_COLUMNS)])
                }


def transform_licensee(raw: dict[str, str]) -> dict[str, Any] | None:
    external_key = compose_external_key(
        raw.get("occupation_code", ""),
        raw.get("license_number", ""),
        raw.get("alternate_license_number", ""),
    )
    if not external_key:
        return None

    licensee_name = _clean(raw.get("licensee_name"))
    if not licensee_name:
        return None

    dba = _clean(raw.get("dba_name"))
    city = _clean(raw.get("city"))
    state = _clean(raw.get("state")).upper()[:2]
    county_code = _clean(raw.get("county_code"))
    primary = _clean(raw.get("primary_status"))
    secondary = _clean(raw.get("secondary_status"))

    display = dba or licensee_name
    slug = slugify(external_key, display)

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": _clean(raw.get("board_number")),
        "external_key": external_key,
        "occupation_code": _clean(raw.get("occupation_code")).upper(),
        "license_number": _clean(raw.get("license_number")),
        "class_code": _clean(raw.get("class_code")),
        "licensee_name_raw": licensee_name,
        "dba_name_raw": dba,
        "display_name": display,
        "slug": slug,
        "primary_status": primary,
        "secondary_status": secondary,
        "status_normalized": normalize_status(primary, secondary),
        "original_licensure_date": _parse_date(raw.get("original_licensure_date")),
        "effective_date": _parse_date(raw.get("effective_date")),
        "expiration_date": _parse_date(raw.get("expiration_date")),
        "address_line_1": _clean(raw.get("address_line_1")),
        "address_line_2": _clean(raw.get("address_line_2")),
        "address_line_3": _clean(raw.get("address_line_3")),
        "city": city,
        "state": state,
        "postal_code": _clean(raw.get("zip")),
        "county_code": county_code,
        "county_name": FL_COUNTY_CODES.get(county_code, ""),
        "board_number": _clean(raw.get("board_number")),
        "raw_payload_json": json.dumps(raw, ensure_ascii=False),
    }


LICENSE_OUT_FIELDS = [
    "source_system",
    "source_board",
    "external_key",
    "occupation_code",
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


QB_OUT_FIELDS = [
    "source_system",
    "entity_key",
    "record_kind",
    "licensee_name_raw",
    "dba_name_raw",
    "display_name",
    "primary_status",
    "secondary_status",
    "status_normalized",
    "address_line_1",
    "city",
    "state",
    "postal_code",
    "county_code",
    "county_name",
    "board_number",
    "raw_payload_json",
]


def run_licensees(
    input_path: Path,
    out_dir: Path,
    *,
    has_header: bool,
    limit: int | None = None,
) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    licenses_path = out_dir / "licenses_normalized.csv"
    contractors_path = out_dir / "contractors_seed.csv"
    qb_path = out_dir / "qualifying_businesses_normalized.csv"
    manifest_path = out_dir / "batch_manifest.json"

    seen_keys: set[str] = set()
    seen_qb: set[str] = set()
    kept = 0
    qb_kept = 0
    skipped_no_key = 0
    skipped_dup = 0
    total_in = 0

    with licenses_path.open("w", encoding="utf-8", newline="") as lf, contractors_path.open(
        "w", encoding="utf-8", newline=""
    ) as cf, qb_path.open("w", encoding="utf-8", newline="") as qf:
        lw = csv.DictWriter(lf, fieldnames=LICENSE_OUT_FIELDS, extrasaction="ignore")
        cw = csv.DictWriter(cf, fieldnames=CONTRACTOR_SEED_FIELDS, extrasaction="ignore")
        qw = csv.DictWriter(qf, fieldnames=QB_OUT_FIELDS, extrasaction="ignore")
        lw.writeheader()
        cw.writeheader()
        qw.writeheader()

        for raw in iter_licensee_rows(input_path, has_header=has_header):
            total_in += 1
            if limit is not None and kept >= limit:
                break

            occ = _clean(raw.get("occupation_code")).upper()
            # Qualifying Business rows: no board license number in this extract
            if occ == "QB":
                name = _clean(raw.get("licensee_name"))
                if not name:
                    skipped_no_key += 1
                    continue
                entity_key = compose_qb_entity_key(raw)
                if entity_key in seen_qb:
                    skipped_dup += 1
                    continue
                seen_qb.add(entity_key)
                primary = _clean(raw.get("primary_status"))
                secondary = _clean(raw.get("secondary_status"))
                county_code = _clean(raw.get("county_code"))
                dba = _clean(raw.get("dba_name"))
                qw.writerow(
                    {
                        "source_system": SOURCE_SYSTEM,
                        "entity_key": entity_key,
                        "record_kind": "qualifying_business",
                        "licensee_name_raw": name,
                        "dba_name_raw": dba,
                        "display_name": dba or name,
                        "primary_status": primary,
                        "secondary_status": secondary,
                        "status_normalized": normalize_status(primary, secondary),
                        "address_line_1": _clean(raw.get("address_line_1")),
                        "city": _clean(raw.get("city")),
                        "state": _clean(raw.get("state")).upper()[:2],
                        "postal_code": _clean(raw.get("zip")),
                        "county_code": county_code,
                        "county_name": FL_COUNTY_CODES.get(county_code, ""),
                        "board_number": _clean(raw.get("board_number")),
                        "raw_payload_json": json.dumps(raw, ensure_ascii=False),
                    }
                )
                qb_kept += 1
                continue

            row = transform_licensee(raw)
            if row is None:
                skipped_no_key += 1
                continue
            key = row["external_key"]
            if key in seen_keys:
                skipped_dup += 1
                continue
            seen_keys.add(key)
            lw.writerow({k: row.get(k, "") for k in LICENSE_OUT_FIELDS})
            cw.writerow(
                {
                    "slug": row["slug"],
                    "display_name": row["display_name"],
                    "legal_name": row["licensee_name_raw"],
                    "dba_name": row["dba_name_raw"],
                    "home_state": row["state"] or "FL",
                    "primary_city": row["city"],
                    "primary_county": row["county_name"] or row["county_code"],
                    "license_external_key": key,
                }
            )
            kept += 1

    checksum = _sha256_file(input_path) if input_path.exists() else ""
    manifest = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": "construction_licensees",
        "source_url": SOURCE_URL_LICENSEES,
        "source_file": str(input_path).replace("\\", "/"),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "checksum_sha256": checksum,
        "row_count_in": total_in,
        "row_count_licenses_out": kept,
        "row_count_qb_entities_out": qb_kept,
        "skipped_no_key": skipped_no_key,
        "skipped_duplicate_key": skipped_dup,
        "has_header": has_header,
        "notes": [
            "QB (Qualifying Business) rows have no license number in the official extract; "
            "staged separately with deterministic QB-ENTITY keys — not invented board licenses.",
        ],
        "outputs": [
            str(licenses_path).replace("\\", "/"),
            str(contractors_path).replace("\\", "/"),
            str(qb_path).replace("\\", "/"),
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


DISCIPLINE_OUT_FIELDS = [
    "source_system",
    "source_dataset",
    "complaint_number",
    "license_type",
    "license_number_raw",
    "respondent_name",
    "classification",
    "entered_date",
    "disposition",
    "disposition_date",
    "discipline_description",
    "violation_code",
    "address_line_1",
    "city",
    "state",
    "postal_code",
    "county_name",
    "raw_payload_json",
    "source_record_locator",
]


def _pick(row: dict[str, str], *names: str) -> str:
    lower_map = {k.lower().strip(): v for k, v in row.items()}
    for n in names:
        if n.lower() in lower_map:
            return _clean(lower_map[n.lower()])
    return ""


def run_discipline(
    input_path: Path,
    out_dir: Path,
    *,
    source_dataset: str = "contractor_disc_lic",
    limit: int | None = None,
) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "discipline_normalized.csv"
    manifest_path = out_dir / "discipline_batch_manifest.json"

    kept = 0
    total_in = 0
    with input_path.open("r", encoding="utf-8", errors="replace", newline="") as f, out_path.open(
        "w", encoding="utf-8", newline=""
    ) as out:
        reader = csv.DictReader(f)
        writer = csv.DictWriter(out, fieldnames=DISCIPLINE_OUT_FIELDS)
        writer.writeheader()
        for row in reader:
            total_in += 1
            if limit is not None and kept >= limit:
                break
            respondent = _pick(row, "Respondent Name", "respondent_name")
            if not respondent:
                continue
            payload = {k: _clean(v) for k, v in row.items()}
            writer.writerow(
                {
                    "source_system": SOURCE_SYSTEM,
                    "source_dataset": source_dataset,
                    "complaint_number": _pick(row, "Complaint Nbr", "complaint_number"),
                    "license_type": _pick(row, "License Type", "license_type"),
                    "license_number_raw": _pick(row, "License Nbr", "license_number"),
                    "respondent_name": respondent,
                    "classification": _pick(row, "Classification", "classification"),
                    "entered_date": _parse_date(_pick(row, "Entered Date", "entered_date")),
                    "disposition": _pick(row, "Disposition", "disposition"),
                    "disposition_date": _parse_date(
                        _pick(row, "Disposition Date", "disposition_date")
                    ),
                    "discipline_description": _pick(
                        row, "Discipline Date - Description", "discipline_description"
                    ),
                    "violation_code": _pick(row, "Violation Code", "violation_code"),
                    "address_line_1": _pick(row, "Address Line 1", "address_line_1"),
                    "city": _pick(row, "City", "city"),
                    "state": _pick(row, "State", "state")[:2],
                    "postal_code": _pick(row, "ZIP Code", "zip", "postal_code"),
                    "county_name": _pick(row, "County", "county_name"),
                    "raw_payload_json": json.dumps(payload, ensure_ascii=False),
                    "source_record_locator": f"csv-record:{total_in}",
                }
            )
            kept += 1

    manifest = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": source_dataset,
        "source_file": str(input_path).replace("\\", "/"),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "checksum_sha256": _sha256_file(input_path),
        "row_count_in": total_in,
        "row_count_out": kept,
        "outputs": [str(out_path).replace("\\", "/")],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Florida DBPR construction adapter")
    sub = p.add_subparsers(dest="command")

    # default licensees mode also via top-level flags for convenience
    p.add_argument("--input", type=Path, help="Licensee CSV path")
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/fl_dbpr"))
    p.add_argument(
        "--has-header",
        action="store_true",
        help="Input includes a header row (sample files)",
    )
    p.add_argument("--limit", type=int, default=None)

    d = sub.add_parser("discipline", help="Normalize discipline CSV")
    d.add_argument("--input", type=Path, required=True)
    d.add_argument("--out-dir", type=Path, default=Path("data/staging/fl_dbpr"))
    d.add_argument("--dataset", default="contractor_disc_lic")
    d.add_argument("--limit", type=int, default=None)

    return p


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "discipline":
        manifest = run_discipline(
            args.input, args.out_dir, source_dataset=args.dataset, limit=args.limit
        )
        print(json.dumps(manifest, indent=2))
        return 0

    if not args.input:
        parser.error("--input is required for licensee mode (or use: discipline --input ...)")

    manifest = run_licensees(
        args.input, args.out_dir, has_header=args.has_header, limit=args.limit
    )
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
