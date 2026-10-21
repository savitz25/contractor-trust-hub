# CON-SITEMAP-001A Production index draft

Status: draft for Founder review. This file is documentation only. No DDL has been executed.

Production diagnosis was performed against Supabase project `jhjztnisugdsuliriajp` with catalog reads and plain `EXPLAIN (FORMAT JSON)` only. It used the Production FL parameters (`home_state = 'FL'`, source array `['fl_dbpr']`). No `EXPLAIN ANALYZE`, data writes, or schema changes were run.

## Cause

`getSitemapShardPlan()` checks whether child 1 exists by calling `listSearchableContractorSlugs` with `LIMIT 1 OFFSET 40000`. The current query has to skip eligible rows in order and materializes the FL license match set for its `home_state = 'FL' OR EXISTS (...)` predicate. Production's plan uses `contractors_slug_key`, an incremental sort on `(slug, id)`, and a hashed license subplan scanning `licenses_occupation_source_idx`.

The planner estimates about 147,070 FL license rows for the subplan and 756,401 matching contractors. The `LIMIT 1 OFFSET 40000` plan has startup cost 204,271; it rises to 408,537 at offset 80,000 and 612,802 at offset 120,000. A 40,000 row page has estimated total cost 204,271 at offset 0, 408,537 at offset 40,000, and 612,802 at offset 80,000. The sitemap's 1,500 ms probe timeout therefore turns the initial later-page probe into a 503.

Splitting the `OR` into disjoint branches was also explained. That plan uses broad contractor scans, a bitmap scan of licenses, and a final sort (estimated startup cost 212,797 for the first 40,000 rows), so a code-only rewrite is not supported by the current indexes.

Statistics were last analyzed on 2026-09-21 for contractors and 2026-09-22 for licenses. They are about a month old, but the plan has a clear access-path problem; stale statistics alone do not explain the selected unordered/heap-heavy path. No sort spill is indicated by plain EXPLAIN, and plain EXPLAIN cannot establish whether runtime spilling occurs.

## Proposed DDL (not executed)

The contractors index contains only eligible, nonempty-slug profiles and carries the exact deterministic order plus the source timestamp. The licenses index supports the existing `source_system = ANY($2::text[])` source filter while providing `contractor_id` directly from the index for the hashed membership set.

```sql
CREATE INDEX CONCURRENTLY contractors_sitemap_order_idx
    ON public.contractors USING btree (slug, id)
    INCLUDE (updated_at)
    WHERE is_thin_profile = FALSE
      AND slug IS NOT NULL
      AND slug <> '';

CREATE INDEX CONCURRENTLY licenses_sitemap_source_contractor_idx
    ON public.licenses USING btree (source_system, contractor_id);
```

The rollback, if needed after an approved build, is:

```sql
DROP INDEX CONCURRENTLY IF EXISTS public.contractors_sitemap_order_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.licenses_sitemap_source_contractor_idx;
```

`CREATE/DROP INDEX CONCURRENTLY` must run outside an explicit transaction. This draft is not placed in the automatic migration directory and must not be applied by a migration runner as-is.

## Expected plan change

After the exact indexes exist, rerun plain `EXPLAIN (FORMAT JSON)` for the seven specified probes before running the focused tests or considering deployment. Expected path: ordered scan using `contractors_sitemap_order_idx` with the profile and slug validity predicates already enforced by the partial index, no `(slug, id)` sort, and an index-only scan of `licenses_sitemap_source_contractor_idx` for the FL source membership set. This should replace repeated heap-heavy candidate filtering and the existing source-only license index scan. OFFSET remains linear in the page number, but the ordered scan can skip index entries without sorting/materializing profile rows. These are expected improvements, not a substitute for measuring the post-index plans.

No eligibility predicate, ordering, publication rule, deduplication behavior, shard boundary, manifest behavior, or failure response changes are proposed.

## Estimated build scope

- Contractors: approximately 1.39 million catalog rows; current `is_thin_profile = false` frequency is 90.7%, and slug has zero estimated null fraction. Expect about 1.26 million partial-index entries before excluding empty slugs. Existing `contractors_slug_key` is 120 MB; the additional `id` and `updated_at` payload make the proposed index larger. Rough planning estimate: 140–170 MB.
- Licenses: approximately 1.27 million catalog rows. Existing `licenses_contractor_idx` is 51 MB. Adding the source key is expected to be similar in scale; rough planning estimate: 55–75 MB.
- Combined steady-state storage estimate: about 195–245 MB, plus transient concurrent-build space and I/O. Confirm current free database storage and actual build impact before execution.

## Founder GO required

Authorize only these two Production operations, both using `CONCURRENTLY`, after confirming the storage estimate:

1. Create `public.contractors_sitemap_order_idx` with the exact DDL above.
2. Create `public.licenses_sitemap_source_contractor_idx` with the exact DDL above.

No database changes are authorized by this draft PR. After a separate Founder GO and successful index builds, rerun the plain Production EXPLAIN probes and then verify sitemap routes. Keep query/publication code unchanged unless that evidence shows the indexes do not produce the expected bounded plan.
