# Data sources

All sources are public records. Prefer bulk official extracts over scrapes.

## Florida — DBPR Construction Industry

| Resource | URL | Notes |
|----------|-----|--------|
| Construction public records hub | https://www2.myfloridalicense.com/construction-industry/public-records/ | Layout + download index |
| Construction licensees (bulk CSV) | https://www2.myfloridalicense.com/sto/file_download/extracts//CONSTRUCTIONLICENSE_1.csv | Active / inactive / voluntarily inactive; **no header row** |
| Construction applicants | https://www2.myfloridalicense.com/sto/file_download/extracts/constr_app.csv | Applicants |
| CE — CILB certified | https://www2.myfloridalicense.com/sto/file_download/extracts/cilb_certified.csv | Continuing education |
| CE — CILB registered | https://www2.myfloridalicense.com/sto/file_download/extracts/cilb_registered.csv | Continuing education |
| Licensed contractor discipline (FY) | e.g. `.../pro/cilb/reports/contractor_disc_lic_2425.csv` | Headered CSV |
| ULA discipline (FY) | `.../contractor_disc_ula_YYYY.csv` | Unlicensed activity |
| Recovery fund discipline (FY) | `.../contractor_disc_rf_YYYY.csv` | Recovery fund |
| Codes guide | https://www2.myfloridalicense.com/about-us/understanding-dbpr-codes/ | Status / occupation codes |
| Disclaimer | https://www2.myfloridalicense.com/public-records-read-medisclaimer/ | Required read before use |

### Licensee file layout (official column order)

Inspected **2026-04-10** from `CONSTRUCTIONLICENSE_1.csv` (~270k rows, ~47 MB). **No header row.**

| # | Field | Example | Fill rate (approx.) |
|---|--------|---------|---------------------|
| 1 | board_number | `06` | 100% |
| 2 | occupation_code | `CBC`, `CGC`, `QB` | 100% |
| 3 | licensee_name | `WORSHAM, RONALD EDWARD` | 100% |
| 4 | dba_name | `WORSHAM CONSTRUCTION COMPANY, INC.` | ~50% |
| 5 | class_code | (often empty) | ~8% |
| 6 | address_line_1 | | ~99% |
| 7 | address_line_2 | | ~7% |
| 8 | address_line_3 | | ~1% |
| 9 | city | `TAMPA` | ~99% |
| 10 | state | `FL` | ~99% |
| 11 | zip | `33617` | ~99% |
| 12 | county_code | `39` | ~97% |
| 13 | license_number | `0015082` (numeric core) | ~53% |
| 14 | primary_status | `C` (dominant) | 100% |
| 15 | secondary_status | `A` active / `I` inactive / blank | ~48% |
| 16 | original_licensure_date | `MM/DD/YYYY` | ~100% |
| 17 | effective_date | `MM/DD/YYYY` | ~100% |
| 18 | expiration_date | `MM/DD/YYYY` | ~46% |
| 19 | blank | unused | 0% |
| 20 | renewal_period | unused in extract | 0% |
| 21 | alternate_license_number | `CBC015082` full id | ~53% |

**Stable product key (licensed occupations):** prefer `alternate_license_number` when present; else compose `{occupation_code}{license_number}` (as published).

**QB (Qualifying Business):** ~127k rows in the 2026 extract have **empty** `license_number` and `alternate_license_number`. These are business shells, not board license credentials. The adapter stages them as `qualifying_businesses_normalized.csv` with deterministic `QB-ENTITY:{sha256-16}` keys — **not** invented license numbers.

**Top occupation codes (full file):** `QB` (~127k), `CGC`, `CBC`, `FRO`, `CAC`, `CCC`, `CFC`, `CRC`, …

DBPR note: NULL & VOID, delinquent, and involuntarily inactive records are **not** in the licensee download.

### Discipline file layout (headered)

Example: `contractor_disc_lic_2425.csv`

```
License Type, License Nbr, Respondent Name, Address Line 1–3, City, State, ZIP Code,
County, Complaint Nbr, Classification, Entered Date, Disposition, Disposition Date,
Discipline Date - Description, Violation Code
```

## Florida — Sunbiz (Division of Corporations)

| Resource | URL / path | Notes |
|----------|------------|--------|
| Data downloads hub | https://dos.fl.gov/sunbiz/other-services/data-downloads/ | Daily + quarterly |
| Corporate definitions | https://dos.sunbiz.org/data-definitions/cor.html | Fixed-width 1440-char rows |
| SFTP host | `sftp.floridados.gov` | User `Public` / password published by DOS |
| Quarterly corporate | `doc/Quarterly/Cor/cordata.zip` | Full active snapshot (~1.8 GB) |
| Daily corporate | `doc/cor/YYYYMMDDc.txt` | Workday filings |

**Ingest:** `scripts/download_sunbiz.py` + `ingest/adapters/fl_sunbiz.py`  
**Guide:** [SUNBIZ.md](SUNBIZ.md)

Use: link legal entity status, officers, FEI, and registered agent to DBPR contractors via high-confidence name/address rules (linker is a follow-up).

## Texas — TDLR specialty trades (+ TSBPE plumbing)

**Texas has no statewide general contractor license.** Statewide open data is specialty-only (TDLR) plus separate plumbing (TSBPE).

Full documentation, columns, coverage limits, and ingest commands:

→ **[DATA_SOURCES_TX.md](./DATA_SOURCES_TX.md)** · product slice: **[TEXAS_VERIFY_V1.md](./TEXAS_VERIFY_V1.md)**

| Resource | URL | Notes |
|----------|-----|--------|
| TDLR All Licenses (Open Data) | https://data.texas.gov/dataset/TDLR-All-Licenses/7358-krk7 | Socrata `7358-krk7` |
| TDLR home | https://www.tdlr.texas.gov/ | Specialty programs |
| TSBPE free licensee CSVs | https://tsbpe.texas.gov/free-licensee-list/ | Plumbing (not TDLR) |

**Ingest:** `scripts/download_tx_tdlr.py` + `ingest/adapters/tx_tdlr.py` → `data/staging/tx_tdlr/`

## Oregon — CCB Active Licenses

Statewide contractor licensing through the Construction Contractors Board.

→ **[DATA_SOURCES_OR.md](./DATA_SOURCES_OR.md)** · product: **[OREGON_VERIFY_V1.md](./OREGON_VERIFY_V1.md)**

| Resource | URL | Notes |
|----------|-----|--------|
| CCB Active Licenses | https://data.oregon.gov/Business/CCB-Active-Licenses/g77e-6bhs | Socrata `g77e-6bhs`; daily refresh |
| CCB search | https://search.ccb.state.or.us/search/ | Interactive human verify |

**Ingest:** `scripts/download_or_ccb.py` + `ingest/adapters/or_ccb.py` → `data/staging/or_ccb/`

## New Jersey — DCA (HIC + specialty boards)

**New Jersey has no single statewide general contractor license.** The primary consumer-facing credential for most residential improvement work is **Home Improvement Contractor (HIC)** registration via the Division of Consumer Affairs (DCA). Specialty trades sit under separate boards (Electrical, Plumbing, HVACR, etc.).

Full documentation, coverage limits, bulk sources, and ingest commands:

→ **[DATA_SOURCES_NJ.md](./DATA_SOURCES_NJ.md)** · product slice: **[NEW_JERSEY_VERIFY_V1.md](./NEW_JERSEY_VERIFY_V1.md)**

| Resource | URL | Notes |
|----------|-----|--------|
| DCA Standard Files (Box) | https://app.box.com/v/DCAStandardFiles | Free bulk / standard licensee lists |
| NJ Consumer Affairs | https://www.njconsumeraffairs.gov/ | Program + board pages |
| MyLicense verification | https://newjersey.mylicense.com/verification | Interactive confirm — not bulk ingest |

**Ingest:** `scripts/download_nj_dca.py` + `ingest/adapters/nj_dca.py` → `data/staging/nj_dca/`

## California — CSLB (high-impact counties)

**California licenses contractors statewide through CSLB.** This product extract uses official Public Data Portal county/classification list downloads for high-impact counties present in `data/raw/ca_contractors/` (includes Riverside; not a full statewide board dump).

→ **[DATA_SOURCES_CA.md](./DATA_SOURCES_CA.md)** · product: **[CALIFORNIA_VERIFY_V1.md](./CALIFORNIA_VERIFY_V1.md)**

| Resource | URL | Notes |
|----------|-----|--------|
| CSLB Instant License Check | https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx | Human confirm |
| Public list Excel downloads | CSLB Public Data Portal | `CSLBSearchData_*.xlsx` by county/class |

**Ingest:** `python -m ingest.adapters.ca_cslb --input-dir data/raw/ca_contractors` → `data/staging/ca_cslb/`

## Arizona — ROC (statewide current active)

**Arizona licenses contractors statewide through the Registrar of Contractors (ROC).** This product extract uses the official free **current active contractor posting list** CSVs (residential, commercial, and dual licenses).

→ **[DATA_SOURCES_AZ.md](./DATA_SOURCES_AZ.md)** · product: **[ARIZONA_VERIFY_V1.md](./ARIZONA_VERIFY_V1.md)**

| Resource | URL | Notes |
|----------|-----|--------|
| ROC Posting List | https://roc.az.gov/posting-list | Free bulk current active CSVs |
| ROC contractor search | https://azroc.my.site.com/AZRoc/s/contractor-search | Human confirm |
| ROC home | https://roc.az.gov/ | Board + consumer info |

**Ingest:** `python scripts/download_az_roc.py` (or manual browser download) + `python -m ingest.adapters.az_roc` → `data/staging/az_roc/`

## Permits (local)

County / city open data portals (building permits) for activity volume and complaint adjacency. Prioritize high-volume FL counties after license core is stable.

## Provenance rules

1. Store `source_system`, `source_file`, `source_url`, `extracted_at` on every load batch
2. Never overwrite official license numbers or disposition text
3. Prefer latest board extract; keep prior batch ids for audit
