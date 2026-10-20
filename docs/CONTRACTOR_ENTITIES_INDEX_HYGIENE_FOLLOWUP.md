# CONTRACTOR_ENTITIES_INDEX_HYGIENE_FOLLOWUP

Documentation only. No index was dropped, disabled, rebuilt, or created.

Observed read-only on Supabase project `jhjztnisugdsuliriajp` on 2026-10-20. `pg_stat_database.stats_reset` was `2026-07-24 08:28:18 UTC`. That is the start of the observation window. A zero `idx_scan` means no scan was recorded after that reset, not that the index was never useful before it.

## Indexes left untouched

| Index | Definition | Size | idx_scan |
| --- | --- | --- | --- |
| `entities_legal_name_idx` | `CREATE INDEX entities_legal_name_idx ON public.entities USING btree (legal_name)` | 369 MB | 0 |
| `entities_name_normalized_idx` | `CREATE INDEX entities_name_normalized_idx ON public.entities USING btree (name_normalized)` | 354 MB | 0 |
| `entities_fei_idx` | `CREATE INDEX entities_fei_idx ON public.entities USING btree (fei_number)` | 164 MB | 0 |
| `entities_postal_idx` | `CREATE INDEX entities_postal_idx ON public.entities USING btree (postal_code)` | 62 MB | 0 |

These are not unique and do not back a primary key or foreign key. Dropping one would not remove a constraint. `entities_source_name_idx` on `(source_system, name_normalized)` is separate, is in use (`idx_scan` 26,776), and is not part of this follow-up.

## Code and rare-job use

The request path does not name these four indexes.

`scripts/audit_fl_ula_ingestion_plan.py` filters `entities.name_normalized` without `source_system`. That predicate can use `entities_name_normalized_idx`. It has not been recorded since the stats reset. Do not treat a zero scan as proof the audit will stay unused.

`fei_number` is parsed by the Sunbiz ingest adapter. `postal_code` and `legal_name` are written by ingest. No current request query was found that filters `entities.fei_number`, `entities.postal_code`, or `entities.legal_name` alone.

## Minimum window before any drop

Keep the stats window open at least through one full Sunbiz quarterly load and one planned run of `scripts/audit_fl_ula_ingestion_plan.py`. Re-read `idx_scan` after that. A drop also needs a separate Founder authorization. This ticket does not authorize it.

## Rollback DDL, not to be run here

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS entities_legal_name_idx ON public.entities USING btree (legal_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS entities_name_normalized_idx ON public.entities USING btree (name_normalized);
CREATE INDEX CONCURRENTLY IF NOT EXISTS entities_fei_idx ON public.entities USING btree (fei_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS entities_postal_idx ON public.entities USING btree (postal_code);
```

Rebuilding any one of these on the about 7.2 GB `entities` relation is a concurrent index build: it takes a long lock-light write window, uses temporary disk, and can fail if ingest is writing the same table. The reverse, if a future ticket drops one, is:

```sql
DROP INDEX CONCURRENTLY IF EXISTS entities_legal_name_idx;
DROP INDEX CONCURRENTLY IF EXISTS entities_name_normalized_idx;
DROP INDEX CONCURRENTLY IF EXISTS entities_fei_idx;
DROP INDEX CONCURRENTLY IF EXISTS entities_postal_idx;
```

Do not run either block without a separate authorization and a fresh `idx_scan` reading.
