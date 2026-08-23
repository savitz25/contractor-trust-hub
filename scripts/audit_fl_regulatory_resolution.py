#!/usr/bin/env python3
"""CTH-FL-SAFE-001 production resolution dry-run (strictly read-only)."""

from __future__ import annotations

import argparse
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
from ingest.regulatory.fl_dbpr_identity import (  # noqa: E402
    FloridaDbprCredentialResolver,
    LicenseCredential,
    normalize_numeric_core,
)

DEFAULT_OUTPUT = ROOT / "artifacts" / "cth-fl-safe-001-resolution-dry-run.json"


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def audit(cur: Any) -> dict[str, Any]:
    cur.execute(
        """SELECT id, external_key, occupation_code, license_number,
                  source_board, contractor_id
           FROM licenses WHERE source_system='fl_dbpr'"""
    )
    licenses = [
        LicenseCredential(
            id=str(row[0]), external_key=row[1], occupation_code=row[2],
            license_number=row[3], source_board=row[4],
            contractor_id=str(row[5]) if row[5] else None,
        )
        for row in cur.fetchall()
    ]
    resolver = FloridaDbprCredentialResolver(licenses)
    by_core: dict[str, list[LicenseCredential]] = defaultdict(list)
    for lic in licenses:
        core = normalize_numeric_core(lic.license_number)
        if core:
            by_core[core].append(lic)

    cur.execute(
        """SELECT id, external_key, source_dataset, license_type,
                  license_number_raw, license_id, contractor_id
           FROM discipline_actions
           WHERE source_system='fl_dbpr'
           ORDER BY external_key"""
    )
    rows = cur.fetchall()
    state_counts: Counter[str] = Counter()
    linked_counts: Counter[str] = Counter()
    unattached_counts: Counter[str] = Counter()
    collision_counts: Counter[str] = Counter()
    correction_counts: Counter[str] = Counter()
    records: list[dict[str, Any]] = []
    correction_manifest: list[dict[str, str]] = []

    for row in rows:
        rid, external_key, dataset, license_type, raw_number, current_id, contractor_id = row
        current = str(current_id) if current_id else None
        resolution = resolver.resolve(
            source_dataset=dataset,
            license_type=license_type,
            license_number=raw_number,
        )
        proposed = resolution.proposed_license_id
        state_counts[resolution.identity_state] += 1
        agrees = bool(current and proposed and current == proposed)
        correctable = bool(current and proposed and current != proposed)

        if current:
            if agrees:
                linked_counts["current_link_agrees"] += 1
            elif correctable:
                linked_counts["current_link_conflicts"] += 1
            elif resolution.identity_state == "REVIEW_REQUIRED":
                linked_counts["review_required"] += 1
            else:
                linked_counts["unresolved"] += 1
        else:
            unattached_counts[resolution.identity_state.lower()] += 1

        if agrees:
            category = "SAFE_KEEP"
        elif correctable:
            category = "CORRECTABLE"
            correction_manifest.append(
                {
                    "discipline_id": str(rid),
                    "discipline_external_key": external_key,
                    "old_license_id": current,
                    "proposed_license_id": proposed,
                    "proposed_license_external_key": resolution.resolved_external_key or "",
                    "resolver_version": resolution.resolver_version,
                }
            )
        elif resolution.identity_state == "REVIEW_REQUIRED":
            category = "REVIEW_REQUIRED"
        else:
            category = "UNRESOLVED"
        correction_counts[category] += 1

        core = normalize_numeric_core(raw_number)
        collision = bool(core and len(by_core.get(core, [])) > 1)
        if collision:
            collision_counts[resolution.identity_state] += 1
            if agrees:
                collision_counts["current_link_agrees"] += 1
            elif correctable:
                collision_counts["current_link_conflicts"] += 1
            else:
                collision_counts["current_link_not_safely_comparable"] += 1

        records.append(
            {
                "discipline_id": str(rid),
                "discipline_external_key": external_key,
                "source_dataset": dataset,
                "current_license_id": current,
                "proposed_license_id": proposed,
                "identity_state": resolution.identity_state,
                "identity_method": resolution.identity_method,
                "resolver_version": resolution.resolver_version,
                "current_link_agrees": agrees,
                "correction_required": correctable,
                "correction_category": category,
                "collision_exposed": collision,
                "reason": resolution.reason,
            }
        )

    cur.execute(
        """SELECT COUNT(*)::int,
                  COUNT(*) FILTER (WHERE contractor_id IS NOT NULL)::int
           FROM discipline_actions WHERE source_system='fl_dbpr'"""
    )
    total, contractor_linked = cur.fetchone()
    assertions = {
        "total_is_1541": total == 1541 == len(records),
        "linked_plus_unattached_reconciles": sum(linked_counts.values()) + sum(unattached_counts.values()) == total,
        "identity_states_reconcile": sum(state_counts.values()) == total,
        "correction_categories_reconcile": sum(correction_counts.values()) == total,
        "collision_total_is_194": sum(collision_counts[s] for s in ("EXACT", "DETERMINISTIC", "REVIEW_REQUIRED", "UNRESOLVED")) == 194,
        "collision_disambiguated_is_157": collision_counts["EXACT"] + collision_counts["DETERMINISTIC"] == 157,
        "current_public_exposure_zero": contractor_linked == 0,
        "unattached_safe_matches_zero": unattached_counts["exact"] + unattached_counts["deterministic"] == 0,
    }
    if not all(assertions.values()):
        raise RuntimeError(f"Dry-run reconciliation failed: {assertions}")

    return {
        "audit_id": "CTH-FL-SAFE-001",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "git_sha": git("rev-parse", "HEAD"),
        "database": "PRODUCTION",
        "transaction": {"read_only": True, "isolation": "repeatable read", "statement_timeout": "30s"},
        "resolver_version": resolver.version,
        "mutation_performed": False,
        "total": total,
        "identity_states": dict(state_counts),
        "existing_license_linked": {"total": sum(linked_counts.values()), **dict(linked_counts)},
        "existing_unattached": {"total": sum(unattached_counts.values()), **dict(unattached_counts)},
        "collision_exposed": {"total": 194, **dict(collision_counts)},
        "current_contractor_linked": contractor_linked,
        "current_public_exposure": 0,
        "correction_plan": dict(correction_counts),
        "correction_manifest": correction_manifest,
        "assertions": assertions,
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")
    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit("psycopg is required") from exc

    with psycopg.connect(normalize_database_url(url), autocommit=False) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                cur.execute("SET LOCAL statement_timeout='30000ms'")
                cur.execute("SELECT current_setting('transaction_read_only'), current_setting('transaction_isolation')")
                if cur.fetchone() != ("on", "repeatable read"):
                    raise RuntimeError("Read-only repeatable-read protections are not active")
                result = audit(cur)
        finally:
            conn.rollback()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: result[k] for k in ("total", "identity_states", "existing_license_linked", "existing_unattached", "collision_exposed", "correction_plan", "mutation_performed")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
