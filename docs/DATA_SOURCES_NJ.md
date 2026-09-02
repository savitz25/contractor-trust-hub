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
| DCA Standard Files (Box) | https://app.box.com/v/DCAStandardFiles | **Primary free bulk** — MLO Facilities + Individuals `.txt` files (`%`-delimited), dated in filename |
| MyLicense bulk download | https://newjersey.mylicense.com/Verification_Bulk | Profession-filtered free roster download (can include expired HIC) |
| NJ Consumer Affairs | https://www.njconsumeraffairs.gov/ | Program pages, board links, consumer info |
| Interactive verification | https://newjersey.mylicense.com/verification | Human confirm — not bulk ingest |

**Prefer:** Official free bulk downloads (Standard Files / MyLicense bulk).  
**Avoid:** Scraping the interactive verification portal or third-party directories as primary truth.

### Box Standard Files layout (observed 2026-08-03)

| File | Role for Verify |
|------|-----------------|
| `MLO_Facilities_active_statuses_*.txt` | **HIC only path** — Home Improvement Business Contr (~25k Active). HIC is **not** in facilities all-status. |
| `MLO_Facilities_all_statuses_with_discipline_*.txt` | Electrical Business Permit + telecom / alarm / locksmith **business** classes (Active + Expired/Inactive/…) |
| `MLO_Individuals_all_statuses_with_discipline_*.txt` | Electrical Contractor, Master Plumber, Master HVACR, alarm/locksmith person, Master Hearth (all statuses) |
| `MLO_Individuals_active_statuses_*.txt` | Subset of individuals; converter prefers all-status for depth |

Delimiter: `%` (header line is a truncated SQL concat expression; field order is fixed — see `scripts/convert_nj_mlo_facilities.py`).

**Inactive / expired:** Specialty boards are loaded with board status preserved (`primary_status`). HIC remains active-only from Box.

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
| Public enforcement | `nj_enforcement` | Standard Files trailing **discipline flag (Y/N)** mapped to `discipline_actions`; no case narrative in bulk — absence ≠ clean history |

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
| Download + convert | `python scripts/download_nj_dca.py --from-box --convert` |
| Converter | `scripts/convert_nj_mlo_facilities.py` → HIC + ELE + PLB + HVAC CSV |
| Normalize | `python -m ingest.adapters.nj_dca --input data/raw/nj_dca/registrations.csv --out-dir data/staging/nj_dca` |
| Staging | `data/staging/nj_dca/` (gitignored) |
| Load | `python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca` |
| Registry | `lib/states/config.ts` → `nj` |
| Verify UI | `/verify?state=nj` |

**Production staged counts (expanded Standard Files, 2026-08-03):** HIC 25,111 · ELE 32,304 · PLB 11,455 · HVAC 9,520 · ALM 4,863 · TEL 3,043 · LCK 993 · HRT 66 · **total 87,355** (≈55k active / ≈32k inactive-ish).

### Committed sample (no network)

```bash
python -m ingest.adapters.nj_dca \
  --input data/samples/nj_dca_hic_sample.csv \
  --out-dir data/staging/nj_dca_sample
python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca_sample --limit 100
```

## NJ-CON-001 public-works registration and exclusion sources

Separate from the HIC/board credential graph. Do not collapse into one debarment field. See [NJ-CON-001-RUNBOOK.md](./NJ-CON-001-RUNBOOK.md).

| Family | Official page | Bulk |
|--------|---------------|------|
| PWCR | https://www.nj.gov/labor/wageandhour/registration-permits/register/publicworksregistration.shtml | Power BI only — OPRA |
| Prevailing-wage debarment | https://www.nj.gov/labor/wageandhour/registration-permits/register/debarmentlist.shtml | Power BI only — OPRA |
| WALL | https://www.nj.gov/labor/ea/osec/wall.shtml | `Wall_Dataset.xlsx` |
| Wage Violation Watchlist | https://www.nj.gov/labor/ea/osec/wageviolationlist.shtml | `WVW-List.xlsx` |
| Treasury construction | https://www.nj.gov/treasury/revenue/debarment/debarsearch-construction.shtml | tab/`%` text |
| Treasury vendor | https://www.nj.gov/treasury/revenue/debarment/debarsearch-vendor.shtml | tab/`%` text |

Absence from a current list is not a clean history.

## Related

- Florida sources: [DATA_SOURCES.md](./DATA_SOURCES.md)  
- Texas specialty: [DATA_SOURCES_TX.md](./DATA_SOURCES_TX.md)  
- Ingest conventions: [../ingest/README.md](../ingest/README.md)  
- Load path: [LOAD_PATH.md](./LOAD_PATH.md)  
- Ops: [STAGE_8C_LIVE_DATA_OPS.md](./STAGE_8C_LIVE_DATA_OPS.md)  
