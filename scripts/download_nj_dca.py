#!/usr/bin/env python3
"""
Prepare New Jersey DCA bulk registration files for the nj_dca adapter.

New Jersey does not publish a single Socrata-style open dump like Texas TDLR.
Official free lists are distributed via DCA Standard Files (Box) and MyLicense
bulk download flows. This script:

  1. Creates data/raw/nj_dca/
  2. Downloads official Box Standard Files (--from-box) OR copies a user file
  3. Optionally converts MLO %-delimited Standard Files to adapter CSV
  4. Validates headers and writes download_manifest.json (source notes, SHA-256)

Usage:
  # Preferred: pull official free bulk from Box Standard Files + convert HIC/specialty
  python scripts/download_nj_dca.py --from-box
  python scripts/download_nj_dca.py --from-box --convert

  # Or stage a CSV you already downloaded:
  python scripts/download_nj_dca.py --from-file path/to/hic_or_board_export.csv
  python scripts/download_nj_dca.py --from-file export.csv --name registrations.csv
  python scripts/download_nj_dca.py --print-sources

Do not scrape interactive license search pages as the primary source of truth.
MyLicense bulk export (Verification_Bulk) is an official free alternative when Box
active-only files are insufficient.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw" / "nj_dca"
BOX_SHARED = "https://app.box.com/v/DCAStandardFiles"
UA = (
    "Mozilla/5.0 (compatible; ContractorTrustHub/1.0; +https://www.contractortrusthub.com) "
    "AppleWebKit/537.36"
)

OFFICIAL_SOURCES = {
    "dca_standard_files_box": BOX_SHARED,
    "nj_consumer_affairs": "https://www.njconsumeraffairs.gov/",
    "mylicense_verification": "https://newjersey.mylicense.com/verification",
    "mylicense_bulk": "https://newjersey.mylicense.com/Verification_Bulk",
    "notes": (
        "Official free bulk: Box DCA Standard Files (MLO Facilities + Individuals). "
        "Active Facilities include ~25k Home Improvement Business Contr registrations. "
        "Convert with scripts/convert_nj_mlo_facilities.py or --convert. "
        "MyLicense Verification_Bulk can export profession-filtered lists (incl. expired)."
    ),
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


def download_box_standard_files() -> list[Path]:
    """Download free DCA Standard Files from the public Box shared folder."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(BOX_SHARED, headers={"User-Agent": UA})
    html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    m = re.search(r"Box\.postStreamData\s*=\s*(\{.*?\});\s*", html, re.S)
    if not m:
        raise SystemExit("Could not parse Box Standard Files listing — open the URL manually")
    data = json.loads(m.group(1))
    shared_name = data["/app-api/enduserapp/shared-item"]["sharedName"]
    items = data["/app-api/enduserapp/shared-folder"]["items"]
    saved: list[Path] = []
    for it in items:
        file_id = int(it["id"])
        name = str(it.get("name") or f"file_{file_id}.txt").replace(" ", "_")
        dest = RAW_DIR / name
        url = (
            "https://app.box.com/index.php?rm=box_download_shared_file"
            f"&shared_name={shared_name}&file_id=f_{file_id}"
        )
        r = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": BOX_SHARED})
        with urllib.request.urlopen(r, timeout=600) as resp:
            body = resp.read()
        if len(body) < 1000 or body[:15].lower().startswith(b"<!doctype"):
            print(f"WARN: skipped non-data response for {name}", file=sys.stderr)
            continue
        dest.write_bytes(body)
        print(f"Downloaded {dest.name} ({len(body):,} bytes)")
        saved.append(dest)
    listing = {
        "source": BOX_SHARED,
        "shared_name": shared_name,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "files": [
            {"name": p.name, "bytes": p.stat().st_size, "sha256": sha256_file(p)} for p in saved
        ],
    }
    (RAW_DIR / "box_download_manifest.json").write_text(
        json.dumps(listing, indent=2), encoding="utf-8"
    )
    return saved


def run_convert() -> Path:
    """Convert MLO Standard Files → adapter CSV via convert_nj_mlo_facilities."""
    convert_script = ROOT / "scripts" / "convert_nj_mlo_facilities.py"
    if not convert_script.is_file():
        raise SystemExit(f"Missing {convert_script}")
    # Import as module by path
    import importlib.util

    spec = importlib.util.spec_from_file_location("convert_nj_mlo", convert_script)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    fac = next(RAW_DIR.glob("MLO_Facilities_active_statuses_*.txt"), None)
    ind = next(RAW_DIR.glob("MLO_Individuals_active_statuses_*.txt"), None)
    out = RAW_DIR / "hic_and_specialty_from_mlo_active.csv"
    result = mod.convert(fac, ind, out)
    print(json.dumps(result, indent=2))
    return out


def write_staging_manifest(
    dest: Path,
    *,
    source_file_original: str,
    digest: str,
    approx_rows: int,
    headers: list[str],
) -> dict:
    manifest = {
        "source_system": "nj_dca",
        "source_dataset": "contractor_hic_and_specialty_bulk",
        "official_sources": OFFICIAL_SOURCES,
        "local_file": str(dest.relative_to(ROOT)),
        "source_file_original": source_file_original,
        "checksum_sha256": digest,
        "approx_data_rows": approx_rows,
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
    (RAW_DIR / "README.md").write_text(
        "\n".join(
            [
                "# NJ DCA raw extracts",
                "",
                "Official free bulk from DCA Standard Files (Box) preferred.",
                "",
                f"- Box Standard Files: {OFFICIAL_SOURCES['dca_standard_files_box']}",
                f"- MyLicense bulk: {OFFICIAL_SOURCES['mylicense_bulk']}",
                f"- Interactive verify (not bulk): {OFFICIAL_SOURCES['mylicense_verification']}",
                "",
                f"Current adapter input: `{dest.name}`",
                f"SHA-256: `{digest}`",
                f"Approx rows: {approx_rows}",
                "",
                "Normalize + load:",
                "```bash",
                f"python -m ingest.adapters.nj_dca --input data/raw/nj_dca/{dest.name} --out-dir data/staging/nj_dca",
                "python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca",
                "```",
                "",
            ]
        ),
        encoding="utf-8",
    )
    return manifest


def stage_csv(src: Path, name: str, allow_unvalidated: bool) -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = RAW_DIR / name
    headers = sniff_headers(src)
    ok, msg = validate_headers(headers)
    if not ok and not allow_unvalidated:
        print(f"Header validation failed: {msg}", file=sys.stderr)
        print("Re-export with headers, or pass --allow-unvalidated", file=sys.stderr)
        return 1
    if not ok:
        print(f"WARN: {msg} (copying anyway)")

    if src.resolve() != dest.resolve():
        shutil.copy2(src, dest)
    digest = sha256_file(dest)
    with dest.open("r", encoding="utf-8", errors="replace", newline="") as f:
        n = sum(1 for _ in f) - 1
    manifest = write_staging_manifest(
        dest,
        source_file_original=str(src),
        digest=digest,
        approx_rows=max(n, 0),
        headers=headers,
    )
    print(f"Staged → {dest}")
    print(f"Rows (approx): {max(n, 0)}")
    print(f"SHA-256: {digest}")
    print(f"Next: {manifest['next_step']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Stage NJ DCA bulk CSV into data/raw/nj_dca")
    p.add_argument("--from-file", type=Path, help="Path to an official bulk CSV already downloaded")
    p.add_argument(
        "--from-box",
        action="store_true",
        help="Download DCA Standard Files from the official Box shared folder",
    )
    p.add_argument(
        "--convert",
        action="store_true",
        help="After Box download (or using existing MLO files), convert HIC/specialty to CSV",
    )
    p.add_argument(
        "--name",
        default="registrations.csv",
        help="Filename under data/raw/nj_dca/ (default: registrations.csv)",
    )
    p.add_argument("--print-sources", action="store_true", help="Print official source URLs and exit")
    p.add_argument(
        "--allow-unvalidated",
        action="store_true",
        help="Copy even if header sniff fails (advanced)",
    )
    args = p.parse_args(argv)

    if args.print_sources:
        print(json.dumps(OFFICIAL_SOURCES, indent=2))
        return 0

    if args.from_box:
        files = download_box_standard_files()
        if not files:
            print("No files downloaded from Box", file=sys.stderr)
            return 1
        if args.convert:
            converted = run_convert()
            return stage_csv(converted, args.name, allow_unvalidated=True)
        print(
            "Box files saved under data/raw/nj_dca/. "
            "Run with --convert to produce adapter CSV, or:\n"
            "  python scripts/convert_nj_mlo_facilities.py"
        )
        return 0

    if args.convert and not args.from_file:
        converted = run_convert()
        return stage_csv(converted, args.name, allow_unvalidated=True)

    if not args.from_file:
        print(
            "Provide --from-box, --convert, or --from-file path/to/official_bulk.csv\n"
            f"Official free lists: {BOX_SHARED}\n"
            "MyLicense bulk: https://newjersey.mylicense.com/Verification_Bulk\n"
            "Or: python scripts/download_nj_dca.py --print-sources",
            file=sys.stderr,
        )
        return 2

    src = args.from_file.expanduser().resolve()
    if not src.is_file():
        print(f"File not found: {src}", file=sys.stderr)
        return 1
    return stage_csv(src, args.name, args.allow_unvalidated)


if __name__ == "__main__":
    raise SystemExit(main())
