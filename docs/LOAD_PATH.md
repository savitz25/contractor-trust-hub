# Florida DBPR → Postgres load path

Phase 1 step: load **already-staged** adapter CSVs into Postgres so licenses, QB shells, and discipline can be queried and joined.

## Prerequisites

1. PostgreSQL 15+
2. Python 3.11+
3. Staged adapter outputs (see [ingest/README.md](../ingest/README.md))

```bash
pip install -r ingest/requirements.txt
# or: pip install 'psycopg[binary]>=3.1'
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Recommended | Full Postgres URL (`postgresql://user:pass@host:5432/dbname`) |
| `POSTGRES_URL` | Alt | Same as `DATABASE_URL` |
| `PGHOST` | Alt | Default `localhost` |
| `PGPORT` | Alt | Default `5432` |
| `PGDATABASE` | Alt | Default `contractor_trust_hub` |
| `PGUSER` | Alt | Default `postgres` |
| `PGPASSWORD` | Alt | Password |

Load order: process env → `.env.local` → `.env` (see `ingest/env.py`).

**Supabase:** use the **URI** from Project Settings → Database. Prefer **direct** or **session** pooler (not transaction `:6543`). Details: [SUPABASE.md](SUPABASE.md).

The loader uses **psycopg v3** (`psycopg[binary]`).

## Stage data first (if needed)

Sample (committed):

```bash
python -m ingest.adapters.fl_dbpr \
  --input data/samples/fl_dbpr_construction_licensees_sample.csv \
  --has-header \
  --out-dir data/staging/fl_dbpr
```

Full extract (local only; raw file gitignored):

```bash
python scripts/download_fl_dbpr.py
python -m ingest.adapters.fl_dbpr \
  --input data/raw/fl_dbpr/CONSTRUCTIONLICENSE_1.csv \
  --out-dir data/staging/fl_dbpr_full
python -m ingest.adapters.fl_dbpr discipline \
  --input data/raw/fl_dbpr/contractor_disc_lic_2425.csv \
  --out-dir data/staging/fl_dbpr_full
# also copy or re-run discipline into the same out-dir used for licenses
```

Expected staging files:

| File | Maps to |
|------|---------|
| `licenses_normalized.csv` | `licenses` + `contractors` |
| `qualifying_businesses_normalized.csv` | `entities` + thin `contractors` |
| `discipline_normalized.csv` | `discipline_actions` |
| `batch_manifest.json` | provenance metadata |

## Apply schema + load

```bash
# Create tables (idempotent CREATE IF NOT EXISTS)
python scripts/load_fl_dbpr_to_postgres.py --init-schema \
  --staging-dir data/staging/fl_dbpr

# Re-run anytime (upserts — safe)
python scripts/load_fl_dbpr_to_postgres.py \
  --staging-dir data/staging/fl_dbpr

# Full production staging
python scripts/load_fl_dbpr_to_postgres.py --init-schema \
  --staging-dir data/staging/fl_dbpr_full
```

Useful flags:

| Flag | Purpose |
|------|---------|
| `--init-schema` | Apply `schema/initial_schema.sql` |
| `--skip-licenses` / `--skip-qb` / `--skip-discipline` | Partial loads |
| `--limit N` | Cap rows per dataset (smoke tests) |
| `--batch-size N` | Commit every N rows (default 1000) |
| `-v` | Debug logging |

## Expected row counts

| Dataset | Sample staging | Full extract (approx.) |
|---------|----------------|-------------------------|
| Licenses (credentials) | ~2,000 | **~143,516** |
| QB entities | 0 in small sample* | **~126,666** |
| Discipline FY 24/25 | ~1,541 | ~1,541 |
| Contractors | ≈ licenses (+ thin QB) | ≈ 143k + thin QB shells |

\* The committed sample is mostly early CBC rows; QB rows appear later in the full file. Use `data/staging/fl_dbpr_full` for complete QB coverage.

**Rules enforced by the loader:**

- Upsert licenses on `(source_system, external_key)` — e.g. `CBC006231`
- One **contractor shell per strong license** (slug derived from external key + name) — high confidence, no fuzzy name merges
- QB shells get **no invented license numbers**; stored as `entities.entity_type = qualifying_business` with optional thin contractor (`is_thin_profile = true`)
- Every load creates an `ingest_batches` row; licenses/entities/discipline get `last_verified_at` and `ingest_batch_id`
- Discipline links to licenses only when `license_number_raw` matches a known license number (high confidence); many board rows will remain unlinked until a better key map exists

## Verify

```bash
python scripts/verify_fl_dbpr_load.py
# or
psql "$DATABASE_URL" -f scripts/verify_fl_dbpr_load.sql
```

Checks include:

- Totals for contractors / licenses / entities / discipline
- Licenses by `status_normalized`
- Top FL counties
- Sample active contractors
- Discipline linkage rate

The loader also prints a short DB summary and writes `load_summary.json` under the staging directory when writable.

## Idempotency

Re-running the same staging directory:

- Updates existing licenses/entities/discipline rows
- Refreshes `last_verified_at` / `last_seen_at`
- Creates a **new** `ingest_batches` row each run (audit trail)

## Extending for Sunbiz

Keep entity rows keyed by `(source_system, external_key)`. Future `fl_sunbiz` loads should insert into `entities` with `source_system = 'fl_sunbiz'` and link via `contractor_entities` with an explicit `confidence` and `evidence` JSON — never overwrite DBPR QB keys.

---

# Texas TDLR specialty → Postgres load path

Texas Verify v1 loads **TDLR specialty contractor** licenses only. There is **no** statewide general contractor license in Texas — do not treat this load as a full TX contractor directory.

See [TEXAS_VERIFY_V1.md](./TEXAS_VERIFY_V1.md) and [DATA_SOURCES_TX.md](./DATA_SOURCES_TX.md).

## Stage data first

```bash
python scripts/download_tx_tdlr.py
python -m ingest.adapters.tx_tdlr \
  --input data/raw/tx_tdlr/tdlr_licenses_specialty.csv \
  --out-dir data/staging/tx_tdlr
```

Sample (committed):

```bash
python -m ingest.adapters.tx_tdlr \
  --input data/samples/tx_tdlr_specialty_sample.csv \
  --out-dir data/staging/tx_tdlr_sample
```

Expected staging files:

| File | Maps to |
|------|---------|
| `licenses_normalized.csv` | `licenses` + `contractors` (`source_system = tx_tdlr`) |
| `contractors_seed.csv` | reference seed (loader uses licenses CSV) |
| `batch_manifest.json` | provenance metadata |

## Load

```bash
# Idempotent upserts (safe to re-run)
python scripts/load_tx_tdlr_to_postgres.py \
  --staging-dir data/staging/tx_tdlr

# First-time / empty local DB
python scripts/load_tx_tdlr_to_postgres.py --init-schema \
  --staging-dir data/staging/tx_tdlr

# Smoke test
python scripts/load_tx_tdlr_to_postgres.py \
  --staging-dir data/staging/tx_tdlr --limit 500
```

**Rules:**

- Upsert licenses on `(source_system, external_key)` — e.g. `TX-TDLR:A-C-CONTRACTOR:10001:BE`
- One contractor shell per license slug (`external_key` + display name)
- `home_state` / license `state` = `TX`
- Every load creates an `ingest_batches` row (`source_system = tx_tdlr`)
- No QB / Sunbiz / discipline in this path

Useful flags: `--limit N`, `--batch-size N`, `--init-schema`, `-v` (same spirit as FL loader).

## Product surface after load

- `/verify?state=tx` — specialty search  
- Florida remains `/verify` default  

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Missing staging CSV | Run download + `tx_tdlr` adapter |
| Empty Texas search | Confirm load finished; check `SELECT COUNT(*) FROM licenses WHERE source_system = 'tx_tdlr'` |
| Cosmetology / wrong trades | Re-download without `--all-types`; use default specialty filter |

---

## Troubleshooting (Florida / shared)

| Symptom | Fix |
|---------|-----|
| `psycopg` import error | `pip install 'psycopg[binary]>=3.1'` |
| Connection refused | Start Postgres; check `DATABASE_URL` |
| Missing CSV | Run the adapter first |
| Schema column errors on old DB | Re-apply `--init-schema` or migrate: add `last_verified_at`, `discipline_actions.external_key` |
