# New Jersey data sources (Phase 0)

Florida remains the full-journey product. Texas is specialty-license Verify.  
**New Jersey is Verify-first** with the same honesty standard as Texas: no invented statewide general contractor directory.

## Coverage reality (product-critical)

| What New Jersey has | What it does **not** have |
|---------------------|---------------------------|
| **Home Improvement Contractor (HIC)** registration under the Division of Consumer Affairs (DCA) — primary consumer-facing credential for most residential improvement work | **No single statewide “general contractor” license** like Florida CGC/CBC/CRC |
| Specialty boards under / related to DCA (Electrical, Plumbing, HVACR, etc.) where bulk lists exist | One unified “all NJ contractors” extract equivalent to FL DBPR CILB |
| Interactive verification: MyLicense portal | Guarantee that every municipal trade card is in statewide bulk files |
| Free DCA standard / bulk licensee files (when published) | Florida-depth permit waves, studios, or protection journey in NJ Verify v1 |

**Product rule:** Never present New Jersey as a complete statewide contractor directory. Label Verify as **HIC registration + available specialty boards**. Always tell users to confirm on the official DCA / board site.

## DCA — Division of Consumer Affairs

### Official bulk / free lists (preferred)

| Resource | URL | Notes |
|----------|-----|--------|
| DCA Standard Files (Box) | https://app.box.com/v/DCAStandardFiles | Free bulk / standard licensee list distribution |
| NJ Consumer Affairs | https://www.njconsumeraffairs.gov/ | Program pages, board links, consumer info |
| MyLicense bulk / download flows | Via njconsumeraffairs.gov / MyLicense portals | Follow official request/download steps for current files |
| Interactive verification | https://newjersey.mylicense.com/verification | Human confirm — not bulk ingest |

**Prefer:** Official free bulk downloads (Standard Files / board CSVs).  
**Avoid:** Scraping the interactive verification portal or third-party directories as primary truth.

### Home Improvement Contractor (HIC) — primary residential set

| Field (product) | Typical bulk aliases | Notes |
|-----------------|----------------------|--------|
| Registration / license # | `registration_number`, `license_number`, `License Number` | Stable id when published |
| Credential type | `credential_type`, `license_type`, `License Type` | Map to `HIC` |
| Business / person name | `business_name`, `Business Name` | Display name |
| Owner / principal | `owner_name`, `Owner Name` | Search + entity context only |
| Status | `status`, `License Status` | Normalize to active / inactive / unknown |
| Expiration | `expiration_date`, `Expiration Date` | When present |
| Address / city / ZIP / county | address*, city, zip, county | Sparse on some extracts |

**Stable product key:**  
`NJ-HIC:{registration_number}`  
(or `NJ-{OCC}:{number}` for specialty boards). Do not invent board IDs.

### Specialty boards (add when clean bulk files exist)

| Board / program | Product occupation codes | Role in Verify v1 |
|-----------------|--------------------------|-------------------|
| Home Improvement Contractor | `HIC` | **Primary** residential coverage |
| Electrical | `ELE` | Specialty when bulk list available |
| Plumbing | `PLB` | Specialty when bulk list available |
| HVACR / Mechanical | `HVAC` | Specialty when bulk list available |
| Other DCA-published construction trades | map in adapter | Only when free bulk is reliable |

Apprentice / individual trainee cards may exist in some lists — **default ingest focuses on business/contractor-facing credentials** (same discipline as TX filtering apprentices).

### What DCA bulk does **not** give us

- Statewide general / residential builder license (does not exist as a single NJ board credential)  
- Complete municipal-only trade cards  
- Live insurance / COI verification  
- Full permit history (out of NJ Verify v1)  
- Automatic high-confidence business entity linkage (separate high-confidence pass only)

## Entity / enforcement (optional depth)

| Layer | `source_system` | Notes |
|-------|-----------------|--------|
| Business entity | `nj_sos` | High-confidence only when a stable entity key is available — **no name-only joins** |
| Public enforcement | `nj_enforcement` | Factual rows when present; absence ≠ clean history |

Interactive case search remains authoritative for enforcement detail.

## Provenance rules (same as Florida / Texas)

1. Store `source_system` (`nj_dca`, `nj_sos`, `nj_enforcement`), source URL, file, SHA-256, `extracted_at`  
2. Never invent registration or license numbers  
3. Prefer latest official bulk extract; keep prior `ingest_batches` rows  
4. Product copy must state HIC + specialty limits and no statewide GC  

## Ingest path (this repo)

| Step | Command / asset |
|------|-----------------|
| Document | This file + [NEW_JERSEY_VERIFY_V1.md](./NEW_JERSEY_VERIFY_V1.md) |
| Place bulk file | Official Box / MyLicense download → `data/raw/nj_dca/` |
| Helper | `python scripts/download_nj_dca.py --from-file path/to/bulk.csv` |
| Normalize | `python -m ingest.adapters.nj_dca --input … --out-dir data/staging/nj_dca` |
| Staging | `data/staging/nj_dca/` (gitignored except samples) |
| Load | `python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca` |
| Registry | `lib/states/config.ts` → `nj` (`live` gated by flag + load) |
| Verify UI | `/verify?state=nj` |

### Committed sample (no network)

```bash
python -m ingest.adapters.nj_dca \
  --input data/samples/nj_dca_hic_sample.csv \
  --out-dir data/staging/nj_dca_sample
python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca_sample --limit 100
```

## Related

- Florida sources: [DATA_SOURCES.md](./DATA_SOURCES.md)  
- Texas specialty: [DATA_SOURCES_TX.md](./DATA_SOURCES_TX.md)  
- Ingest conventions: [../ingest/README.md](../ingest/README.md)  
- Load path: [LOAD_PATH.md](./LOAD_PATH.md)  
- Ops: [STAGE_8C_LIVE_DATA_OPS.md](./STAGE_8C_LIVE_DATA_OPS.md)  
