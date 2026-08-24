# CTH-FL-STATE-006A — Controlled Florida DFS Stop-Work Ingestion Architecture

## Accepted source snapshot

The official Florida DFS Division of Workers’ Compensation all-employer report was retrieved once on 2026-08-24 at 20:09:45.980409 UTC. It contains 48,260 displayed rows, 48,254 unique exact observations, and six additional identical appearances. Its raw SHA-256 is `fa40871e338dd97e0c8ca2b14bf13b61e3c1b6751a2d582bc25ba8585014d13b` and its normalized table fingerprint is `sha256:393817d6bff052e461d1eddb0bd5df50a2f34f3d231a2c970882661d568c6e68`.

The raw wrapper hash differs from planning while byte size, schema, row counts, multiplicity, reasons, and date shapes remain unchanged. This is accepted as an expected daily/generated-HTML delta. The architecture snapshot is the newly retrieved file. Future no-op decisions use the normalized table fingerprint, while raw SHA remains audit provenance.

## Parser and exact contracts

The incremental `HTMLParser` reads 1 MiB chunks, hashes as it reads, and retains parsed rows rather than an 80 MB DOM. It requires exactly one header with these ordered fields: Employer Name, County, City, Date Served, Date Ended*, Date Reinstated**, Reason. Malformed shapes, missing/duplicate headers, unknown reasons, blank fields, invalid UTF-8, and unsupported dates fail closed.

`source-observation-key-v2` hashes the exact ordered seven-field row. `logical-matter-detail-key-v1` uses Employer Name, County, City, Date Served, and Reason only as review/grouping metadata. It never authorizes identity, deduplication, linkage, publication, or supersession.

The normalized snapshot algorithm counts every source-observation key, sorts `[key,multiplicity]` pairs, serializes them as compact JSON, and SHA-256 hashes those bytes. It ignores row order and HTML wrapper layout while detecting additions, removals, field changes, and duplicate-multiplicity changes.

## Grain and duplicate appearances

One `discipline_action` and one source observation represent each unique exact seven-field assertion: 48,254 each. Each displayed appearance becomes an occurrence: 48,260. For duplicate exact rows, deterministic ordinals `1..N` are assigned within the observation/snapshot multiset. Occurrence UUIDv5 identity includes observation key, batch ID, and ordinal, so reordering cannot change identity. No DFS order number is invented.

## Identity and semantic safety

The bulk result exposes no order, case, employer, FEIN, DFS, Sunbiz, DBPR, DOAH, or final-order identifier. All 48,254 initial actions are `UNRESOLVED` using `NO_OFFICIAL_IDENTITY_IDENTIFIER` and `fl-dfs-stop-work-identity-v1`; `license_id`, `contractor_id`, and `resolved_license_external_key` remain null. Names and locations never create candidate identities.

Date Served is mapped exactly to `entered_date`; Employer Name to `respondent_name`; Reason to `discipline_description`; City and County to their compatible location columns. Classification, complaint, credential, disposition, disposition date, violation, street/state/postal, and penalty fields remain null. The exact seven-field assertion is retained in `raw_payload` and migration-009 `source_payload`.

Date Served does not establish current active status. Date Ended establishes only the ambiguous DFS ending semantics and does not prove full payment or generic compliance. Date Reinstated does not establish current active status. Source reasons are retained verbatim and are not rewritten as current uninsured status or fraud.

## Compact manifest and reconciliation

The compact manifest is approximately 6.5 MB and contains the immutable snapshot envelope, sorted observation-key/multiplicity pairs, aggregate identity/insert counts, deterministic ID fingerprints, batch ID, and manifest fingerprint. Fresh accepted source rows regenerate row fingerprints, logical keys, action/observation/occurrence UUIDs, and exact source payloads. Two passes and reversed source order reproduce identical execution identity.

The compact reverse manifest records the approved manifest fingerprint, deterministic ID derivation, cohort ID fingerprints, batch ID, counts, and rollback order. Automatic rollback is not authorized.

## Transaction and refresh

The dedicated executor defaults to dry-run and requires explicit `--execute`, an approved manifest, and its exact fingerprint. A future execution uses one `REPEATABLE READ` transaction, a `fl_dfs:workers_comp_stop_work` advisory transaction lock, 5-second lock timeout, 180-second statement timeout, collision gates, exact baseline/fingerprint gates, insert-only writes, and actual post-state/fingerprint validation before commit. Failure rolls back the whole transaction; ambiguous commits are not retried.

An unchanged normalized snapshot is a no-op. A new accepted snapshot adds occurrences for re-seen exact observations, actions/observations for new exact facts, and revision-review relationships only for logically related changed facts. Missing prior facts remain immutable history; there is no automatic delete, retraction, or supersession.

## Publication and scoring

All rows remain `INTERNAL`; `PUBLIC_ELIGIBLE`, Trust Score, ranking, profile, discovery, badges, warnings, and generic adverse-history exposure remain zero. This remains true even if the generic Florida regulatory gate is enabled. A later dataset-specific policy is required before any public presentation.

## Future DFS enrichment

The separate unsent public-records request asks for stable order/case/employer identifiers, FEIN, penalty semantics, DOAH/final-order references, status history, documents, and a data dictionary. Any returned identifiers require a separately reviewed deterministic enrichment. Existing evidence IDs remain stable; identity improvement attaches authoritative evidence rather than replacing source facts.

No migration is required. Migrations 008 and 009 remain immutable.
