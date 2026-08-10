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

## New Jersey — DCA

| Resource | Notes |
|----------|--------|
| NJ DCA contractor registration | Public contractor / home improvement registration lists |
| Use | Wave-2 state after FL pipeline is solid |

## Permits (local)

County / city open data portals (building permits) for activity volume and complaint adjacency. Prioritize high-volume FL counties after license core is stable.

## Provenance rules

1. Store `source_system`, `source_file`, `source_url`, `extracted_at` on every load batch
2. Never overwrite official license numbers or disposition text
3. Prefer latest board extract; keep prior batch ids for audit
