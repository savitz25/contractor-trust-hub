# CON-OSHA-001 loader contract

This is not a loader. Do not run it. Production load needs a separate Founder GO.

The draft tables are in `schema/migrations/018_con_osha_001_osha_safety_record.sql`.
Rollback SQL is in `schema/rollback/018_con_osha_001_osha_safety_record.rollback.sql`.
Neither file is executed by this pull request.

## Package the future loader must re-verify

Archive `osha-handoff-20261021.tgz` SHA256:

`35339be96091e744f0b9a936e0744eb5955b3a7258ea5daf576bc399d303d62c`

No checksum file was inside the package. That hash was computed from the archive. It matches the reported prefix `35339be9` and suffix `d62c`.

The handoff contains license-level match totals only. It does not contain `fl_insp.csv`, `fl_viol.csv`, `nj_insp.csv`, or `nj_viol.csv`. Those are the files the matching scripts read and did not ship.

## Identity

- Join `license_key` to an existing `licenses.external_key` whose `contractor_id` is already set.
- Insert public rows only for `match_tier` exact or strong.
- If the license is not already on a contractor profile, skip the row and count it as `skipped_no_profile`. Do not insert into `contractors`.
- Do not name-match around a missing license.
- Do not merge contractors or edit canonical license identity.
- Weak rows go only to `contractor_osha_identity_review`. The profile query must not read that table.

## Receipt

In one transaction:

1. Insert `ingest_batches` with `source_system = us_dol_osha` and the package SHA256.
2. Insert `osha_load_receipts` for that batch before any match row.
3. Insert exact and strong rows into `contractor_osha_license_matches`.
4. Insert weak rows into `contractor_osha_identity_review`.
5. Set the receipt counts and status to `loaded`.

A match row without a receipt cannot be inserted. That is the guard against a receipt gap.

## Inspection rows are blocked

Do not create `contractor_osha_inspections` from `first_open`, `last_open`, `osha_activity_nrs`, `n_contested`, or `n_with_final_order`.

The additional official extract has to carry, for each `ACTIVITY_NR`:

- `OPEN_DATE`
- citation-item count for that activity after `DELETE_FLAG = X` rows are removed
- `CONTEST_DATE` for that activity
- `FINAL_ORDER_DATE` for that activity

The activity numbers in this handoff are 6 to 9 digit integers. The public OSHA inspection page observed during review uses a dotted id such as `establishment.inspection_detail?id=1878827.015`. That pattern was not verified for these integers, so the profile does not emit an activity link.

## Display

`initial_penalty_amount` is stored and is not selected by the profile query.
The profile shows `Cited penalty (current)` from `current_penalty_amount` only.
Absence of a row is not a clean record. The profile renders nothing.
