# New Jersey Verify v1 — HIC + specialty boards

## What is live (product path)

| Surface | Status |
|---------|--------|
| Official bulk source notes | [DATA_SOURCES_NJ.md](./DATA_SOURCES_NJ.md) |
| Place / stage helper | `scripts/download_nj_dca.py` → `data/raw/nj_dca/` |
| Normalize | `python -m ingest.adapters.nj_dca` → `data/staging/nj_dca/` |
| Postgres load | `scripts/load_nj_dca_to_postgres.py` (`source_system = nj_dca`) |
| State config | `EVIDENCE_STATES.nj` — pilot Verify; `NEXT_PUBLIC_NJ_VERIFY_PILOT` |
| Verify UI | `/verify?state=nj` — registration # or business/person name |
| Trust Report | `/contractors/[slug]` when `home_state = NJ` |
| Coverage banner | Violet pilot banner: no statewide GC; HIC + specialty limits |
| Credential labels | `lib/states/nj-credentials.ts` |

### Credential types (v1 default)

- **Home Improvement Contractor (HIC)** — primary residential set  
- **Electrical (ELE)** — when present in extract  
- **Plumbing (PLB)** — when present in extract  
- **HVAC / Mechanical (HVAC)** — when present in extract  
- Other DCA types only if published in free bulk with a stable key  

## Honest product claims

**Do say:**

- New Jersey has **no** single statewide general contractor license.  
- Current coverage prioritizes **Home Improvement Contractor** registrations and **available specialty boards**.  
- Always confirm on the official DCA / MyLicense verification site.  
- Missing from results does **not** mean unlicensed (municipal or other boards may apply).  
- Prefer fewer accurate matches over weak padded results.

**Do not say:**

- “All New Jersey contractors”  
- Statewide GC / full builder directory  
- Florida-depth plan, permits, studios, or passport legal localization for NJ  
- Lead-gen or ranking language  

## Still out of scope (v1)

- Full NJ Project Studios / Plan parity  
- NJ permit-history system  
- Scraping MyLicense interactive search  
- Name-only entity auto-joins  
- Cross-state identity merge with FL/TX  

## End-to-end load path

```bash
# 1) Obtain official bulk CSV (Box Standard Files / MyLicense free lists)
#    Place under data/raw/nj_dca/  OR:
python scripts/download_nj_dca.py --from-file path/to/dca_bulk.csv

# 2) Normalize → staging
python -m ingest.adapters.nj_dca \
  --input data/raw/nj_dca/registrations.csv \
  --out-dir data/staging/nj_dca

# 3) Idempotent Postgres load
python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca

# Sample (committed, no network)
python -m ingest.adapters.nj_dca \
  --input data/samples/nj_dca_hic_sample.csv \
  --out-dir data/staging/nj_dca_sample
python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca_sample
```

## UI entry points

| URL | Behavior |
|-----|----------|
| `/verify` | Florida (default) — unchanged |
| `/verify?state=tx` | Texas TDLR specialty — unchanged |
| `/verify?state=nj` | NJ HIC + specialty extract search + coverage banner |
| `/contractors/{slug}` | Trust Report; NJ detected via `home_state` |

## Feature flag

```bash
NEXT_PUBLIC_NJ_VERIFY_PILOT=true   # default: show NJ in state switcher when live
NEXT_PUBLIC_NJ_VERIFY_PILOT=false  # hide NJ entry without code removal
```

## Counts & gaps (ops)

After load, record:

| Metric | How |
|--------|-----|
| HIC rows | `SELECT COUNT(*) FROM licenses WHERE source_system='nj_dca' AND occupation_code='HIC'` |
| Specialty rows | same with `occupation_code IN ('ELE','PLB','HVAC',…)` |
| Entity links | `entities` where `source_system='nj_sos'` |
| Enforcement rows | `discipline_actions` where `source_system='nj_enforcement'` |

**Known gaps:** bulk file availability varies by board; addresses may be sparse; entity/enforcement optional; municipal-only credentials excluded.

## Guardrails checklist

1. ✅ Honest coverage banner on NJ Verify  
2. ✅ No name-only auto-joins  
3. ✅ FL/TX paths unchanged  
4. ✅ Official bulk preferred over scrape  
5. ⬜ Production full HIC refresh schedule (ops)  
6. ⬜ Specialty board bulk when files are stable  

## Related

- Sources: [DATA_SOURCES_NJ.md](./DATA_SOURCES_NJ.md)  
- Texas pattern: [TEXAS_VERIFY_V1.md](./TEXAS_VERIFY_V1.md)  
- Depth: [STAGE_8A_NJ_VERIFY_DEPTH.md](./STAGE_8A_NJ_VERIFY_DEPTH.md)  
