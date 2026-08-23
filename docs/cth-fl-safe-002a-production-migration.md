# CTH-FL-SAFE-002A Production Migration Attempt

## Result

**BLOCKED — PRODUCTION DRIFT. Migration 008 was not applied.**

The bounded production preflight ran on 2026-08-23 UTC from Git SHA
`2760230dd763695449287ee73642054af8c01fa6`. It found that the task's expected
whole-table `discipline_actions` population no longer matched production. The
transactional migration phase was therefore not entered.

## Execution controls

- Database: verified ContractorTrustHub production PostgreSQL
- PostgreSQL version: 17.6
- Migration reviewed: `schema/migrations/008_fl_adverse_evidence_safety.sql`
- Migration SHA-256: `8332755784a0b87ab94917c58880e56c167394ca95627b854d578d0e444566c7`
- Preflight transaction: repeatable-read, read-only
- Preflight statement timeout: 30 seconds
- Intended migration lock timeout: 5 seconds (not exercised)
- Intended migration statement timeout: 60 seconds (not exercised)
- Migration state before execution: NOT APPLIED
- Migration committed: NO
- Database mutation performed: NO

## Pre-migration snapshot

| Measure | Expected by task | Observed production |
|---|---:|---:|
| Total discipline rows | 1,541 | 3,134 |
| License-linked | 987 | 1,446 |
| Contractor-linked | 0 | 1,593 |
| Both license and contractor linked | 0 | 459 |
| Neither linked | 554 | 554 |

Relationship fingerprint (stable IDs only):
`sha256:7b51b5d9e117c2efb842552d0d564f3d29adaa95059f9d432b6535abe2c6faf2`

The source breakdown explains the difference:

| Source | Dataset | Total | License-linked | Contractor-linked | Neither |
|---|---|---:|---:|---:|---:|
| `az_roc` | `roc_disciplinary_actions` | 459 | 459 | 459 | 0 |
| `fl_dbpr` | `contractor_disc_lic` | 1,541 | 987 | 0 | 554 |
| `nj_enforcement` | `dca_standard_files_discipline_flag` | 1,134 | 0 | 1,134 | 0 |

The Florida subset still matches the accepted baseline, including zero
contractor-linked Florida rows. However, migration 008 targets the entire
`discipline_actions` table, so its defaults and post-migration assertions would
apply to 3,134 existing rows rather than the task-authorized 1,541. Proceeding
would have exceeded the explicitly verified mutation scope.

## Migration review

Migration 008 remains additive. It adds 13 fail-closed safety columns, three
check constraints, and `discipline_publication_gate_idx`. It does not update
`license_id` or `contractor_id`, delete rows, publish evidence, ingest records,
or alter unrelated tables. Existing rows would default to `UNRESOLVED` and
`INTERNAL`. Because production drift was detected, none of these changes were
executed.

## Production configuration and health

- Production deployment SHA: `2760230dd763695449287ee73642054af8c01fa6`
- `REGULATORY_PUBLICATION_GATE_V1`: absent from production environment; gate OFF
- Homepage: HTTP 200
- Florida landing page: HTTP 200
- Florida discovery sample (`/florida/miami-dade`): HTTP 200
- Three bounded Florida contractor profile samples: HTTP 200
- Florida adverse rows with `contractor_id`: 0
- Current Florida public adverse exposure: 0
- Manual deployment: NO

## Required follow-up

Before retrying SAFE-002A, approve a revised whole-table migration baseline that
explicitly includes the existing Arizona and New Jersey regulatory rows, and
update the expected post-migration fail-closed state counts from 1,541 to the
then-current complete `discipline_actions` population. No Florida link
correction or regulatory backfill is required to resolve this blocker.
