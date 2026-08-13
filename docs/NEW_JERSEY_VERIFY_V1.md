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

## End-to-end load path (production)

Official free bulk is the **DCA Standard Files** Box folder (MLO Facilities + Individuals, `%`-delimited).

```bash
# 1) Download Box Standard Files + convert HIC / specialty → adapter CSV
python scripts/download_nj_dca.py --from-box --convert
# Equivalent two-step:
#   python scripts/download_nj_dca.py --from-box
#   python scripts/convert_nj_mlo_facilities.py
#   python scripts/download_nj_dca.py --from-file data/raw/nj_dca/hic_and_specialty_from_mlo_active.csv

# 2) Normalize → staging
python -m ingest.adapters.nj_dca \
  --input data/raw/nj_dca/registrations.csv \
  --out-dir data/staging/nj_dca

# 3) Idempotent Postgres load (requires DATABASE_URL)
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

## Production counts (Box Standard Files, active statuses, 2026-08-03 extract)

Staged from official free bulk (not sample):

| occupation_code | Source in Standard Files | Rows staged |
|-----------------|--------------------------|------------:|
| **HIC** | Facilities → Home Improvement Business Contr (+ Home Elevation) | **25,111** |
| **ELE** | Facilities → Electrical Business Permit | **2,853** |
| **PLB** | Individuals → Master Plumber | **1,719** |
| **HVAC** | Individuals → Master HVACR Contractor | **1,575** |
| **Total** | | **31,258** |

All rows in this extract are **Active**. Expired/inactive HIC appear on MyLicense interactive/bulk profession export but are **not** in the Box “active” Standard Files (the facilities “all statuses” file also omits HIC profession entirely as of this extract).

After Postgres load, confirm:

| Metric | SQL |
|--------|-----|
| HIC | `SELECT COUNT(*) FROM licenses WHERE source_system='nj_dca' AND occupation_code='HIC'` |
| Specialty | `… AND occupation_code IN ('ELE','PLB','HVAC')` |
| Batch | `SELECT * FROM ingest_batches WHERE source_system='nj_dca' ORDER BY id DESC LIMIT 3` |

### Field notes from full extract

- Stable keys: `NJ-HIC:{license_no}`, `NJ-ELE:…`, `NJ-PLB:…`, `NJ-HVAC:…`  
- Location fill is strong on facilities (city/state/ZIP/county present)  
- Individuals specialty rows are **person-named** credentials (Master Plumber / Master HVACR), not business shells  
- Entity / enforcement not present in Standard Files — optional depth only  
- Phone present on facilities; often absent on individuals  

### Remaining gaps

| Gap | Notes |
|-----|--------|
| Expired / inactive HIC | Use MyLicense Verification_Bulk profession download if needed |
| Full electrical person cards | Only business permits from facilities by default |
| Journeyman / apprentice | Intentionally excluded (contractor-facing only) |
| Entity linkage | No automatic SOS join |
| Enforcement depth | Not in Standard Files active extract |
| Municipal-only cards | Out of scope |
| Refresh schedule | Re-run `--from-box --convert` when Box files update (dated in filename) |

## Guardrails checklist

1. ✅ Honest coverage banner on NJ Verify  
2. ✅ No name-only auto-joins  
3. ✅ FL/TX paths unchanged  
4. ✅ Official bulk preferred over scrape  
5. ✅ Production full HIC (+ specialty) staged from Box Standard Files  
6. ⬜ Postgres production load (requires `DATABASE_URL`) + UI smoke on live DB  
7. ⬜ Scheduled refresh when Box file dates change  

## Related

- Sources: [DATA_SOURCES_NJ.md](./DATA_SOURCES_NJ.md)  
- Texas pattern: [TEXAS_VERIFY_V1.md](./TEXAS_VERIFY_V1.md)  
- Depth: [STAGE_8A_NJ_VERIFY_DEPTH.md](./STAGE_8A_NJ_VERIFY_DEPTH.md)  
