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

### Credential types (loaded from Standard Files)

| Code | Credential | Source extract |
|------|------------|----------------|
| **HIC** | Home Improvement Business Contr (+ elevation) | Facilities **active** only |
| **ELE** | Electrical Business Permit + Electrical Contractor (person) | Facilities + individuals all-status |
| **TEL** | Telecom Contractor | Facilities all-status |
| **ALM** | Burglar / fire alarm business + person licenses | Facilities + individuals all-status |
| **LCK** | Locksmith business + person licenses | Facilities + individuals all-status |
| **PLB** | Master Plumber | Individuals all-status |
| **HVAC** | Master HVACR Contractor | Individuals all-status |
| **HRT** | Master Hearth Specialist | Individuals all-status |

Skipped by default: apprentices, journeymen, CE sponsors, electrologists, medical-gas subclasses.

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

## Production counts (Box Standard Files expanded, 2026-08-03)

| occupation_code | Active | Inactive-ish* | Total |
|-----------------|-------:|--------------:|------:|
| **HIC** | 25,111 | 0 | **25,111** |
| **ELE** | 13,091 | 19,213 | **32,304** |
| **PLB** | 4,903 | 6,552 | **11,455** |
| **HVAC** | 6,654 | 2,866 | **9,520** |
| **ALM** | 2,081 | 2,782 | **4,863** |
| **TEL** | 3,018 | 25 | **3,043** |
| **LCK** | 392 | 601 | **993** |
| **HRT** | 59 | 7 | **66** |
| **Total** | **55,309** | **32,046** | **87,355** |

\*Inactive-ish = Expired, Inactive, Closed, Deceased, Retired, Suspended, Revoked, Out of Business, Voluntary Surrender (normalized to `inactive`). UI shows **raw board status** so Expired cannot look Active.

**HIC status limitation:** Box facilities all-status omits Home Improvement Contractors. HIC is active-only from facilities active file. Expired HIC may exist via MyLicense Verification_Bulk (not yet automated).

After Postgres load, confirm:

| Metric | SQL |
|--------|-----|
| HIC | `SELECT COUNT(*) FROM licenses WHERE source_system='nj_dca' AND occupation_code='HIC'` |
| Specialty | `… AND occupation_code IN ('ELE','TEL','ALM','LCK','PLB','HVAC','HRT')` |
| By raw status | `SELECT primary_status, COUNT(*) FROM licenses WHERE source_system='nj_dca' GROUP BY 1` |
| Batch | `SELECT * FROM ingest_batches WHERE source_system='nj_dca' ORDER BY created_at DESC LIMIT 3` |

### Field notes from full extract

- Stable keys: `NJ-{CODE}:{license_no}`  
- Specialty inactive/expired included from all-status Standard Files  
- Individuals specialty rows are person-named (Master Plumber / HVACR / Electrical Contractor)  
- Entity / enforcement not present in Standard Files — optional depth only  

### Remaining gaps

| Gap | Notes |
|-----|--------|
| Expired / inactive HIC | Not in Box Standard Files; evaluate MyLicense Verification_Bulk HIC export |
| Journeyman / apprentice | Intentionally excluded |
| Medical gas subclasses | Not default consumer set |
| Entity linkage | No automatic SOS join |
| Full enforcement case files | Bulk feed is a **Y/N discipline flag only** (~1.1k mapped flags); no complaint narrative/dates |
| Municipal-only cards | Out of scope |
| Refresh schedule | Re-run `--from-box --convert` when Box file dates change |

## Guardrails checklist

1. ✅ Honest coverage banner on NJ Verify  
2. ✅ No name-only auto-joins  
3. ✅ FL/TX paths unchanged  
4. ✅ Official bulk preferred over scrape  
5. ✅ Production HIC + expanded specialty from Box Standard Files  
6. ✅ Inactive/expired specialty statuses loaded with visible raw status  
7. ✅ Public discipline flags mapped to `discipline_actions` (`nj_enforcement`, ~1.1k)  
8. ⬜ Expired HIC via MyLicense bulk (if product prioritizes)  
9. ⬜ Scheduled refresh when Box file dates change  

### Discipline / enforcement (Standard Files flag)

| Metric | Value |
|--------|------:|
| Rows with discipline flag Y (mapped credentials) | **1,134** |
| Soft-linked to `nj_dca` license number | **1,134** (100%) |
| Source | Trailing Y/N column on all-status MLO files |
| What is **not** in bulk | Case id narrative, disposition dates, full docket |

External key: `NJ-ENF:FLAG:{license_no}` · `source_system = nj_enforcement`

## Related

- Sources: [DATA_SOURCES_NJ.md](./DATA_SOURCES_NJ.md)  
- Texas pattern: [TEXAS_VERIFY_V1.md](./TEXAS_VERIFY_V1.md)  
- Depth: [STAGE_8A_NJ_VERIFY_DEPTH.md](./STAGE_8A_NJ_VERIFY_DEPTH.md)  
