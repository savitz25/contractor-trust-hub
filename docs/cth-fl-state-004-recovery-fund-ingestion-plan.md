# CTH-FL-STATE-004 Recovery Fund ingestion plan

Status: read-only planning complete. Production mutations, Recovery Fund rows, contractor links, publication changes, scoring changes, Google calls, and county work are zero.

## Official source and corpus

Florida DBPR/CILB publishes five `Recovery Fund Contractor Discipline` extracts from its official [Construction Industry Public Records](https://www2.myfloridalicense.com/construction-industry/public-records/) page. Fresh HTTP 200 downloads on 2026-08-24 produced:

| Fiscal year | File | Rows | SHA-256 |
|---|---|---:|---|
| 2021-22 | `contractor_disc_rf_2122.csv` | 548 | `ab863b07b1af6893af9fb419a4992270d430bec96d400a28c41ecb46eda55182` |
| 2022-23 | `contractor_disc_rf_2223.csv` | 256 | `c7a6e73bc819aa8940af09e1a1885873eecb336e3ccb2eef88c3ebce57e8b3cc` |
| 2023-24 | `contractor_disc_rf_2324.csv` | 216 | `2594e81df06c21778edca9e7683ba329b29d3b282e79375f69e3906f69d28c01` |
| 2024-25 | `contractor_disc_rf_2425.csv` | 647 | `fed3e761246c936ca87f2067367f30d64665b8914c9e71fd966008464b18b1fa` |
| 2025-26 | `contractor_disc_rf_2526.csv` | 12 | `297b4e87309c23b9a313f995700d9117cfafbf7ffd719e7477ac1ac7778bc475` |

All 1,679 rows parse against one ordered 17-column schema (`sha256:6bf9b84582f037e9d604290c43ab490ac790a72fe9dbaf59a7dc0160afffe575`). There are no malformed rows, blank claim identifiers, exact duplicate observations, cross-fiscal claims, or revision candidates. The earlier 1,679-row expectation remains exact; the open FY25-26 file has not drifted from the freshly accepted snapshot.

## Schema, claim grain, and data minimization

The ordered fields are License Type, License Nbr, Respondent Name, Address Lines 1-3, City, State, ZIP Code, County, Claim Nbr, Classification, Entered Date, Disposition, Disposition Date, Discipline Date - Description, and Violation Code.

One row is an official claim detail, not one whole claim. The corpus contains 841 claims: 838 have two detail rows (1,676 rows), three have one, and the maximum is two. Predominantly, paired rows separately record an `RF Reimbursement` detail and a `Suspend License` detail. Claim-number deduplication would therefore erase legitimate official detail.

The extract contains contractor/respondent identity and business-address observations, not claimant identity. It has no claimant-name, claimant-address, phone, email, financial-amount, bank, payment-amount, award-amount, order-ID, DOAH-ID, entity-ID, or FEI/Sunbiz column. Future claimant PII must be excluded unless a separate necessity review proves it essential. Respondent addresses remain internal provenance-bearing source observations and must not update canonical contractor addresses or contacts.

## Claim semantics are not generalized discipline semantics

All rows have raw classification `Recovery Fund`. Raw dispositions are `RF Claim Granted` (1,671), `RF Claim Closed` (6), and blank (2). A conservative audit-only crosswalk yields claim stages `CLAIM_APPROVED` 1,671, `CLAIM_CLOSED` 6, and `UNKNOWN` 2; detail types are `REIMBURSEMENT_RECORDED` 840, `LICENSE_SUSPENSION_RECORDED` 837, and `OTHER_DETAIL` 2.

A claim, grant, closure, or reimbursement is not by itself proof of contractor wrongdoing, consumer loss amount, final liability, or payment to a claimant. The source does explicitly record a license-suspension detail for 837 rows; that exact regulator statement may be preserved, but it must not be broadened into a generic wrongdoing flag, severity, consumer warning, ranking penalty, or Trust Score input. No financial amount exists to publish or infer.

## Credential identity

The existing versioned Florida credential resolver can be reused because every row supplies official License Type and License Nbr. It produces this fail-closed row partition: EXACT 75, DETERMINISTIC 29, REVIEW_REQUIRED 342, and UNRESOLVED 1,233. The 104 safely linkable rows resolve to 49 unique current license targets. At claim grain the partition is EXACT 38, DETERMINISTIC 15, REVIEW_REQUIRED 171, and UNRESOLVED 617.

The REVIEW_REQUIRED cohort comprises 334 numeric candidates that conflict with official type and eight rows whose types (`Registered General Contractor`, six; `Registered Roofing Contractor`, two) are not in the current versioned dictionary. The 1,233 unresolved rows have no current authoritative credential candidate. Numeric-core-only, name-only, fuzzy, claimant, and address matching are prohibited. A future initial load may populate `license_id` only for the approved 104 exact/deterministic rows; `contractor_id` remains null for every row.

## Storage and public-read recommendation

For this exact published source, the shared `discipline_actions` table is usable without a schema migration only under a strict dataset-specific contract: `source_dataset=contractor_disc_rf`, one action per exact official detail row, exact raw terminology, safe license linkage only, `contractor_id=NULL`, `publication_state=INTERNAL`, no publication evaluation/evidence, no score impact, and explicit exclusion from public/adverse analytics.

A separate claim table is not required for this initial corpus because the existing columns losslessly represent all 17 source fields and migration-009 provenance preserves detail/occurrence history. The table name is semantically broader than some claim rows, so product code must never infer “discipline” from table membership. A dedicated Recovery Fund adapter, semantic policy, executor, and fail-closed public-read tests are required before ingestion. If future sources add claimant or financial fields, a separate claim/event model and migration must be reconsidered before accepting them.

Current Florida public SQL is fail closed: while the publication gate is absent/off, all `fl_dbpr` evidence is excluded. Even with a future gate, it requires PUBLIC_ELIGIBLE, safe identity, both contractor and license links, and no holds. The planned `INTERNAL`/null-contractor rows therefore remain unreachable. Before any future Recovery Fund publication, dataset-aware presentation and adjudication are additionally required so claims cannot be mislabeled as disciplinary actions.

## Provenance and refresh

`regulatory_source_observations` and `regulatory_source_occurrences` are reusable unchanged. Proposed `FL_RECOVERY_FUND_FIELDS` is the exact ordered 17-field schema above. `source-observation-key-v2` provides exact observation identity. Proposed `FL_RECOVERY_FUND_LOGICAL_FIELDS` is Claim Nbr, License Type, License Nbr, Respondent Name, Classification, Entered Date, and Violation Code using `logical-matter-detail-key-v1`.

Logical identity is review/grouping only: never deduplication, identity, supersession, or publication authority. Only exact observations are suppressed. A genuinely new snapshot of the same row adds an occurrence; a material change creates a new `REVISION_REVIEW_REQUIRED` observation; missing prior rows are retained and investigated, never deleted. Refresh the open fiscal year monthly and historical files by quarterly checksum review. An unchanged checksum creates neither a redundant batch nor occurrence.

## Production baseline and next execution design

The repeatable-read/read-only production audit confirms 19,741 whole discipline rows; 6,457 Florida licensed rows; 11,691 Florida ULA rows; 18,148 Florida total rows; 18,148 observations and occurrences; 56 batches; 459 Arizona rows; 1,134 New Jersey rows; Recovery Fund zero; PUBLIC_ELIGIBLE zero; and the publication gate absent/off. Licensed provenance remains 6,457/6,457, safe links 1,972/1,972, and CORRECTABLE zero. ULA provenance remains 11,691/11,691 with zero license, contractor, or public links.

The future controlled architecture review should add only dataset-specific code and tests, generate a deterministic 1,679-entry non-PII manifest and reverse manifest, prove the 104 safe targets against a fresh license inventory, predict post-state fingerprints, and design one insert-only bounded transaction. Proposed future counts are 1,679 actions, observations, and occurrences plus five source batches; exact duplicates and revisions are zero. Contractor links, PUBLIC_ELIGIBLE, publication evaluation, and scoring impact remain zero.
