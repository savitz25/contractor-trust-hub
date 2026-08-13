# Ingest layer

**Language decision (Phase 0):** Python 3.11+ for speed of CSV profiling, bulk transforms, and future pandas/SQL loads. The product UI may later be TypeScript; adapters stay Python unless there is a strong reason to dual-write.

## Adapter plan

| Priority | Adapter | Source | Output |
|----------|---------|--------|--------|
| 1 | `adapters/fl_dbpr.py` | FL DBPR construction licensees + discipline | `data/staging/fl_dbpr/` |
| 2 | `adapters/fl_sunbiz.py` | Sunbiz corporate fixed-width (SFTP) | `data/staging/fl_sunbiz/` |
| 3 | `adapters/tx_tdlr.py` | TX TDLR specialty licenses (Open Data) | `data/staging/tx_tdlr/` |
| 4 | `adapters/tx_tsbpe.py` | TX plumbing (TSBPE free CSV lists) | Phase 1 |
| 5 | `adapters/nj_dca.py` | NJ DCA / HIC registration (Stage 7 pilot) | `data/staging/nj_dca/` |
| 6 | Permits | County / city open data | Later |

**Texas note:** No statewide GC license. TDLR adapter filters to specialty contractor types only — see `docs/DATA_SOURCES_TX.md`.

## Conventions

1. **Read-only** against official downloads; never mutate source files
2. Every run writes a batch manifest (`batch_manifest.json`) with URL, file, SHA-256, row counts
3. Normalized outputs use stable snake_case columns aligned with `schema/initial_schema.sql`
4. Prefer **precision**: skip rows that cannot form a stable external key rather than inventing IDs
5. Keep full raw extracts under `data/raw/` (gitignored); commit samples only

## FL DBPR quick commands

```bash
# Download full licensee extract
python scripts/download_fl_dbpr.py

# Normalize sample (has header we added)
python -m ingest.adapters.fl_dbpr \
  --input data/samples/fl_dbpr_construction_licensees_sample.csv \
  --has-header \
  --out-dir data/staging/fl_dbpr

# Normalize full extract (no header)
python -m ingest.adapters.fl_dbpr \
  --input data/raw/fl_dbpr/CONSTRUCTIONLICENSE_1.csv \
  --out-dir data/staging/fl_dbpr

# Discipline FY file (headered)
python -m ingest.adapters.fl_dbpr discipline \
  --input data/raw/fl_dbpr/contractor_disc_lic_2425.csv \
  --out-dir data/staging/fl_dbpr

# Load into Postgres (requires DATABASE_URL) — see docs/LOAD_PATH.md
python scripts/load_fl_dbpr_to_postgres.py --init-schema --staging-dir data/staging/fl_dbpr
python scripts/verify_fl_dbpr_load.py

# Sunbiz (official SFTP) — see docs/SUNBIZ.md
python scripts/download_sunbiz.py --daily-latest
python -m ingest.adapters.fl_sunbiz \
  --input data/raw/sunbiz/daily \
  --glob '*c.txt' \
  --out-dir data/staging/fl_sunbiz

# Texas TDLR specialty contractors (Open Data SODA) — see docs/DATA_SOURCES_TX.md
# and docs/TEXAS_VERIFY_V1.md
python scripts/download_tx_tdlr.py
python scripts/download_tx_tdlr.py --limit 2000   # sample / CI-friendly
python -m ingest.adapters.tx_tdlr \
  --input data/raw/tx_tdlr/tdlr_licenses_specialty.csv \
  --out-dir data/staging/tx_tdlr

# Load into Postgres (idempotent upserts + ingest_batches)
python scripts/load_tx_tdlr_to_postgres.py --staging-dir data/staging/tx_tdlr

# New Jersey Verify pilot (Stage 7)
python -m ingest.adapters.nj_dca \
  --input data/samples/nj_dca_hic_sample.csv \
  --out-dir data/staging/nj_dca
python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca
```

## Staging files produced

| File | Maps to |
|------|---------|
| `licenses_normalized.csv` | `licenses` (real board credentials only) |
| `contractors_seed.csv` | `contractors` (1:1 seed from licensed rows) |
| `qualifying_businesses_normalized.csv` | future `entities` / linkage (QB rows; no license #) |
| `discipline_normalized.csv` | `discipline_actions` |
| `batch_manifest.json` | `ingest_batches` |
