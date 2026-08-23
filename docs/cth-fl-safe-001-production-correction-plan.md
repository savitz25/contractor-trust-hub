# CTH-FL-SAFE-001 — Production Correction Plan (Not Executed)

This document is a future mutation plan. It does not authorize or perform production changes.

## Read-only classification

| Category | Rows | Meaning |
|---|---:|---|
| SAFE KEEP | 496 | Current `license_id` agrees with the authoritative resolver |
| CORRECTABLE | 88 | Current link differs and one exact/deterministic replacement exists |
| REVIEW REQUIRED | 376 | Identifier/type evidence conflicts or cannot safely select one credential |
| UNRESOLVED | 581 | No current credential exists; includes 27 linked rows and all 554 unattached rows |
| **Total** | **1,541** | Reconciled production population |

The prior 491 type-conflicting linked rows reconcile as 88 correctable + 376 review-required + 27 unresolved. The 68 deterministic full-key conflicts from STATE-001 are a subset of the 88 correctable rows; the other 20 resolve through unique official type/board/number evidence where stored external-key representation differs.

## Proposed controlled execution

CTH-FL-SAFE-002 should run only after explicit approval:

1. Apply migration 008 and verify all existing rows default to `UNRESOLVED / INTERNAL`.
2. Re-run the dry-run in a fresh repeatable-read snapshot and require the same reconciliations or explain production drift.
3. Lock the bounded target rows and compare each current value to the manifest's expected old `license_id` (optimistic concurrency guard).
4. Update only the 496 SAFE KEEP and 88 CORRECTABLE rows with resolver metadata; change `license_id` only for the 88 CORRECTABLE rows.
5. Detach or alter none of the 376 review-required or 581 unresolved rows without a separately approved decision. Existing unsafe IDs may be held internally pending that decision.
6. Keep every row `INTERNAL`; do not populate `contractor_id` as part of identity correction.
7. Reconcile row counts, old/new IDs, resolver version, audit log, and zero public exposure before commit.
8. Roll back the transaction on any stale old ID, duplicate target, count drift, or constraint failure.

## Correction manifest

`artifacts/cth-fl-safe-001-resolution-dry-run.json` contains `correction_manifest`, bounded to 88 rows. Each entry contains only:

- stable discipline UUID and external key
- expected old license UUID
- proposed license UUID and external key
- resolver version

It intentionally excludes respondent names, addresses, complaint numbers, source payloads, and consumer PII. The manifest is a review input, not an executable migration.

## Publication remains separate

Even after a corrected license link, a row remains `INTERNAL`. A later publication evaluation must validate license-to-contractor identity, regulatory semantics, provenance, freshness, conflicts, and correction/retraction holds. Neither `license_id` nor `contractor_id` independently permits publication.

## Rollback approach

The future correction transaction must record old and new IDs and use a single bounded transaction. Before commit, a reverse manifest must be generated. If post-commit verification fails, apply the reverse manifest under a separately approved transaction and restore all rows to `INTERNAL` with a correction hold.

`PRODUCTION CORRECTIONS EXECUTED: NO`
