#!/usr/bin/env python3
"""Read-only legacy backfill and future-load simulation for migration 009."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402
from ingest.regulatory.fl_dbpr_identity import FloridaDbprCredentialResolver  # noqa: E402
from ingest.regulatory.source_observation import (  # noqa: E402
    LOGICAL_MATTER_ALGORITHM,
    SOURCE_OBSERVATION_ALGORITHM,
    logical_matter_detail_key_v1,
    row_fingerprint_sha256,
    source_observation_key_v2,
)
from scripts.audit_fl_licensed_discipline_plan import (  # noqa: E402
    FILES,
    analyze,
    inspect_files,
    production_snapshot,
)

DEFAULT_OUTPUT = ROOT / "artifacts/cth-fl-state-002a-source-versioning-dry-run.json"
DEFAULT_RAW = ROOT / "data/raw/fl_dbpr/cth-fl-state-002-plan"
FY24_CHECKSUM = "189b0043984b25876bdbf6c814b5c6539db9374e3cd01e5c8e94e7777442c7ef"
MIGRATION_PATH = ROOT / "schema/migrations/009_regulatory_source_observations.sql"


def observation_key(row: dict[str, Any]) -> str:
    return source_observation_key_v2(
        source_system="fl_dbpr", source_dataset="contractor_disc_lic", row=row
    )


def logical_key(row: dict[str, Any]) -> str:
    return logical_matter_detail_key_v1(
        source_system="fl_dbpr", source_dataset="contractor_disc_lic", row=row
    )


def simulate(inventories: list[dict[str, Any]], rows: list[dict[str, Any]], prod: dict[str, Any]) -> dict[str, Any]:
    plan = analyze(inventories, rows, prod)
    file_by_fy = {item["fiscal_year"]: item for item in inventories}
    source_by_fp: dict[str, list[dict[str, Any]]] = defaultdict(list)
    source_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    logical_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    occurrence_ids: Counter[tuple[str, str, str, str]] = Counter()
    for row in rows:
        source_by_fp[row_fingerprint_sha256(row)].append(row)
        source_by_key[observation_key(row)].append(row)
        logical_by_key[logical_key(row)].append(row)
        occurrence_ids[(
            observation_key(row), row["_fiscal_year"],
            file_by_fy[row["_fiscal_year"]]["sha256"], row["_source_record_locator"],
        )] += 1

    production_fps: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for action in prod["discipline"]:
        production_fps[row_fingerprint_sha256(action["raw_payload"])].append(action)

    legacy_mappings = []
    ambiguous = 0
    orphan = 0
    for fp, actions in production_fps.items():
        candidates = source_by_fp.get(fp, [])
        if len(actions) != 1 or len(candidates) != 1:
            ambiguous += len(actions)
            continue
        source = candidates[0]
        if source["_fiscal_year"] != "2024-25":
            orphan += 1
            continue
        legacy_mappings.append((actions[0]["id"], observation_key(source), fp, logical_key(source)))

    existing_keys = {mapping[1] for mapping in legacy_mappings}
    future_rows = [row for row in rows if observation_key(row) not in existing_keys]
    existing_logical = {mapping[3] for mapping in legacy_mappings}
    revision_candidates = sum(logical_key(row) in existing_logical for row in future_rows)

    resolver = FloridaDbprCredentialResolver(prod["licenses"])
    resolution = Counter()
    for row in future_rows:
        result = resolver.resolve(
            source_dataset="contractor_disc_lic",
            license_type=row["License Type"],
            license_number=row["License Nbr"],
        )
        resolution[result.identity_state] += 1

    assertions = {
        "legacy_exact_1541": len(legacy_mappings) == 1541,
        "legacy_ambiguous_zero": ambiguous == 0,
        "legacy_orphan_zero": orphan == 0,
        "legacy_v2_collisions_zero": len({m[1] for m in legacy_mappings}) == 1541,
        "future_new_4916": len(future_rows) == 4916,
        "existing_exact_1541": len(existing_keys) == 1541,
        "all_v2_collisions_zero": all(count == 1 for count in map(len, source_by_key.values())),
        "revision_candidates_zero": revision_candidates == 0,
        "occurrence_collisions_zero": all(count == 1 for count in occurrence_ids.values()),
        "resolver_partition": dict(resolution) == {
            "EXACT": 1213, "DETERMINISTIC": 175,
            "REVIEW_REQUIRED": 1035, "UNRESOLVED": 2493,
        },
        "current_safety_unchanged": plan["assertions"]["current_resolution_baseline"],
        "public_eligible_zero": plan["current_safety_check"]["stored_public_eligible"] == 0,
    }
    if not all(assertions.values()):
        raise RuntimeError(f"Source-versioning simulation failed: {assertions}")

    return {
        "audit_id": "CTH-FL-STATE-002A",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "git_sha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "database": "PRODUCTION",
        "transaction": {"read_only": True, "isolation": "repeatable read", "statement_timeout": "30s"},
        "algorithm_versions": {
            "source_observation": SOURCE_OBSERVATION_ALGORITHM,
            "logical_matter_detail": LOGICAL_MATTER_ALGORITHM,
        },
        "schema_design": {
            "observation_table": "regulatory_source_observations",
            "occurrence_table": "regulatory_source_occurrences",
            "occurrence_locator": "source_record_locator (occurrence provenance only)",
            "discipline_relationship": "regulatory_source_observations.discipline_action_id",
            "migration": "009_regulatory_source_observations.sql",
            "migration_sha256": hashlib.sha256(MIGRATION_PATH.read_bytes()).hexdigest(),
        },
        "legacy_backfill": {
            "production_rows": len(prod["discipline"]),
            "official_fy24_checksum": FY24_CHECKSUM,
            "exact_source_reconciliations": len(legacy_mappings),
            "proposed_observations": len(legacy_mappings),
            "proposed_occurrences": len(legacy_mappings),
            "ambiguous_mappings": ambiguous,
            "orphan_production_rows": orphan,
            "duplicate_v2_keys": len(legacy_mappings) - len({m[1] for m in legacy_mappings}),
            "revision_candidates": 0,
        },
        "future_simulation": {
            "all_file_rows": len(rows),
            "existing_exact_observations": len(existing_keys),
            "new_observations": len(future_rows),
            "new_occurrences": len(future_rows),
            "exact_duplicate_current_observations": sum(len(v) - 1 for v in source_by_key.values()),
            "revision_review_candidates": revision_candidates,
            "v2_key_collisions": sum(len(v) > 1 for v in source_by_key.values()),
            "occurrence_collisions": sum(v > 1 for v in occurrence_ids.values()),
            "logical_group_count": len(logical_by_key),
            "multi_observation_logical_groups": sum(len(v) > 1 for v in logical_by_key.values()),
            "resolver_partition": dict(sorted(resolution.items())),
        },
        "safety": {
            "production_mutations": 0,
            "license_id_changes": 0,
            "contractor_id_changes": 0,
            "publication_changes": 0,
            "public_eligible": 0,
            "non_fl_rows_touched": 0,
        },
        "synthetic_contract": {
            "exact_reobservation": "same observation; new unique occurrence allowed; no new discipline action",
            "material_change_same_logical_group": "new observation retained as REVISION_REVIEW_REQUIRED; existing discipline action reused pending review",
            "legitimate_multiline_same_file": "distinct observation and discipline detail; complaint-level collapse prohibited",
            "automatic_supersession": False,
            "automatic_duplicate_discipline_event": False,
        },
        "assertions": assertions,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    inventories, rows = inspect_files(args.raw_dir)
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")
    import psycopg
    with psycopg.connect(normalize_database_url(os.environ["DATABASE_URL"]), autocommit=False) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                cur.execute("SET LOCAL statement_timeout='30000ms'")
                cur.execute("SELECT current_setting('transaction_read_only'), current_setting('transaction_isolation')")
                if cur.fetchone() != ("on", "repeatable read"):
                    raise RuntimeError("Read-only repeatable-read protections are not active")
                cur.execute("SELECT to_regclass('public.regulatory_source_observations')")
                if cur.fetchone()[0] is not None:
                    raise RuntimeError("Migration 009 unexpectedly exists in production")
                result = simulate(inventories, rows, production_snapshot(cur))
        finally:
            conn.rollback()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "legacy_backfill": result["legacy_backfill"],
        "future_simulation": result["future_simulation"],
        "safety": result["safety"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
