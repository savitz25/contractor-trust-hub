# Stage 8C — Live Data Ops

Production extracts · load reliability · coverage reality.

Move from sample-assisted evidence toward **repeatable batch production operations** for Florida permit waves and New Jersey verify sources — without loosening matching or overclaiming completeness.

## Principles

| Rule | Detail |
|------|--------|
| Precision over recall | Exact license/registration keys only |
| Idempotent loads | Safe to re-run; Wave loads delete `CTH Wave%` then re-insert |
| Source + freshness | `source_label`, `retrieved_at` required |
| Coverage honesty | Never present sample density as full AHJ coverage |
| FL journey stable | Ops must not break Plan → Project → Passport |
| NJ pilot | Verify-depth until coverage is intentional |

## Schema

| Migration | Purpose |
|-----------|---------|
| `006_stage6_permits_activity.sql` | `permit_records`, `contractor_permit_activity`, `permit_coverage_stats` |
| `007_stage8c_ops_load_runs.sql` | `ops_load_runs` — last success, delta, failures |

Apply:

```bash
psql "$DATABASE_URL" -f schema/migrations/006_stage6_permits_activity.sql
psql "$DATABASE_URL" -f schema/migrations/007_stage8c_ops_load_runs.sql
```

## Command set

### Load

```bash
# All waves A–C from data/property/sample-permits.json (or --file path)
npm run load:permits

# Wave subsets
npm run load:wave-a
npm run load:wave-bc

# Dry run (no writes)
node scripts/load_wave_permits.mjs --dry-run --wave A

# Rebuild activity rollups from permit_records only
npm run rebuild:activity

# New Jersey Verify
python -m ingest.adapters.nj_dca \
  --input data/samples/nj_dca_hic_sample.csv \
  --out-dir data/staging/nj_dca
python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca
```

### Verify

```bash
npm run verify:stage6      # tables present
npm run verify:ops         # production counts, freshness, NJ, last runs
npm run ops:snapshot       # JSON health snapshot
```

### Audit

```bash
npm run audit:joins          # file extract join proxy
npm run audit:production     # DB join proxy when DATABASE_URL set
npm run test:ops             # script structure smoke
```

## Canonical runbook

1. **Snapshot note** — record time + reason for load  
2. **Extract pull** — AHJ dump or committed `sample-permits.json` / NJ CSV  
3. **Normalize** — status via loader `normalizePermitStatus`; raw retained in `raw` JSONB  
4. **Load** — `npm run load:permits` (zero-row aborts)  
5. **Verify** — `npm run verify:ops`  
6. **Audit** — `npm run audit:production`  
7. **Coverage** — open `/tools/coverage` + `GET /api/property/coverage`  
8. **UI smoke** — addresses + contractor activity + NJ search (below)  

## Florida waves

| Wave | Counties |
|------|----------|
| A | Miami-Dade, Broward, Orange, Hillsborough |
| B | Palm Beach, Duval, Pinellas, Lee |
| C | Collier, Sarasota, Pasco, Polk |

Loader:

- Filters rows by jurisdiction slug for selected waves  
- Rebuilds `contractor_permit_activity` from **permit_records** (not only JSON rollups)  
- Updates `permit_coverage_stats`  
- Logs `ops_load_runs` when migration 007 applied  

## New Jersey

| source_system | Content |
|---------------|---------|
| `nj_dca` | Registrations / credentials |
| `nj_sos` | High-confidence entities |
| `nj_enforcement` | Public action rows |

### Production refresh (HIC + specialty)

```bash
python scripts/download_nj_dca.py --from-box --convert
python -m ingest.adapters.nj_dca --input data/raw/nj_dca/registrations.csv --out-dir data/staging/nj_dca
python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca
# or: python scripts/load_nj_dca_via_supabase_rest.py --staging-dir data/staging/nj_dca
```

**Expanded Standard Files counts (2026-08-03):** HIC 25,111 · ELE 32,304 · PLB 11,455 · HVAC 9,520 · ALM 4,863 · TEL 3,043 · LCK 993 · HRT 66 (total **87,355**; ≈55k active / ≈32k non-active specialty).  
HIC is active-only from Box; specialty inactive/expired included. Coverage banner remains: no statewide GC; HIC primary.

## Coverage truthfulness

| Surface | Behavior |
|---------|----------|
| `/tools/coverage` | Banner: production DB vs file/sample mode |
| `GET /api/property/coverage` | `production` block + matrix `dataMode` |
| Property pages | Unchanged honesty notes; empty ≠ clean |
| Trust Report activity | Live / partial / not linked from DB rollups |

## Failure modes

| Failure | Handling |
|---------|----------|
| Download / missing file | Loader exits non-zero |
| Zero-row wave selection | Abort before write |
| Schema missing | `verify:ops` FAIL |
| Freshness > threshold | `verify:ops` WARN (default 120d) |
| Load exception | ROLLBACK; `ops_load_runs` status=failed when table exists |
| Unmatched license spike | `audit:production` unmatched count |

## Post-load UI smoke

### Florida

- Wave A address with sample key (e.g. `100 Ocean Drive` / `33139`)  
- Wave B/C address from extract  
- Contractor with known license activity (e.g. CGC1526123 in sample)  
- Contractor with no activity → Not linked  

### New Jersey

- Search registration key from sample  
- Search business name  
- Open Trust Report → source badges + checked/not-checked  

### Regression

- Plan → Scope → Quote still healthy  
- Homepage continuity unaffected  

## FL license / entity / discipline refresh (existing)

Not replaced by Stage 8C — document cadence:

| Source | Scripts | Cadence (ops-owned) |
|--------|---------|---------------------|
| FL DBPR | `download_fl_dbpr.py`, `load_fl_dbpr_to_postgres.py` | Schedule per capacity |
| Sunbiz | `download_sunbiz.py`, link scripts | Quarterly / as published |
| Discipline | DBPR adapter discipline path | With DBPR refresh |

Surface last-success via `ops_load_runs` (extend loaders when ready) and Trust Report `last_verified_at` fields.

## Matching (unchanged)

- Exact license/registration key only  
- No name-only auto-joins  
- No cross-state merges  
- No quality scores from permit volume  

## Files

| Path | Role |
|------|------|
| `scripts/load_wave_permits.mjs` | Production wave load |
| `scripts/rebuild_permit_activity.mjs` | Rollup rebuild |
| `scripts/verify_production_data.mjs` | `verify:ops` |
| `scripts/audit_production_joins.mjs` | `audit:production` |
| `scripts/ops_snapshot.mjs` | JSON snapshot |
| `lib/property/ops-db.ts` | DB stats for API/UI |
| `schema/migrations/007_stage8c_ops_load_runs.sql` | Load history |

## Related

- [STAGE_6_1_VERIFICATION.md](./STAGE_6_1_VERIFICATION.md)  
- [STAGE_7_FL_DEPTH_AND_NJ_SPIKE.md](./STAGE_7_FL_DEPTH_AND_NJ_SPIKE.md)  
- [STAGE_8A_NJ_VERIFY_DEPTH.md](./STAGE_8A_NJ_VERIFY_DEPTH.md)  
- [PRODUCTION.md](./PRODUCTION.md)  
