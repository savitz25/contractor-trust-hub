# CTH-FL-SAFE-002A Production Migration Attempt and Scope Correction

## Blocked production attempt

**BLOCKED — SHARED-TABLE MIGRATION SCOPE. Migration 008 was not applied.**

The bounded production preflight ran on 2026-08-23 UTC from Git SHA
`2760230dd763695449287ee73642054af8c01fa6`. The whole-table
`discipline_actions` population did not match the Florida-only task assumption,
so the transactional migration phase was never entered. The Florida population
had not drifted; the table also contained existing Arizona and New Jersey rows.

### Execution controls

- Database: verified ContractorTrustHub production PostgreSQL
- PostgreSQL version: 17.6
- Migration: `schema/migrations/008_fl_adverse_evidence_safety.sql`
- Original migration SHA-256: `8332755784a0b87ab94917c58880e56c167394ca95627b854d578d0e444566c7`
- Preflight transaction: repeatable-read, read-only
- Preflight statement timeout: 30 seconds
- Intended migration lock timeout: 5 seconds (not exercised)
- Intended migration statement timeout: 60 seconds (not exercised)
- Migration state before execution: NOT APPLIED
- Migration committed: NO
- Database mutation performed: NO

### Pre-migration snapshot

| Measure | Florida-only task assumption | Observed shared table |
|---|---:|---:|
| Total discipline rows | 1,541 | 3,134 |
| License-linked | 987 | 1,446 |
| Contractor-linked | 0 | 1,593 |
| Both license and contractor linked | 0 | 459 |
| Neither linked | 554 | 554 |

Relationship fingerprint (stable IDs only):
`sha256:7b51b5d9e117c2efb842552d0d564f3d29adaa95059f9d432b6535abe2c6faf2`

| Source | Dataset | Total | License-linked | Contractor-linked | Both | Neither |
|---|---|---:|---:|---:|---:|---:|
| `az_roc` | `roc_disciplinary_actions` | 459 | 459 | 459 | 459 | 0 |
| `fl_dbpr` | `contractor_disc_lic` | 1,541 | 987 | 0 | 0 | 554 |
| `nj_enforcement` | `dca_standard_files_discipline_flag` | 1,134 | 0 | 1,134 | 0 | 0 |

The Florida subset still matched its accepted baseline, including zero
contractor-linked Florida rows and zero public Florida adverse exposure.

## Root cause

The original migration was additive but used table-wide non-null defaults. It
would have labeled Arizona and New Jersey rows `UNRESOLVED` and `INTERNAL` under
a Florida-specific safety contract. That would have been semantically
misleading even though relationships and current visibility were unchanged.

## SAFE-002A-R migration revision

Migration 008 was revised before its first production application. Repository
conventions do not prohibit revising an unapplied migration, and a corrective
migration for a schema production never received would obscure the actual
first-application contract.

- Accepted scope-correction SHA-256: `89f312b880f449e7f1315fe29e73c094efa77c440583bd5f7f0adbb634d2a416`
- Final migration SHA-256: `1b110240c4487bbb3dfe74ac2ef893aca3defbc93afaedd23aad3732133adeb8`
- Final checksum change: deployment-order comment correction only; SQL behavior unchanged
- Original applied to production: NO
- Production migration state at revision: NOT APPLIED
- Reason: `discipline_actions` is shared by Florida, Arizona, and New Jersey

The revised migration keeps all 13 safety fields nullable at the shared-table
level, then initializes only existing `source_system='fl_dbpr'` rows to
`UNRESOLVED` / `INTERNAL` with both holds false. Florida-scoped constraints
require valid non-null states and holds for Florida rows and enforce the
Florida public-eligibility contract. The partial publication index is also
restricted to Florida.

The application read path may be deployed before this migration only while
`REGULATORY_PUBLICATION_GATE_V1` remains OFF. Migration 008 must precede any
Florida regulatory backfill, any production run of the safety-aware Florida
loader, and any activation of that publication feature gate.

Non-Florida rows remain NULL in these columns, meaning **not evaluated under
Florida safety contract v1**. The revised migration does not modify
`license_id`, `contractor_id`, source identifiers, complaints, dispositions, or
raw payloads. It does not change Arizona or New Jersey visibility semantics.

## Read-only impact simulation

If applied to the measured production snapshot, the revised initialization
would affect:

| Source | Rows receiving Florida-v1 safety metadata |
|---|---:|
| Florida DBPR | 1,541 |
| Arizona ROC | 0 |
| New Jersey enforcement | 0 |

Expected relationship changes: 0. Expected schema-migration visibility changes:
0. The Florida publication feature gate remains OFF.

## Production configuration and health at blocked attempt

- Production deployment SHA: `2760230dd763695449287ee73642054af8c01fa6`
- `REGULATORY_PUBLICATION_GATE_V1`: absent; gate OFF
- Homepage, Florida landing/discovery, and three bounded profiles: HTTP 200
- Florida adverse rows with `contractor_id`: 0
- Current Florida public adverse exposure: 0
- Manual deployment: NO

## Validation limitation and next step

No disposable local PostgreSQL server or Docker runtime was available. The
revised migration therefore received static SQL validation, source-scoped
contract tests, application tests, and a read-only production impact
simulation; it was not executed against any database during SAFE-002A-R.

Merge and review this corrected design before retrying SAFE-002A. The next
production attempt must verify every shared-table relationship remains
unchanged, initialize only the then-current `fl_dbpr` population, and verify
non-Florida rows retain NULL Florida-v1 metadata.
