#!/usr/bin/env bash
# Disposable PostgreSQL 17 engine verification for CON-OSHA-002.
# Synthetic data only. This script refuses any host other than the local
# service container. It does not read repo secrets and does not call the
# production writer.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGDATABASE:?PGDATABASE is required}"

case "$PGHOST" in
  localhost|127.0.0.1|/tmp) ;;
  *)
    echo "refusing non-local database host"
    exit 2
    ;;
esac

case "$PGDATABASE" in
  cth_osha_pg17_synthetic) ;;
  *)
    echo "refusing database name that is not the disposable synthetic database"
    exit 2
    ;;
esac

if [[ "${PGPASSWORD:-}" == *supabase* || "$PGHOST" == *supabase* || "$PGDATABASE" == *prod* ]]; then
  echo "refusing a production-shaped connection"
  exit 2
fi

export PGOPTIONS="${PGOPTIONS:-} -c search_path=public"

echo "SQL-engine verification on synthetic data. Not a production load."

for _ in $(seq 1 30); do
  if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE"

psql_exec() {
  psql -X -v ON_ERROR_STOP=1 "$@"
}

psql_exec -f scripts/con_osha_002/pg17/00_parents.sql
psql_exec -f scripts/con_osha_002/pg17/01_roles.sql
psql_exec -f schema/migrations/018_con_osha_001_osha_safety_record.sql
psql_exec -f schema/migrations/019_con_osha_001b_inspection_details.sql
psql_exec -f schema/migrations/020_con_osha_002_state_expansion.sql

set +e
output="$(psql_exec -f scripts/con_osha_002/pg17/02_assertions.sql 2>&1)"
status=$?
set -e
printf '%s\n' "$output"

assertions=(
  migration_020_applies
  state_constraints_and_foreign_keys
  inspection_citation_receipts_separate
  initial_penalties_null_zero_positive
  source_zip_hashes_persisted
  synthetic_fixture_counts
  mid_transaction_rollback
  second_execution_zero_duplicates
  batch_rollback_preserves_fl_nj
  private_hold_tables_unreadable
)

echo "--- assertion receipts ---"
failed=0
for name in "${assertions[@]}"; do
  if printf '%s\n' "$output" | grep -q "ASSERTION ${name} PASS"; then
    echo "ASSERTION ${name} PASS"
  else
    echo "ASSERTION ${name} FAIL"
    failed=1
  fi
done

if [[ "$status" -ne 0 || "$failed" -ne 0 ]]; then
  echo "CI=FAIL"
  echo "PRODUCTION_MUTATIONS = 0"
  exit 1
fi

echo "--- gates ---"
echo "POSTGRES_17_ENGINE=PASS"
echo "MIGRATION_020=PASS"
echo "FOREIGN_KEYS=PASS"
echo "CITATION_PROVENANCE=PASS"
echo "INITIAL_PENALTIES=PASS"
echo "SOURCE_HASHES=PASS"
echo "TRANSACTION_ROLLBACK=PASS"
echo "SECOND_RUN_IDEMPOTENCY=PASS"
echo "FL_NJ_UNCHANGED=PASS"
echo "CI=PASS"
echo "PRODUCTION_MUTATIONS = 0"
