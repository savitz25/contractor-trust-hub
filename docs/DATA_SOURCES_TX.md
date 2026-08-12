# Texas data sources (Phase 0)

Florida remains the reference product. Texas is **trade-specific statewide licensing**, not a full general-contractor registry.

## Coverage reality (product-critical)

| What Texas has statewide | What it does **not** have |
|--------------------------|---------------------------|
| TDLR specialty licenses (electrical, A/C/HVAC, appliance install, water well, elevators, mold, etc.) | **No statewide “general contractor” license** |
| TSBPE plumbing licenses (separate board) | One unified “all contractors” board extract like FL DBPR CILB |
| Local building permits / municipal registration in many cities | Statewide GC directory we can truthfully claim |

**Product rule:** Never present Texas as a complete statewide contractor directory. Label Verify as **TDLR-covered specialty trades** (and later TSBPE plumbing). General residential builders are often city/county only.

## TDLR — Texas Department of Licensing and Regulation

### Official open data (preferred)

| Resource | URL | Notes |
|----------|-----|--------|
| TDLR – All Licenses (Open Data Portal) | https://data.texas.gov/dataset/TDLR-All-Licenses/7358-krk7 | Socrata dataset `7358-krk7`; listing of TDLR license holders |
| SODA API / CSV export | `https://data.texas.gov/resource/7358-krk7.json` · `.csv` | Paginated API; full CSV export via portal UI |
| Socrata API docs | https://dev.socrata.com/foundry/data.texas.gov/7358-krk7 | Query / export endpoints |
| License search (interactive) | https://www.tdlr.texas.gov/LicenseSearch/ | Human verify — not bulk ingest |
| TDLR home | https://www.tdlr.texas.gov/ | Program list & consumer info |

**Prefer:** Open Data Portal bulk/CSV + SODA export filtered to construction-relevant license types.  
**Avoid:** Scraping LicenseSearch or third-party “149 bulk file” aggregators as primary source of truth.

### Columns observed (dataset `7358-krk7`, 2026 probe)

| Field (API) | Description |
|-------------|-------------|
| `license_type` | e.g. `A/C Contractor`, `Electrical Contractor` |
| `license_number` | Numeric/string board number |
| `license_subtype` | e.g. `AC`, `BC`, `AE` |
| `license_expiration_date_mmddccyy` | `MM/DD/YYYY` text |
| `business_name` | Business or person-as-business |
| `owner_name` | Owner / individual name |
| `business_county` / `mailing_address_county` | County name when present |
| `business_address_line1/2`, `business_city_state_zip` | Often sparse on open export |
| `business_telephone` / `owner_telephone` | When present |
| `continuing_education_flag` | Y/N style flag |

**Stable product key:**  
`TX-TDLR:{license_type_slug}:{license_number}`  
with optional `:{license_subtype}` when subtype is present. Do not invent board IDs.

### Construction-relevant license types (for Verify v1 filter)

Observed high-volume types (approx. counts from open data group-by, 2026 probe — refresh on each extract):

| License type | Approx. rows | Role in product |
|--------------|--------------|-----------------|
| Apprentice Electrician | ~250k | Individual — optional, not default “contractor” list |
| Journeyman Electrician | ~45k | Individual |
| A/C Contractor | ~20k | **Primary** business-level specialty |
| Master Electrician | ~20k | Individual / qualifier context |
| Electrical Contractor | ~14k | **Primary** business-level specialty |
| Appliance Installation Contractor | ~800 | Specialty contractor |
| Electrical Sign Contractor | ~650 | Specialty |
| Elevator Contractor | ~350 | Specialty |
| Water Well Driller/Pump Installer | ~1.7k | Specialty |
| Appliance Installer | ~2.5k | Individual / trade |

**Default ingest filter for Phase 0 / Verify v1:** business-oriented contractor types  
(see `ingest/adapters/tx_tdlr.py` → `DEFAULT_LICENSE_TYPES`). Apprentices/journeymen can be staged separately later.

### What TDLR does **not** give us

- Statewide general / residential building contractor credentials  
- Full municipal GC registration  
- Plumbing under TDLR (see TSBPE)  
- Guarantee of complete address fill (open export is sparse on mailing fields)

## TSBPE — Texas State Board of Plumbing Examiners

Plumbing is **not** TDLR. Separate board.

| Resource | URL | Notes |
|----------|-----|--------|
| TSBPE home | https://tsbpe.texas.gov/ | |
| Free Licensee List (CSV) | https://tsbpe.texas.gov/free-licensee-list/ | Updated daily; large CSVs |
| Responsible Master Plumber list | Linked from free-licensee-list (`RMP` download) | Contractors offering plumbing to the public |
| Public license search | Via TSBPE / HPC online systems | Interactive |

**Phase 0–1:** Document only — adapter `tx_tsbpe` is a follow-on (same staging shape as TDLR).  
**After TDLR Verify v1:** Optional second source once specialty electrical + A/C load is solid.

## Local / municipal (out of scope for TX Verify v1)

Many “general contractors” are regulated only by city or county (permits, registration). Examples: major metros maintain their own contractor registration open data. Treat as **future** enrichment, not statewide coverage.

## Provenance rules (same as Florida)

1. Store `source_system` (`tx_tdlr`, later `tx_tsbpe`), source URL, file, SHA-256, extracted_at  
2. Never invent license numbers  
3. Prefer latest open-data extract; keep prior batch ids  
4. Product copy must state trade-specific statewide coverage  

## Ingest path (this repo)

| Step | Command / asset |
|------|-----------------|
| Document | This file + [TEXAS_VERIFY_V1.md](./TEXAS_VERIFY_V1.md) |
| Download (filtered SODA CSV) | `python scripts/download_tx_tdlr.py` |
| Normalize | `python -m ingest.adapters.tx_tdlr --input …` |
| Staging | `data/staging/tx_tdlr/` |
| Registry | `lib/states/config.ts` → `tx` (`live: false` until load + Verify wired) |

## Related

- Florida sources: [DATA_SOURCES.md](./DATA_SOURCES.md)  
- Ingest conventions: [../ingest/README.md](../ingest/README.md)  
- Discovery multi-state notes: [DISCOVERY.md](./DISCOVERY.md)  
