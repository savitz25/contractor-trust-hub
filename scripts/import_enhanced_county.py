#!/usr/bin/env python3
"""Enhanced-county import CLI.

Stages: A audit, B parse, C identity, D dry-run, E production (refuses TEST_ONLY).
Discovery mode writes no database rows.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ingest.enhanced_county import (  # noqa: E402
    PARSER_VERSION,
    SOURCES,
    run_discovery,
    stage_a,
    stage_b_permits,
    stage_c_identity,
    quality_report,
)


def main() -> int:
    p = argparse.ArgumentParser(description="Broward/PBC native-export importer")
    p.add_argument("--source", required=True, choices=sorted(SOURCES))
    p.add_argument("--file", required=True, type=Path)
    p.add_argument(
        "--stage",
        default="A",
        choices=["A", "B", "C", "D", "E", "discovery"],
        help="A=audit B=parse C=identity D=dry-run E=load discovery=column report",
    )
    args = p.parse_args()
    if not args.file.is_file():
        print(f"missing file: {args.file}", file=sys.stderr)
        return 2

    if args.stage in {"A", "discovery"}:
        report = run_discovery(args.file, args.source)
        print(json.dumps(report, indent=2))
        return 0

    audit, rows = stage_a(args.file, args.source)
    cfg = SOURCES[args.source]
    parsed = []
    if cfg["kind"] == "permit":
        parsed = stage_b_permits(rows, audit.inferred_mappings, cfg["source_system"])
        if args.stage in {"C", "D", "E"}:
            parsed = stage_c_identity(parsed)
    else:
        parsed = stage_c_identity(
            [
                {
                    "record_key": None,
                    "contractor_license_raw": "",
                    "local_contractor_id": "",
                    "status_raw": "",
                    "issue_date": "",
                    "valuation": None,
                    "raw_payload": r,
                }
                for r in rows
            ]
        )
        parsed = run_discovery(args.file, args.source)  # certs use discovery shape
        print(json.dumps(parsed, indent=2))
        return 0

    if args.stage == "B":
        print(json.dumps({"parsed": len(parsed), "parser_version": PARSER_VERSION}, indent=2))
        return 0
    if args.stage in {"C", "D"}:
        print(json.dumps(quality_report(parsed, audit), indent=2))
        return 0
    if args.stage == "E":
        if audit.test_only:
            print("REFUSED: TEST_ONLY fixture cannot be loaded to production", file=sys.stderr)
            return 3
        print("REFUSED: production load requires a received agency file and QA sign-off", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
