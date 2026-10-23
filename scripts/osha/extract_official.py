"""Read the official DOL OSHA zips and write a five-state extract.

The source zips are opened read-only. This script never writes beside them.
"""

from __future__ import annotations

import argparse
import csv
import io
import zipfile
from pathlib import Path

from scripts.osha.normalize import activity_number
from scripts.osha.states import STATE_ORDER

INSPECTION_FIELDS = ("activity_nr", "estab_name", "site_zip", "mail_zip", "site_state", "open_date")
VIOLATION_FIELDS = (
    "activity_nr",
    "delete_flag",
    "viol_type",
    "current_penalty",
    "initial_penalty",
    "contest_date",
    "final_order_date",
)


def _members(archive: zipfile.ZipFile, required: set[str]) -> list[str]:
    chosen = []
    for name in archive.namelist():
        if name.endswith("/"):
            continue
        with archive.open(name) as raw:
            head = raw.readline().decode("utf-8-sig", errors="replace")
        header = {part.strip().strip('"') for part in head.split(",")}
        if required.issubset(header):
            chosen.append(name)
    if not chosen:
        raise SystemExit("no usable csv member")
    return chosen


def _iter_rows(archive: zipfile.ZipFile, name: str):
    with archive.open(name) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        yield from csv.DictReader(text)


def extract(inspection_zip: Path, violation_zip: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    states = set(STATE_ORDER)
    inspection_path = out_dir / "inspections.csv"
    activities: set[str] = set()
    counts = {state: 0 for state in STATE_ORDER}
    scanned = 0
    with zipfile.ZipFile(inspection_zip, "r") as archive, inspection_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=INSPECTION_FIELDS, lineterminator="\n")
        writer.writeheader()
        for name in _members(archive, {"ACTIVITY_NR", "SITE_STATE", "ESTAB_NAME"}):
            for row in _iter_rows(archive, name):
                scanned += 1
                site_state = (row.get("SITE_STATE") or "").strip().upper()
                if site_state not in states:
                    continue
                activity = activity_number(row.get("ACTIVITY_NR") or "")
                if not activity:
                    continue
                writer.writerow(
                    {
                        "activity_nr": activity,
                        "estab_name": row.get("ESTAB_NAME") or "",
                        "site_zip": row.get("SITE_ZIP") or "",
                        "mail_zip": row.get("MAIL_ZIP") or "",
                        "site_state": site_state,
                        "open_date": row.get("OPEN_DATE") or "",
                    }
                )
                activities.add(activity)
                counts[site_state] += 1
    print("INSPECTION_SCANNED", scanned)
    for state in STATE_ORDER:
        print("INSPECTION_ROWS", state, counts[state])
    print("INSPECTION_ACTIVITIES", len(activities))

    violation_path = out_dir / "violations.csv"
    viol_counts = {state: 0 for state in ("ALL",)}
    kept = 0
    scanned = 0
    with zipfile.ZipFile(violation_zip, "r") as archive, violation_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=VIOLATION_FIELDS, lineterminator="\n")
        writer.writeheader()
        for name in _members(archive, {"ACTIVITY_NR", "DELETE_FLAG"}):
            for row in _iter_rows(archive, name):
                scanned += 1
                activity = activity_number(row.get("ACTIVITY_NR") or "")
                if activity not in activities:
                    continue
                writer.writerow(
                    {
                        "activity_nr": activity,
                        "delete_flag": row.get("DELETE_FLAG") or "",
                        "viol_type": row.get("VIOL_TYPE") or "",
                        "current_penalty": row.get("CURRENT_PENALTY") or "",
                        "initial_penalty": row.get("INITIAL_PENALTY") or "",
                        "contest_date": row.get("CONTEST_DATE") or "",
                        "final_order_date": row.get("FINAL_ORDER_DATE") or "",
                    }
                )
                kept += 1
    print("VIOLATION_SCANNED", scanned)
    print("VIOLATION_ROWS", kept)
    print("WROTE", inspection_path.name, violation_path.name)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspection-zip", type=Path, required=True)
    parser.add_argument("--violation-zip", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    extract(args.inspection_zip, args.violation_zip, args.out_dir)


if __name__ == "__main__":
    main()
