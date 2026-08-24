# CTH-FL-STATE-003 ULA controlled ingestion architecture

Status: architecture and exact production dry run only. Production mutations, ULA rows ingested, contractor/license links, publication changes, DOAH enrichment, and contact promotion are all zero.

## Evidence and identity policy

Florida DBPR `contractor_disc_ula` is standalone regulatory evidence. Its complaint number identifies a matter, not a respondent. The source supplies no credential, entity, FEI/Sunbiz, respondent, citation, final-order, or DOAH identifier capable of establishing respondent identity. Consequently every initial row is `UNRESOLVED` using `NO_OFFICIAL_IDENTITY_IDENTIFIER` and policy version `fl-dbpr-ula-identity-v1`.

All 11,691 proposed actions have `license_id`, `contractor_id`, and `resolved_license_external_key` null; `publication_state=INTERNAL`; correction and retraction holds false. The stable review reason is `ULA_SOURCE_HAS_NO_AUTHORITATIVE_RESPONDENT_IDENTIFIER`. Identity evidence records only the absence of an authoritative identifier and the prohibition on name/address matching.

The 113 exact-name/full-address review-opportunity matters (246 rows; 95 unique and 18 ambiguous matters) remain aggregate planning statistics. They are not `REVIEW_REQUIRED`, are not queried during ingestion, and contribute no candidate IDs to evidence. Name-only, address-only, fuzzy, numeric-fragment, Sunbiz, contractor, and license attachment are prohibited.

## Official corpus and field contract

The drift-gated corpus totals 11,691 parseable rows with no malformed rows, exact duplicate observations, cross-period revision candidates, or current production conflicts:

| Fiscal year | Rows | SHA-256 |
|---|---:|---|
| 2021-22 | 2,312 | `4f0ca3409686d5a1fe960e7ecf2c0cf0416d62e216d29c4bc371432846d07d1c` |
| 2022-23 | 2,631 | `2c03c334e3bcda679d689494c397f7166c205aa60d3d43c05c8cf875ee84cc7b` |
| 2023-24 | 2,568 | `a5036af5f02e85d12b9af3252d17368b71b4c7cd9fa5c6b9a57fafcd4d2dcddc` |
| 2024-25 | 2,338 | `06169ddf04e1911fc6414977924c3eea28d872899a5499f6d86c766813f22b15` |
| 2025-26 | 1,842 | `3e9a92d8340f2c0975e4204d31b6d83cbc5bf8a7eef36a85da11b30218e87c9a` |

The 16-column schema fingerprint is `sha256:b1eb7f0fca26ee6dfd36125a5d1a2b49b2d06177c8b1480a39135ffdc1549690`. `FL_ULA_FIELDS` preserves this official order: License Type, Respondent Name, three address lines, City, State, ZIP Code, County, Complaint Nbr, Classification, Entered Date, Disposition, Disposition Date, Discipline Date - Description, and Violation Code.

Exact identity uses `source-observation-key-v2` with `fl_dbpr`, `contractor_disc_ula`, and this dataset-specific field order. The key is row-position and download-time independent. It becomes the future `discipline_actions.external_key` and migration-009 observation identity. Exact payload and row fingerprint remain in immutable provenance.

`logical-matter-detail-key-v1` uses Complaint Nbr, License Type, Respondent Name, Classification, Entered Date, and Violation Code. It is review/grouping input only. It cannot authorize deduplication, supersession, identity/linkage, or publication. The 4,492 multi-line matters and their 11,486 detail rows remain distinct.

## Semantics

The audit-only deterministic crosswalk produces: complaint/investigation 614, citation 3,162, order 24, final order 7,852, dismissed 12, closed/administrative 15, insufficient evidence 12, other 0, and unknown 0. There are 2,691 final-order matters. Raw classifications, dispositions, descriptions, dates, and violation codes are preserved; no severity or wrongdoing field is created. No DOAH URL or linkage is manufactured.

## Insert-only execution design

The dedicated executor defaults to a repeatable-read, read-only dry run. A future write requires explicit `--execute` plus the exact manifest fingerprint, row count, and zero-current-ULA gates. It is hard-bound to `fl_dbpr/contractor_disc_ula`, never invokes the generic loader, and contains no update, delete, conflict-update, periodic commit, contractor/license lookup, publication mutation, address promotion, or contact path.

The proposed single transaction uses `REPEATABLE READ`, a 5-second lock timeout, and a bounded 180-second statement timeout. It inserts five source batches, 11,691 actions, 11,691 immutable observations, and 11,691 occurrences: 35,078 rows total. Before writes it must revalidate the corpus and approved manifest and prove ULA count zero plus absence of all IDs, source keys, and external keys. It does not lock the contractor or license universe.

Deterministic batch IDs are:

- 2021-22: `ac0975a8-e58d-5e57-9037-a94dd18a8034`
- 2022-23: `fdb6cf53-3279-5ea3-a921-6fa94160ee08`
- 2023-24: `2a2962b6-0982-5ece-8e18-5597f602ea53`
- 2024-25: `a18295a4-7a5f-5ad5-a825-c4f36fb80523`
- 2025-26: `82a99065-ce86-5548-8cc0-86eb67321a83`

The execution manifest fingerprint is `sha256:149f259afa14a5fb9d653128017bb8c3148f7628f0076b6b2c1c1d0f01ca0d73`. The reverse-manifest fingerprint is `sha256:12e45eb92796c989ea499a2c983a81ce1523510e4413eebc02bb865a9d1be2a1`. A rollback is not automatically authorized; if separately approved, its order is occurrences, observations, new ULA actions, then five ULA batches.

## Predicted post-state and fingerprints

The predicted whole action count is 19,741; Florida `fl_dbpr` is 18,148, including 11,691 ULA rows; observations and occurrences are 18,148 each; batches are 56. Florida identity becomes EXACT 1,736, DETERMINISTIC 236, REVIEW_REQUIRED 1,411, and UNRESOLVED 14,765. Relationships are 2,375 license-linked, zero contractor-linked, and 15,773 unattached. Correction holds are 403 true/17,745 false; retraction holds are zero true/18,148 false. All 18,148 remain INTERNAL and zero are PUBLIC_ELIGIBLE.

Predicted fingerprints are:

- whole relationships: `sha256:5bee9a5963aadb8ab58c7d16e6e9c508e320eecc1fe0a17b14ece673df80c940`
- Florida relationships: `sha256:3474cf0b86c6f9e816163244cdb1f9c86daa6479f7d703cea87b9dd4c02b7614`
- Florida safety: `sha256:d1a721ab16a24ee862b85056867f9bb75cfa0e100ae67caeb71eed0a7940721f`
- Arizona: `sha256:d5c456b2d6d60accef4f892ce2b95b1b23ca6a792cea0d8f0e2ee92f2bf8f6c3`
- New Jersey: `sha256:6aae90e88c656e664717442a32009e7010b71c378838690651242de3e37f43c3`
- ULA cohort: `sha256:6df200e2451bbcc2cc331476e5754399acb4b9f6481c321f18f35089a2835092`
- provenance: `sha256:52a9a11013a5c65f6ae2f90a2ce23ca20d5803c37150a75b2970308649c4d793`
- batches: `sha256:627aa32acced612818234e11b361c0cd518f1087fff2563fbe60726415cf5bcb`

The existing licensed cohort remains 6,457/6,457 with all observation keys, row fingerprints, and logical keys unchanged; 1,972/1,972 safe links agree and CORRECTABLE remains zero. Arizona and New Jersey fingerprints are unchanged.

## Publication, refresh, and boundaries

An unattached, unresolved INTERNAL ULA row fails the shared public SQL contract: the Florida gate is absent/off, and even when enabled the row lacks PUBLIC_ELIGIBLE state, exact/deterministic identity, contractor ID, and license ID. It cannot appear in profile, discovery, plan, or public regulatory results.

An exact row observed in a genuinely new snapshot reuses its observation and evidence action and creates only a new occurrence. An unchanged checksum rerun is a no-op with no batch or occurrence. A materially changed row in the same logical grouping creates a retained immutable observation in `REVISION_REVIEW_REQUIRED`; it is not automatically superseded, attached, or published. Missing rows are retained for review, never automatically deleted. Check the open fiscal year monthly and historical files quarterly; transition FY25-26 only after a checksum/delta review.

Official addresses remain evidence payload/provenance only. No canonical address, respondent contact, phone, email, website, entity, or Sunbiz link is created. Recovery Fund, workers compensation, exemptions, stop-work orders, county/city data, Google APIs, and DOAH document enrichment remain outside this task.
