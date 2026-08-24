# CTH-FL-SAFE-002B-DRY Post-Migration Identity Correction Review

## Executive result

The production dry run completed read-only against a repeatable-read snapshot
at `2026-08-24T00:11:33.552894+00:00`. The fresh resolver results and the
88-row correction manifest exactly match SAFE-001. No production mutation,
relationship change, ingestion, or publication occurred.

## Production snapshot

- Main SHA: `9e5bc61f060610712cf081ded54a53ec0a101187`
- PostgreSQL: 17.6
- Migration 008: applied; 13 safety columns present
- Required constraints: four present and valid
- Florida partial publication index: present and correctly scoped
- Publication feature gate: absent/OFF
- Florida rows: 1,541
- Current license-linked: 987
- Current contractor-linked: 0
- Fully unattached: 554
- Stored identity state: 1,541 UNRESOLVED
- Stored publication state: 1,541 INTERNAL; 0 PUBLIC_ELIGIBLE
- Holds: all 1,541 correction and retraction holds false
- Current public adverse exposure: 0

The shared table remains isolated correctly: 459 `az_roc` and 1,134
`nj_enforcement` rows have NULL Florida-v1 identity, publication, and hold
metadata. They are excluded from this analysis.

## Fresh authoritative resolution

| Outcome | Rows |
|---|---:|
| EXACT | 523 |
| DETERMINISTIC | 61 |
| REVIEW_REQUIRED | 376 |
| UNRESOLVED | 581 |
| **Total** | **1,541** |

These counts equal SAFE-001. There is no production, resolver, license-table,
source-data, or prior-audit delta.

## Current linked and unattached classifications

Of 987 currently license-linked rows:

| Category | Rows |
|---|---:|
| SAFE_KEEP | 496 |
| CORRECTABLE | 88 |
| REVIEW_REQUIRED | 376 |
| UNRESOLVED | 27 |

SAFE_KEEP contains 459 EXACT and 37 DETERMINISTIC rows. CORRECTABLE contains
64 EXACT and 24 DETERMINISTIC rows. SAFE_KEEP proposes no relationship change.

All 554 rows with neither `license_id` nor `contractor_id` remain UNRESOLVED.
None is exact, deterministic, or review-required under the current official
credential resolver. Name matching was not attempted.

## Numeric-core collision reconciliation

The collision-exposed population remains 194:

- Safely disambiguated by authoritative type plus number: 157
  - EXACT: 121
  - DETERMINISTIC: 36
- Current link agrees: 69
- Current link conflicts with the unique authoritative result: 88
- REVIEW_REQUIRED: 37
- UNRESOLVED: 0

Numeric-core-only matching is not used and cannot produce an automatic link.
Name-only matching likewise cannot produce an automatic adverse-evidence link.

## Correctable manifest comparison

The canonical fingerprint covers sorted discipline row ID, expected current
license ID, and proposed license ID.

| Measure | Result |
|---|---|
| SAFE-001 count | 88 |
| Fresh count | 88 |
| Exact discipline row set | MATCH |
| Expected current license IDs | MATCH |
| Proposed replacement license IDs | MATCH |
| Added rows | 0 |
| Removed rows | 0 |
| Changed replacements | 0 |
| Stale expected-current IDs | 0 |
| Old fingerprint | `sha256:be4ff31eac2c732d2207ee7a6cb7601c7bd62f9905e72e156526a2af378812bd` |
| New fingerprint | `sha256:be4ff31eac2c732d2207ee7a6cb7601c7bd62f9905e72e156526a2af378812bd` |

The new manifest contains stable identifiers and resolver metadata only. It
contains no respondent names, addresses, complaint narratives, raw payloads,
or consumer PII.

## Review and unresolved safety treatment

### REVIEW_REQUIRED — 376 linked rows

All have numeric candidates, but none agrees with the authoritative official
type mapping. A future transaction should retain the current `license_id`, set
`identity_state='REVIEW_REQUIRED'`, keep `publication_state='INTERNAL'`, and set
`correction_hold=TRUE`. They must not publish or be automatically relinked.

### Linked UNRESOLVED — 27 rows

No corresponding credential exists in the current DBPR license inventory. The
existing link is unverifiable, not deterministically proven wrong. A future
transaction should retain the relationship, set `identity_state='UNRESOLVED'`,
keep `publication_state='INTERNAL'`, and set `correction_hold=TRUE`.
Detachment requires a separate bounded manual approval and is not proposed by
SAFE-002B.

### Unattached UNRESOLVED — 554 rows

No corresponding credential exists in the current inventory. These rows should
remain unattached with `identity_state='UNRESOLVED'` and
`publication_state='INTERNAL'`. A correction hold is unnecessary because no
relationship exists to freeze; retain `correction_hold=FALSE`. Do not infer a
credential or contractor from a name.

## Proposed controlled SAFE-002B mutation

All proposed rows are `source_system='fl_dbpr'`; proposed non-Florida mutations
are zero.

| Category | Rows | Relationship action | Metadata action |
|---|---:|---|---|
| SAFE_KEEP | 496 | None | Store exact/deterministic resolver result; INTERNAL |
| CORRECTABLE | 88 | Replace expected old `license_id` with unique proposed ID | Store resolver result; INTERNAL |
| REVIEW_REQUIRED | 376 | None | REVIEW_REQUIRED; INTERNAL; correction hold true |
| Linked UNRESOLVED | 27 | None | UNRESOLVED; INTERNAL; correction hold true |
| Unattached UNRESOLVED | 554 | None | UNRESOLVED; INTERNAL; correction hold false |

Proposed contractor ID mutations: 0. Proposed detachments: 0. Rows becoming
PUBLIC_ELIGIBLE: 0. The publication feature gate remains OFF, so expected
public adverse exposure before and after remains zero.

## Transaction and rollback contract

The future execution must:

1. Verify the exact main SHA, resolver/dictionary versions, production safety
   baseline, category counts, and manifest fingerprint.
2. Begin one transaction with an approximately five-second lock timeout and a
   bounded statement timeout.
3. Generate and durably record the reverse manifest before commit. For each of
   88 corrections it must contain discipline row ID, old license ID, and new
   license ID.
4. Apply every relationship correction with optimistic concurrency:
   `WHERE id=target_id AND license_id=expected_old_license_id AND
   source_system='fl_dbpr'`.
5. Require exactly one affected row per manifest entry. Any stale row, missing
   row, count delta, or category drift rolls back the entire transaction.
6. Update safety metadata without changing `contractor_id`; retain every row as
   INTERNAL and keep PUBLIC_ELIGIBLE at zero.
7. Before commit, prove relationship changes equal only the 88 approved pairs,
   contractor ID changes are zero, non-Florida changes are zero, all category
   counts reconcile, and reverse-manifest fingerprint is stable.
8. Commit only after all invariants pass, then independently verify using a new
   read-only connection.

Rollback after commit, if separately authorized, must use the recorded reverse
manifest with symmetric optimistic guards requiring each current license ID to
equal the previously proposed new ID. It must never infer reversal targets.

## Scope assurances

- Production mutations in this task: 0
- License ID changes: 0
- Contractor ID changes: 0
- PUBLIC_ELIGIBLE rows: 0
- Regulatory ingestion: 0
- Google calls: 0
- County work: 0
- Contact enrichment: none

Future contact work must continue to preserve multiple provenance-bearing
emails, phones, contact names, roles/titles, addresses, and locations rather
than collapsing observations into a single value.
