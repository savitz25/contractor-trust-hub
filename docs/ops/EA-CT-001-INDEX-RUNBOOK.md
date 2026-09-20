# EA-CT-001-INDEX — production read-path index runbook

Eliminates the confirmed sequential scan of `public_contact_observations` (16,009 rows today,
reaching 8,015 distinct contractor profiles) that EA-CT-001's Trust Report contact lookup performs
on every profile view (contact-bearing or not). Pure performance hardening: PR #88's feature is
correct and fail-closed with or without this index.

**This is a preparation-only artifact. No one has applied this index yet. Do not apply it without
explicit authorization from whoever owns production schema changes, and do not apply it while the
current DB session/IO-pressure incident is active without that owner's explicit sign-off.**

## B. Production migration execution model (as found in this repo)

- Migrations live as numbered SQL files in `schema/migrations/0NN_*.sql`.
- Each migration has its own dedicated apply script, `scripts/apply_migration_0NN.py`
  (011, 013, 014, 015 exist today) — there is no single generic runner that walks the directory.
- Every existing apply script follows the identical pattern:
  ```python
  with psycopg.connect(url) as conn:      # default autocommit=False
      conn.execute("SET lock_timeout = '5s'")
      conn.execute("SET statement_timeout = '60s'")
      # ... idempotency pre-check via information_schema ...
      conn.execute(sql)                   # whole migration file, inside the implicit transaction
      conn.commit()
  ```
- There is **no** schema-version tracking table; idempotency is achieved per-script via an
  ad-hoc "does the specific change already exist?" check (a column, in the existing scripts).
- **This means every existing migration file's statements run inside one implicit transaction.**
  `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block at all — PostgreSQL raises
  `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block` and aborts. There is no
  existing "non-transactional migration" mode in this repo to opt into.

## C. Chosen safe implementation shape

**Option B from the ticket**: a versioned migration SQL file (for tracking/history, matching the
existing numbering) plus a **separate, distinctly-named** apply script that explicitly opens the
connection with `autocommit=True` and never wraps the statement in a transaction — clearly
distinguished by name (`_concurrent.py` suffix) and by an explicit docstring warning so it is never
confused with, or "corrected" to match, the standard pattern.

## D. Files added

- `schema/migrations/016_public_contact_observations_confirmed_license_idx.sql` — the DDL, with a
  header warning against the standard apply pattern.
- `scripts/apply_migration_016_concurrent.py` — `--check` (default, read-only), `--apply` (requires
  `--i-understand-this-touches-production`), `--verify` (read-only, post-apply).
- `docs/ops/EA-CT-001-INDEX-RUNBOOK.md` — this file.

No EA-CT-001 feature code was touched.

## E. Exact proposed SQL

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  public_contact_observations_confirmed_license_idx
ON public_contact_observations (attributed_license_id)
WHERE attribution_class = 'CONFIRMED'
  AND is_agency_number = false
  AND attributed_license_id IS NOT NULL;
```

Idempotent (`IF NOT EXISTS`) with one caveat: if a prior `CONCURRENTLY` build of this same name
failed or was cancelled, Postgres leaves an **INVALID** index behind under that name, and
`IF NOT EXISTS` will then silently no-op forever (Postgres sees the name as taken). The pre-apply
check below detects this case explicitly.

## F. Pre-apply checklist

Run: `python -X utf8 scripts/apply_migration_016_concurrent.py --check` (read-only, safe anytime).

It checks:
1. `public_contact_observations` exists (`to_regclass`).
2. Current row count (informational — confirms scale before/after).
3. Whether an index of this name already exists (`pg_indexes`).
4. Whether that existing index (if any) is **invalid** (`pg_index.indisvalid`) — a leftover from a
   prior failed/cancelled concurrent build. If so: **stop**, do not run `--apply` — first run
   `DROP INDEX CONCURRENTLY IF EXISTS public_contact_observations_confirmed_license_idx;` (also
   non-transactional; run it the same way, via a one-off autocommit connection) and re-check.
5. Connected database/server/user identity — confirm this is genuinely the intended target before
   ever proceeding to `--apply`.
6. Any transaction open longer than 2 minutes (`pg_stat_activity`) — not a blocker by itself, but a
   concurrent build's validation pass will wait on these; flagged for awareness, especially during
   the current incident.

The script does **not** check the incident dashboard for you. Confirm with the incident owner that
a low-impact concurrent build (no table lock, never blocks reads or writes) is acceptable right now
before using `--apply`.

## G. Post-apply verification package (read-only)

Run: `python -X utf8 scripts/apply_migration_016_concurrent.py --verify`

It checks:
1. The index exists and `pg_index.indisvalid = true`.
2. Its `pg_indexes` definition matches the intended predicate exactly.
3. `EXPLAIN ANALYZE` on the real Trust Report contact query for a contact-bearing contractor
   (`cgc061782-jemko-developmant-corp`) and a zero-contact contractor
   (`mn-qb115394-james-t-otterkill`) — the same two fixed fixtures used throughout EA-CT-001 QA.

**Acceptance**: no `Seq Scan` on `public_contact_observations` in either plan; the plan uses
`public_contact_observations_confirmed_license_idx`; returned rows are unchanged from the pre-index
behavior (2 rows for JEMKO, 0 for the zero-contact contractor); execution time materially below the
~16ms full-scan baseline measured in EA-CT-001's QA amendment.

## H. Rollback

```sql
DROP INDEX CONCURRENTLY IF EXISTS public_contact_observations_confirmed_license_idx;
```

Also non-transactional; run it via a one-off autocommit connection (the same shape `--apply` uses),
never through the standard transactional apply pattern.

- **When appropriate**: the index is materially slowing writes/vacuum on
  `public_contact_observations` in a way that wasn't anticipated, or a build attempt failed/was
  cancelled and left an invalid index that needs clearing before retrying.
- **How to verify rollback**: re-run `--check` — `index_already_exists_per_pg_indexes` should report
  `False`.
- **Effect on PR #88 if the index is absent**: none to correctness. `getContractorBySlug`'s new
  query has no dependency on this index existing — it is a pure query-planner optimization. Without
  it, the query returns to the full sequential scan (~16ms today, growing with table size); every
  identity/privacy/dedup guarantee in EA-CT-001 is unchanged either way. This index is performance
  hardening, never identity logic.

## I. Operational caveats

- The existing apply-script convention's `SET statement_timeout = '60s'` is deliberately **not**
  reused here — a legitimate concurrent index build can validly take longer than 60s as the table
  grows, and a timeout mid-build would abort it and leave an invalid index behind (see F.4/H). No
  statement timeout is set by `--apply`; rely on the pre-apply checks and manual monitoring instead.
- `CREATE INDEX CONCURRENTLY` never takes a lock that blocks normal reads or writes on the table (it
  does take a brief lock at the very start and end), so it is safe to run during periods of live
  traffic. It does add extra I/O/CPU load while building, which is the specific reason to coordinate
  with the current session/IO-pressure incident owner before running `--apply`.
- Table size today (16,009 rows) makes this a fast build regardless; the safety machinery above is
  sized for the incident-timing concern, not because this specific build is expected to be slow.
