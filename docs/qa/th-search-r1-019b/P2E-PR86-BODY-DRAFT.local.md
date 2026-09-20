<!-- LOCAL DRAFT ONLY. NOT PUBLISHED. PR #86's body and branch are unchanged. Publish only on owner instruction. -->

# TH-SEARCH-R1-019B — Contractor name-candidate operation (DRAFT — BLOCKED pending Production index transition)

## Status
**BLOCKED — do not merge.** The runtime code is reviewed and locally green; release is gated on a
Production index transition that has been prepared and rehearsed but **not authorized or executed**.

## What this PR adds
`contractor-name-candidates-v1`: a callable name-candidate operation over the ONE shared name-matching core
also used by native Verify search. Tiered retrieval (strong = equals/starts-with, token = every word),
truthful completeness states, failure never reported as a miss, explicit jurisdiction, 200-row source cap
with working continuation. Legacy v2 contract, fingerprints and pins untouched.

## Infrastructure history (Production, this unreleased ticket sequence only)
1. **Phase 1 — live.** Five `*_nameorder_idx` B-trees (`text_pattern_ops`) on the normalized-name expression.
   Measured clean: frozen holdout 51/60 FOUND_PAGE_1, 9/60 SOURCE_ERROR; Allied / stilw ≈1–2 s.
2. **Original Phase 2 — live, and the cause of a planner regression.** Five `*_namewords_idx` GINs were built
   on the *same* bare expression. Plain `EXPLAIN` shows the planner then serving most strong-tier prefix
   branches from the GIN indexes instead of the Phase-1 B-trees.
3. **Regression confirmed in isolation** (fresh runtime, nothing concurrent, two runs): 8/9 then 9/9 named
   cases SOURCE_FAILURE at ~6–7 s, including Allied and stilw. An earlier 7/60 holdout figure was taken under
   concurrent local test load and is not cited as evidence. *Observed:* the planner's index choice. *Not
   established:* cache/`shared_buffers`/footprint explanations, or that GIN is inherently unsuitable.
4. **P2D structural correction prepared** (`th-search-r1-019b-p2d-access-path` @ `c6d3435`): the token tier's
   access path and its GIN indexes move to a value-identical but syntactically distinct expression
   `(normalized || '')`; the strong tier stays on the bare expression. PostgreSQL matches expression indexes
   syntactically, so neither tier can be served by the other's index family. Semantic predicate, rank SQL,
   publication gate, jurisdiction handling unchanged. Runtime diff: `lib/contractors/name-search-core.ts`
   only (+23/−2). 20/20 focused tests; 17/17 existing + 6/6 new mutations detected, byte-identical restore.
   A range-operator alternative was tested and rejected (GIN's operator family serves `~~` regardless; no
   provably safe exclusive upper bound exists for unbounded non-ASCII names).
5. **Production transition — pending authorization.** Build five replacement GINs under temporary names
   (fail-closed, no `IF NOT EXISTS`) → verify → separately authorized retirement of the five old bare GINs →
   rename to canonical → prove strong→B-tree / token→GIN and re-measure with this PR still undeployed → only
   then advance this PR. Packet: `docs/qa/th-search-r1-019b/P2E-TRANSITION-PACKET.md` (hashes inside).

## Not done
No merge, no deploy, no Ask change, no database setting change, no ANALYZE/VACUUM. Release readiness will be
decided only from the Stage E measurements on the final index shape.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
