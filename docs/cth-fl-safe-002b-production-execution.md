# CTH-FL-SAFE-002B Controlled Production Identity Correction

## Result

The controlled Florida regulatory identity backfill completed successfully on
2026-08-24 UTC. Exactly 88 canonical `license_id` replacements were applied;
all other relationship changes were zero. Every Florida row remains INTERNAL,
the publication feature gate remains OFF, and public Florida adverse exposure
remains zero.

## Execution identity

- Main/execution SHA: `25a5d998ccb46aed7fac4bf878dec91e1522dc0d`
- PostgreSQL: 17.6
- Migration 008: applied and immutable
- Canonical correction count: 88
- Canonical manifest fingerprint: `sha256:be4ff31eac2c732d2207ee7a6cb7601c7bd62f9905e72e156526a2af378812bd`
- Reverse manifest fingerprint: `sha256:ac285218213e1012ba7e9a1a03442f55e4d6dbe4cb957772ebe489f83e4b94fd`
- Transaction started: `2026-08-24T02:40:33.662349+00:00`
- Transaction committed: `2026-08-24T02:42:06.542590+00:00`
- Independent verification: `2026-08-24T02:42:11.486044+00:00`
- Lock timeout: 5 seconds
- Statement timeout: 120 seconds
- Florida rows locked: 1,541
- Manifest reverified after lock: YES
- Rollback required: NO

## Pre-state

Before the transaction all 1,541 Florida rows were UNRESOLVED and INTERNAL.
All correction/retraction holds were false. Relationships were 987
license-linked, 0 contractor-linked, and 554 with neither relationship.

The fresh resolver and canonical manifest both reconciled before any write:

| Resolver outcome | Rows |
|---|---:|
| EXACT | 523 |
| DETERMINISTIC | 61 |
| REVIEW_REQUIRED | 376 |
| UNRESOLVED | 581 |

The canonical 88 targets all existed as unique `fl_dbpr` credentials with the
exact approved IDs and external keys. The resolver selected every target using
official type plus license number; no numeric-core-only or name match was used.

## Applied partition

| Category | Rows updated | Relationship change |
|---|---:|---|
| SAFE_KEEP | 496 | None |
| CORRECTABLE | 88 | Exact approved old-to-new `license_id` replacement |
| REVIEW_REQUIRED | 376 | None |
| Linked UNRESOLVED | 27 | None; relationship frozen, not endorsed |
| Unattached UNRESOLVED | 554 | None; remained unattached |

Each row used an optimistic guard on ID, `source_system='fl_dbpr'`, expected
current `license_id`, null `contractor_id`, and INTERNAL publication state.
Every guard affected exactly one row. The transaction did not change
`discipline_actions.updated_at`, contractor IDs, publication evidence, or
publication evaluation timestamps.

## Post-state

| Identity state | Rows |
|---|---:|
| EXACT | 523 |
| DETERMINISTIC | 61 |
| REVIEW_REQUIRED | 376 |
| UNRESOLVED | 581 |

| Publication/hold state | Rows |
|---|---:|
| INTERNAL | 1,541 |
| PUBLIC_ELIGIBLE | 0 |
| WITHHELD | 0 |
| correction_hold TRUE | 403 |
| correction_hold FALSE | 1,138 |
| retraction_hold TRUE | 0 |
| retraction_hold FALSE | 1,541 |

Relationships remain 987 license-linked, 0 contractor-linked, and 554 with
neither. Exactly 88 approved license relationships changed. Detachments,
SAFE_KEEP relationship changes, review/unresolved relationship changes, and
unexpected relationship changes were all zero.

The independent post-commit resolver classified all 584 exact/deterministic
linked rows as agreeing with their authoritative credential. Remaining
CORRECTABLE rows: 0.

## Relationship fingerprints

| Scope | Pre | Predicted/actual post |
|---|---|---|
| Whole table | `sha256:9cc3d5aa52819feaa35c86a083071e1e860e65d29e705905358b4eb36f20e0c4` | `sha256:88ebcbe5cb68cba50c928cafb79628181e0cff95cc227298f6f0ae709f6e626f` |
| Florida | `sha256:d698f6c4a1887decf3f3dfb128f2020f7d1804394c8e58ec3c05174325422475` | `sha256:23e83fd0b09dab19fda11ef9ebf5beef23c2fd333ce3522389eda4f15e21ecd8` |
| Arizona | `sha256:f7316a640891009e8a6f671fb0c9088c18308ae7212ca1d0c20c543266b58b02` | unchanged |
| New Jersey | `sha256:a319948c6760227eb9c1180ee2e4adce3025b901b2b562df71904d6c55af3dbf` | unchanged |

Predicted and actual whole/Florida post fingerprints matched exactly.
Arizona, New Jersey, and all other non-Florida affected rows: 0.

## Publication and production health

- `REGULATORY_PUBLICATION_GATE_V1`: absent/OFF
- Florida contractor-linked rows: 0
- Florida PUBLIC_ELIGIBLE rows: 0
- Publicly reachable Florida adverse rows: 0
- Homepage: HTTP 200
- Florida landing, discovery, and two bounded profiles: HTTP 200
- Arizona landing and bounded profile: HTTP 200
- Verify and bounded New Jersey profile: HTTP 200
- Database/query errors observed: none
- Manual deployment: NO

## Reverse manifest and rollback design

The reverse manifest was generated before the write transaction from the
canonical approved manifest. It contains only discipline row ID, old license
ID, and new license ID. It is an audit/recovery input, not authorization to
roll back.

Any later rollback requires separate approval and must use one bounded
transaction with symmetric optimistic guards requiring each row's current
license ID to equal the recorded new ID. Any stale row or count mismatch must
roll back the entire reversal. Metadata reversal policy must be reviewed at
that time; no automatic rollback is authorized.

## Scope confirmation

- Contractor ID changes: 0
- New regulatory ingestion: 0
- Publication enabled: NO
- Google calls: 0
- County work: 0
- Migration 008 changed: NO
