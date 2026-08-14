# Mississippi Verify v1 — State Board of Contractors

## What is live

| Surface | Status |
|---------|--------|
| Official public list download | `scripts/download_ms_sbc.py` → `data/raw/ms_sbc/` (`--from-file` if Cloudflare blocks) |
| Normalize / stage | `python -m ingest.adapters.ms_sbc` → `data/staging/ms_sbc/` |
| Postgres load | `scripts/load_ms_sbc_to_postgres.py` (`source_system = ms_sbc`) |
| State config | `EVIDENCE_STATES.ms` (aliases `ms` / `mississippi`) |
| Verify UI | `/verify?state=ms` (alias `mississippi`) |
| Trust Report | `/contractors/[slug]` when `home_state = MS` |

## Production load (2026-08-14)

Official MSBOC “View Results In Excel” file (`data/raw/msboc/msboc_results.xls`, ColdFusion HTML table, 2026-08-14). The file contains **8,244** list-view rows; the adapter kept **8,242** unique keys (2 same-name unlicensed collisions). Board search pages also advertise **~38,709** rows — this Excel is the official export that was saved, not a scrape of every search page.

| Code | Published type | Rows |
|------|----------------|------|
| RES | Residential (+ inactive label) | 3,042 |
| MC | Commercial (major, `-MC`) | 2,220 |
| SC | Commercial specialty (`-SC`) | 1,890 |
| COM | Commercial (no suffix) | 1,090 |
| **Total** | | **8,242** |

| Published type label | Rows |
|----------------------|------|
| Commercial | 5,154 |
| Residential | 2,902 |
| Residential (Inactive) | 140 |
| Commercial (Inactive) | 46 |

| Status | Rows |
|--------|------|
| expired (Licensed Expired) | 4,544 |
| active (Licensed) | 3,425 |
| unlicensed | 257 |
| revoked | 14 |
| suspended | 2 |

Class suffixes on the license number: **MC 2,220 · SC 1,890 · none 4,132**.

Keys: `MS-SBC:{COM\|RES}:{LicenseNumber}`. Unlicensed rows with no number use `MS-SBC:UNLIC:{digest}` — not an invented license number.

## Honest claims

**Do say:**

- Mississippi licenses contractors statewide through the State Board of Contractors.
- This search uses official MSBOC public list-view credentials.
- Type, status, class suffix, and city are **as published**.
- Always confirm on the official MSBOC lookup.

**Do not say:**

- That we verified a bond, insurance policy, qualifying party, or SOS filing.
- That a missing row means the person cannot work (full roster may not be loaded yet; always use the board lookup).
- Rankings, “best contractors,” or lead-gen.
- Invented disciplinary history.

## Out of scope (v1)

- Scraping Advanced Search / detail for every specialty class and qualifying party
- Bond / insurance / discipline
- Mississippi SOS entity linking
- Plan / Studios / Discovery / map
- Lead gen

## Search

- License number (e.g. `16945`, `16945-MC`) or `MS-SBC:…` keys
- Business / person name
- Result cards: published type (plain language + official code), status, location

Example searches (after load):

| Query | Expected |
|-------|----------|
| `/verify?state=ms&q=22954-MC` | 21 MACHINE AND FAB LLC — Licensed commercial major (Forest) |
| `/verify?state=ms&q=3S%20HOMES` | 3S HOMES, LLC — Licensed residential (Brandon) |
| `/verify?state=ms&q=18419-SC` | ZINSEL GLASS AND MIRROR LLC — Licensed commercial specialty |
| `/verify?state=ms` | Empty Verify with coverage banner + sample chips |

Trust Reports stay thin: published MSBOC type, status, and location only. Confirm on [MSBOC search](http://search.msboc.us/ConsolidatedSearch.cfm).

## Refresh

```bash
python scripts/download_ms_sbc.py
python -m ingest.adapters.ms_sbc --input data/raw/ms_sbc/msboc_contractor_list.csv --out-dir data/staging/ms_sbc
python scripts/load_ms_sbc_to_postgres.py --staging-dir data/staging/ms_sbc
```

If Cloudflare blocks the GET:

```bash
python scripts/download_ms_sbc.py --from-file path/to/official_export.xls
```

Confirm: `SELECT COUNT(*) FROM licenses WHERE source_system = 'ms_sbc';`

## Related

- Sources: [DATA_SOURCES_MS.md](./DATA_SOURCES_MS.md)
