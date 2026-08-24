# CTH-FL-STATE-004 Recovery Fund controlled ingestion architecture

Status: architecture and exact production dry run only. Production mutations, Recovery Fund rows, contractor links, publication, scoring, claimant/contact creation, Google calls, and county work are zero.

## Source and claim-detail grain

Five official DBPR/CILB `contractor_disc_rf` files contain 1,679 parseable rows across 841 claims. The accepted fiscal counts are 548, 256, 216, 647, and 12. All use the same 17-field contract and have zero malformed rows, exact duplicates, revisions, or production key conflicts.

One row is one official detail, not one whole claim. There are 838 two-row claims containing 1,676 rows and three one-row claims. Two details with the same Claim Nbr remain separate when the exact source content differs; claim-number deduplication is impossible by design.

## Claim semantics and data minimization

A claim, grant, closure, or reimbursement description does not establish generalized wrongdoing, liability, consumer loss, payment amount, disciplinary finding, or Trust Score penalty. The deterministic audit crosswalk preserves 1,671 `CLAIM_APPROVED`, six `CLAIM_CLOSED`, and two `UNKNOWN` claim-stage rows. Detail types are 840 `REIMBURSEMENT_RECORDED`, 837 `LICENSE_SUSPENSION_RECORDED`, and two `OTHER_DETAIL`.

`LICENSE_SUSPENSION_RECORDED` means only that DBPR's source explicitly records that detail; it does not infer fraud or loss. `RF Reimbursement` remains text because the corpus has no numeric financial field. Raw classification, disposition, detail description, and all other official values remain unchanged in source evidence.

The source has no claimant name, claimant address, phone, email, banking, or financial-amount fields. Respondent/business addresses remain internal evidence only. No canonical address, contact, claimant, entity, or financial record is created. A future source with claimant or monetary fields is a hard schema/architecture stop requiring separate review.

## Immutable source and identity contracts

`FL_RECOVERY_FUND_FIELDS` is License Type, License Nbr, Respondent Name, Address Lines 1-3, City, State, ZIP Code, County, Claim Nbr, Classification, Entered Date, Disposition, Disposition Date, Discipline Date - Description, and Violation Code. `source-observation-key-v2` hashes that exact ordered contract for `fl_dbpr/contractor_disc_rf` and becomes `discipline_actions.external_key`.

`FL_RECOVERY_FUND_LOGICAL_FIELDS` is Claim Nbr, License Type, License Nbr, Respondent Name, Classification, Entered Date, and Violation Code. `logical-matter-detail-key-v1` is review/grouping input only and can never authorize identity, deduplication, claim consolidation, supersession, linkage, or publication.

The existing versioned Florida resolver produces 75 EXACT, 29 DETERMINISTIC, 342 REVIEW_REQUIRED, and 1,233 UNRESOLVED rows. Only 104 exact/deterministic rows receive their approved `license_id` and resolved external key; these cover 49 unique current licenses. The remaining 1,575 rows retain null license identity. All 1,679 rows have `contractor_id=NULL`. Unknown type mappings remain eight rows, collision/type conflicts 334, and absent credentials 1,233. Name, address, fuzzy, AI, and numeric-core-only matching are prohibited.

## Deterministic execution and provenance

The 1,679-entry execution manifest is aggregate/non-PII and contains only fiscal/checksum/locator hashes, semantic categories, resolver outputs, approved safe license targets, and deterministic execution IDs. It contains no respondent, address, claim number, raw text, narrative, claimant data, or contractor ID. Independent generation is byte-for-byte identical.

Five deterministic batch IDs correspond to the five exact source checksums. Each detail has deterministic action, observation, and occurrence IDs. Initial provenance is 1,679 `CURRENT` observations and 1,679 occurrences, with zero revision-review or superseded rows. The reverse manifest contains only these prospective IDs/checksums and authorizes no automatic rollback.

## Predicted production state and fingerprints

The future insert-only transaction adds five batches, 1,679 actions, 1,679 observations, and 1,679 occurrences: 5,042 rows total. Predicted totals are 21,420 whole actions; 19,827 Florida actions; 6,457 licensed; 11,691 ULA; 1,679 Recovery Fund; 19,827 observations and occurrences; and 61 batches.

Predicted Florida identity is EXACT 1,811, DETERMINISTIC 265, REVIEW_REQUIRED 1,753, and UNRESOLVED 15,998. Relationships are 2,479 license-linked, zero contractor-linked, and 17,348 neither. Holds are correction 403/19,424 and retraction 0/19,827. Publication is INTERNAL 19,827 and PUBLIC_ELIGIBLE zero.

Hard predicted fingerprints are:

- whole `sha256:b276b929dab3c37ee7670ec244283a109c8479dd3711f484ef286fa9afc0c67e`
- Florida `sha256:aeec5f86ac1f55c3f75c1c1a34b664dc02aeb3b7b9f847ec062562533919c813`
- Florida safety `sha256:15266e1ef2a3e3e256207997a07db62d26de2177295d501154843292621eba73`
- Arizona `sha256:d5c456b2d6d60accef4f892ce2b95b1b23ca6a792cea0d8f0e2ee92f2bf8f6c3`
- New Jersey `sha256:6aae90e88c656e664717442a32009e7010b71c378838690651242de3e37f43c3`
- Recovery Fund cohort `sha256:b471e74ed85eb4ae681687c3ef4a9b484f5e8fda8c478b6850fa196c1eba1557`
- provenance `sha256:2dfc1c162a1e0d115ff86484d26c3da30db089d8745ebcfacec2f38685379596`
- batches `sha256:6949a6af5e099f294f4a1044c2f9be27c93071a918e6a63902e908831b600645`

## Transaction and lock design

Production remains opt-in through explicit `--execute` plus exact manifest, row-count, and zero-current-RF gates. The executor uses one REPEATABLE READ transaction, a transaction-scoped advisory lock for `fl_dbpr:contractor_disc_rf`, `lock_timeout=5s`, and `statement_timeout=120s`. It revalidates exact pre-state counts/fingerprints and all manifest collisions, then locks only the 49 approved license targets `FOR KEY SHARE` and verifies their external keys.

When `--manifest-input` is supplied, the approved committed manifest is bound before collision checks, target validation, predicted fingerprints, reverse-manifest derivation, or execution. A fresh official re-download still independently verifies every byte checksum, schema, source payload, semantic partition, and resolver result. The local filesystem modification/download time is audit metadata rather than source identity, so timestamp-only differences do not redefine the approved cohort. The approved manifest's `downloaded_at` values remain the controlled provenance snapshot timestamps used for batch extraction and observation/occurrence timing; an eventual production audit records its fresh retrieval time separately. Any checksum, schema, content, or resolver drift still fails closed.

The only write statements insert into ingest batches, actions, observations, and occurrences. There are no updates, deletes, conflict updates, generic-loader calls, periodic commits, contractor/entity/contact/address changes, publication mutations, or scoring paths. After 5,042 inserts, actual combined counts, RF cohort identity, provenance/hash/key coverage, fiscal counts, and all eight actual database fingerprints must match before the sole commit. Any failure rolls back the whole transaction.

## Public-read and scoring isolation

Recovery Fund rows remain `INTERNAL`, null-contractor, and absent from profiles, discovery, adverse-history queries, warnings, badges, Trust Score, ranking, and search ordering. The public gate is currently absent/off. Tests also prove that gate-on rows with null contractor and INTERNAL state remain excluded. Even explicit suspension details remain internal until a separate dataset-aware publication policy is approved.

## Refresh and rollback

An unchanged file/checksum produces no batch or occurrence. An exact observation in a genuinely new snapshot produces an occurrence only. A material change in the same logical group produces a new `REVISION_REVIEW_REQUIRED` observation while preserving old evidence, with no identity escalation or automatic supersession. A missing prior row is retained and investigated; automatic deletion is prohibited.

The prospective rollback order, only if separately authorized after future execution, is occurrences, observations, new Recovery Fund actions, then five Recovery Fund batches. It never targets licensed, ULA, Arizona, or New Jersey evidence.

## Production execution — 2026-08-24

The approved controlled ingestion executed from merged main `3fa275d5937fc48cd63390da93e76b31c0516f68` in one transaction from `2026-08-24T19:07:02.9063447Z` through `2026-08-24T19:07:26.1794151Z`. It inserted exactly 5,042 rows: five batches, 1,679 Recovery Fund details, 1,679 source observations, and 1,679 source occurrences.

The committed execution manifest `sha256:b706e61f7fedbf1f9af91ac55c207d3b5eb51f9a0417bf40e90bfc00fefa7b02` remained authoritative. Fresh execution-day retrieval timestamps were recorded separately and did not replace the approved provenance snapshot timestamps. The resulting cohort has 104 safe license links across 49 licenses, zero contractor links, zero `PUBLIC_ELIGIBLE` rows, and zero scoring impact.

Independent post-commit verification matched all eight approved fingerprints and confirmed licensed, ULA, Arizona, New Jersey, contractor, license, entity, contact, and canonical-address data remained unchanged. Automatic rollback remains unauthorized; the reverse manifest is retained only for separately authorized emergency reconciliation.
