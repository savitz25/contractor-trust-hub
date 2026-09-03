# CA-CON-COUNTY-001A — San Francisco + San Diego harvest

Internal data foundation. **No public county routes.**

Namespaces: `sf-sd`, `san-francisco`, `san-diego`. Does not touch Los Angeles / Santa Clara files.

## CSLB spine

Acquired partial master: **75,572** licenses (`ACQUIRED_PARTIAL_STREAM_TRUNCATED`). A local license absent from this extract is **not** unlicensed.

## San Francisco (city-county)

| Source | Grain | Rows | Hash prefix |
|---|---|---|---|
| DataSF `g8m3-pdis` registered businesses | location | 366,307 | `48e62d70` |
| DataSF `i98e-djp9` building permits | permit at address | 1,294,909 | `bc85fa94` |
| DataSF `3pee-9qhc` permit contacts | contact/agent | 1,032,543 | `055fc442` |
| DataSF `vckc-dh2h` inspections | inspection event | 702,749 | `45c139c6` |

Permit file has **no contractor license**. Exact CSLB is on contacts `License1`/`License2`: **2,729** distinct licenses in the acquired spine; **20,450** distinct source licenses not in the partial spine.

Inspections join by permit/parcel. **PASSED ≠ contractor passed.**

## City of San Diego (not county)

Year-filtered **created** approvals 2024–2026: **172,453** approval rows / **39,612** projects. Full 653MB created file not stored (disk). Permit holder is a **contact name**; almost no CSLB numbers.

Business tax: **59,321** active + **104,083** inactive since 2015. Certificate ≠ trade license.

Rental unit tax accounts: **328,337** APN/address rows. No owner dossiers.

## Publication (not this ticket)

- San Francisco → `PUBLISH_DEDICATED_COUNTY_PAGE`
- City of San Diego → `PUBLISH_LIGHT_MARKET_MODULE`
- San Diego County → `PARK`
