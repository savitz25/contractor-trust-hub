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

- `/verify?state=tx` — TDLR specialty + TSBPE plumbing search  
- Florida remains `/verify` default  

---

# Texas TSBPE plumbing → Postgres load path

Official daily CSVs from [TSBPE free licensee list](https://tsbpe.texas.gov/free-licensee-list/). Default set: Responsible Master Plumber + Master Plumber.

```bash
python scripts/download_tx_tsbpe.py
python -m ingest.adapters.tx_tsbpe --raw-dir data/raw/tx_tsbpe --out-dir data/staging/tx_tsbpe
python scripts/load_tx_tsbpe_to_postgres.py --staging-dir data/staging/tx_tsbpe
```

Sample (committed):

```bash
python -m ingest.adapters.tx_tsbpe \
  --input data/samples/tx_tsbpe_rmp_sample.csv --kind rmp \
  --out-dir data/staging/tx_tsbpe_sample
```

Keys: `TX-TSBPE:RMP:{n}` / `TX-TSBPE:MP:{n}`. `source_system = tx_tsbpe`. Texas Verify searches `tx_tdlr` and `tx_tsbpe` together.

---

# Oregon CCB Active Licenses → Postgres

```bash
python scripts/download_or_ccb.py
python -m ingest.adapters.or_ccb --input data/raw/or_ccb/ccb_active_licenses.csv --out-dir data/staging/or_ccb
python scripts/load_or_ccb_to_postgres.py --staging-dir data/staging/or_ccb
```

Sample: `data/samples/or_ccb_active_sample.csv`. Keys: `OR-CCB:{number}:{type}`. `source_system = or_ccb`.

---

# Washington L&I contractor licenses → Postgres

```bash
python scripts/download_wa_lni.py
python -m ingest.adapters.wa_lni --input data/raw/wa_lni/lni_contractor_licenses.csv --out-dir data/staging/wa_lni
python scripts/load_wa_lni_to_postgres.py --staging-dir data/staging/wa_lni
```

Sample: `data/samples/wa_lni_contractor_sample.csv`. Keys: `WA-LNI:{ContractorLicenseNumber}`. `source_system = wa_lni`.

**Production (2026-08-13):** 160,998 licenses loaded (0 skipped). Active 75,483 · Expired 61,333 · Suspended 9,820 · Re-licensed 9,405 · Out of business 4,708 · other published statuses 249. Types: CC 148,648 · EC 9,199 · PC 3,029 · LC 122. See [WASHINGTON_VERIFY_V1.md](./WASHINGTON_VERIFY_V1.md).

---

# Arizona ROC current contractors → Postgres

```bash
python scripts/download_az_roc.py
python -m ingest.adapters.az_roc --input data/raw/az_roc/roc_all_current.csv --out-dir data/staging/az_roc
python scripts/load_az_roc_to_postgres.py --staging-dir data/staging/az_roc
```

Sample: `data/samples/az_roc_current_sample.csv`. Keys: `AZ-ROC:{License No}`. `source_system = az_roc`. Use the All Current file only — do not union Commercial/Residential/Dual subsets.

**Production (2026-08-13):** 58,408 `az_roc` licenses (58,199 Active · 142 Revoked · 67 Suspended). See [ARIZONA_VERIFY_V1.md](./ARIZONA_VERIFY_V1.md).

---

# Louisiana LSLBC official public roster → Postgres

```bash
python scripts/download_la_lslbc.py
python -m ingest.adapters.la_lslbc --input data/raw/la_lslbc/lslbc_contractor_roster.csv --out-dir data/staging/la_lslbc
python scripts/load_la_lslbc_to_postgres.py --staging-dir data/staging/la_lslbc
```

Sample: `data/samples/la_lslbc_contractor_sample.csv`. Keys: `LA-LSLBC:{LicenseNumber}`. `source_system = la_lslbc`. Official Request Roster is Active only.

**Production (2026-08-14):** 26,298 `la_lslbc` licenses (all Active). Commercial 19,993 · Residential 4,579 · Home improvement 1,462 · Mold 264. See [LOUISIANA_VERIFY_V1.md](./LOUISIANA_VERIFY_V1.md).

---

# Mississippi MSBOC official public list → Postgres

```bash
python scripts/download_ms_sbc.py
python -m ingest.adapters.ms_sbc --input data/raw/ms_sbc/msboc_contractor_list.csv --out-dir data/staging/ms_sbc
python scripts/load_ms_sbc_to_postgres.py --staging-dir data/staging/ms_sbc
```

If Cloudflare blocks the download, save the official “View Results In Excel” file and run:

```bash
python scripts/download_ms_sbc.py --from-file path/to/official_export.xls
```

Sample: `data/samples/ms_sbc_contractor_sample.csv`. Keys: `MS-SBC:{COM|RES}:{LicenseNumber}`. `source_system = ms_sbc`. Official list view includes commercial / residential type, status, and location.

**Production (2026-08-14):** official Excel `data/raw/msboc/msboc_results.xls` → **8,242** licenses. Licensed 3,425 · Expired 4,544 · Unlicensed 257 · Revoked 14 · Suspended 2. See [MISSISSIPPI_VERIFY_V1.md](./MISSISSIPPI_VERIFY_V1.md). The board search also advertises ~38,709 rows; this load is the saved official Excel, not every search page.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Missing staging CSV | Run download + `tx_tdlr` adapter |
| Empty Texas search | Confirm load finished; check `SELECT COUNT(*) FROM licenses WHERE source_system = 'tx_tdlr'` |
| Empty Washington search | Confirm load finished; check `SELECT COUNT(*) FROM licenses WHERE source_system = 'wa_lni'` |
| Empty Arizona search | Confirm load finished; check `SELECT COUNT(*) FROM licenses WHERE source_system = 'az_roc'` |
| Empty Louisiana search | Confirm load finished; check `SELECT COUNT(*) FROM licenses WHERE source_system = 'la_lslbc'` |
| Empty Mississippi search | Confirm load finished; check `SELECT COUNT(*) FROM licenses WHERE source_system = 'ms_sbc'`. If download hit Cloudflare, use `--from-file` with the official Excel. |
| Cosmetology / wrong trades | Re-download without `--all-types`; use default specialty filter |

---

---

# New Jersey DCA / HIC → Postgres load path

New Jersey Verify loads **Home Improvement Contractor (HIC)** registrations and **available specialty board** credentials from DCA bulk extracts. There is **no** single statewide general contractor license in New Jersey — do not treat this load as a full NJ contractor directory.

See [NEW_JERSEY_VERIFY_V1.md](./NEW_JERSEY_VERIFY_V1.md) and [DATA_SOURCES_NJ.md](./DATA_SOURCES_NJ.md).

## Stage data first

```bash
# Official bulk CSV already downloaded (Box Standard Files / MyLicense free lists)
python scripts/download_nj_dca.py --from-file path/to/dca_bulk.csv
python -m ingest.adapters.nj_dca \
  --input data/raw/nj_dca/registrations.csv \
  --out-dir data/staging/nj_dca
```

Sample (committed, no network):

```bash
python -m ingest.adapters.nj_dca \
  --input data/samples/nj_dca_hic_sample.csv \
  --out-dir data/staging/nj_dca_sample
```

Expected staging files:

| File | Maps to |
|------|---------|
| `licenses_normalized.csv` | `licenses` + `contractors` (`source_system = nj_dca`) |
| `contractor_seeds.csv` | reference seed (loader uses licenses + seeds) |
| `entities_normalized.csv` | `entities` (`source_system = nj_sos`) when high-confidence keys present |
| `enforcement_normalized.csv` | `discipline_actions` (`source_system = nj_enforcement`) — public discipline flags from Standard Files |
| `batch_manifest.json` | provenance metadata |

## Load

```bash
# Preferred when DATABASE_URL (Session pooler) is set locally
python scripts/load_nj_dca_to_postgres.py \
  --staging-dir data/staging/nj_dca

# Alternate: PostgREST service-role bulk upsert (when only SUPABASE_SERVICE_ROLE_KEY is available)
# python scripts/load_nj_dca_via_supabase_rest.py --staging-dir data/staging/nj_dca

# Smoke / sample
python scripts/load_nj_dca_to_postgres.py \
  --staging-dir data/staging/nj_dca_sample --limit 100
```

### Production load snapshot (Box Standard Files expanded, 2026-08-03)

| Code | Active | Non-active | Total |
|------|-------:|-----------:|------:|
| HIC | 25,111 | 0 | 25,111 |
| ELE | 13,091 | 19,213 | 32,304 |
| PLB | 4,903 | 6,552 | 11,455 |
| HVAC | 6,654 | 2,866 | 9,520 |
| ALM | 2,081 | 2,782 | 4,863 |
| TEL | 3,018 | 25 | 3,043 |
| LCK | 392 | 601 | 993 |
| HRT | 59 | 7 | 66 |
| **Total** | **55,309** | **32,046** | **87,355** |

HIC inactive/expired is not in Box facilities all-status (profession absent). Specialty boards include Expired/Inactive/Closed/etc. with raw `primary_status` for UI.

**Rules:**

- Upsert licenses on `(source_system, external_key)` — e.g. `NJ-HIC:HIC-13VH00012300`
- One contractor shell per license slug (`home_state = NJ`)
- Entity links only when stable `entity_key` present — **no name-only joins**
- Every load creates an `ingest_batches` row (`source_system = nj_dca`)
- Prefer official free bulk over scraping MyLicense interactive search

Useful flags: `--limit N`, `--staging-dir`, dry-run when `DATABASE_URL` is unset (prints plan).

## Product surface after load

- `/verify?state=nj` — HIC + specialty extract search + honest coverage banner  
- Florida remains `/verify` default; Texas remains `/verify?state=tx`  
- Feature flag: `NEXT_PUBLIC_NJ_VERIFY_PILOT` (default on)

## Troubleshooting (NJ)

| Symptom | Fix |
|---------|-----|
| Missing staging CSV | Place bulk via `download_nj_dca.py --from-file` + run `nj_dca` adapter |
| Empty NJ search | Confirm load; `SELECT COUNT(*) FROM licenses WHERE source_system = 'nj_dca'` |
| Header validation failed | Ensure CSV has registration/license # + business/owner name columns |
| Overclaiming GC coverage | Product must say HIC + specialty only — no statewide GC |

---

---

# California CSLB → Postgres load path

California Verify loads **CSLB public list extracts** for high-impact counties present under `data/raw/ca_contractors/`. Not every CA county is guaranteed in the download set — see [DATA_SOURCES_CA.md](./DATA_SOURCES_CA.md).

```bash
python -m ingest.adapters.ca_cslb \
  --input-dir data/raw/ca_contractors \
  --out-dir data/staging/ca_cslb

python scripts/load_ca_cslb_to_postgres.py --staging-dir data/staging/ca_cslb
# or:
python scripts/load_ca_cslb_via_supabase_rest.py --staging-dir data/staging/ca_cslb
```

**Rules:** upsert on `(source_system, external_key)` with `CA-CSLB:{license}`; `home_state = CA`; multi-class in `class_code`; bond/WC in `secondary_status` + raw payload.

### Production snapshot (2026-08-13)

| Metric | Value |
|--------|------:|
| Unique licenses | **43,779** CLEAR |
| Counties | 39 (includes Riverside + coverage batches) |
| Product | `/verify?state=ca` |

## Arizona (ROC)

```bash
# Prefer browser download if Cloudflare blocks automation:
# https://roc.az.gov/posting-list → All Current Contractors → data/raw/az_roc/

python scripts/download_az_roc.py
python -m ingest.adapters.az_roc --input-dir data/raw/az_roc --out-dir data/staging/az_roc
python scripts/load_az_roc_to_postgres.py --staging-dir data/staging/az_roc
# or:
python scripts/load_az_roc_via_supabase_rest.py --staging-dir data/staging/az_roc
```

**Rules:** upsert on `(source_system, external_key)` with `AZ-ROC:{license}`; `home_state = AZ`; class type/category in `secondary_status` + raw payload.

### Production snapshot (2026-08-13)

| Metric | Value |
|--------|------:|
| Unique licenses | **58,199** Active |
| Categories | Dual 36,475 · Residential 11,015 · Commercial 10,709 |
| Product | `/verify?state=az` |

---

## Troubleshooting (Florida / shared)

| Symptom | Fix |
|---------|-----|
| `psycopg` import error | `pip install 'psycopg[binary]>=3.1'` |
| Connection refused | Start Postgres; check `DATABASE_URL` |
| Missing CSV | Run the adapter first |
| Schema column errors on old DB | Re-apply `--init-schema` or migrate: add `last_verified_at`, `discipline_actions.external_key` |
