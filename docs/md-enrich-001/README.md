# MD-ENRICH-001 — Miami-Dade business-website enrichment

Publishes the Founder-reviewed Miami-Dade enrichment (273 strict + 1,164 partial = 1,437 existing
contractor profiles; the 184 hold rows are not in the input and are never loaded) as additive,
provenance-tracked observations on the Contractor Trust Report.

The raw inputs contain business phone numbers and emails and are **not** in this public repository.
They live in a private operator directory and are pinned by SHA-256 inside the loader:

| file | rows | sha256 |
|---|---|---|
| miami-dade-publish-ready-2026-10-06.csv | 1,437 | b1a2ee4497542c5be04fba98485f469e61cc244417f39afda1afcc02608a38c4 |
| miami-dade-publish-ready-2026-10-06.json | 1,437 | 16e09a48250005ce18233d871fba3c09c42abd213e07cc2edd8685b0ce0267c7 |
| miami-dade-publish-ready-flagged-2026-10-06.csv | 528 | 8965b32a799df36b354c33f718bf5ab07ad8933190a27edd0edff294b73f89ae |

## Storage

`schema/migrations/017_contractor_enrichment_observations.sql`: one new table, RLS on, no
anon/authenticated privileges, FK to `contractors(id)`. Nothing is written to `contractors` or
`licenses`. The idempotency key is `(contractor_id, field, value_normalized, batch_id)`.

The existing `public_contact_observations` table was not reused. It is keyed by license rather than
contractor, its `kind` check has no specialty, it has no batch or suppression column, and its
unique key ignores the batch, so a batch could not be removed cleanly.

- `source_system` = `scout_web_enrich_md_2026_10`
- `batch_id` = `md-enrich-001-2026-10-06`
- `observed_at` = the frozen Scout snapshot time, 2026-10-05 21:08 ET

### Mapping from the reviewed file

| file column | field | rule |
|---|---|---|
| website_url | website | one per profile |
| phone | phone | split on `;` (8 cells list several numbers) |
| email | email | one per profile |
| additional_locations | address_location | one per non-empty cell, displayed verbatim |
| specialties | specialty | split on `\|`, deduplicated within the profile |
| primary_address | — | not loaded; the DBPR primary address stays authoritative |

**Identity gate.** A row loads only if `contractor_id` exists **and** an `fl_dbpr` license on that
contractor has `external_key = license_key`, with no other contractor owning that key. Rows are
never matched by name.

**Suppression.** For the 8 Founder-suppressed profiles, `website`, `phone` and `email` load with
`is_suppressed = true`. Their `address_location` is also suppressed, because it was taken from the
same likely-different-company website (one is an Arizona franchise HQ). Specialties publish.
Suppression is a flag, so lifting it needs no reload (see the rollback SQL).

## Receipts (counts / license keys only)

- `dry-run-production-receipt.json`: read-only dry run against production.
- `preview-load-1-receipt.json`, `preview-reload-receipt.json`: isolated preview database (throwaway
  PostgreSQL 17 built from the production catalog plus the 1,437 target profiles and 5 non-enriched
  control profiles).

| | planned | public | suppressed | profiles |
|---|---:|---:|---:|---:|
| website | 1,437 | 1,429 | 8 | 1,437 |
| phone | 1,390 | 1,384 | 6 | 1,381 |
| email | 1,086 | 1,079 | 7 | 1,086 |
| address_location | 534 | 527 | 7 | 534 |
| specialty | 7,244 | 7,244 | 0 | 1,430 |
| **total** | **11,691** | | 28 | |

- Identity: 1,437 / 1,437 matched, 0 excluded.
- Existing non-empty `contractors.phone` / `website` on target profiles: 0, so there are 0 conflicts.

## Preview verification

- **Migration:** applied, then re-applied as a no-op. Result: 17 columns, RLS on, 0 public grants;
  `SET ROLE anon` gets *permission denied*.
- **Load cycle:**
  1. Load inserted 11,691 rows, equal to the dry run.
  2. Rerunning the same batch inserted 0.
  3. Rollback deleted 11,691, leaving 0.
  4. Reload inserted 11,691.
  5. `scripts/sql/md-enrich-001-rollback.sql` deleted 11,691, leaving 0.
  6. A final reload inserted 11,691 again.
- **Data integrity:** after the load, the `contractors` and `licenses` rows for all 1,442 preview
  profiles hash identical to production (UTC md5 over id, slug, name, phone, website, status,
  address and timestamps).
- **Write guards:** the loader refuses a non-local write without `--production`, and refuses an
  input directory inside the repository.
- **Profile smokes** (`next dev` on the preview database, HTML assertions plus 1440px and 390px
  renders with no horizontal scroll):
  - Phorcys Builders CGC1526767: other location shown, DBPR primary address unchanged.
  - Blue Diamond Air Condition CAC042703.
  - Thermal Concepts CMC1251535: other location shown.
  - Florida Delta Mechanical CFC1425917: no website, phone, email, location or source link;
    specialties shown.
  - A.K.G. Inspection Services CCC042809: no email row and no placeholder.
  - A non-enriched control profile renders unchanged with no section.
  - Sweep of all 8 suppressed profiles: no website host, phone, email or location in the page HTML.
- **Smoke fix:** the smokes caught source links resurfacing a suppressed website through specialty
  `source_refs`. Source links now render only when the website itself is public, and a unit test
  covers this.

## Operating

```bash
# dry run (default)
python scripts/md_enrich_001/load.py --input-dir <private dir> --database-url-env DATABASE_URL
# production
python scripts/apply_migration_017.py --production
python scripts/md_enrich_001/load.py --input-dir <private dir> --apply --production --receipt <path>
# rollback (one bounded statement)
python scripts/md_enrich_001/load.py --input-dir <private dir> --rollback --production
```
