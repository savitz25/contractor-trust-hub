# NJ-CON-001 runbook

Public-works registration and exclusion sources. Evidence only. No `/new-jersey` UI, sitemap, score, or badge.

## Commands

```bash
# Official downloads (WALL, Watchlist, Treasury). PWCR / PW debarment stay blocked unless a local CSV is supplied.
python scripts/nj_con_001_ingest.py --mode official-download --dry-run

# Local files already under data/raw/nj_public_works/
python scripts/nj_con_001_ingest.py --mode local-input --dry-run

# Optional: identity against a full nj_dca licenses_normalized.csv
python scripts/nj_con_001_ingest.py --mode local-input --dry-run --licenses-csv data/staging/nj_dca/licenses_normalized.csv

# Postgres (requires working DATABASE_URL)
python scripts/apply_migration_013.py
python scripts/nj_con_001_ingest.py --mode local-input --execute
python scripts/nj_con_001_ingest.py --mode local-input --execute   # second run: unchanged

python -m unittest scripts.test_nj_con_001
```

PWCR local CSV path if an OPRA file arrives: `data/raw/nj_public_works/nj_pwcr_registration.csv`  
Prevailing-wage debarment CSV: `data/raw/nj_public_works/nj_prevailing_wage_debarment.csv`  
Required headers are documented in `ingest/adapters/nj_public_works.py`.

## Reconciliation SQL (after execute)

Tables are generic (`official_source_snapshots` / `official_source_observations` / `official_source_occurrences`), not NJ-only clones of Florida `discipline_actions`. Source family stays on each row. Duplicate official watchlist rows are unique observations by fingerprint and retain every file locator as an occurrence.

```sql
SELECT source_family, COUNT(*) FROM official_source_observations GROUP BY 1 ORDER BY 1;
SELECT source_family, match_method, COUNT(*) FROM official_source_observations GROUP BY 1,2 ORDER BY 1,2;
SELECT COUNT(*) FROM official_source_observations WHERE contractor_id IS NULL;
SELECT o.source_family, COUNT(*) AS occurrences, COUNT(DISTINCT o.observation_id) AS observations
FROM official_source_occurrences o
JOIN official_source_observations s ON s.id = o.observation_id
GROUP BY 1;
-- Absence from a snapshot is not a clean history.
```

## Fingerprint formula

`SHA-256(JSON({source_family, ...canonical official fields sorted}))`  
Canonicalization trims whitespace and normalizes CRLF only. No case folding.

Treasury construction/vendor: official fields listed in `TREASURY_FIELDS`.  
WALL: name + principal address + violation type + posted date + liability.  
Watchlist: name + address + nature + status + final-order date.

## Identity

- Exact: stored PWCR certificate or stored Treasury vendor ID (not a DCA HIC number).
- High-confidence: exact normalized legal name + exact normalized address, or unique name+ZIP.
- Review-required: name+city, individual-to-business, multiple ZIP hits.
- Unresolved: name-only (never auto-attached). Unmatched source rows are kept.

## Do not

- Merge WALL with prevailing-wage debarment
- Call a watchlist row a debarment
- Import Treasury MEDICAL / PROFESSIONAL categories
- Mint contractors from exclusion rows
- Publish Public Works Vetted / Government Approved language
