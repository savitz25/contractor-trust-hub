# Arizona Full Journey v1 — Explore + Verify

Florida remains the deepest product (plan, studios, permits, passport). Arizona v1 adds **browse + project matching** on top of live ROC Verify. It is not Florida-depth.

## What is live

| Surface | Route | Status |
|---------|--------|--------|
| Verify | `/verify?state=az` | Unchanged — license / name search |
| Landing | `/arizona` | County, major city, trade, project chips |
| Geo | `/arizona/{county-or-city}` | City-derived county + dedicated city pages |
| Trade | `/arizona/{trade}` | Published ROC class families |
| Geo + trade | `/arizona/{geo}/{trade}` | Combined filter |
| Project | `/arizona/projects/{project}` | Primary class map + also-needed |
| Geo + project | `/arizona/{geo}/{project}` | Combined filter |
| Trust Report | `/contractors/{slug}?project=` | Thin AZ report + linked discipline + project note |

## Geo method

The ROC posting list has **city** (and ZIP) and almost **no county**. Product copy states this on the landing page, county pages, city pages, and thin/empty geo states.

- County browse rolls up a maintained **city → county** map (`lib/arizona/geos.ts`). Not an official ROC county field.
- Major-city browse matches that city only. Landing leads with the ten densest markets.
- City of Maricopa and San Tan Valley → **Pinal**. Apache Junction → Pinal (majority). Queen Creek → Maricopa (majority).
- Out-of-state mailing cities and unmapped towns are omitted from county totals.

Interactive map is deferred.

## Project → class map

Maintained in `lib/arizona/projects.ts`. Result notes lead with plain language, then official class codes (`matchHeadline` + `officialLabel`). Primary published classes first. Secondary classes are included only when a view has fewer than five primary matches. Also-needed chips link to related trade pages — not a ranking.

## Active-first

Discovery lists default to `status_normalized IN ('active','current')`. Revoked / suspended rows remain on Verify and on Trust Reports when linked.

## Discipline

Linked ROC disciplinary-action rows (time-window extract) show on result cards when present and on Trust Reports. Absence is **not** advertised as a clean history.

## Homepage

Arizona is badged **Explore + Verify**, not Verify-only. Explorer entry: `/arizona`. Do not claim Cost Studios, Plan parity, or permit intelligence.

## Deferred

- Interactive AZ map
- Cost Studios / Plan / Passport / permit intelligence
- Full historical inactive archive
- Bond / insurance / COI
- Arizona Corporation Commission entity linking
- Complete disciplinary history

## Refresh

Same ROC ingest as Verify:

```bash
python scripts/download_az_roc.py
python -m ingest.adapters.az_roc --input data/raw/az_roc/roc_all_current.csv --out-dir data/staging/az_roc
python scripts/load_az_roc_to_postgres.py --staging-dir data/staging/az_roc
```
