"""
Arizona ROC disciplinary actions adapter (posting-list CSV).

Source: https://roc.az.gov/posting-list — Disciplinary Actions CSV.

File shape (observed):
  - Title line: "Disciplinary Actions - File created: … - N Records"
  - Disclaimer line (good-standing note)
  - Header: Business Name, Doing Business As, Address, Address 2, City, State, Zip,
            License No, License Class, Case Number, Description
  - Description is typically Suspended | Revoked (not free-text narrative)

Usage:
  python -m ingest.adapters.az_roc_discipline \\
    --input data/raw/az_roc/ROC_Disciplinary-Actions_2026-08-13.csv \\
    --out-dir data/staging/az_roc
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

SOURCE_SYSTEM = "az_roc"
SOURCE_DATASET = "roc_disciplinary_actions"
SOURCE_URL = "https://roc.az.gov/posting-list"

DISCIPLINE_OUT_FIELDS = [
    "source_system",
    "source_dataset",
    "external_key",
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
]


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _normalize_license(raw: str) -> str:
    """Keep leading zeros as published; strip whitespace only."""
    return _clean(raw)


def discipline_external_key(
    *,
    case_number: str,
    license_no: str,
    respondent: str,
    description: str,
) -> str:
    case = _clean(case_number)
    lic = _normalize_license(license_no)
    if case and lic:
        return f"AZ-ROC-DISC:{case}:{lic}"
    if case:
        return f"AZ-ROC-DISC:{case}"
    material = f"{lic}|{respondent}|{description}"
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:16]
    return f"AZ-ROC-DISC:h:{digest}"


def iter_disciplinary_csv(path: Path) -> Iterator[dict[str, str]]:
    """Skip title + disclaimer lines before the real header."""
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    lines = text.splitlines()
    header_idx = None
    for i, line in enumerate(lines[:8]):
        if "License No" in line and ("Case Number" in line or "Description" in line):
            header_idx = i
            break
    if header_idx is None:
        raise SystemExit(f"Could not find disciplinary header in {path}")
    reader = csv.DictReader(lines[header_idx:])
    for row in reader:
        if not row:
            continue
        # Skip empty trailing rows
        if not any(_clean(v) for v in row.values() if v is not None):
            continue
        yield {k: _clean(v) for k, v in row.items() if k is not None}


def transform_row(raw: dict[str, str]) -> dict[str, str] | None:
    business = _clean(raw.get("Business Name") or raw.get("business_name"))
    dba = _clean(raw.get("Doing Business As") or raw.get("dba"))
    respondent = business or dba
    if not respondent:
        return None

    lic = _normalize_license(raw.get("License No") or raw.get("license_number") or "")
    case = _clean(raw.get("Case Number") or raw.get("case_number") or "")
    description = _clean(raw.get("Description") or raw.get("description") or "")
    license_class = _clean(raw.get("License Class") or raw.get("license_class") or "")

    # Description is typically Suspended / Revoked — store as disposition
    disposition = description
    # Keep description as published (short status word), not invented narrative
    discipline_description = (
        f"ROC disciplinary action as published: {description}."
        if description
        else "ROC disciplinary action (see official contractor search for standing)."
    )

    state = _clean(raw.get("State") or "AZ").upper().replace(" ", "")[:2] or "AZ"
    city = _clean(raw.get("City"))
    postal = _clean(raw.get("Zip") or raw.get("ZIP"))
    address = _clean(raw.get("Address"))

    ext = discipline_external_key(
        case_number=case,
        license_no=lic,
        respondent=respondent,
        description=description,
    )

    payload = {k: v for k, v in raw.items() if _clean(v)}
    payload["_official_disclaimer"] = (
        "Some forms of discipline are temporary or may be remedied, others are permanent. "
        "Confirm current standing on ROC contractor search."
    )

    return {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": SOURCE_DATASET,
        "external_key": ext,
        "complaint_number": case,
        "license_type": license_class,
        "license_number_raw": lic,
        "respondent_name": respondent,
        "classification": license_class or description or "ROC disciplinary action",
        "entered_date": "",
        "disposition": disposition,
        "disposition_date": "",
        "discipline_description": discipline_description,
        "violation_code": "",
        "address_line_1": address,
        "city": city,
        "state": state,
        "postal_code": postal,
        "county_name": "",
        "raw_payload_json": json.dumps(payload, ensure_ascii=False),
    }


def run(input_path: Path, out_dir: Path, limit: int | None = None) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "discipline_normalized.csv"
    manifest_path = out_dir / "discipline_batch_manifest.json"

    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    skipped = 0
    disposition_counts: dict[str, int] = {}

    for raw in iter_disciplinary_csv(input_path):
        t = transform_row(raw)
        if not t:
            skipped += 1
            continue
        if t["external_key"] in seen:
            skipped += 1
            continue
        seen.add(t["external_key"])
        rows.append(t)
        d = t.get("disposition") or "(blank)"
        disposition_counts[d] = disposition_counts.get(d, 0) + 1
        if limit is not None and len(rows) >= limit:
            break

    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=DISCIPLINE_OUT_FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)

    manifest = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": SOURCE_DATASET,
        "source_url": SOURCE_URL,
        "source_file": str(input_path).replace("\\", "/"),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "checksum_sha256": _sha256_file(input_path),
        "row_count": len(rows),
        "skipped": skipped,
        "disposition_counts": dict(sorted(disposition_counts.items(), key=lambda x: -x[1])),
        "field_notes": {
            "present": [
                "Business Name",
                "License No",
                "License Class",
                "Case Number",
                "Description (typically Suspended/Revoked)",
                "Address / City / State / Zip",
            ],
            "not_present": [
                "Entered / disposition dates as separate columns",
                "Full case narrative or findings text",
                "Violation codes beyond Description status word",
                "Automatic current standing (file disclaimer: use Contractor Search)",
            ],
        },
        "notes": (
            "Official ROC Disciplinary Actions posting-list CSV. "
            "Soft-link to active az_roc licenses by exact license number only. "
            "Many rows are Revoked and may not appear on the current active list. "
            "Absence of a row is not a clean history certificate."
        ),
        "outputs": [str(out_path).replace("\\", "/")],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize Arizona ROC disciplinary CSV")
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/az_roc"))
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    if not args.input.exists():
        print(f"Missing input: {args.input}", file=sys.stderr)
        return 1

    manifest = run(args.input, args.out_dir, args.limit)
    print(f"Wrote {manifest['row_count']} discipline rows → {args.out_dir}")
    print(json.dumps({k: manifest[k] for k in ("row_count", "disposition_counts", "skipped")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
