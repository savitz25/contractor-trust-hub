# NJ-CON-003 production runbook

Authorized DATABASE_URL session only. Do not print secrets. Do not enable
`CONTRACTOR_ENABLE_NJ_STATE_UI`. Do not publish `/new-jersey`.

## Capacity (order-of-magnitude)

| Item | Estimate |
| --- | --- |
| Raw CSV | 730 MB |
| Staging (TEMP, 2.68M rows) | ~1–2 GB |
| `permit_source_records` + jsonb payload | ~4–8 GB |
| Unique index on source_record_key | ~0.3–0.6 GB |
| WAL for first load | similar order to table write |
| Duration class | tens of minutes for COPY + set-based upsert, not hours of per-row ORM inserts |
| Timeout risk | COPY and upsert must run with statement_timeout raised (30–60 min) |
| Lock risk | upsert touches only `source_system = nj_dca_construction_permits` |

If the target cannot store ~10 GB plus WAL, **stop**. Do not load a reduced extract.

## Commands

```bash
python scripts/apply_migration_013.py
python scripts/apply_migration_014.py
python scripts/apply_migration_015.py
python scripts/nj_con_001_ingest.py --execute
python scripts/nj_con_001_ingest.py --execute
python scripts/nj_con_002a_ingest.py --execute
python scripts/nj_con_002a_ingest.py --execute
# Permit load: COPY path in docs/sql/nj-con-003-production-execution.sql
# Then second COPY/upsert for idempotency (first_seen_at preserved, last_seen_at refreshed)
```

Validate source hash `abc0df7f4d25691f82ca80b14358fd10f94cd8841433edd935f4191e06e46c4e`
and row count 2,678,341 before COPY.

Confirm:

- Zero `CONFIRMED` permit attributions for this source
- OCP remains PARTIAL_SOURCE_COVERAGE
- Unacquired families have no zero observations
- NJ DCA `licenses` count is not increased by permit ingest
- First snapshot is baseline-only (no historical alerts)

Identity matching for NJ-CON-001 / 002A uses the full address-level license
graph. Name-plus-city stays review-required.
