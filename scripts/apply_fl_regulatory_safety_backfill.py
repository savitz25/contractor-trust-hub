#!/usr/bin/env python3
"""Bounded SAFE-002B Florida identity backfill and canonical corrections."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402
from scripts.audit_fl_regulatory_resolution import (  # noqa: E402
    audit,
    canonical_manifest,
    manifest_fingerprint,
    stable_reason_code,
)

CANONICAL_ARTIFACT = ROOT / "artifacts/cth-fl-safe-002b-dry-run.json"
REVERSE_ARTIFACT = ROOT / "artifacts/cth-fl-safe-002b-reverse-manifest.json"
VERIFY_ARTIFACT = ROOT / "artifacts/cth-fl-safe-002b-production-verification.json"
EXPECTED_FINGERPRINT = "sha256:be4ff31eac2c732d2207ee7a6cb7601c7bd62f9905e72e156526a2af378812bd"


def git_sha() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()


def relationship_rows(cur: Any) -> list[dict[str, str]]:
    cur.execute("""
      SELECT id::text, source_system, license_id::text, contractor_id::text
      FROM discipline_actions ORDER BY id
    """)
    return [
        {"id": row[0], "source_system": row[1], "license_id": row[2] or "", "contractor_id": row[3] or ""}
        for row in cur
    ]


def relation_fingerprint(rows: list[dict[str, str]], source: str | None = None) -> str:
    digest = hashlib.sha256()
    for row in rows:
        if source is not None and row["source_system"] != source:
            continue
        digest.update("|".join((row["id"], row["source_system"], row["license_id"] or "<NULL>", row["contractor_id"] or "<NULL>")).encode())
        digest.update(b"\n")
    return "sha256:" + digest.hexdigest()


def all_relationship_fingerprints(rows: list[dict[str, str]]) -> dict[str, str]:
    return {
        "whole": relation_fingerprint(rows),
        "florida": relation_fingerprint(rows, "fl_dbpr"),
        "arizona": relation_fingerprint(rows, "az_roc"),
        "new_jersey": relation_fingerprint(rows, "nj_enforcement"),
    }


def safety_fingerprint(cur: Any) -> str:
    cur.execute("""
      SELECT id::text, license_id::text, contractor_id::text,
             identity_state, identity_method, resolver_version,
             resolved_license_external_key, review_reason, publication_state,
             correction_hold::text, retraction_hold::text
      FROM discipline_actions WHERE source_system='fl_dbpr' ORDER BY id
    """)
    digest = hashlib.sha256()
    for row in cur:
        digest.update("|".join(value or "<NULL>" for value in row).encode())
        digest.update(b"\n")
    return "sha256:" + digest.hexdigest()


def predicted_relationships(pre: list[dict[str, str]], manifest: list[dict[str, Any]]) -> list[dict[str, str]]:
    replacements = {row["discipline_id"]: row["proposed_license_id"] for row in manifest}
    result = [dict(row) for row in pre]
    for row in result:
        if row["id"] in replacements:
            row["license_id"] = replacements[row["id"]]
    return result


def reverse_manifest(corrections: list[dict[str, Any]]) -> dict[str, Any]:
    entries = sorted(
        [
            {
                "discipline_id": row["discipline_id"],
                "old_license_id": row["expected_current_license_id"],
                "new_license_id": row["proposed_license_id"],
            }
            for row in corrections
        ],
        key=lambda row: row["discipline_id"],
    )
    payload = json.dumps(entries, separators=(",", ":"), sort_keys=True)
    return {
        "audit_id": "CTH-FL-SAFE-002B-REVERSE",
        "source_system": "fl_dbpr",
        "count": len(entries),
        "fingerprint": "sha256:" + hashlib.sha256(payload.encode()).hexdigest(),
        "entries": entries,
        "automatic_rollback_authorized": False,
    }


def validate_partition(result: dict[str, Any], *, pre_correction: bool) -> None:
    expected_states = {"EXACT": 523, "DETERMINISTIC": 61, "REVIEW_REQUIRED": 376, "UNRESOLVED": 581}
    if result["total"] != 1541 or result["identity_states"] != expected_states:
        raise RuntimeError("resolver partition drift")
    linked = result["existing_license_linked"]
    unattached = result["existing_unattached"]
    if unattached != {"total": 554, "unresolved": 554}:
        raise RuntimeError("unattached partition drift")
    if pre_correction:
        expected_linked = {"total": 987, "current_link_agrees": 496, "current_link_conflicts": 88, "review_required": 376, "unresolved": 27}
    else:
        expected_linked = {"total": 987, "current_link_agrees": 584, "review_required": 376, "unresolved": 27}
    if linked != expected_linked:
        raise RuntimeError(f"linked partition drift: {linked}")
    if result["current_contractor_linked"] != 0 or result["current_public_exposure"] != 0:
        raise RuntimeError("Florida contractor/public exposure drift")


def validate_manifest(canonical: list[dict[str, Any]], fresh: list[dict[str, Any]]) -> None:
    if len(canonical) != 88 or len(fresh) != 88:
        raise RuntimeError("correctable count drift")
    if manifest_fingerprint(canonical) != EXPECTED_FINGERPRINT or manifest_fingerprint(fresh) != EXPECTED_FINGERPRINT:
        raise RuntimeError("manifest fingerprint drift")
    keys = ("discipline_id", "discipline_external_key", "expected_current_license_id", "proposed_license_id", "proposed_license_external_key", "resolver_version", "identity_state", "identity_method")
    canon = {row["discipline_id"]: tuple(row[k] for k in keys) for row in canonical}
    current = {row["discipline_id"]: tuple(row[k] for k in keys) for row in fresh}
    if canon != current:
        raise RuntimeError("canonical manifest fields drift")


def validate_targets(cur: Any, corrections: list[dict[str, Any]]) -> None:
    target_ids = sorted({row["proposed_license_id"] for row in corrections})
    cur.execute("""
      SELECT id::text, source_system, external_key FROM licenses WHERE id = ANY(%s::uuid[])
    """, (target_ids,))
    found = {row[0]: (row[1], row[2]) for row in cur}
    if set(found) != set(target_ids):
        raise RuntimeError("one or more target licenses do not exist")
    for row in corrections:
        actual = found[row["proposed_license_id"]]
        if actual != ("fl_dbpr", row["proposed_license_external_key"]):
            raise RuntimeError(f"target credential mismatch for {row['discipline_id']}")
    cur.execute("""
      SELECT external_key FROM licenses WHERE source_system='fl_dbpr'
      GROUP BY external_key HAVING count(*) > 1
    """)
    if cur.fetchone() is not None:
        raise RuntimeError("duplicate Florida external_key detected")


def stored_post_state(cur: Any) -> dict[str, Any]:
    cur.execute("""SELECT identity_state, count(*)::int FROM discipline_actions
                   WHERE source_system='fl_dbpr' GROUP BY 1 ORDER BY 1""")
    identity = dict(cur.fetchall())
    cur.execute("""SELECT publication_state, count(*)::int FROM discipline_actions
                   WHERE source_system='fl_dbpr' GROUP BY 1 ORDER BY 1""")
    publication = dict(cur.fetchall())
    cur.execute("""
      SELECT count(*) FILTER (WHERE correction_hold IS TRUE)::int,
             count(*) FILTER (WHERE correction_hold IS FALSE)::int,
             count(*) FILTER (WHERE retraction_hold IS TRUE)::int,
             count(*) FILTER (WHERE retraction_hold IS FALSE)::int,
             count(*) FILTER (WHERE license_id IS NOT NULL)::int,
             count(*) FILTER (WHERE contractor_id IS NOT NULL)::int,
             count(*) FILTER (WHERE license_id IS NULL AND contractor_id IS NULL)::int
      FROM discipline_actions WHERE source_system='fl_dbpr'
    """)
    values = cur.fetchone()
    return {
        "identity": identity,
        "publication": publication,
        "holds": dict(zip(("correction_true", "correction_false", "retraction_true", "retraction_false"), values[:4])),
        "relationships": dict(zip(("license_linked", "contractor_linked", "neither"), values[4:])),
    }


def expected_post_state() -> dict[str, Any]:
    return {
        "identity": {"DETERMINISTIC": 61, "EXACT": 523, "REVIEW_REQUIRED": 376, "UNRESOLVED": 581},
        "publication": {"INTERNAL": 1541},
        "holds": {"correction_true": 403, "correction_false": 1138, "retraction_true": 0, "retraction_false": 1541},
        "relationships": {"license_linked": 987, "contractor_linked": 0, "neither": 554},
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute-production", action="store_true")
    parser.add_argument("--expected-manifest-fingerprint")
    parser.add_argument("--publication-gate-off-confirmed", action="store_true")
    args = parser.parse_args()
    if not args.execute_production:
        raise SystemExit("Dry by default. Pass --execute-production only with explicit approval.")
    if args.expected_manifest_fingerprint != EXPECTED_FINGERPRINT:
        raise SystemExit("Expected canonical manifest fingerprint is required")
    if not args.publication_gate_off_confirmed:
        raise SystemExit("Explicit publication gate OFF confirmation is required")

    load_dotenv_files(ROOT / ".env.local", ROOT / ".env.production.local")
    url = normalize_database_url(os.environ.get("DATABASE_URL", ""))
    if not url:
        raise SystemExit("DATABASE_URL is required")
    import psycopg
    from psycopg.types.json import Jsonb

    canonical_artifact = json.loads(CANONICAL_ARTIFACT.read_text(encoding="utf-8"))
    canonical = canonical_artifact["correction_manifest"]
    execution: dict[str, Any] = {
        "audit_id": "CTH-FL-SAFE-002B-PROD",
        "git_sha": git_sha(),
        "manifest_fingerprint": EXPECTED_FINGERPRINT,
        "mutation_scope": "fl_dbpr only",
        "contractor_id_mutations": 0,
        "publication_enabled": False,
        "ingestion_performed": False,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }

    # Fresh independent read-only preflight.
    with psycopg.connect(url, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        cur.execute("SET LOCAL statement_timeout='30s'")
        cur.execute("SHOW server_version")
        execution["postgresql_version"] = cur.fetchone()[0]
        fresh = audit(cur)
        validate_partition(fresh, pre_correction=True)
        validate_manifest(canonical, fresh["correction_manifest"])
        validate_targets(cur, fresh["correction_manifest"])
        pre_relationships = relationship_rows(cur)
        execution["pre_relationship_fingerprints"] = all_relationship_fingerprints(pre_relationships)
        execution["pre_safety_fingerprint"] = safety_fingerprint(cur)
        execution["pre_stored_state"] = stored_post_state(cur)
        expected_pre = {
            "identity": {"UNRESOLVED": 1541},
            "publication": {"INTERNAL": 1541},
            "holds": {"correction_true": 0, "correction_false": 1541, "retraction_true": 0, "retraction_false": 1541},
            "relationships": {"license_linked": 987, "contractor_linked": 0, "neither": 554},
        }
        if execution["pre_stored_state"] != expected_pre:
            raise RuntimeError(f"stored production baseline drift: {execution['pre_stored_state']}")
        safety = fresh["stored_safety_state"]
        if safety["safety_column_count"] != 13 or len(safety["constraints"]) != 4 or not all(row["valid"] for row in safety["constraints"]) or not safety["publication_index"]:
            raise RuntimeError("migration safety schema drift")
        execution["pre_shared_sources"] = safety["shared_sources"]
        if any(
            row["source_system"] != "fl_dbpr"
            and any(row[key] != 0 for key in ("identity_nonnull", "publication_nonnull", "correction_nonnull", "retraction_nonnull"))
            for row in safety["shared_sources"]
        ):
            raise RuntimeError("non-FL safety metadata drift")
        cur.execute("ROLLBACK")

    predicted = predicted_relationships(pre_relationships, canonical)
    execution["predicted_post_relationship_fingerprints"] = all_relationship_fingerprints(predicted)
    reverse = reverse_manifest(canonical)
    execution["reverse_manifest_fingerprint"] = reverse["fingerprint"]
    REVERSE_ARTIFACT.write_text(json.dumps(reverse, indent=2) + "\n", encoding="utf-8")

    # One bounded, locked production transaction.
    with psycopg.connect(url, autocommit=True) as conn, conn.cursor() as cur:
        try:
            execution["transaction_started_at"] = datetime.now(timezone.utc).isoformat()
            cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            cur.execute("SET LOCAL lock_timeout='5s'")
            cur.execute("SET LOCAL statement_timeout='120s'")
            cur.execute("""SELECT id FROM discipline_actions WHERE source_system='fl_dbpr'
                           ORDER BY id FOR UPDATE""")
            locked = cur.fetchall()
            execution["florida_rows_locked"] = len(locked)
            if len(locked) != 1541:
                raise RuntimeError("Florida lock count drift")

            locked_audit = audit(cur)
            validate_partition(locked_audit, pre_correction=True)
            validate_manifest(canonical, locked_audit["correction_manifest"])
            validate_targets(cur, locked_audit["correction_manifest"])
            locked_relationships = relationship_rows(cur)
            if locked_relationships != pre_relationships:
                raise RuntimeError("relationship state changed between preflight and lock")
            if stored_post_state(cur)["publication"].get("PUBLIC_ELIGIBLE", 0) != 0:
                raise RuntimeError("publication drift")
            execution["manifest_reverified_inside_transaction"] = True

            safe_external = {row["discipline_id"]: row["resolved_license_external_key"] for row in locked_audit["safe_keep_manifest"]}
            correct_external = {row["discipline_id"]: row["proposed_license_external_key"] for row in locked_audit["correction_manifest"]}
            evaluated_at = datetime.now(timezone.utc)
            update_counts = {"SAFE_KEEP": 0, "CORRECTABLE": 0, "REVIEW_REQUIRED": 0, "LINKED_UNRESOLVED": 0, "UNATTACHED_UNRESOLVED": 0}

            sql = """
              UPDATE discipline_actions SET
                license_id=%s, identity_state=%s, identity_method=%s,
                resolver_version=%s, resolved_license_external_key=%s,
                identity_evidence=%s, identity_evaluated_at=%s, review_reason=%s,
                publication_state='INTERNAL', correction_hold=%s, retraction_hold=FALSE
              WHERE id=%s::uuid AND source_system='fl_dbpr'
                AND license_id IS NOT DISTINCT FROM %s::uuid
                AND contractor_id IS NULL AND publication_state='INTERNAL'
            """
            for record in locked_audit["records"]:
                category = record["correction_category"]
                current = record["current_license_id"]
                proposed = record["proposed_license_id"] if category == "CORRECTABLE" else current
                if category == "UNRESOLVED":
                    label = "LINKED_UNRESOLVED" if current else "UNATTACHED_UNRESOLVED"
                else:
                    label = category
                hold = category == "REVIEW_REQUIRED" or label == "LINKED_UNRESOLVED"
                review_reason = stable_reason_code(record["identity_state"], record["reason"]) if category in {"REVIEW_REQUIRED", "UNRESOLVED"} else None
                resolved_key = safe_external.get(record["discipline_id"]) or correct_external.get(record["discipline_id"])
                evidence = Jsonb({"reason_code": review_reason or "AUTHORITATIVE_TYPE_NUMBER_MATCH", "resolver_reason": record["reason"]})
                cur.execute(sql, (
                    proposed, record["identity_state"], record["identity_method"], record["resolver_version"],
                    resolved_key, evidence, evaluated_at, review_reason, hold,
                    record["discipline_id"], current,
                ))
                if cur.rowcount != 1:
                    raise RuntimeError(f"optimistic guard failed for {record['discipline_id']}")
                update_counts[label] += 1

            if update_counts != {"SAFE_KEEP": 496, "CORRECTABLE": 88, "REVIEW_REQUIRED": 376, "LINKED_UNRESOLVED": 27, "UNATTACHED_UNRESOLVED": 554}:
                raise RuntimeError(f"update count drift: {update_counts}")
            execution["updated_rows"] = update_counts

            actual_relationships = relationship_rows(cur)
            actual_fp = all_relationship_fingerprints(actual_relationships)
            execution["precommit_relationship_fingerprints"] = actual_fp
            if actual_fp != execution["predicted_post_relationship_fingerprints"]:
                raise RuntimeError("predicted relationship fingerprint mismatch")
            before = {row["id"]: row for row in pre_relationships}
            after = {row["id"]: row for row in actual_relationships}
            changes = [rid for rid in before if before[rid] != after[rid]]
            if set(changes) != {row["discipline_id"] for row in canonical}:
                raise RuntimeError("unexpected relationship changes")
            if any(before[rid]["contractor_id"] != after[rid]["contractor_id"] for rid in before):
                raise RuntimeError("contractor relationship changed")
            execution["license_relationship_changes"] = len(changes)

            post_state = stored_post_state(cur)
            execution["precommit_stored_state"] = post_state
            if post_state != expected_post_state():
                raise RuntimeError(f"post-state invariant failed: {post_state}")
            if actual_fp["arizona"] != execution["pre_relationship_fingerprints"]["arizona"] or actual_fp["new_jersey"] != execution["pre_relationship_fingerprints"]["new_jersey"]:
                raise RuntimeError("non-FL fingerprint changed")

            cur.execute("COMMIT")
            execution["commit_successful"] = True
            execution["committed_at"] = datetime.now(timezone.utc).isoformat()
        except Exception:
            try:
                cur.execute("ROLLBACK")
            except Exception:
                pass
            execution["commit_successful"] = False
            raise

    # Independent post-commit read-only verification and resolver rerun.
    with psycopg.connect(url, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        cur.execute("SET LOCAL statement_timeout='30s'")
        post_audit = audit(cur)
        validate_partition(post_audit, pre_correction=False)
        post_relationships = relationship_rows(cur)
        execution["post_relationship_fingerprints"] = all_relationship_fingerprints(post_relationships)
        execution["post_safety_fingerprint"] = safety_fingerprint(cur)
        execution["post_stored_state"] = stored_post_state(cur)
        if execution["post_relationship_fingerprints"] != execution["predicted_post_relationship_fingerprints"]:
            raise RuntimeError("post-commit relationship fingerprint mismatch")
        if execution["post_stored_state"] != expected_post_state():
            raise RuntimeError("post-commit stored state mismatch")
        if post_audit["stored_safety_state"]["shared_sources"] != execution["pre_shared_sources"]:
            # Florida non-null counts remain 1,541; only values change. Non-FL
            # rows must remain byte-for-byte identical at this aggregate grain.
            raise RuntimeError("shared-source safety isolation changed")
        execution["correctable_remaining"] = post_audit["correction_plan"].get("CORRECTABLE", 0)
        execution["post_resolver_states"] = post_audit["identity_states"]
        execution["post_verified_at"] = datetime.now(timezone.utc).isoformat()
        execution["post_commit_verification"] = True
        cur.execute("ROLLBACK")

    execution["completed_at"] = datetime.now(timezone.utc).isoformat()
    execution["production_mutation"] = "SAFE-002B metadata backfill plus 88 canonical license corrections only"
    VERIFY_ARTIFACT.write_text(json.dumps(execution, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(execution, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
