# Arizona data sources (Phase 0)

Florida remains the full-journey product. Texas / New Jersey / Oregon / California are Verify-focused.  
**Arizona Verify v1** uses official **Registrar of Contractors (ROC)** current-contractor posting lists.

## Coverage reality (product-critical)

| What Arizona has | What this extract does **not** claim |
|------------------|--------------------------------------|
| Statewide contractor licensing through AZ ROC | Complete historical / inactive / revoked archive |
| Free bulk **current active** posting-list CSVs | Live bond / insurance certificate verification |
| Residential / commercial / dual license categories | Full disciplinary case detail (separate disciplinary CSV exists; not loaded in v1) |
| Class codes + class detail on each license | Automatic SOS / ACC entity linkage |
| Qualifying party name when published | Personnel roster depth beyond QP name |

**Product rule:** Label Verify as **Arizona ROC licenses from the official current-contractor posting list**. Always tell users to confirm on the [ROC contractor search](https://azroc.my.site.com/AZRoc/s/contractor-search).

## Official sources

| Resource | URL | Notes |
|----------|-----|--------|
| ROC home | https://roc.az.gov/ | Board + consumer info |
| Posting List | https://roc.az.gov/posting-list | Free bulk CSVs (primary ingest) |
| Contractor Search | https://azroc.my.site.com/AZRoc/s/contractor-search | Human verify — not bulk ingest |
| Classifications / rules | https://roc.az.gov/rules | Class definitions |

### Current Active Contractors bulk files

Published on the Posting List page (date-stamped filenames, e.g. `ROC_Posting-List_YYYY-MM-DD.csv`):

| File | Scope |
|------|--------|
| **All Current Contractors** | Full active universe (preferred primary load) |
| Commercial Contractors | Commercial-only subset |
| Residential Contractors | Residential-only subset |
| Dual License Contractors | Dual-only subset |

Also published (not required for Verify v1 core): Pending Applications, New Licenses, Disciplinary Actions CSVs.

**Prefer:** Official free posting-list downloads.  
**Avoid:** Scraping the interactive contractor search as primary truth.  
**Note:** `roc.az.gov` may sit behind Cloudflare; automated download can fail with 403. Browser download from the Posting List page works; place the CSV under `data/raw/az_roc/`.

## Observed CSV schema (All Current Contractors)

Title row (skipped by adapter), then header:

```
#, License No, Business Name, Doing Business As, Class, Class Detail, Class Type,
Address, Address 2, City, State, Zip, Qualifying Party, Issued Date, Expiration Date, Status
```

| Field | Product mapping |
|-------|-----------------|
| License No | `license_number`; stable key `AZ-ROC:{LicenseNo}` |
| Business Name | `licensee_name_raw` / contractor display |
| Doing Business As | `dba_name_raw` |
| Class | `occupation_code` / `class_code` (e.g. `B`, `CR-11`, `KB-1`) |
| Class Detail | `occupation_description` |
| Class Type | Category label: General/Specialty × Residential/Commercial/Dual → stored in `secondary_status` + payload |
| Address / City / State / Zip | Address fields (`state` usually AZ) |
| Qualifying Party | Payload + secondary signal (not inventing roles) |
| Issued / Expiration Date | `original_licensure_date` / `expiration_date` |
| Status | `primary_status`; Active → `status_normalized = active` |

### License categories (Class Type)

Plain-language groups used in product copy:

| Class Type (as published) | Category bucket |
|---------------------------|-----------------|
| General Residential / Specialty Residential | **Residential** |
| General Commercial / Specialty Commercial | **Commercial** |
| General Dual / Specialty Dual | **Dual** (residential + commercial) |

Official class codes (B, KB-1, CR-*, R-*, C-*, etc.) remain visible on result cards.

## Download inventory (this repo)

Raw directory: `data/raw/az_roc/`

| Item | Value |
|------|--------|
| Primary file pattern | `ROC_Posting-List_YYYY-MM-DD.csv` |
| Example load | `ROC_Posting-List_2026-08-13.csv` — **58,200** rows |
| Status in extract | Almost entirely **Active** |
| One license per row | Yes in observed file (no multi-class row expansion) |

## Stable product key

`AZ-ROC:{LicenseNo}`  
Strip whitespace; keep leading zeros as published (e.g. `002386`).

## Ingest path

| Step | Command |
|------|---------|
| Download (when CF allows) | `python scripts/download_az_roc.py` |
| Or place manual browser download | `data/raw/az_roc/ROC_Posting-List_*.csv` |
| Normalize | `python -m ingest.adapters.az_roc --input data/raw/az_roc/ROC_Posting-List_….csv` |
| Load (Postgres) | `python scripts/load_az_roc_to_postgres.py --staging-dir data/staging/az_roc` |
| Load (PostgREST) | `python scripts/load_az_roc_via_supabase_rest.py --staging-dir data/staging/az_roc` |
| Verify UI | `/verify?state=az` |

## Remaining gaps

| Gap | Notes |
|-----|--------|
| Inactive / revoked history | Current posting list is active-only |
| Disciplinary depth | Separate disciplinary CSV on posting list — not wired in Verify v1 (do not invent) |
| Bond / insurance live validity | Not in current-contractor columns as COI |
| Qualifying party depth | Name only when present; “QP Exempt” / missing names as published |
| Entity linkage | ACC / SOS not auto-linked |
| AZ Plan / Studios | Out of scope (Verify first) |

## Provenance rules

1. Store `source_system = az_roc`, source file, URL, SHA-256, `extracted_at`
2. Never invent license numbers or discipline
3. Prefer latest All Current Contractors file; keep prior `ingest_batches`
4. Product copy must state posting-list scope + official ROC search confirm

## Related

- [DATA_SOURCES.md](./DATA_SOURCES.md)
- [LOAD_PATH.md](./LOAD_PATH.md)
- [ARIZONA_VERIFY_V1.md](./ARIZONA_VERIFY_V1.md)
