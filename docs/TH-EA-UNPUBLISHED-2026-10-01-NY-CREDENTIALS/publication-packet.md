# NY DOL credential wave — Evidence recheck packet

**Disposition: HOLD for source drift review.** This branch stages the independently certified 2026-09-30 snapshots; it does not load production. The official exports changed by 2026-10-01. Evidence must decide whether to authorize the frozen snapshot as a dated credential observation or certify a refreshed source before any execution. No current-active or distinct-business count is asserted.

## Certified staging

| Source | Official dataset | Pinned SHA-256 | Rows | Unique bare numbers | Unique type + number keys | Active | Expired | Batch UUID |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| NY DOL mold | `ikqx-ispy` | `bdbf258434d772810a2027a3fd5fa679b8210435ed1126cdc5fb1e34194bfb5c` | 2,510 | 2,482 | 2,510 | 1,761 | 749 | `ef3a17a2-75fd-5e1b-af1b-3ac5be7944ac` |
| NY DOL elevator | `jrac-r9vc` | `9e5455d1aeec34a399d6e81c5bb55fba4dac42e4399ca01140a893fa5a982244` | 302 | 302 | 302 | 212 | 90 | `8875f5a5-a2f1-58fc-86f9-854b0cec6b7f` |

Official exports: [Mold Contractor Licenses](https://data.ny.gov/d/ikqx-ispy) and [Elevator Contractor License](https://data.ny.gov/d/jrac-r9vc). The pinned files are `data/raw/th_enrich_b1/ikqx-ispy.csv` and `data/raw/th_enrich_b1/jrac-r9vc.csv`. The exact stage is `ny-credentials-stage.csv` (SHA-256 in `receipt.json`). Every row retains license type, number, status, holder text, address, dates, source URL/hash, raw payload, and source line. `external_key = source_dataset + ':' + license_type + ':' + license_number` under `source_system = ny_dol`; a repeated mold number across SH125 and SH126 remains two credentials. The license number never identifies a canonical business.

## Fresh official export drift

The 2026-10-01 official `?$limit=500000` recheck gave mold **2,511** rows, SHA-256 `5eda889f071350c8e1c1bed040f177de1b0a28e64619afabadb9a4fae468927c`, with 1,737 Active and 774 Expired. Relative to the certified file, 4 compound keys were added, 3 removed, and 29 shared rows changed. Elevator remained **302** rows and 212 Active / 90 Expired, but its SHA-256 changed to `4e7dd536aacb197589ffc0df56c35ffc2b6289bd141b2f741da`; one shared row changed sourced name casing, address casing, and phone. See `source-drift.json` for the exact changed-key set. The fresh files were inspected in a temporary directory and did not replace certified source artifacts.

This is material source drift for mold and content drift for elevator. The reviewed load must **not** run while current source hashes differ unless Evidence explicitly certifies publication of the frozen 2026-09-30 observation. A refreshed wave would need a new source receipt, stage, and review.

## Production ownership and target grain

Read-only inspection of ContractorTrustHub production on 2026-10-01 found **zero** `licenses` rows with `source_system IN ('ny_dol_mold','ny_elevator','ny_dol')`, zero other `source_system` names containing NY/mold/elevator, and zero NY DOL `ingest_batches`. Thus exact already-owned credentials are 0 at inspection time. The packet rechecks exact `(source_system, external_key)` ownership transactionally at execution; any existing row must be an identical rerun in the same batch.

`licenses.contractor_id` is nullable. The packet sets it to NULL for all 2,812 credentials. `contractors`, `entities`, and business search are untouched. Existing canonical business queries inner-join `licenses` to `contractors`, so unattached credentials cannot enter ordinary business search. Raw `Active` and `Expired` are retained in `primary_status`; `status_normalized` is the lowercase equivalent. The holder's address state is stored separately from the New York issuing jurisdiction in raw payload.

## Execution and rollback design — not authorized

`load.psql` stages the pinned CSV in a session-local table, validates counts, statuses, compound keys, source hashes, batch IDs and exact ownership, then inserts two `ingest_batches` and only unattached `licenses` in one transaction. The unique `(source_system, external_key)` constraint plus identical-rerun preflight makes a rerun insert zero rows. `rollback.psql` is bounded to the two batch UUIDs, `ny_dol` source, source hashes, dataset keys, standalone grain, null contractor links, and certified maximum row counts. It is not executed.

The local credential preview now includes mold Active and Expired and elevator Active and Expired examples. The route remains development-only, noindex, and separate from canonical Contractor search. The pre-existing NJ permit fixture is not part of this wave or load packet.

Local preview check: `http://127.0.0.1:3457/credential-lookup-preview` returned HTTP 200 in development. The [Expired elevator mobile capture](preview-elevator-expired.png) shows the source status as Expired and business identity linkage as Not established. Four staging tests, four existing preview tests, and TypeScript typecheck passed. The production route remains unavailable by design.

```text
CERTIFIED_ROWS = 2812
EXACT_EXISTING_CREDENTIALS_AT_INSPECTION = 0
PROPOSED_NEW_CREDENTIAL_ROWS_IF_FROZEN_SOURCE_APPROVED = 2812
CANONICAL_BUSINESSES_CREATED = 0
SCHEMA_CHANGE = NO
PRODUCTION_MUTATIONS = NO
NJ_FIRE_STATUS = HOLD — EVIDENCE COUNT CONFLICT 541 VS 542
```
