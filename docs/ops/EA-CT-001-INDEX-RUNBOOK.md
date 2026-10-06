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

It checks, and **fails closed** (non-zero exit, `--apply` refuses to proceed) rather than treating
an ambiguous state as a safe no-op:
1. `public_contact_observations` exists (`to_regclass('public.public_contact_observations')`).
2. Current row count (informational — confirms scale before/after).
3. Whether an object named `public_contact_observations_confirmed_license_idx` already exists,
   inspected via `pg_class`/`pg_namespace`/`pg_index`/`pg_attribute` (never the display-formatted
   `indexdef` string, for the structural facts). If it exists, it must **exactly** match all of:
   - index schema **and** table schema are both `public` (an identically-named object in another
     schema never satisfies this);
   - the indexed table is `public_contact_observations`;
   - the indexed column is exactly `attributed_license_id` (and only that column);
   - the partial predicate, read via `pg_get_expr(indpred, indrelid)`, semantically covers
     `attribution_class = 'CONFIRMED'`, a non-agency exclusion (Postgres may canonicalize
     `is_agency_number = false` as `NOT is_agency_number` — both forms are accepted), and
     `attributed_license_id IS NOT NULL`;
   - `indisvalid` **and** `indisready` are both true.

   Any existing object failing **any** one of these is a **BLOCKER** — `--check`/`--apply` fail
   closed, never falling back to "close enough" or a silent no-op. Only when every condition holds
   is it treated as an already-satisfied, safe no-op.
4. If a same-named object exists but is invalid/not-ready or otherwise mismatched (e.g. a prior
   failed/cancelled concurrent build): **stop**, do not run `--apply` — investigate the mismatch,
   and only drop it (`DROP INDEX CONCURRENTLY IF EXISTS ...`, non-transactional, same one-off
   autocommit shape as `--apply`) once you've confirmed it is safe to rebuild, then re-check.
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

`--verify` prints a hard PASS/FAIL line for every check below and **exits non-zero if any single one
fails** — nothing here is merely informational:
1. The index exists.
2. It exactly matches intent (same schema/table/column/predicate check as `--check`, item F.3).
3. `indisvalid` is true.
4. `indisready` is true.
5. For **both** fixtures (contact-bearing `cgc061782-jemko-developmant-corp`, zero-contact
   `mn-qb115394-james-t-otterkill`) — the same two fixed fixtures used throughout EA-CT-001 QA:
   - the contractor slug resolves;
   - the **actual contact query is executed** (not just `EXPLAIN`'d) and its **returned row count**
     matches the count established during EA-CT-001 QA exactly (JEMKO: 2, zero-contact: 0) — proving
     data-result stability, not only plan shape;
   - a separate, read-only `EXPLAIN (ANALYZE, FORMAT TEXT)` of the identical query shows **no**
     `Seq Scan on public_contact_observations` and **does** reference the new index by name;
   - execution time is parsed from the plan and printed for comparison to the ~16ms pre-index
     baseline — **informational only, never a fixed-millisecond pass/fail cutoff** (runtime noise
     varies); the plan shape (no Seq Scan, index present) is the hard gate;
   - any exception raised while running the query itself is caught and reported as a FAIL for that
     fixture, never allowed to crash the script uncaught.

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

- **`lock_timeout` vs. `statement_timeout` — deliberately different from the existing apply-script
  convention.** `--apply` sets `SET lock_timeout = '5s'` immediately before `CREATE INDEX
  CONCURRENTLY` (the existing apply scripts set both `lock_timeout='5s'` AND
  `statement_timeout='60s'`). This script sets **only** `lock_timeout`:
  - `lock_timeout='5s'` makes the build fail fast (a clean, immediate error) if it cannot acquire
    its brief initial lock right away — e.g. because something else is mid-DDL on the same table —
    rather than queuing silently behind an incompatible lock indefinitely.
  - `statement_timeout` is **never set** for `--apply`. Once the initial lock is acquired, a
    legitimate concurrent build can validly run far longer than 60s as the table grows, and a
    timeout mid-build would forcibly abort it, leaving an **invalid** index behind (the same failure
    mode as an operator-cancelled build — see F.3/F.4/H). Killing the build on elapsed time alone,
    rather than on genuine lock contention, is exactly the failure mode this split avoids.
  - Net effect: the build either starts within ~5s or fails cleanly with no side effect; once
    started, it is never killed merely for taking a while.
- `CREATE INDEX CONCURRENTLY` never takes a lock that blocks normal reads or writes on the table (it
  does take a brief lock at the very start and end), so it is safe to run during periods of live
  traffic. It does add extra I/O/CPU load while building, which is the specific reason to coordinate
  with the current session/IO-pressure incident owner before running `--apply`.
- Table size today (16,009 rows) makes this a fast build regardless; the safety machinery above is
  sized for the incident-timing concern, not because this specific build is expected to be slow.
