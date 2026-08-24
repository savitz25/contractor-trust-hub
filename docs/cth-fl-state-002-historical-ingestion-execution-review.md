# CTH-FL-STATE-002 historical licensed-discipline execution review

This is a production read-only execution review. It performs no ingestion,
publication evaluation, relationship mutation, Google call, or county work.

## Fresh official sources and exact delta

On 2026-08-24 all five `contractor_disc_lic` files were freshly downloaded
from Florida DBPR/CILB. Every request returned HTTP 200, every file had the
approved 17-column schema fingerprint
`sha256:b373171b1916c0b5e0e48a7e96ac6334fd01255fd0b8a3a69435a224bcf36345`,
and all approved row counts and SHA-256 checksums matched:

| Fiscal year | Rows | SHA-256 |
|---|---:|---|
| 2021-22 | 1,109 | `ab67307147fb2007b4751900d105773d7cf2cee83dece8b9ac6dca42096500d0` |
| 2022-23 | 1,534 | `cd733ddce04de63d76c5f123b1004990ddfd03f2260f32ccf9e26bd817c81884` |
| 2023-24 | 1,878 | `90a561929f6bf2821900ab0cb1b54177bcff43bd4f8b411fe608a9928b641de4` |
| 2024-25 | 1,541 | `189b0043984b25876bdbf6c814b5c6539db9374e3cd01e5c8e94e7777442c7ef` |
| 2025-26 | 395 | `1cecf33f0b5a5e329527dd2df723cb3ec658e60027d81805c765b639a55155f7` |

All 6,457 exact source-observation keys reconcile as 1,541 existing FY24-25
observations and 4,916 new observations: 1,109 + 1,534 + 1,878 + 0 + 395.
There are zero exact duplicates, v2 collisions, logical revision candidates,
or other review exceptions. The FY24-25 execution delta is strictly zero; no
new FY24-25 batch, action, observation, or occurrence is proposed. Logical
matter keys remain review hints and never collapse complaint detail.

## Current production and identity partition

The bounded repeatable-read/read-only snapshot found 3,134 discipline actions,
including Florida 1,541, Arizona 459, and New Jersey 1,134. Florida retains 987
license links, zero contractor links, 554 unattached rows, `EXACT` 523,
`DETERMINISTIC` 61, `REVIEW_REQUIRED` 376, `UNRESOLVED` 581, 403 correction
holds, and zero `PUBLIC_ELIGIBLE`. All 584 safely resolved current links agree.
The 1,541 legacy observations and occurrences validate 1,541/1,541 with zero
revision or supersession rows.

The 4,916 new rows resolve as follows:

| Fiscal year | EXACT | DETERMINISTIC | REVIEW_REQUIRED | UNRESOLVED |
|---|---:|---:|---:|---:|
| 2021-22 | 238 | 34 | 174 | 663 |
| 2022-23 | 400 | 52 | 306 | 776 |
| 2023-24 | 471 | 63 | 449 | 895 |
| 2024-25 | 0 | 0 | 0 | 0 |
| 2025-26 | 104 | 26 | 106 | 159 |
| **Total** | **1,213** | **175** | **1,035** | **2,493** |

All 1,388 safe license targets currently exist and match their expected DBPR
external keys. The other 3,528 rows have no proposed license target. The
resolver has no numeric-core-only, name-only, or fuzzy adverse matching path.

## Canonical execution and rollback manifests

The 4,916-entry stable-ID-only execution manifest fingerprint is
`sha256:d09a6c1ff1ffc1b92db998025e310401be045ed8910a9b255b20eb38e659c9fa`.
Two independent generations matched exactly. All proposed action, observation,
occurrence, batch, and external keys are internally unique and have zero
production collisions.

The four approved batch IDs are:

- 2021-22: `ab2725a6-d295-517a-8f4b-f50423d37730`
- 2022-23: `a61cd195-b737-5f08-9a80-be936a6f400c`
- 2023-24: `d6e4d46b-ba19-5dff-b842-793da3a6dfca`
- 2025-26: `0f3ca6ec-1255-5e28-a356-68569b1c7d79`

The prospective reverse-manifest fingerprint is
`sha256:f7efd16afa5c57533e364604b795d6c9c137fc9ca6ff8c2e3fa3a9164509bcac`.
It contains only the four new batch IDs and 4,916 IDs for each proposed table.
Rollback order is occurrences, observations, new discipline actions, then new
batches. It excludes all legacy rows and is not authorization to roll back.

## Dedicated insert-only executor

The generic loader is not approved for this operation because its discipline
path supports conflict updates and intermediate commits. The dedicated executor
defaults to a read-only review. Production requires `--execute`, the committed
manifest as `--manifest-input`, its exact fingerprint, all five source
checksums, new/current row counts, and the exact resolver partition.

The future execution is one repeatable-read transaction with a 5-second lock
timeout and bounded 180-second per-statement timeout. It has only INSERT paths:
four batches, 4,916 actions, 4,916 observations, and 4,916 occurrences (14,752
rows). There are no update, delete, upsert, periodic commit, contractor-link,
publication, or non-Florida mutation paths.
The four ordered insert phases use psycopg pipelined `executemany` calls with
exact affected-row assertions, avoiding thousands of serial network round trips
while preserving the single all-or-nothing transaction.

Immediately before insertion it key-locks the 1,541 legacy Florida actions,
locks and verifies all proposed safe license targets, revalidates fresh source
bytes and resolver results against the committed manifest, and rechecks every
UUID, observation key, and external key as absent. Unique constraints remain a
final race guard. Any stale target or collision rolls back the whole transaction.

## Predicted post-state

Successful execution predicts 8,050 whole-table and 6,457 Florida actions,
6,457 observations and occurrences, and 51 ingest batches. Florida identity
would be `EXACT` 1,736, `DETERMINISTIC` 236, `REVIEW_REQUIRED` 1,411, and
`UNRESOLVED` 3,074. Relationships would be 2,375 license-linked, zero
contractor-linked, and 4,082 unattached. Correction holds remain true for only
the 403 legacy rows; all 6,457 rows remain `INTERNAL` and `PUBLIC_ELIGIBLE` zero.

Predicted relationship/safety fingerprints are:

- whole: `sha256:078f0d84f76ecd5dc4b1b4fc717a3ffca5f88e18182b17510ebc8c1e4d9805fe`
- Florida: `sha256:c25f931b7c8d5371dc2d75497f0ef270487f4fbc46028bc87fd1da0ab73632ce`
- Arizona unchanged: `sha256:d5c456b2d6d60accef4f892ce2b95b1b23ca6a792cea0d8f0e2ee92f2bf8f6c3`
- New Jersey unchanged: `sha256:6aae90e88c656e664717442a32009e7010b71c378838690651242de3e37f43c3`
- Florida safety: `sha256:d990ba40a4e75d1651a16c0fc4e42f1b361a509348ab5f027af435e8e35609ef`

The source values and regulator terminology remain unaltered; the import adds no
TrustHub severity score or publication adjudication. Source addresses remain
source payload observations and are not promoted to canonical contractor or
contact data. ULA, Recovery Fund, workers compensation, exemptions, stop-work,
county, and Google work remain outside scope.
