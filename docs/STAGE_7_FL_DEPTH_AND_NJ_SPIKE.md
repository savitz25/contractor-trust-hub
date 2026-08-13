# Stage 7 — Florida Data Depth + New Jersey Architecture Spike

Two tracks:

1. **Track A** — Florida Wave B/C permit/activity depth (still exact-license joins only)  
2. **Track B** — New Jersey Verify pilot (registration-first, not Florida-depth)

Preserve: evidence over opinion · high-confidence matching · explicit coverage limits · no marketplace.

---

## Track A — Florida Wave B/C depth

### Counties

| Wave | Counties |
|------|----------|
| B | Palm Beach, Duval, Pinellas, Lee |
| C | Collier, Sarasota, Pasco, Polk |

### What improved

- Denser `data/property/sample-permits.json` rows for Wave B/C addresses  
- AHJ-style **raw status** strings (e.g. `In Progress`, `Final Inspection`, `VOID`) normalized via `lib/property/status.ts`  
- Higher **activity rollup** counts for license keys already used on Trust Reports  
- Coverage matrix notes + freshness (`2026-04-10`)  
- Ops: `waveBOpsSnapshot()` / `waveCOpsSnapshot()` + `/tools/coverage` + `GET /api/property/coverage`

### Matching (unchanged)

- Auto-join **exact license number only**  
- UI discloses match method / join audit  
- **No** name-only joins  
- **No** cross-state permit joins  

### Scripts

```bash
npm run verify:stage7   # file-level Wave B/C density + join proxy
npm run audit:joins
npm run load:wave-bc    # same loader as Wave A — loads full sample JSON → Postgres
npm run verify:stage6   # migration 006 tables (when DATABASE_URL set)
```

### Success checks

- Wave B/C property demos return more useful rows where address keys exist  
- Trust Report activity lights up for more license-linked FL keys  
- Join audit remains exact-license only  
- Coverage page Wave B/C counts match extract  

---

## Track B — New Jersey architecture spike

### Purpose

Prove multi-state readiness: second regulatory regime into the same product shell **without** cloning Florida’s full journey.

### Positioning copy

- “New Jersey verification pilot”  
- “Built from official registration and public-record extracts”  
- “Coverage differs by state”  
- “Florida currently includes the full planning and protection journey”  

### NJ source matrix

| Layer | Source system | Notes |
|-------|---------------|--------|
| Registration / HIC | `nj_dca` | Home Improvement Contractor + selected trade credentials in pilot |
| Entity | `nj_sos` | High-confidence only when a linker is designed (not name-only) |
| Enforcement | flag fields in extract | Full case narratives may lag; do not invent |
| Permits / activity | **Out of Stage 7** | Explicitly not FL parity |

Official entry points (confirm live URLs in ops):

- NJ Division of Consumer Affairs: https://www.njconsumeraffairs.gov/  
- Business records portal (entity, separate): https://www.njportal.com/DOR/BusinessRecords/

### Shared multi-state schema principles

Already on core tables (`schema/initial_schema.sql`):

| Field | Role |
|-------|------|
| `contractors.home_state` | FL / TX / NJ |
| `licenses.source_system` | `fl_dbpr` · `tx_tdlr` · `nj_dca` |
| `licenses.external_key` | License or registration key |
| `licenses.occupation_code` | Credential type code |
| `licenses.status_normalized` | Product status |
| `licenses.raw_payload` | Source row |
| `licenses.last_verified_at` | Extract freshness |

Trust Report uses **state-aware copy** (`lib/states/evidence-copy.ts`) — not hard-coded “Florida DBPR” on every profile.

### Feature flag

```bash
# Disable NJ pilot (default is enabled for Stage 7 ship)
NEXT_PUBLIC_NJ_VERIFY_PILOT=false
# or
NJ_VERIFY_PILOT=false
```

`lib/states/feature-flags.ts` · `getStateBySlug("nj")` respects the flag.

### Ingest path

```bash
# Normalize sample (or raw extract)
python -m ingest.adapters.nj_dca \
  --input data/samples/nj_dca_hic_sample.csv \
  --out-dir data/staging/nj_dca

# Load Postgres (requires DATABASE_URL)
python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca
```

Adapter documents field gaps + matching strategy in `batch_manifest.json`.

### Product surface (MVP)

| In scope | Out of scope |
|----------|--------------|
| `/verify?state=nj` | Full NJ Project Studios |
| Search name / registration key | NJ permit history |
| Trust Report core + pilot banner | NJ lien/payment legal trackers |
| Honest coverage limits | Homepage multi-state overload |

Florida remains the complete journey product.

### Language standards

| State | Credential label | Board extract |
|-------|------------------|---------------|
| FL | License | Florida DBPR extract |
| TX | Specialty license | TDLR specialty extract |
| NJ | Registration / credential | New Jersey registration extract |

Global: no endorsement · no “safe to hire” · evidence only.

---

## Architecture notes

- Ingest adapters isolated by state (`ingest/adapters/fl_*`, `tx_*`, `nj_*`)  
- Shared domain: contractors, licenses, entities, discipline  
- State-specific UI banners + occupation labels  
- Cross-state matching **prohibited** unless explicitly designed later  

### Files (Stage 7)

| Area | Path |
|------|------|
| FL Wave B/C data | `data/property/sample-permits.json` |
| FL ops | `lib/property/ops-health.ts`, `wave-bc.ts` |
| NJ adapter | `ingest/adapters/nj_dca.py` |
| NJ loader | `scripts/load_nj_dca_to_postgres.py` |
| NJ sample | `data/samples/nj_dca_hic_sample.csv` |
| NJ UI | `components/search/NjCoverageBanner.tsx` |
| Config | `lib/states/config.ts`, `feature-flags.ts`, `evidence-copy.ts`, `nj-credentials.ts` |

---

## Regression

- Florida Stages 1–6 journeys unchanged (plan, property, projects, passport)  
- `npm run test:matcher` remains green  
- `npm run verify:stage7` + `audit:joins`  
- TX Verify path still specialty-only  
- NJ Verify requires load for live search results (same as TX)  

---

## Known limitations

- Wave B/C extracts remain **partial** — empty property results are normal  
- NJ pilot is **Verify-only** — do not claim Florida-depth  
- Entity linkage for NJ not fully built in Stage 7  
- Production refresh cadence for NJ DCA extract is ops-owned  
- Feature flag can disable NJ without code removal  
