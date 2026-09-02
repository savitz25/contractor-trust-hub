# NJ-CON-002B runbook

Statewide construction-permit **market intelligence**. A permit applicant, owner,
or address is not a contractor work history. Default attribution is `MARKET_ONLY`.

```bash
python -m unittest scripts.test_nj_con_002b
python scripts/nj_con_002b_ingest.py --sample
python scripts/nj_con_002b_ingest.py --acquire
python scripts/apply_migration_015.py   # production session only
python scripts/nj_con_002b_ingest.py --execute
```

Production: no authorized session in this ticket. Do not publish `/new-jersey`,
county pages, sitemaps, scores, badges, or public contractor permit histories.
Do not commit the multi-million-row CSV. Do not introduce Dropbox.

## Official source

- Landing: https://data.nj.gov/Reference-Data/NJ-Construction-Permit-Data/w9se-dmra
- Dataset ID: `w9se-dmra`
- Agency: NJ DCA Division of Codes & Standards
- Bulk CSV: https://data.nj.gov/api/views/w9se-dmra/rows.csv?accessType=DOWNLOAD
- Construction Reporter: https://www.nj.gov/dca/codes/reporter/building_permits.shtml

## Grain and key

Each row is a municipal permit **or** certificate record. Official mainframe
primary key is municipality code (`comu`) plus record ID. Socrata `pk` is that
concatenation. Permit numbers are not globally unique.

## Rolling window

Official metadata states records are purged 60 months after they were received.
Observed process dates in the current extract still include older rows. Never
hard-delete a previously acquired row because it is absent from a later snapshot.
Absence is not cancellation, revocation, completion, or withdrawal.

## Attribution

This source does not include contractor, license, applicant, owner, or property
address fields. Public contractor-to-permit attachments created by this ticket
must be zero.
