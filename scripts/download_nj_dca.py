#!/usr/bin/env python3
"""
Prepare New Jersey DCA bulk registration files for the nj_dca adapter.

New Jersey does not publish a single Socrata-style open dump like Texas TDLR.
Official free lists are distributed via DCA Standard Files (Box) and MyLicense
bulk download flows. This script:

  1. Creates data/raw/nj_dca/
  2. Copies a user-provided bulk CSV into the raw tree with provenance
  3. Optionally validates header presence for common field names
  4. Writes a download_manifest.json (source notes, SHA-256)

Usage:
  python scripts/download_nj_dca.py --from-file path/to/hic_or_board_export.csv
  python scripts/download_nj_dca.py --from-file export.csv --name registrations.csv
  python scripts/download_nj_dca.py --print-sources   # print official links only

Do not scrape https://newjersey.mylicense.com/verification — interactive only.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw" / "nj_dca"

OFFICIAL_SOURCES = {
    "dca_standard_files_box": "https://app.box.com/v/DCAStandardFiles",
    "nj_consumer_affairs": "https://www.njconsumeraffairs.gov/",
    "mylicense_verification": "https://newjersey.mylicense.com/verification",
    "notes": (
        "Download free bulk/standard licensee lists from official DCA channels "
        "(Box Standard Files or MyLicense bulk export). Place the CSV here via "
        "--from-file. Prefer HIC roster first; add specialty board files when available."
    ),
}

# Headers we accept (case-insensitive) for a usable extract
USEFUL_HEADERS = {
    "registration_number",
    "license_number",
    "license number",
    "license_no",
    "licensenumber",
    "credential_type",
    "license_type",
    "license type",
    "business_name",
    "business name",
    "owner_name",
    "owner name",
    "status",
    "license status",
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sniff_headers(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as f:
        reader = csv.reader(f)
        row = next(reader, [])
    return [c.strip() for c in row]


def validate_headers(headers: list[str]) -> tuple[bool, str]:
    lower = {h.lower() for h in headers if h}
    if not lower:
        return False, "empty header row"
    has_id = bool(
        lower
        & {
            "registration_number",
            "license_number",
            "license number",
            "license_no",
            "licensenumber",
            "external_key",
        }
    )
    has_name = bool(
        lower
        & {
            "business_name",
            "business name",
            "owner_name",
            "owner name",
            "licensee_name",
            "name",
        }
    )
    if not has_id:
        return (
            False,
            "no registration/license number column found "
            f"(headers: {', '.join(headers[:12])}…)",
        )
    if not has_name:
        return (
            False,
            "no business/owner name column found "
            f"(headers: {', '.join(headers[:12])}…)",
        )
    return True, "ok"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Stage NJ DCA bulk CSV into data/raw/nj_dca")
    p.add_argument(
        "--from-file",
        type=Path,
        help="Path to an official bulk CSV already downloaded",
    )
    p.add_argument(
        "--name",
        default="registrations.csv",
        help="Filename under data/raw/nj_dca/ (default: registrations.csv)",
    )
    p.add_argument(
        "--print-sources",
        action="store_true",
        help="Print official source URLs and exit",
    )
    p.add_argument(
        "--allow-unvalidated",
        action="store_true",
        help="Copy even if header sniff fails (advanced)",
    )
    args = p.parse_args(argv)

    if args.print_sources:
        print(json.dumps(OFFICIAL_SOURCES, indent=2))
        return 0

    if not args.from_file:
        print(
            "Provide --from-file path/to/official_bulk.csv\n"
            "Official free lists: https://app.box.com/v/DCAStandardFiles\n"
            "Interactive verify (not bulk): https://newjersey.mylicense.com/verification\n"
            "Or: python scripts/download_nj_dca.py --print-sources",
            file=sys.stderr,
        )
        return 2

    src = args.from_file.expanduser().resolve()
    if not src.is_file():
        print(f"File not found: {src}", file=sys.stderr)
        return 1

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = RAW_DIR / args.name

    headers = sniff_headers(src)
    ok, msg = validate_headers(headers)
    if not ok and not args.allow_unvalidated:
        print(f"Header validation failed: {msg}", file=sys.stderr)
        print("Re-export with headers, or pass --allow-unvalidated", file=sys.stderr)
        return 1
    if not ok:
        print(f"WARN: {msg} (copying anyway)")

    shutil.copy2(src, dest)
    digest = sha256_file(dest)
    # rough row count
    with dest.open("r", encoding="utf-8", errors="replace", newline="") as f:
        n = sum(1 for _ in f) - 1

    manifest = {
        "source_system": "nj_dca",
        "source_dataset": "contractor_hic_and_specialty_bulk",
        "official_sources": OFFICIAL_SOURCES,
        "local_file": str(dest.relative_to(ROOT)),
        "source_file_original": str(src),
        "checksum_sha256": digest,
        "approx_data_rows": max(n, 0),
        "headers_sample": headers[:40],
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "next_step": (
            "python -m ingest.adapters.nj_dca "
            f"--input {dest.as_posix()} --out-dir data/staging/nj_dca"
        ),
    }
    (RAW_DIR / "download_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    # Human-readable pointer
    (RAW_DIR / "README.md").write_text(
        "\n".join(
            [
                "# NJ DCA raw extracts",
                "",
                "Place official free bulk CSVs here (HIC first; specialty boards when available).",
                "",
                f"- Box Standard Files: {OFFICIAL_SOURCES['dca_standard_files_box']}",
                f"- Interactive verify (not bulk): {OFFICIAL_SOURCES['mylicense_verification']}",
                "",
                f"Current file: `{args.name}`",
                f"SHA-256: `{digest}`",
                f"Approx rows: {max(n, 0)}",
                "",
                "Normalize:",
                "```bash",
                f"python -m ingest.adapters.nj_dca --input data/raw/nj_dca/{args.name} --out-dir data/staging/nj_dca",
                "```",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print(f"Copied → {dest}")
    print(f"Rows (approx): {max(n, 0)}")
    print(f"SHA-256: {digest}")
    print(f"Next: {manifest['next_step']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
