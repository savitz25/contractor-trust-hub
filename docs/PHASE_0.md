# Phase 0 — Foundation

## Objective

Stand up Contractor Trust Hub’s data backbone before product UI:

- Exact public-source inventory
- Postgres schema for licenses, entities, discipline, permits, trust scores
- First production-quality ingest adapter: **Florida DBPR Construction**

## In scope

| Item | Status |
|------|--------|
| Repo + docs scaffold | Done |
| `schema/initial_schema.sql` | Done (refined against real FL extract) |
| FL DBPR licensee sample + field profile | Done |
| `ingest/adapters/fl_dbpr.py` | Done |
| Discipline extract staging (licensee discipline FY files) | Adapter hooks + docs |
| Sunbiz entity linkage | Documented; adapter later |
| NJ DCA / permits | Documented; not built in Phase 0 |

## Out of scope (Phase 0)

- Full multi-state product UI
- Perfect coverage of every FL specialty board
- Invented contractor “scores” without transparent inputs
- Scraping behind logins or CAPTCHAs

## Success criteria

1. Repo on GitHub `main` with schema, docs, and FL adapter
2. Real FL DBPR fields documented from an official download (not guessed)
3. Adapter produces normalized staging CSVs with stable keys
4. Schema can load staged licenses + discipline without inventing columns

## Bridge to Phase 1

Postgres load path: [LOAD_PATH.md](LOAD_PATH.md) and `scripts/load_fl_dbpr_to_postgres.py`.

## Wave-1 markets

1. **Florida** — DBPR CILB construction licensees + discipline (primary)
2. New Jersey — DCA contractor registration (secondary, later)
3. Local permits — county open data where available (later)

## Tagline

**Before you hire, verify.**
