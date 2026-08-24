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

---

## SUCCESSFUL PRODUCTION MIGRATION

Migration 008 was applied successfully to the verified ContractorTrustHub
production database on 2026-08-24 UTC.

### Execution identity and controls

- Git SHA: `824435b30fec1dbdd9f15a23feaa8c2f21b45502`
- Migration SHA-256: `1b110240c4487bbb3dfe74ac2ef893aca3defbc93afaedd23aad3732133adeb8`
- PostgreSQL version: 17.6
- Transaction started: `2026-08-24T00:00:06.832455+00:00`
- Transaction committed: `2026-08-24T00:00:08.289344+00:00`
- Independent verification completed: `2026-08-24T00:00:09.824795+00:00`
- Lock timeout: 5 seconds
- Migration statement timeout: 60 seconds
- Pre/post verification statement timeout: 30 seconds
- Migration state before: NOT APPLIED
- Migration state after: APPLIED AND VERIFIED
- Rollback required: NO

### Shared-table population

All row and linkage counts were identical before and after migration.

| Source | Dataset | Total | License-linked | Contractor-linked | Both | Neither |
|---|---|---:|---:|---:|---:|---:|
| `az_roc` | `roc_disciplinary_actions` | 459 | 459 | 459 | 459 | 0 |
| `fl_dbpr` | `contractor_disc_lic` | 1,541 | 987 | 0 | 0 | 554 |
| `nj_enforcement` | `dca_standard_files_discipline_flag` | 1,134 | 0 | 1,134 | 0 | 0 |
| **Whole table** | — | **3,134** | **1,446** | **1,593** | **459** | **554** |

### Relationship fingerprints

Fingerprints use only stable `id`, `source_system`, `license_id`, and
`contractor_id` values in deterministic order. Every pre/post pair matched.

| Scope | Pre/post SHA-256 fingerprint |
|---|---|
| Whole table | `sha256:9cc3d5aa52819feaa35c86a083071e1e860e65d29e705905358b4eb36f20e0c4` |
| Florida | `sha256:d698f6c4a1887decf3f3dfb128f2020f7d1804394c8e58ec3c05174325422475` |
| Arizona | `sha256:f7316a640891009e8a6f671fb0c9088c18308ae7212ca1d0c20c543266b58b02` |
| New Jersey | `sha256:a319948c6760227eb9c1180ee2e4adce3025b901b2b562df71904d6c55af3dbf` |

### Florida initialization

Exactly 1,541 `fl_dbpr` rows received Florida-v1 safety metadata:

- `identity_state='UNRESOLVED'`: 1,541
- `publication_state='INTERNAL'`: 1,541
- `publication_state='PUBLIC_ELIGIBLE'`: 0
- `publication_state='WITHHELD'`: 0
- `correction_hold=FALSE`: 1,541; true: 0
- `retraction_hold=FALSE`: 1,541; true: 0

Florida `license_id` and `contractor_id` values were unchanged. Florida
contractor-linked rows and publicly reachable adverse rows remain zero.

### Non-Florida isolation

- Arizona rows with any of the four state/hold fields non-null: 0 of 459
- New Jersey rows with any of the four state/hold fields non-null: 0 of 1,134
- Other non-Florida source systems discovered: none

NULL continues to mean that a non-Florida row was not evaluated under Florida
safety contract v1.

### Schema verification

All 13 safety columns exist. The following constraints exist and are validated:

- `discipline_actions_identity_state_check`
- `discipline_actions_publication_state_check`
- `discipline_actions_fl_hold_state_check`
- `discipline_actions_public_eligibility_check`

`discipline_publication_gate_idx` exists and is restricted to
`source_system='fl_dbpr'` and `publication_state='PUBLIC_ELIGIBLE'`.

Migration 008 is now immutable. Any later schema adjustment requires a new
numbered migration.

### Publication and production health

- `REGULATORY_PUBLICATION_GATE_V1`: absent/OFF
- Florida public eligible rows: 0
- Florida publicly reachable adverse rows: 0
- Production deployment SHA: `824435b30fec1dbdd9f15a23feaa8c2f21b45502`
- Homepage, Florida landing/discovery, two Florida profiles, Arizona landing,
  two Arizona profiles, Verify, and two New Jersey profiles: HTTP 200
- Database/schema-query errors observed: none
- Arizona behavior regression: none observed
- New Jersey behavior regression: none observed
- Manual deployment: NO
- Regulatory ingestion: 0
- Identity/link corrections: 0
