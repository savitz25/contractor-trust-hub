"""Local exact-native-number preview of the certified Florida person credentials."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

STAGE = Path(__file__).resolve().parents[1] / "artifacts/th-ea-fl-credentials/fl-certified-person-credentials.csv"


def lookup(native_number: str) -> dict | None:
    native_number = native_number.strip().upper()
    if not native_number or not native_number.isalnum():
        return None
    with STAGE.open(encoding="utf-8", newline="") as stream:
        matches = [r for r in csv.DictReader(stream) if r["external_key"] == native_number]
    if len(matches) > 1:
        raise ValueError("certified stage contains duplicate native key")
    if not matches:
        return None
    row = matches[0]
    return {
        "grain": "Florida DBPR person credential",
        "native_credential_number": row["external_key"],
        "issuing_regulator": "Florida DBPR",
        "issuing_board": row["board_number"],
        "credential_class": row["occupation_code"],
        "reported_name": row["licensee_name_raw"],
        "reported_dba_text": row["dba_name_raw"] or None,
        "primary_status": row["primary_status"],
        "secondary_status": row["secondary_status"],
        "status_normalized": row["status_normalized"],
        "expiration_date": row["expiration_date"] or None,
        "source_file": row["source_file"],
        "source_sha256": row["source_sha256"],
        "source_line": int(row["source_line"]),
        "contractor_id": None,
        "canonical_business": False,
        "note": "DBA text is source evidence, not an organization identity or bridge.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("native_number", help="exact Florida DBPR credential number")
    args = parser.parse_args()
    print(json.dumps(lookup(args.native_number), indent=2))
