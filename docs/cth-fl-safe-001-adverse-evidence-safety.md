# CTH-FL-SAFE-001 — Adverse-Evidence Identity and Publication Safety

## Scope and invariant

This change implements the prerequisite safety contract for Florida DBPR regulatory evidence. It does not apply the migration, relink production rows, add contractor links, publish evidence, ingest additional files, or deploy.

The non-negotiable invariant is: **numeric license core alone and respondent name alone can never automatically link adverse evidence.** License linkage, contractor linkage, and publication are three separate decisions.

## Versioned credential identity

The source-of-truth dictionary is `ingest/regulatory/fl_dbpr_license_types.v1.json`, version `2026-08-23.v1`. It records the 12 exact official mappings and the deterministic `Construction Financial Officer → FRO` mapping, with DBPR reference and review date. Unknown labels fail closed as `REVIEW_REQUIRED`.

`ingest/regulatory/fl_dbpr_identity.py` resolves only official source fields against the DBPR license inventory:

1. `EXACT`: a recognized exact-official type prefix plus normalized source number equals one `licenses.external_key`.
2. `DETERMINISTIC`: the FRO mapping resolves a unique full key, or exact type/board/number selects one license when its stored external-key representation differs.
3. `REVIEW_REQUIRED`: unknown type, duplicates, board conflict, multiple typed candidates, or type/identifier conflict.
4. `UNRESOLVED`: missing/unparseable credential, no current credential, or respondent-only ULA.

The resolver deliberately discards `respondent_name` for identity. Numeric candidates are inspected only to identify a conflict and force review; they are never returned as a proposed link.

## Loader contract

`scripts/load_fl_dbpr_to_postgres.py` now builds a complete credential inventory and invokes the resolver for every regulatory row. Only `EXACT` and `DETERMINISTIC` outcomes may populate `license_id`. Review/unresolved rows remain unattached. The loader always leaves `contractor_id` null and writes `publication_state='INTERNAL'`.

The legacy numeric dictionary has been removed. The loader now depends on migration 008 and will fail loudly against a schema without the safety columns. It was not run in this task.

## Identity and publication schema

Migration `008_fl_adverse_evidence_safety.sql` is additive and defaults existing rows to:

- `identity_state='UNRESOLVED'`
- `publication_state='INTERNAL'`
- no evaluated identity, publication evidence, or public eligibility

Identity metadata retains method, resolver version, resolved external key, evidence, evaluation time, and review reason without overwriting source identifiers. Publication metadata retains evidence, evaluation time, withheld reason, correction hold, and retraction hold.

The database constraint rejects `PUBLIC_ELIGIBLE` unless identity is exact/deterministic, license and contractor are present, provenance timestamps/batch exist, evaluation occurred, and no hold is active. Reversal SQL is documented in the migration; reversing discards safety metadata and must follow application rollback.

## Publication gate

`lib/regulatory/publication.ts` contains the shared fail-closed predicate and eligibility evaluation. Eligibility requires:

- authoritative source
- exact/deterministic identity
- valid license-to-contractor relationship
- recognized regulatory semantics
- complete provenance
- acceptable freshness
- no identifier conflict
- no correction/retraction hold

Application detail, search, discovery, Florida browse, and planning paths now require Florida DBPR rows to have explicit `PUBLIC_ELIGIBLE`, safe identity, both IDs, and no hold. A non-null `contractor_id` alone is insufficient. Until `REGULATORY_PUBLICATION_GATE_V1=1` is deliberately enabled after migration/backfill, the shared SQL predicate excludes `fl_dbpr` rows without referencing new columns. This preserves compatibility with the current schema, guarantees zero Florida exposure, and leaves non-Florida regulatory behavior unchanged.

Complaint, classification, disposition, discipline description, final order, ULA, and Recovery Fund claim remain distinct concepts. A complaint number or blank disposition cannot independently pass the semantics gate. ULA remains respondent evidence without an authoritative identity anchor.

## Deployment contract

These steps must be separately approved and executed in order:

1. Apply additive migration 008. Existing rows become `UNRESOLVED / INTERNAL` and remain non-public.
2. Run and review the resolver backfill/correction transaction under CTH-FL-SAFE-002; verify counts before commit.
3. Populate publication eligibility only through a semantics/provenance review; do not conflate identity resolution with publication.
4. Deploy the gated application read paths with the feature flag still absent/off; verify zero exposure.
5. Set `REGULATORY_PUBLICATION_GATE_V1=1` and deploy only after schema/backfill and publication review are complete.
6. Verify profile/search/discovery exposure, holds, correction behavior, and zero unintended adverse exposure.

Deploying the read paths or Florida loader before migration 008 is incompatible and prohibited. No production step above occurred in SAFE-001.

## Dry-run result

The production audit used one `REPEATABLE READ READ ONLY` transaction, a 30-second statement timeout, and rollback. It evaluated 1,541 rows:

| Identity state | Rows |
|---|---:|
| EXACT | 523 |
| DETERMINISTIC | 61 |
| REVIEW_REQUIRED | 376 |
| UNRESOLVED | 581 |

Existing 987 links partition into 496 agreeing, 88 safely correctable conflicts, 376 review-required, and 27 unresolved. The last three groups total the prior 491 type-conflicting links. All 554 unattached rows remain unresolved.

Collision-exposed rows partition into 121 exact, 36 deterministic, and 37 review-required. Of the 157 safe resolutions, 69 current links agree and 88 differ. No collision row is automatically resolved from numeric core alone.

The machine-readable result and bounded 88-row correction manifest are in `artifacts/cth-fl-safe-001-resolution-dry-run.json`. It contains stable record/license IDs and no respondent names, addresses, complaint numbers, or raw payloads.

## Contact architecture boundary

This change does not implement contact observations and makes no contact-cardinality assumptions. Future architecture must preserve second and subsequent emails, phones, named contacts, titles, addresses, locations, source records, and provenance as separate observations.

## Safety outcome

- Current production contractor-linked Florida regulatory rows: 0
- Current public adverse exposure: 0
- Production mutation: NO
- Regulatory link correction: NO
- New regulatory ingestion: NO
- Google calls: 0
- County/municipal work: 0
