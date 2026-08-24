# CTH-FL-STATE-002A Regulatory Source Observation Versioning

## Executive summary

This change adds a generic, additive provenance layer separating the logical regulatory evidence in `discipline_actions` from the exact versions and file occurrences published by a regulator. Florida licensed discipline is the first consumer. Arizona ROC and New Jersey enforcement receive no initialization, backfill, or behavior change.

Migration 009 is structure-only and is not applied by this task. Production mutations, ingestion, license/contractor relationship changes, and publication changes are all zero. Migration 008 remains immutable.

## Evidence, observation, and occurrence

- **Evidence (`discipline_actions`)** is the current normalized regulatory object used by identity and publication safety logic.
- **Observation (`regulatory_source_observations`)** is one immutable exact regulator-published row/version. It contains the lossless source payload, exact observation identity, conservative logical review key, revision state, and a restrictive link to its evidence object.
- **Occurrence (`regulatory_source_occurrences`)** is one sighting of an observation in a specific immutable ingest batch, fiscal period, file checksum, source-record locator, URL/file snapshot, and observation time.

The same exact row seen again reuses the observation and records another unique occurrence. It never creates another evidence object. A materially changed row receives a different exact observation identity and is retained without overwriting history.

## Source observation key v2

Algorithm: `source-observation-key-v2`.

For `fl_dbpr / contractor_disc_lic`, the hash envelope contains the algorithm identifier, source system, source dataset, and the canonical ordered 17-field official row:

1. License Type
2. License Nbr
3. Respondent Name
4. Address Line 1
5. Address Line 2
6. Address Line 3
7. City
8. State
9. ZIP Code
10. County
11. Complaint Nbr
12. Classification
13. Entered Date
14. Disposition
15. Disposition Date
16. Discipline Date - Description
17. Violation Code

Output format is `fl_dbpr:contractor_disc_lic:v2:<sha256>`.

### Canonicalization

Canonicalization deliberately follows only the established adapter parsing boundary:

- missing/null becomes the empty string;
- CRLF and CR inside a value become LF;
- leading/trailing whitespace is trimmed, matching the existing DBPR adapter `_clean` behavior;
- field order and JSON serialization are deterministic UTF-8.

It does **not** lowercase or case-fold names, remove punctuation, collapse internal whitespace, normalize addresses, rewrite dates, strip meaningful credential zeroes, or perform semantic equivalence. The original official values remain in `source_payload`.

`row_fingerprint_sha256` hashes the canonical 17-field row without the source envelope. A materially changed field changes both fingerprint and observation key.

## Logical matter/detail key v1

Algorithm: `logical-matter-detail-key-v1`.

The conservative grouping envelope contains source identity plus complaint number, official license type, official license number, respondent, classification, entered date, and violation code. It deliberately excludes mutable disposition and discipline-description fields so a refresh can surface a possible revision.

This key is a review hint only. A collision never authorizes deduplication, update, supersession, evidence/license/contractor linkage, or publication. Complaint-level uniqueness and deduplication are prohibited.

## Revision handling

Observation revision states are `CURRENT`, `REVISION_REVIEW_REQUIRED`, and `SUPERSEDED`.

- Exact re-observation: reuse the immutable observation and add a unique occurrence.
- Distinct lines in the same ingest batch/file: create distinct observations and evidence details; no complaint-level collapse.
- New observation sharing a logical group with an observation from an earlier batch: retain the new source version as `REVISION_REVIEW_REQUIRED`, link it to the existing evidence object for review, and create no second evidence event automatically.
- Supersession: never automatic. A future reviewed workflow must explicitly set `SUPERSEDED` and `superseded_by_observation_id`.

No revision state grants publication eligibility. A source correction affecting future public evidence must trigger correction/retraction review under the existing publication contract.

## Constraints and immutability

Exact observation uniqueness is `(source_system, source_dataset, source_observation_key)`. Occurrence uniqueness is `(source_observation_id, ingest_batch_id, fiscal_year, source_file_checksum_sha256, source_record_locator)`. The locator (for example `csv-record:17`) is occurrence provenance only; it is never part of permanent observation or evidence identity. This permits two identical rows in one file to remain two sightings of one observation.

There is no uniqueness constraint on complaint number, logical key, license number, or respondent. Both child tables use restrictive foreign keys so evidence or audit batches cannot be casually deleted out from under provenance.

`ingest_batches` remains the authoritative batch record. Occurrences also snapshot fiscal year, checksum, file, URL, and observation time so file provenance remains inspectable. Batch records should be treated as immutable audit records.

## Existing external-key compatibility

The 1,541 legacy `discipline_actions.external_key` values remain untouched. Their source observations will link to the existing action IDs during a separately approved backfill.

Future new licensed-discipline evidence uses `source_observation_key_v2` as its `external_key`, while exact already-represented observations are located through the child table rather than the legacy key. A revision candidate does not upsert or overwrite `discipline_actions`.

## Legacy 1,541-row dry run

The production read-only simulation used the official FY24-25 checksum `189b0043984b25876bdbf6c814b5c6539db9374e3cd01e5c8e94e7777442c7ef` and reconciled all production rows to exact official source observations:

- exact source reconciliations: 1,541
- proposed observation mappings: 1,541
- proposed occurrences: 1,541
- ambiguous mappings: 0
- orphan production rows: 0
- duplicate v2 keys/collisions: 0
- revision candidates: 0

Every proposed observation links to the existing unchanged `discipline_action_id`. The dry run contains no respondent or address payload dump.

## Future 4,916-row simulation

Across the five official fiscal files:

- current exact observations: 1,541
- true new observations/occurrences: 4,916
- exact duplicate current observations: 0
- revision-review candidates: 0
- v2 collisions: 0
- occurrence collisions: 0
- logical groups: 3,160
- multi-observation logical groups: 1,140, protecting 3,297 legitimate additional detail lines from complaint-level collapse

Resolver outcomes for the future observations remain `EXACT` 1,213, `DETERMINISTIC` 175, `REVIEW_REQUIRED` 1,035, and `UNRESOLVED` 2,493.

Source observation identity remains independent of license identity. The authoritative Florida credential resolver is still required. Numeric-core-only and name-only adverse matching remain prohibited.

## Loader contract

Future Florida licensed-discipline loading requires explicit fiscal year, official source URL, and lowercase official source-file SHA-256 in addition to an ingest batch. The loader:

1. computes the shared exact observation and logical review keys;
2. reuses exact observations and inserts only new occurrences;
3. retains cross-refresh logical collisions as revision-review observations without creating another evidence event;
4. preserves distinct lines in the same source batch;
5. creates new evidence only for a genuinely new observation under these rules;
6. invokes the independent credential resolver for `license_id`;
7. always leaves `contractor_id` null and publication `INTERNAL`.

The loader must not run in production until migration 009 is applied and the legacy 1,541-row provenance backfill is completed and verified.

## Contact and address preservation

`source_payload` is lossless and can retain multiple regulator-provided addresses, emails, phones, websites, named contacts, roles/titles, and locations without imposing a canonical single-contact field. Current licensed-discipline files contain zero email, phone, website, or named-contact fields beyond respondent and 6,457 address observations. Those addresses are not promoted to canonical contractor addresses.

## Migration and non-Florida isolation

Migration `009_regulatory_source_observations.sql` creates only the two provenance tables, constraints, indexes, and documentation comments. It does not update or backfill `discipline_actions`, modify relationships or safety state, or reference Arizona/New Jersey source values.

`schema/initial_schema.sql` contains the same clean-install model. Migration 008 is unchanged at SHA-256 `1b110240c4487bbb3dfe74ac2ef893aca3defbc93afaedd23aad3732133adeb8`.

No disposable PostgreSQL or Docker runtime was available locally, so migration validation is static in this task: SQL structure/invariant tests, clean-schema alignment checks, additive/no-DML checks, Python tests, type checking, and application build. Production application is explicitly prohibited here.

## Controlled production sequence

1. Merge STATE-002A code and migration after review.
2. Apply migration 009 structure only in a separately approved task.
3. Verify constraints, tables, production health, publication OFF, and zero relationship changes.
4. Execute a bounded, checksum-bound backfill of 1,541 observations and 1,541 occurrences linked to the unchanged legacy action IDs.
5. Independently verify 1,541/1,541 mappings, zero relationship/publication changes, and non-FL zero impact.
6. Only then authorize the 4,916-row historical load.

The backfill transaction must lock only the Florida target set, verify the FY24 checksum and exact mapping manifest, use optimistic guards, require exact affected counts, and roll back on drift. Rollback deletes only the newly inserted occurrences/observations by approved IDs or batch manifest; it never changes the existing discipline actions. Post-commit rollback requires separate authorization.

## Safety boundary

This implementation performs no production mutation, migration application, ingestion, publication evaluation, contractor linkage, license correction, Google call, or county work. All future imported evidence remains `INTERNAL`, and the publication feature flag remains OFF.

## Production migration 009 application

Migration 009 was applied to production as a structure-only change from main SHA `6aea360e4072d5c96d3044eb5b1c5808dfb7c0b9`. The exact applied SHA-256 was `5bff76bb440d77aa2f118d63db1737f5bfe680257dd6339e532f88a36041a481`; migration 008 remained unchanged at `1b110240c4487bbb3dfe74ac2ef893aca3defbc93afaedd23aad3732133adeb8`. Migration 009 is immutable after this application.

- PostgreSQL: 17.6
- State before application: `NOT_APPLIED`
- Transaction start: 2026-08-24T04:39:21.263798+00:00
- Transaction commit: 2026-08-24T04:39:23.640478+00:00
- Lock timeout: 5 seconds
- Statement timeout: 60 seconds
- Result: committed; rollback required: no

The first transaction attempt rolled back before commit because the local catalog validator expected three restrictive foreign keys and omitted the accepted self-referential supersession foreign key. Production remained `NOT_APPLIED`. The ignored validator was corrected to require all four restrictive foreign keys, and the exact unchanged migration was then applied successfully. No ad-hoc SQL or partial repair was performed.

Post-commit catalog verification confirmed both tables, all required columns and constraints, four restrictive foreign keys, four named secondary indexes, the immutability function, and the enabled `BEFORE UPDATE FOR EACH ROW` trigger. `regulatory_source_observations` and `regulatory_source_occurrences` each contained zero rows before and after. No legacy provenance backfill or historical ingestion occurred.

Shared regulatory populations remained unchanged: Florida 1,541 rows (987 license-linked, zero contractor-linked, 554 neither), Arizona 459 rows, and New Jersey 1,134 rows; whole-table total 3,134. Florida remained `EXACT` 523, `DETERMINISTIC` 61, `REVIEW_REQUIRED` 376, `UNRESOLVED` 581, `INTERNAL` 1,541, `PUBLIC_ELIGIBLE` zero, correction holds true 403, and retraction holds true zero. A fresh resolver audit confirmed all 584 safely resolved relationships agree and `CORRECTABLE` remains zero.

Pre/post non-PII fingerprints matched exactly:

- whole relationships: `sha256:5f5af54a2384cfcf228a742751650df543f2dc25a217c92b2af1950046b2b6c3`
- Florida relationships: `sha256:d2fb06f2f7d16a94f2981057b2a7f29a89e94c7cb9d7cc7c9cb0fea1783eab4c`
- Arizona relationships: `sha256:d5c456b2d6d60accef4f892ce2b95b1b23ca6a792cea0d8f0e2ee92f2bf8f6c3`
- New Jersey relationships: `sha256:6aae90e88c656e664717442a32009e7010b71c378838690651242de3e37f43c3`
- Florida safety: `sha256:c96193c37fd8a9759f3574122e4a451590e27ff59514d0b9f8352a7b9e213199`

The `ingest_batches` count remained 46. License IDs, contractor IDs, identity state, publication state, holds, discipline rows, and ingest batches had zero changes. Arizona and New Jersey received no provenance rows or Florida safety initialization. `REGULATORY_PUBLICATION_GATE_V1` remained absent/OFF.

Before and after application, the homepage, Florida and Arizona landing pages, and bounded Florida, Arizona, and New Jersey contractor profiles returned HTTP 200. No database/query errors were observed and no manual deployment occurred. Production work was limited to migration 009 structures: legacy backfill zero, licensed-discipline ingestion zero, ULA zero, Recovery Fund zero, Google calls zero, and county work zero.
