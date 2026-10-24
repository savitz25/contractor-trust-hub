# CON-SITEMAP-001A Production index draft

Status: documentation draft for Founder review. No DDL has been executed.

Production diagnosis used catalog reads and plain `EXPLAIN (FORMAT JSON)` only, with FL parameters `home_state = 'FL'` and source array `['fl_dbpr']`. No `EXPLAIN ANALYZE`, data writes, or schema changes were run.

## Cause

`getSitemapShardPlan()` checks whether child 1 exists by calling `listSearchableContractorSlugs` with `LIMIT 1 OFFSET 40000`. The current query skips eligible rows in order and materializes the FL license match set for its `home_state = 'FL' OR EXISTS (...)` predicate. Production's plan uses `contractors_slug_key`, an incremental sort on `(slug, id)`, and a hashed license subplan scanning `licenses_occupation_source_idx`.

The planner estimates about 147,070 FL license rows for the subplan and 756,401 matching contractors. The `LIMIT 1 OFFSET 40000` plan has startup cost 204,271; it rises to 408,537 at offset 80,000 and 612,802 at offset 120,000. A 40,000 row page has estimated total cost 204,271 at offset 0, 408,537 at offset 40,000, and 612,802 at offset 80,000. The sitemap's 1,500 ms probe timeout turns the initial later-page probe into a 503.

Splitting the `OR` into disjoint branches was also explained. That plan uses broad contractor scans, a bitmap scan of licenses, and a final sort (estimated startup cost 212,797 for the first 40,000 rows), so a code-only rewrite is not supported by the current indexes.

Statistics were last analyzed on 2026-09-21 for contractors and 2026-09-22 for licenses. They are about a month old, but the plan has a clear access-path problem; stale statistics alone do not explain the selected unordered/heap-heavy path. Plain EXPLAIN did not establish whether runtime sort spilling occurs.

## Proposed DDL (not executed)

The contractor index preserves all qualifying routes: it must not restrict `home_state` in its partial predicate because a contractor whose home state is not FL can still qualify through an FL DBPR license. The license index supports the current source filter and supplies `contractor_id` for the hashed membership set.

```sql
CREATE INDEX CONCURRENTLY contractors_sitemap_order_idx
    ON public.contractors USING btree (slug, id)
    INCLUDE (updated_at, home_state)
    WHERE is_thin_profile = FALSE
      AND slug IS NOT NULL
      AND slug <> '';

CREATE INDEX CONCURRENTLY licenses_sitemap_source_contractor_idx
    ON public.licenses USING btree (source_system, contractor_id);
```

The partial predicate above must remain exactly as written. Do not add `home_state = 'FL'`.

## Required future execution sequence

These are instructions for a future separately authorized operation. This PR authorizes no database changes.

1. Connect directly to the Production database, never through the session pooler. Run each `CREATE INDEX CONCURRENTLY` as one statement at a time, outside any `BEGIN`/`COMMIT` transaction block, and never through an automatic migration runner.
2. After creating `contractors_sitemap_order_idx`, verify `pg_index.indisvalid`, `indisready`, and `indislive` are all true for that index.
3. Create `licenses_sitemap_source_contractor_idx`, then verify the same three flags for it.
4. Run `ANALYZE public.contractors;` and `ANALYZE public.licenses;`.
5. Run plain `EXPLAIN (FORMAT JSON)` for `LIMIT 1` at offsets 0, 40000, 80000, and 120000. Do not run `EXPLAIN ANALYZE` without a separate safety review.
6. If plans are acceptable, perform the bounded live sitemap smoke.

### Invalid concurrent-build recovery

If a concurrent build fails and leaves an invalid index, run `DROP INDEX CONCURRENTLY IF EXISTS public.<only-the-failed-index>;` outside a transaction. Drop only the index whose build failed. Never drop an index that completed successfully or any pre-ticket index.

## Expected plan change

- Contractors: ordered partial index scan; `(slug, id)` satisfies the requested order; `home_state` and `updated_at` are available from index payload; heap access should be reduced.
- Licenses: `source_system` filter is served by `licenses_sitemap_source_contractor_idx`, and `contractor_id` is available from the index. An index-only membership scan is expected where visibility permits.
- OFFSET remains linear. Keyset pagination remains backlog unless the post-index offset 80000 or 120000 probes still exceed the 1,500 ms probe budget.

These are expected improvements and must be confirmed with the post-index plans.

No eligibility predicate, ordering, publication rule, deduplication behavior, shard boundary, manifest behavior, or failure response changes are proposed.

## Estimated build scope

- Contractors: approximately 1.39 million catalog rows; current `is_thin_profile = false` frequency is 90.7%, and slug has zero estimated null fraction. Expect about 1.26 million partial-index entries before excluding empty slugs. Existing `contractors_slug_key` is 120 MB; the additional `id`, `updated_at`, and `home_state` payload make the proposed index larger. Rough planning estimate: 140-170 MB.
- Licenses: approximately 1.27 million catalog rows. Existing `licenses_contractor_idx` is 51 MB. Adding the source key is expected to be similar in scale; rough planning estimate: 55-75 MB.
- Combined steady-state storage estimate: about 195-245 MB, plus transient concurrent-build space and I/O. Confirm current free database storage and actual build impact before execution.

## Existing baseline test failure

B1 independently found that `test_migration_008_is_immutable` fails identically on current main. PR #165 does not modify migration 008. Record this as `BASELINE_FAILURE = NON-BLOCKING` for this ticket. Do not edit migration 008 here.

## Founder GO required

Authorize only the two exact `CREATE INDEX CONCURRENTLY` statements above and the required post-build verification sequence. No database changes are authorized by this draft PR. After a separate Founder GO and successful index builds, verify both index flags, run ANALYZE, inspect the four plain EXPLAIN probes, and then perform bounded live sitemap verification.

This proposal remains documentation only and must stay outside `schema/migrations` and any automatic migration runner.
