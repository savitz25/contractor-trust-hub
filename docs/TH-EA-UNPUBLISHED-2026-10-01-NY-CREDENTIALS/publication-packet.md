# NY DOL credential wave — Founder production gate packet

**Prepared, not executed.** Evidence Activation certified the current official NY DOL exports on 2026-10-01. This packet replaces the prior frozen 2,510-row Mold proposal. The publication grain is a standalone regulator credential, never a distinct canonical business.

## Current certified sources

| Source | Dataset | SHA-256 | Rows | Unique bare numbers | Unique type + number keys | Active | Expired | Batch UUID |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| NY DOL Mold | `ikqx-ispy` | `5eda889f071350c8e1c1bed040f177de1b0a28e64619afabadb9a4fae468927c` | 2,511 | 2,483 | 2,511 | 1,737 | 774 | `637955be-0fc3-5beb-aa6f-52904f3184f0` |
| NY DOL Elevator | `jrac-r9vc` | `4e7dd536aacb197589ffc0df56c35ffc2b6289912cb24bf6289bd141b2f741da` | 302 | 302 | 302 | 212 | 90 | `cf41ef92-452b-553d-927e-f3944c3d2dfd` |

Official datasets: [Mold Contractor Licenses](https://data.ny.gov/d/ikqx-ispy) and [Elevator Contractor License](https://data.ny.gov/d/jrac-r9vc). The exact current exports are pinned in `sources/`; `source-manifest.json` records URLs, retrieval, bytes, and hashes. Independent fresh downloads reproduced both Evidence hashes. Relative to the prior snapshot, Mold added four Active keys, removed three Active keys, and changed 25 Active records to Expired. Elevator had no key or status changes; one record's sourced text/phone and CSV row order changed. The historical comparison remains in `source-drift.json`.

`ny-credentials-stage.csv` contains **2,813** rows. Its final, independently recomputed SHA-256 is **`8529bef17460a38efc1df6b37a4233872a1be1fceb5010dd4e78b0ee9e34a695`**, matching `receipt.json`. Stage keys are `source_dataset + ':' + license_type + ':' + license_number` under `source_system = ny_dol`. Repeated bare Mold numbers across SH125 and SH126 remain distinct credentials. Every row retains native type/number, raw Active or Expired status, holder text, address and dates, official source URL/hash, source line, and full raw payload.

## Ownership, denominator, and transaction

Read-only production inspection on 2026-10-01 reconfirmed **zero** `ny_dol` licenses and ingest batches, with **1,392,730** canonical contractors. The execution packet rechecks exact `(source_system,external_key)` ownership immediately before insert. Existing exact rows are accepted only as identical reruns of this release batch; differing rows stop the transaction. A Founder execution gate must repeat the live ownership check.

`load.psql` uses two deterministic batch UUIDs and one transaction. It validates 2,511 Mold, 302 Elevator, 774 and 90 Expired, 2,483 bare Mold numbers, 2,813 unique external keys, and both source hashes. It inserts only `licenses` with `contractor_id = NULL`; it does not write `contractors` or `entities`. The `(source_system,external_key)` unique constraint and exact-rerun preflight yield **2,813 first-run inserts** at the inspected zero-owned baseline and **0 second-run inserts**. These are local deterministic packet results, not claims of production execution.

`rollback.psql` is bounded by the two batch IDs, `ny_dol`, source dataset and hash, standalone grain, null contractor link, and certified maximum row counts. No schema change is required. Ordinary Contractor business search remains unchanged because unattached licenses are excluded by its contractor join.

The development-only credential preview shows Mold and Elevator Active/Expired examples. The [Expired Elevator mobile capture](preview-elevator-expired.png) shows Expired status and “Business identity linkage: Not established.” NJ Fire Protection is **HOLD** and excluded from both the 2,813-row stage and SQL packets.

```text
TOTAL_CERTIFIED_ROWS = 2813
EXACT_EXISTING_CREDENTIALS_AT_LAST_READ_ONLY_INSPECTION = 0
FIRST_RUN_INSERTS_AT_THAT_BASELINE = 2813
SECOND_RUN_INSERTS = 0
CANONICAL_BUSINESSES_CREATED = 0
SCHEMA_CHANGE = NO
PRODUCTION_MUTATIONS = NO
NJ_FIRE_STATUS = HOLD
```
