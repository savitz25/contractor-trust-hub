# CTH-FL-STATE-002 Licensed-Discipline Historical Ingestion Plan

## Executive summary

This is the production-read-only plan for the five official Florida DBPR/CILB `contractor_disc_lic` fiscal extracts. Fresh downloads on 2026-08-23 contain 6,457 parseable rows, exactly matching the STATE-001 total. All 1,541 current production rows match the refreshed FY 2024-25 source rows byte-for-byte after field normalization. The proven proposed delta is therefore 4,916 new source observations, with zero source updates, exact duplicates, malformed rows, or missing current-source rows.

The candidate resolver partition is 1,213 `EXACT`, 175 `DETERMINISTIC`, 1,035 `REVIEW_REQUIRED`, and 2,493 `UNRESOLVED`. Only the first two groups (1,388 rows) may receive `license_id` in a future controlled load. Every row starts `INTERNAL`; `contractor_id` remains null; no row becomes `PUBLIC_ELIGIBLE`. Numeric-core-only and name-only adverse matching remain prohibited.

Production was queried in one `REPEATABLE READ READ ONLY` transaction with a 30-second statement timeout. Production mutations, ingestion, publication changes, Google calls, and county work were all zero.

## Source inventory and freshness

Authority: Florida Department of Business and Professional Regulation / Construction Industry Licensing Board. Official index: <https://www2.myfloridalicense.com/construction-industry/public-records/>.

| Fiscal year | Rows | Bytes | SHA-256 | HTTP | Last-Modified |
|---|---:|---:|---|---:|---|
| 2021-22 | 1,109 | 250,488 | `ab67307147fb2007b4751900d105773d7cf2cee83dece8b9ac6dca42096500d0` | 200 | 2026-07-27 16:46:15 GMT |
| 2022-23 | 1,534 | 348,335 | `cd733ddce04de63d76c5f123b1004990ddfd03f2260f32ccf9e26bd817c81884` | 200 | 2026-07-27 16:50:46 GMT |
| 2023-24 | 1,878 | 422,411 | `90a561929f6bf2821900ab0cb1b54177bcff43bd4f8b411fe608a9928b641de4` | 200 | 2026-07-27 16:51:48 GMT |
| 2024-25 | 1,541 | 347,204 | `189b0043984b25876bdbf6c814b5c6539db9374e3cd01e5c8e94e7777442c7ef` | 200 | 2026-07-27 16:52:44 GMT |
| 2025-26 | 395 | 88,641 | `1cecf33f0b5a5e329527dd2df723cb3ec658e60027d81805c765b639a55155f7` | 200 | 2026-07-27 16:53:45 GMT |

All files use the same 17-column schema; its ordered-header fingerprint is `sha256:b373171b1916c0b5e0e48a7e96ac6334fd01255fd0b8a3a69435a224bcf36345`. All 6,457 rows parsed, and no row has a blank license type, license number, complaint number, or respondent. STATE-001 did not retain comparable file SHA-256 values, so byte-level “changed since STATE-001” is unknown. Row totals, headers, and the exact 1,541-row FY24-25 production reconciliation are unchanged. The raw downloads are ignored and are not committed.

## Source grain

One CSV row is a source observation/detail line, not necessarily one complaint, case, finding, sanction, or final order. Multiple rows sharing a complaint and credential are retained when classification, violation, disposition, discipline description, or other original fields differ. Complaint number alone is never a deduplication or wrongdoing key.

The complete original fields are preserved: license type/number, respondent, three address lines, city/state/ZIP/county, complaint number, classification, entered date, disposition, disposition date, discipline date/description, and violation code. Fiscal year, source URL, checksum, download time, batch, and source-row version are additional provenance.

## Production reconciliation

The current production set contains 1,541 `fl_dbpr / contractor_disc_lic` rows. Canonical 17-field multiset comparison found:

- `EXACT_CURRENT_SOURCE_MATCH`: 1,541
- `SOURCE_ROW_UPDATED`: 0
- `SOURCE_ROW_NO_LONGER_PRESENT`: 0
- `DUPLICATE_CURRENT_ROW`: 0
- `OTHER_REVIEW_REQUIRED`: 0

The current FY24-25 source has not drifted relative to production. No production row was changed.

## Cross-year duplicates, revisions, and legitimate detail lines

Across all five files there are zero exact duplicate row occurrences, zero exact rows repeated across fiscal files, zero matter groups repeated across fiscal files, and zero materially revised cross-file groups. There are 1,140 within-file complaint/credential/classification groups containing multiple materially distinct detail lines. Those lines must remain separate.

The current loader key hashes dataset, complaint, raw license number, respondent, discipline description, and disposition date. It has zero collisions in this current five-file corpus, but it omits fiscal/source version and some source fields and incorporates mutable disposition fields. It cannot, by itself, distinguish a corrected version from a new observation reliably.

### Minimum source-row identity contract before ingestion

Use two deterministic identifiers:

1. `source_observation_key_v2`: hash of dataset plus the canonical ordered 17-field source row. It is order-independent, complaint-safe, and distinguishes legitimate detail lines. It deliberately does not use row position.
2. `logical_matter_detail_key`: a conservative grouping key over complaint, official credential type/number, respondent, classification, entered date, and violation code. It is for revision review only and never automatic deduplication.

Every physical file occurrence also needs fiscal year, file checksum, and source-row fingerprint. For national-quality refresh history, the minimum durable extension is an additive source-observation/version relation keyed by evidence row, ingest batch, source file, fiscal year, row fingerprint, observed-at time, and current/superseded state. This permits exact duplicates to be represented once as evidence while retaining every file occurrence, and permits materially changed rows to be retained as versions. Do not retrofit complaint-number uniqueness. A schema/code prerequisite should be reviewed before the production load; this plan does not modify schema.

## True ingestion delta

| Category | Count |
|---|---:|
| Already represented unchanged | 1,541 |
| Represented but source-updated | 0 |
| True net-new source observations | 4,916 |
| Exact duplicate occurrences suppressed | 0 |
| Revision/history rows retained | 0 |
| Malformed/review-required source rows | 0 |

Thus the proven proposed observation count is 4,916—not merely the arithmetic assumption—even though it equals 6,457 minus 1,541.

## Identity resolution and linkage policy

Fresh production license inventory and the merged versioned resolver produced:

| State | Candidate count | Future linkage |
|---|---:|---|
| EXACT | 1,213 | Populate exact `license_id`; `contractor_id` null |
| DETERMINISTIC | 175 | Populate unique authoritative type/board/number `license_id`; `contractor_id` null |
| REVIEW_REQUIRED | 1,035 | No guessed attachment; INTERNAL/review-held |
| UNRESOLVED | 2,493 | Remain unattached and INTERNAL |

Unknown type and multiple candidates fail closed. Numeric-core-only and respondent-name matching cannot produce an automatic adverse link.

The existing 1,541-row population independently reconciled to `EXACT` 523, `DETERMINISTIC` 61, `REVIEW_REQUIRED` 376, and `UNRESOLVED` 581. Correctable remaining is zero, and all 584 exact/deterministic relationships still agree with the resolver.

## Regulatory semantics

Original values remain authoritative and are never overwritten. A parallel presentation category may be computed only from explicit source terminology:

| Normalized category | Rows |
|---|---:|
| Final order (including “Final Order of Local Discipline”) | 5,783 |
| Citation filed | 554 |
| Closure/other disposition | 47 |
| Dismissed | 16 |
| Complaint/matter only | 3 |
| Insufficient evidence | 1 |
| Blank/unknown | 53 |

The exact official disposition distribution is retained in the JSON artifact. There are 5,775 rows labeled `Final Order` and eight labeled `Final Order of Local Discipline`, for 5,783 final-order candidates. A later bounded task may qualify deterministic DBPR/DOAH order references; this task does not invent URLs or scrape PDFs. Complaint presence is not proof of misconduct, and disposition, allegation/classification, discipline description, and final order remain distinct concepts.

## Contact and address observations

The refreshed headers reconfirm zero email, phone, website, role/title, or named-contact fields beyond respondent. All 6,457 rows contain an address component and all contain Address Line 1. These are regulator source observations, not canonical contractor addresses, and may include “Private Address.” No address or respondent value is included in the committed planning artifact.

Future contact architecture must retain every qualified email, phone, website, named contact, role/title, address, and location as a separate provenance-bearing observation. It must not discard second or subsequent values or overwrite historical observations merely because another value exists.

## Provenance, batches, and refresh policy

Create one ingest batch per official fiscal file (five batches in the first historical load). Each batch records agency, dataset, fiscal year, official URL, download time, byte size, checksum, header fingerprint, row counts, resolver version, evaluation timestamp, and verification time. Each evidence observation retains raw payload or an approved lossless normalized equivalent plus source-row/version identity.

Recommended refresh cadence is monthly for the open fiscal year and quarterly for all published prior files, plus a fiscal-year rollover check. Re-download and checksum every file; no-op unchanged files; structurally diff changed files; preserve prior versions; and place affected evidence on correction/retraction review as appropriate. Absence from a refreshed file triggers investigation and never automatic deletion.

## Proposed controlled production execution

The future load should first implement/review the source-observation identity/version prerequisite, then execute five checksum-bound batches. It must:

- verify the same 4,916-row delta and resolver partition immediately before write;
- use a bounded transaction per approved batch with exact counts and checksum guards;
- upsert only by the approved v2 observation identity, preserving revisions and fiscal provenance;
- populate `license_id` only for the 1,388 exact/deterministic candidates;
- retain 1,035 review-required and 2,493 unresolved observations fail-closed;
- set all 4,916 observations `INTERNAL`, with `PUBLIC_ELIGIBLE = 0`;
- keep every `contractor_id` null and affect no non-Florida row;
- distinguish inserts from source-version updates and roll back inserts by `ingest_batch_id`;
- leave the publication feature flag OFF.

Rollback must be manifest-driven: capture inserted IDs, preexisting row/version state, and batch IDs before commit; verify counts, relationships, safety states, and non-FL fingerprints before commit; and require separate authorization for a post-commit reversal.

ULA, Recovery Fund, workers' compensation, exemptions, stop-work orders, county/municipal data, and contact promotion are outside this plan.

## QA and execution boundary

The audit validates all official downloads and CSV schemas, performs five-file and cross-fiscal reconciliation, runs the authoritative resolver, reconciles production in a read-only repeatable-read snapshot, and fails if the SAFE-002B baseline regresses. Raw files remain ignored. Migration 008 remains immutable.

This document and its machine-readable artifact authorize planning only. Production mutations: 0. Ingestion: 0. Publication enabled: no. Google calls: 0. County work: 0.
