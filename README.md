# Contractor Trust Hub

**Before you hire, verify.**

Independent, evidence-backed contractor verification for homeowners and commercial buyers. Phase 0 establishes the data foundation: state license extracts, entity linkage, discipline, and a transparent trust-score schema.

| | |
|---|---|
| **Status** | Phase 0 — foundation + first FL DBPR adapter |
| **Repo** | https://github.com/savitz25/contractor-trust-hub |
| **Primary market (wave 1)** | Florida (DBPR Construction Industry Licensing Board) |
| **Tagline** | Before you hire, verify. |

## Product positioning

- Educational / research tooling — not a substitute for official licensing boards
- Every metric sourced (state board, Sunbiz, permits, discipline dockets)
- Prefer precision over thin profiles
- No invented licenses, NMLS-style guesses, or unverified “ratings”

## Repository layout

```
contractor-trust-hub/
├── app/                     # Next.js product shell (Vercel)
├── docs/
│   ├── DATA_SOURCES.md      # FL DBPR CSVs, Sunbiz, NJ DCA, permits
│   ├── PHASE_0.md
│   └── SCHEMA.md
├── schema/
│   └── initial_schema.sql
├── ingest/                  # Python offline adapters (not a Vercel Python app)
│   ├── requirements.txt
│   └── adapters/fl_dbpr.py
├── data/samples/
└── scripts/download_fl_dbpr.py
```

## Quick start (web)

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build (what Vercel runs)
```

Vercel must use the **Next.js** framework (see `vercel.json`). Python under `ingest/` is offline tooling only — there is no root `requirements.txt` so the Python runtime is not selected.

## Quick start (ingest)

```bash
pip install -r ingest/requirements.txt

# Optional: fetch the full official construction licensee extract (~47 MB)
python scripts/download_fl_dbpr.py

# Normalize sample (or full file) → data/staging/fl_dbpr/
python -m ingest.adapters.fl_dbpr --input data/samples/fl_dbpr_construction_licensees_sample.csv --has-header
# Full extract (no header row):
python -m ingest.adapters.fl_dbpr --input data/raw/fl_dbpr/CONSTRUCTIONLICENSE_1.csv
```

## Quick start (Postgres load)

```bash
# Requires DATABASE_URL or PG* env vars — see docs/LOAD_PATH.md
python scripts/load_fl_dbpr_to_postgres.py --init-schema --staging-dir data/staging/fl_dbpr
python scripts/verify_fl_dbpr_load.py
```

## Quick start (Sunbiz entities)

```bash
# Official public SFTP — see docs/SUNBIZ.md
python scripts/download_sunbiz.py --daily-latest
python -m ingest.adapters.fl_sunbiz \
  --input data/raw/sunbiz/daily \
  --glob '*c.txt' \
  --out-dir data/staging/fl_sunbiz
```

## Phase 0 goals

1. Document exact public data sources and field layouts
2. Define Postgres schema (contractors, licenses, entities, permits, discipline, trust scores)
3. Ship first concrete adapter: **Florida DBPR Construction**
4. Keep raw downloads out of git; commit samples + profiles only

See [docs/PHASE_0.md](docs/PHASE_0.md).

## License / disclaimer

Public records data remains property of the issuing government body. Contractor Trust Hub provides independent research tooling. Always verify current license status on the official board site before hiring.
