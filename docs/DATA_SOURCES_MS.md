# Mississippi data sources — State Board of Contractors

Florida remains the full-journey product. Mississippi Verify is a **statewide State Board of Contractors (MSBOC)** lookup — not a marketplace and not a ranking.

## Coverage reality

| What Mississippi has statewide | What this extract is not |
|--------------------------------|--------------------------|
| MSBOC commercial, residential, and roofer credentials | A live check at page load |
| Official public consolidated search + “View Results In Excel” | A posted open-data CSV on data.gov |
| Type, license number, status, mailing address, phone | Proof of current bond or insurance |
| Interactive lookup for confirmation | A complaint / discipline archive |
| Classification codes on Advanced Search / detail | A substitute for the official board lookup |

**Product rule:** Mississippi *does* license contractors statewide through the State Board of Contractors. Still confirm current status and classifications on the official MSBOC lookup before hiring.

## Official sources (preferred)

| Resource | URL | Notes |
|----------|-----|--------|
| Board home | https://www.msboc.us/ | Commercial, residential, and roofers |
| Public search | http://search.msboc.us/ConsolidatedSearch.cfm | Official lookup form |
| Public results | http://search.msboc.us/ConsolidatedResults.cfm | Official list; **View Results In Excel** |
| Hire / search link | https://www.msboc.us/consumers/hire-a-contractor/ | Points consumers at the search |
| Classifications | https://www.msboc.us/classifications/ | Major vs specialty |
| Public information | https://www.msboc.us/public-information/ | Public-records policy; no posted bulk CSV |

**Prefer:** official Excel / list-view export from the consolidated search.  
**Avoid:** scraping the interactive search as the primary source when the Excel export is available.  
**Not used:** third-party aggregators.

There is **no** Socrata / data.ms.gov contractor roster. The board’s public extract is the consolidated search (HTML table or Excel). Google-indexed official result pages report **Records … of 38709** (2026).

`search.msboc.us` is Cloudflare-protected. Automated download from datacenter IPs often receives a challenge page. Re-run `scripts/download_ms_sbc.py` from a browser-capable network, or save the official Excel into `data/raw/ms_sbc/` and pass `--from-file`.

## License structure (published types)

The official search offers **Commercial** and **Residential** (`searchType=Commercial|Residential`). Roofers are part of the same board. List-view **Type** is Commercial or Residential.

Commercial license numbers often carry an official suffix:

| Suffix | Meaning (as published on the number) | Product class |
|--------|--------------------------------------|---------------|
| `-MC` | Major commercial | `MC` |
| `-SC` | Specialty commercial | `SC` |

Residential numbers are often a numeric core only (e.g. `01260`, `03052`). Board instructions: enter **numbers only** — no letter prefix/suffix.

### Classification codes (Advanced Search / board classifications page)

These appear on Advanced Search and detail views. They are **not reliably on the list-view Excel**. Do not invent them.

**Residential (published codes):**

| Code | Published label |
|------|-----------------|
| `I` | (residential class on Advanced Search) |
| `R` | Remodeler |
| `B` | Residential builder |
| `S123` | Roofing |

**Commercial majors (published codes):**

| Code | Published label |
|------|-----------------|
| `B` | Building construction |
| `C` | Heavy |
| `A` | Highway, street and bridge |
| `E` | Electrical work |

Many `S###` specialty codes exist on the classifications page. Product v1 stores `ClassCode` / `Qualifier` only when the official extract includes those columns.

## Status values (official search filter)

Published status filter options on the live search (2026):

| Published status | Product `status_normalized` |
|------------------|-----------------------------|
| Licensed / Licensed - Active | `active` |
| Licensed - Inactive / Inactive | `inactive` |
| Licensed Expired / Licensed - Expired | `expired` |
| R - Revoked / Revoked | `revoked` |
| S - Suspended / Suspended | `suspended` |
| U - Unlicensed / Unlicensed | `unlicensed` |

## Columns observed (official list view)

| Field | Description |
|-------|-------------|
| Type | Commercial or Residential |
| Company Name | Business / person name |
| License Number | Official number, including `-MC` / `-SC` when published |
| Status | Licensed, Licensed Expired, Inactive, Revoked, Suspended, Unlicensed |
| Address, City, State, Zip | Mailing location (State may be outside MS) |
| Phone | As published (stored on payload; not used for lead-gen) |
| ClassCode | Only when present on Advanced / Excel |
| Qualifier | Qualifying party — only when present |

**Not on the list view:** bond, insurance, discipline, expiration date as a first-class column (expiration may appear on detail), full specialty class list.

**Stable product key:** `MS-SBC:{COM|RES}:{LicenseNumber}` — type is part of the key because commercial and residential can share a numeric core. Official `-MC` / `-SC` suffixes are kept on the number. Unlicensed rows with no number use `MS-SBC:UNLIC:{digest}` (not an invented license number).

## Qualifying party / location

- **City / mailing state / ZIP** are first-class on the list view.
- **Qualifying party** appears on Advanced Search / detail, not reliably on the list view. Do not invent it.
- Mailing `State` can be AL, LA, TN, etc. The **credential is still Mississippi MSBOC**. Product `home_state` is always `MS`.

## Bond / insurance / entity limitations

- The list view does **not** publish bond or insurance. Do not invent them.
- Phone is a contact field as published — not a COI.
- Always re-check on [MSBOC search](http://search.msboc.us/ConsolidatedSearch.cfm).

## Provenance

1. `source_system = ms_sbc`
2. Store source URL, file, SHA-256, `extracted_at` on `ingest_batches`
3. Never invent license numbers, classifications, discipline, bond, or insurance

## Ingest path

```bash
python scripts/download_ms_sbc.py
# or, after saving the official Excel / CSV from a browser:
python scripts/download_ms_sbc.py --from-file path/to/msboc_results.xls
python -m ingest.adapters.ms_sbc --input data/raw/ms_sbc/msboc_contractor_list.csv
python scripts/load_ms_sbc_to_postgres.py --staging-dir data/staging/ms_sbc
```

Sample (committed): `data/samples/ms_sbc_contractor_sample.csv`

**Production (2026-08-14):** official Excel `data/raw/msboc/msboc_results.xls` → **8,242** `ms_sbc` licenses (3,425 Licensed · 4,544 Licensed Expired · 257 unlicensed · 14 revoked · 2 suspended). See [MISSISSIPPI_VERIFY_V1.md](./MISSISSIPPI_VERIFY_V1.md).

## Related

- Index: [DATA_SOURCES.md](./DATA_SOURCES.md)
- Product: [MISSISSIPPI_VERIFY_V1.md](./MISSISSIPPI_VERIFY_V1.md)
- Ingest conventions: [../ingest/README.md](../ingest/README.md)
