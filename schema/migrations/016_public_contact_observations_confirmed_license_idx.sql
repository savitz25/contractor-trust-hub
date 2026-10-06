-- EA-CT-001-INDEX: eliminate the confirmed sequential scan of public_contact_observations
-- (16,009 rows today) that EA-CT-001's Trust Report contact lookup performs on every profile
-- view. The table's only existing index is a 5-column composite UNIQUE index
-- (source_system, kind, value_normalized, attributed_license_id, attributed_local_credential_id)
-- that cannot serve a lookup filtered on attributed_license_id alone.
--
-- Pure performance hardening: no identity/filter semantics change. The feature (PR #88) is
-- correct and fail-closed with or without this index -- it is simply slower without it.
--
-- *** DO NOT apply this file through the standard transactional migration pattern used by
-- scripts/apply_migration_0NN.py (psycopg.connect(url) with default autocommit=False, followed
-- by conn.commit()). PostgreSQL cannot run CREATE INDEX CONCURRENTLY inside a transaction block;
-- doing so raises "CREATE INDEX CONCURRENTLY cannot run inside a transaction block" and the
-- migration will fail. Apply ONLY via scripts/apply_migration_016_concurrent.py, which explicitly
-- opens the connection in autocommit mode for exactly this reason. See
-- docs/ops/EA-CT-001-INDEX-RUNBOOK.md for the full execution procedure. ***
--
-- Idempotent: IF NOT EXISTS is safe to re-run. A prior failed CONCURRENTLY build can leave an
-- INVALID index of this same name behind (PostgreSQL does not clean this up automatically) -- the
-- runbook's pre-apply check detects and reports that case; IF NOT EXISTS alone will NOT repair or
-- replace an invalid index of the same name, since the name already exists from Postgres's
-- perspective (see the runbook's rollback/rebuild procedure for that case).

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  public_contact_observations_confirmed_license_idx
ON public_contact_observations (attributed_license_id)
WHERE attribution_class = 'CONFIRMED'
  AND is_agency_number = false
  AND attributed_license_id IS NOT NULL;
